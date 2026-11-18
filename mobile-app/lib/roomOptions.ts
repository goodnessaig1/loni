import { AudioPresets, type RoomOptions } from 'livekit-client';

/**
 * LiveKit room options for a voice call. Same file in mobile-app and loni-server-app.
 *
 * Capture processing: echo cancellation, noise suppression and auto gain on. On iOS the voiceChat
 * audio mode (index.js) does this in Apple's voice-processing unit; on Android WebRTC uses the
 * platform's hardware effects where present and its own otherwise - each is applied once, by WebRTC.
 *
 * Publish: the speech preset (24 kbps Opus, mono), DTX (no packets during silence: less data and
 * battery) and RED (redundant audio, so a lost packet on a weak mobile network does not drop a
 * syllable).
 */
export const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  publishDefaults: {
    audioPreset: AudioPresets.speech,
    dtx: true,
    red: true,
  },
};
