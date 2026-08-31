/**
 * Expo config plugin: calls `LiveKitReactNative.setup(this)` in
 * `MainApplication.kt`'s `onCreate()`, before `loadReactNative(this)`.
 *
 * `@livekit/react-native` does not ship its own Expo config plugin (no
 * `app.plugin.js`), so `expo prebuild` never adds this automatically -
 * same situation as notifee and CallKeep in loni-server-app.
 *
 * Without this call, the SDK's own source
 * (node_modules/@livekit/react-native/android/src/main/java/com/livekit/reactnative/LiveKitReactNative.kt)
 * throws the instant anything touches the native audio device module:
 *
 *   IllegalStateException: Audio device module is not initialized! Did
 *   you remember to call LiveKitReactNative.setup in your
 *   Application.onCreate?
 *
 * The doc comment on `LiveKitReactNative.setup()` is explicit: "Must be
 * called from your Application.onCreate method before any other
 * react-native initialization" - hence inserting it immediately before
 * `loadReactNative(this)` rather than at the very top of `onCreate()`
 * (which runs framework setup code first) or the very end (too late -
 * React Native and its native modules, including LiveKit's own, are
 * already initializing by then).
 */
const { withMainApplication } = require('@expo/config-plugins');

const IMPORT_LINE = 'import com.livekit.reactnative.LiveKitReactNative';
const SETUP_CALL = 'LiveKitReactNative.setup(this)';

function withLiveKitAndroid(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      console.warn(
        '[withLiveKitAndroid] Expected a Kotlin MainApplication.kt but found ' +
        config.modResults.language + ' - skipping. You will need to call ' +
        'LiveKitReactNative.setup(this) manually in Application.onCreate.'
      );
      return config;
    }

    let contents = config.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      const importAnchor = 'import expo.modules.ReactNativeHostWrapper';
      if (contents.includes(importAnchor)) {
        contents = contents.replace(importAnchor, `${importAnchor}\n${IMPORT_LINE}`);
      } else {
        console.warn('[withLiveKitAndroid] Could not find import anchor in MainApplication.kt - adding LiveKit import at top of file.');
        contents = `${IMPORT_LINE}\n${contents}`;
      }
    }

    if (!contents.includes(SETUP_CALL)) {
      const callAnchor = 'loadReactNative(this)';
      if (contents.includes(callAnchor)) {
        contents = contents.replace(
          callAnchor,
          `${SETUP_CALL} // required native init - see plugins/withLiveKitAndroid.js\n    ${callAnchor}`
        );
      } else {
        console.warn(
          '[withLiveKitAndroid] Could not find `loadReactNative(this)` in ' +
          'MainApplication.kt to inject the setup call before - LiveKit ' +
          'audio will crash at runtime. Check MainApplication.kt manually.'
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withLiveKitAndroid;
