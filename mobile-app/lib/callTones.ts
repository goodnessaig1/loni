import { Platform } from 'react-native';
import { Audio, InterruptionModeIOS } from 'expo-av';

/**
 * Ringing sounds for a call that has not connected yet. Same file in mobile-app and loni-server-app.
 *
 * - Ringtone: the RECEIVER's phone, while an incoming call is waiting. The device's own ringtone.
 * - Ringback: the CALLER's phone, while the other side is being rung. A quiet "tuut... tuut" tone.
 *
 * The caller used to hear a full phone ringtone: `InCallManager.startRingback('_DEFAULT_')` is not a
 * ringback tone at all. On Android `_DEFAULT_` resolves to `Settings.System.DEFAULT_RINGTONE_URI` (the
 * phone's ringtone) and on iOS to `/Library/Ringtones/Marimba.m4r`. So the person placing the call
 * heard their own phone ring as if they were being called. Android now uses `_DTMF_` (a real
 * ringback tone from ToneGenerator on the voice-call stream: earpiece, loops natively); iOS has no
 * built-in tone generator, so it plays a bundled ringback tone (assets/sounds/ringback.wav).
 */

interface InCallManagerTones {
  startRingtone: (ringtone: string) => void;
  stopRingtone: () => void;
  startRingback: (ringback: string) => void;
  stopRingback: () => void;
}

function inCallManager(): InCallManagerTones | null {
  try {
    return require('react-native-incall-manager').default as InCallManagerTones;
  } catch {
    return null;
  }
}

let iosRingback: Audio.Sound | null = null;
let ringbackWanted = false;

export async function startRingback(): Promise<void> {
  if (ringbackWanted) return;
  ringbackWanted = true;
  if (Platform.OS === 'android') {
    try { inCallManager()?.startRingback('_DTMF_'); } catch { /* no tone - the screen still says "Calling" */ }
    return;
  }
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    });
    const { sound } = await Audio.Sound.createAsync(require('../assets/sounds/ringback.wav'), {
      isLooping: true,
      volume: 0.6,
      shouldPlay: false,
    });
    if (!ringbackWanted) {
      await sound.unloadAsync();
      return;
    }
    iosRingback = sound;
    await sound.playAsync();
  } catch (e) {
    console.warn('[CallTones] ringback unavailable', e);
  }
}

export async function stopRingback(): Promise<void> {
  ringbackWanted = false;
  if (Platform.OS === 'android') {
    try { inCallManager()?.stopRingback(); } catch { /* nothing playing */ }
    return;
  }
  const sound = iosRingback;
  iosRingback = null;
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch { /* already unloaded */ }
  }
}

export function startRingtone(): void {
  try { inCallManager()?.startRingtone('_DEFAULT_'); } catch { /* no ringtone available */ }
}

export function stopRingtone(): void {
  try { inCallManager()?.stopRingtone(); } catch { /* nothing playing */ }
}

export function stopAllCallTones(): void {
  stopRingtone();
  void stopRingback();
}
