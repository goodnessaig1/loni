import { Platform } from 'react-native';
import { AudioSession } from '@livekit/react-native';

/**
 * Issue 1 root cause (the actual "no audio transmission" bug):
 * `@livekit/react-native` requires an explicit, separate call to
 * `AudioSession.startAudioSession()` before connecting to a room - this is
 * NOT the same thing as `registerGlobals()` (which only installs the
 * `RTCPeerConnection`/WebRTC JS API surface) and is NOT automatic on
 * Android. Confirmed by reading the SDK's own source
 * (node_modules/@livekit/react-native/src/audio/AudioSession.ts,
 * AudioManager.ts):
 *
 *   - `registerGlobals()` calls `setupIOSAudioManagement()` by default,
 *     which DOES automatically start/stop the audio session in reaction to
 *     the native audio engine's playout/recording state - but that
 *     function is a hard no-op on Android
 *     (`if (Platform.OS !== 'ios') { return () => {}; }`).
 *   - On Android there is no automatic equivalent. Nothing in this app
 *     ever called `AudioSession.startAudioSession()`, so the native
 *     AudioManager mode was never set to `inCommunication`, audio focus
 *     was never requested, and the mic/speaker were never actually
 *     activated for a call - even though signaling could succeed (a
 *     LiveKit room can report "connected" purely at the
 *     ICE/DTLS/SRTP transport level without any of this).
 *
 * This is why the call could show "Connected" on both ends with a
 * completely silent audio pipeline: every layer above the OS audio
 * session (getUserMedia, track creation, publish, subscribe) can succeed
 * while the actual hardware never opens the mic or routes output.
 */

const TAG = '[AudioSession]';
let started = false;

export async function startCallAudioSession(): Promise<boolean> {
  if (started) {
    console.log(TAG, 'startCallAudioSession called but session is already active - skipping');
    return true;
  }
  try {
    // Must be called before starting the session for the config to apply
    // (per the SDK's own doc comment on AudioSession.configureAudio).
    await AudioSession.configureAudio({
      android: {
        preferredOutputList: ['earpiece', 'speaker', 'headset', 'bluetooth'],
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
    try {
      const InCallManager = require('react-native-incall-manager').default;
      InCallManager.start({ media: 'audio' });
      InCallManager.setForceSpeakerphoneOn(false);
    } catch (e) {
      console.error(TAG, 'InCallManager start failed', e);
    }
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
    try {
      const InCallManager = require('react-native-incall-manager').default;
      InCallManager.stop();
    } catch (e) {
      console.error(TAG, 'InCallManager stop failed', e);
    }
    await AudioSession.stopAudioSession();
    console.log(TAG, 'Audio Session Released');
  } catch (e) {
    console.error(TAG, 'Failed to stop audio session', e);
  } finally {
    started = false;
  }
}

/** Issue 6: audio output device management. `startCallAudioSession` must
 * have been called first (per the SDK's own requirement). */
export async function listAudioOutputs(): Promise<string[]> {
  try {
    return await AudioSession.getAudioOutputs();
  } catch (e) {
    console.error(TAG, 'getAudioOutputs failed', e);
    return [];
  }
}

export async function selectAudioOutput(deviceId: string): Promise<void> {
  try {
    await AudioSession.selectAudioOutput(deviceId);
    console.log(TAG, 'Audio output switched to', deviceId);
  } catch (e) {
    console.error(TAG, 'selectAudioOutput failed', e);
  }
}

/** iOS only - shows the native route picker (handles Bluetooth/AirPlay/
 * wired selection UI that iOS otherwise doesn't expose granular control
 * over to apps). */
export async function showNativeAudioRoutePicker(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await AudioSession.showAudioRoutePicker();
  } catch (e) {
    console.error(TAG, 'showAudioRoutePicker failed', e);
  }
}
