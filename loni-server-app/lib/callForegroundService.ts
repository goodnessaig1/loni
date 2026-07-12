import notifee, { AndroidImportance, AndroidForegroundServiceType } from '@notifee/react-native';
import { Platform } from 'react-native';

/**
 * Issue 4 fix: "call does not continue when app is closed/backgrounded".
 *
 * Android aggressively suspends a backgrounded app's process (network,
 * CPU, and eventually the whole process) unless a foreground service with
 * a persistent, ongoing notification is running. `AudioSession` being
 * started (see lib/audioSession.ts) keeps the audio hardware active, but
 * without a foreground service Android can still kill the whole app
 * process shortly after backgrounding - which was `react-native-callkeep`'s
 * job (`selfManaged: true` + its own `foregroundService` config in
 * lib/callKeepService.ts), except CallKeep is currently disabled via the
 * `EXPO_PUBLIC_ENABLE_CALLKEEP` kill switch (repeated native crashes, see
 * CALL_SYSTEM_AUDIT.md) - meaning there was NO foreground service running
 * during a call at all, on either app, regardless of CallKeep's state.
 *
 * This uses notifee directly instead - already a stable, working
 * dependency in this project (unlike CallKeep) - to provide the same
 * survive-in-background guarantee independent of whether CallKeep ever
 * gets re-enabled.
 */

const TAG = '[ForegroundService]';
const CHANNEL_ID = 'active_call';
const NOTIFICATION_ID = 'active-call-service';

let serviceRegistered = false;
let isRunning = false;

/**
 * Must be called once, as early as possible (module scope in index.js,
 * before the app finishes bootstrapping) - notifee requires the runner to
 * be registered before `displayNotification({ asForegroundService: true })`
 * can actually start a service.
 */
export function registerCallForegroundService(): void {
  if (serviceRegistered || Platform.OS !== 'android') return;
  serviceRegistered = true;
  notifee.registerForegroundService(() => {
    console.log(TAG, 'runner started - process will stay alive until stopCallForegroundService() is called');
    return new Promise(() => {
      // Deliberately never resolves. stopCallForegroundService() below
      // calls notifee.stopForegroundService(), which is what actually
      // tears this down - not resolving this promise from in here.
    });
  });
}

/** Call once the call reaches CONNECTED (or ACCEPTED/CONNECTING - as soon
 * as there's real audio work happening worth protecting from being
 * suspended). Safe to call multiple times - no-ops if already running. */
export async function startCallForegroundService(title: string, body: string): Promise<void> {
  if (Platform.OS !== 'android' || isRunning) return;
  try {
    const channelId = await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Active Call',
      // LOW, not HIGH: this is a persistent status indicator ("a call is
      // using your microphone"), not an alert - it shouldn't make sound
      // or heads-up-pop over whatever the user is doing. The actual
      // incoming-call ring uses a separate, HIGH-importance channel
      // (see index.js's 'calls_v2' channel).
      importance: AndroidImportance.LOW,
    });

    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title,
      body,
      android: {
        channelId,
        asForegroundService: true,
        ongoing: true,
        // Deliberately omitting `smallIcon` - notifee falls back to the
        // app's own launcher icon correctly. Explicitly passing a name
        // here resolves it as a `drawable/` resource the same way
        // react-native-callkeep's `imageName` does (see
        // CALL_SYSTEM_AUDIT.md's "invalid drawable-resource crash") -
        // this project's icons only exist under mipmap-*/, so passing
        // one here would silently fail/crash the same way that did.
        foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE],
        pressAction: { id: 'default' },
      },
    });

    isRunning = true;
    console.log(TAG, 'Started - call will now survive the app being backgrounded/minimized');
  } catch (e) {
    console.error(TAG, 'Failed to start - call audio may be suspended if the app is backgrounded', e);
  }
}

/** Call the instant the call ends, for any reason - leaving this running
 * after a call ends is both a resource leak and a confusing permanent
 * notification (Issue 7 cleanup requirement). */
export async function stopCallForegroundService(): Promise<void> {
  if (Platform.OS !== 'android' || !isRunning) return;
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(NOTIFICATION_ID);
    console.log(TAG, 'Stopped and notification cleared');
  } catch (e) {
    console.error(TAG, 'Failed to stop cleanly', e);
  } finally {
    isRunning = false;
  }
}
