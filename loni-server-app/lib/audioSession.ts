import { DeviceEventEmitter, EmitterSubscription, NativeModules, Platform } from 'react-native';
import { AudioSession } from '@livekit/react-native';

/**
 * Call audio has ONE owner: LiveKit's `AudioSession`.
 *
 * `AudioSession.startAudioSession()` must be called explicitly before connecting (it is what sets the
 * Android AudioManager to `inCommunication` and takes audio focus; `registerGlobals()` does not do
 * this on Android). On iOS the category is set by `setupIOSAudioManagement` (index.js): playAndRecord
 * in voiceChat mode, which turns on Apple's echo cancellation / noise suppression / gain control and
 * starts on the earpiece.
 *
 * `react-native-incall-manager` is used only for what LiveKit does not do: ringtone/ringback sounds
 * (lib/callTones.ts) and the proximity sensor (screen off at the ear). It is never `start()`ed during
 * a call - its `start()` takes over the same AudioManager / AVAudioSession and fights LiveKit over
 * routing (Bluetooth falling back to the earpiece, speaker toggles being reverted).
 *
 * Routes: the app asks the OS what is really connected and what is really playing
 * (`getAudioRoute`, added to @livekit/react-native by patches/@livekit+react-native+2.11.1.patch)
 * rather than trusting the last button pressed.
 *
 * Same file in mobile-app and loni-server-app - keep them identical.
 */

const TAG = '[AudioSession]';
let started = false;

export type AudioRouteKind = 'earpiece' | 'speaker' | 'bluetooth' | 'headset';

export interface AudioRouteState {
  /** Routes the OS reports as usable right now, best first. */
  available: AudioRouteKind[];
  /** The route audio is playing on now, or null if the OS did not say. */
  current: AudioRouteKind | null;
}

/** Highest first: a connected headset always beats the earpiece; the speaker is opt-in. */
export const OUTPUT_PRIORITY: AudioRouteKind[] = ['bluetooth', 'headset', 'earpiece', 'speaker'];

interface NativeRouteModule {
  getAudioRoute?: () => Promise<{ available: string[]; current: string | null }>;
  selectAudioRoute?: (kind: string) => Promise<void>;
}

const nativeRoute: NativeRouteModule | undefined = NativeModules.LivekitReactNativeModule;

function isRouteKind(v: unknown): v is AudioRouteKind {
  return v === 'earpiece' || v === 'speaker' || v === 'bluetooth' || v === 'headset';
}

function sortRoutes(routes: AudioRouteKind[]): AudioRouteKind[] {
  return OUTPUT_PRIORITY.filter((r) => routes.includes(r));
}

let currentOutput: AudioRouteKind = 'earpiece';
let proximitySub: EmitterSubscription | null = null;

interface InCallManagerScreen {
  setKeepScreenOn: (on: boolean) => void;
  startProximitySensor: () => void;
  stopProximitySensor: () => void;
  turnScreenOff: () => void;
  turnScreenOn: () => void;
}

function inCallManager(): InCallManagerScreen | null {
  try {
    return require('react-native-incall-manager').default as InCallManagerScreen;
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
        preferredOutputList: OUTPUT_PRIORITY,
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
    started = true;
    await getAudioRoute(); // a headset already connected wins from the first second
    startProximity();
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
    currentOutput = 'earpiece';
  }
}

/** What is connected and what is playing, as the OS reports it. */
export async function getAudioRoute(): Promise<AudioRouteState> {
  try {
    if (nativeRoute?.getAudioRoute) {
      const raw = await nativeRoute.getAudioRoute();
      const available = sortRoutes((raw?.available ?? []).filter(isRouteKind));
      const current = isRouteKind(raw?.current) ? raw.current : null;
      if (current) currentOutput = current;
      return { available, current };
    }
    // A build without the native patch: Android can still list devices; iOS only knows its two.
    if (Platform.OS === 'android') {
      const outputs = sortRoutes((await AudioSession.getAudioOutputs()).filter(isRouteKind));
      return { available: outputs, current: outputs.includes(currentOutput) ? currentOutput : outputs[0] ?? null };
    }
    return { available: ['earpiece', 'speaker'], current: currentOutput };
  } catch (e) {
    console.warn(TAG, 'getAudioRoute failed', e);
    return { available: [], current: null };
  }
}

export async function selectAudioRoute(kind: AudioRouteKind): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      if (nativeRoute?.selectAudioRoute) await nativeRoute.selectAudioRoute(kind);
      else await AudioSession.selectAudioOutput(kind === 'speaker' ? 'force_speaker' : 'default');
    } else {
      await AudioSession.selectAudioOutput(kind);
    }
    currentOutput = kind;
    if (kind !== 'earpiece') inCallManager()?.turnScreenOn();
    console.log(TAG, 'Audio output switched to', kind);
  } catch (e) {
    console.error(TAG, 'selectAudioRoute failed', e);
  }
}

export function currentAudioOutput(): AudioRouteKind {
  return currentOutput;
}
