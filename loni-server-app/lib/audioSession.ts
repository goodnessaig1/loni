import { DeviceEventEmitter, EmitterSubscription, Platform } from 'react-native';
import { AudioSession } from '@livekit/react-native';

/**
 * Call audio has ONE owner: LiveKit's `AudioSession`.
 *
 * `AudioSession.startAudioSession()` must be called explicitly before connecting (it is what sets the
 * Android AudioManager to `inCommunication` and takes audio focus; `registerGlobals()` does not do
 * this on Android).
 *
 * `react-native-incall-manager` used to be started here as well. Its `start()` takes over the same
 * Android AudioManager (mode, focus, speakerphone, Bluetooth SCO) and the same iOS AVAudioSession,
 * so the two libraries fought over routing: Bluetooth falling back to the earpiece, speaker toggles
 * being reverted. It is now used only for what LiveKit does not do: ringtone/ringback sounds and the
 * proximity sensor (screen off at the ear). It is never `start()`ed during a call.
 *
 * Same file in mobile-app and loni-server-app - keep them identical.
 */

const TAG = '[AudioSession]';
let started = false;

/** Highest first: a connected headset always beats the earpiece; the speaker is opt-in. */
export const OUTPUT_PRIORITY = ['bluetooth', 'headset', 'earpiece', 'speaker'];

let currentOutput: string = 'earpiece';
let userPicked: string | null = null;
let proximitySub: EmitterSubscription | null = null;

function inCallManager(): any | null {
  try {
    return require('react-native-incall-manager').default;
  } catch {
    return null;
  }
}

function startProximity() {
  const icm = inCallManager();
  if (!icm) return;
  try {
    icm.setKeepScreenOn(true);
    icm.startProximitySensor();
    if (Platform.OS === 'android' && !proximitySub) {
      // iOS blanks the screen itself once proximity monitoring is on; Android needs telling, and only
      // when the call is on the earpiece (not with the phone on the table on speaker).
      proximitySub = DeviceEventEmitter.addListener('Proximity', (e: { isNear?: boolean }) => {
        if (e?.isNear && currentOutput === 'earpiece') icm.turnScreenOff();
        else icm.turnScreenOn();
      });
    }
  } catch (e) {
    console.warn(TAG, 'proximity sensor unavailable', e);
  }
}

function stopProximity() {
  proximitySub?.remove();
  proximitySub = null;
  const icm = inCallManager();
  if (!icm) return;
  try {
    icm.stopProximitySensor();
    icm.turnScreenOn();
    icm.setKeepScreenOn(false);
  } catch { /* nothing to undo */ }
}

export async function startCallAudioSession(): Promise<boolean> {
  if (started) return true;
  try {
    await AudioSession.configureAudio({
      android: {
        preferredOutputList: OUTPUT_PRIORITY as any,
        audioTypeOptions: {
          manageAudioFocus: true,
          audioMode: 'inCommunication',
          audioFocusMode: 'gain',
          audioStreamType: 'voiceCall',
          audioAttributesUsageType: 'voiceCommunication',
          audioAttributesContentType: 'speech',
        },
      },
      ios: {
        defaultOutput: 'earpiece',
      },
    });
    await AudioSession.startAudioSession();
    currentOutput = 'earpiece';
    userPicked = null;
    if (Platform.OS === 'android') {
      // A headset already connected wins from the first second (OUTPUT_PRIORITY): reflect that in
      // the route icon and in the proximity screen-off, which applies to the earpiece only.
      try { noteAvailableOutputs(await AudioSession.getAudioOutputs()); } catch { /* keep earpiece */ }
    }
    startProximity();
    started = true;
    console.log(TAG, 'Audio Session Activated (platform=' + Platform.OS + ')');
    return true;
  } catch (e) {
    console.error(TAG, 'Failed to start audio session - call audio will not work', e);
    started = false;
    return false;
  }
}

export async function stopCallAudioSession(): Promise<void> {
  if (!started) return;
  try {
    stopProximity();
    await AudioSession.stopAudioSession();
    console.log(TAG, 'Audio Session Released');
  } catch (e) {
    console.error(TAG, 'Failed to stop audio session', e);
  } finally {
    started = false;
  }
}

export async function listAudioOutputs(): Promise<string[]> {
  try {
    return await AudioSession.getAudioOutputs();
  } catch (e) {
    console.error(TAG, 'getAudioOutputs failed', e);
    return [];
  }
}

/** The route the call is on, as best this app knows it (Android: what was picked, or what LiveKit
 * auto-selects by OUTPUT_PRIORITY when a device comes or goes). */
export function currentAudioOutput(): string {
  return currentOutput;
}

/**
 * Keep `currentAudioOutput()` in step when devices change (headset plugged in, Bluetooth connects):
 * LiveKit then switches to the highest-priority available device unless the user picked one that is
 * still there. Returns the route now in use.
 */
export function noteAvailableOutputs(outputs: string[]): string {
  if (userPicked && outputs.includes(userPicked)) {
    currentOutput = userPicked;
  } else {
    userPicked = null;
    currentOutput = OUTPUT_PRIORITY.find((o) => outputs.includes(o)) ?? currentOutput;
  }
  return currentOutput;
}

export async function selectAudioOutput(deviceId: string): Promise<void> {
  try {
    await AudioSession.selectAudioOutput(deviceId);
    currentOutput = deviceId;
    userPicked = deviceId;
    console.log(TAG, 'Audio output switched to', deviceId);
    if (deviceId !== 'earpiece') inCallManager()?.turnScreenOn();
  } catch (e) {
    console.error(TAG, 'selectAudioOutput failed', e);
  }
}

/** iOS only: the system route picker (speaker / Bluetooth / AirPods). */
export async function showNativeAudioRoutePicker(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await AudioSession.showAudioRoutePicker();
  } catch (e) {
    console.error(TAG, 'showAudioRoutePicker failed', e);
  }
}
