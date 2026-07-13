/**
 * Expo config plugin: adds notifee's local Android Maven repository to the
 * root `android/build.gradle`, AND fixes a foreground-service-type mismatch
 * between what this app requests at runtime and what notifee's own bundled
 * native manifest declares (see withNotifeeForegroundServiceType below) -
 * this second part is the fix for the "app crashes the instant a call
 * connects" bug.
 *
 * `@notifee/react-native@9.1.8` (the installed version) does not ship its
 * own `app.plugin.js`, unlike most of the other native modules in this
 * project - so unlike `@react-native-firebase/app` or
 * `@config-plugins/react-native-webrtc`, there's nothing that
 * automatically wires this up during `expo prebuild`.
 *
 * notifee publishes its Android SDK (`app.notifee:core`,
 * `app.notifee:notifee-react-native`) as a LOCAL flat Maven repo bundled
 * directly inside the npm package
 * (node_modules/@notifee/react-native/android/libs/app/notifee/...) rather
 * than to Google's Maven, Maven Central, or JitPack - none of which
 * Gradle's dependency resolver will find it in "app.notifee:core:+ as no
 * versions of app.notifee:core are available" is exactly what happens
 * without this repository entry, because the root build.gradle's
 * `allprojects { repositories { ... } }` block never gets told to look in
 * that local directory. `expo prebuild` regenerates `android/build.gradle`
 * from scratch every time, so a one-off manual edit doesn't survive - this
 * has to be a config plugin.
 */
const { withProjectBuildGradle, withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const NOTIFEE_REPO_MARKER = '@notifee/react-native/android/libs';
const NOTIFEE_REPO_LINE =
  '    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" } // notifee local repo - see plugins/withNotifeeAndroid.js';

function withNotifeeMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      console.warn(
        '[withNotifeeAndroid] Expected a Groovy android/build.gradle but found ' +
        config.modResults.language + ' - skipping. You will need to add the ' +
        'notifee Maven repo manually.'
      );
      return config;
    }

    if (config.modResults.contents.includes(NOTIFEE_REPO_MARKER)) {
      return config; // already present, don't double-insert on repeated prebuilds
    }

    const repositoriesBlock = /allprojects\s*{\s*repositories\s*{/;
    if (repositoriesBlock.test(config.modResults.contents)) {
      config.modResults.contents = config.modResults.contents.replace(
        repositoriesBlock,
        (match) => `${match}\n${NOTIFEE_REPO_LINE}`
      );
    } else {
      console.warn(
        '[withNotifeeAndroid] Could not find an `allprojects { repositories {` ' +
        'block in android/build.gradle to inject into - notifee Android build ' +
        'will likely fail. Check android/build.gradle manually.'
      );
    }

    return config;
  });
}

/**
 * ROOT CAUSE of the "call connects, then both apps immediately crash" bug:
 *
 * notifee's bundled core AAR (under
 * node_modules/@notifee/react-native/android/libs/app/notifee/core/, versioned
 * subfolder, file core-<version>.aar) declares its own foreground-service
 * component in ITS AndroidManifest.xml as:
 *
 *   <service android:name="app.notifee.core.ForegroundService"
 *            android:foregroundServiceType="shortService" />
 *
 * (confirmed by unzipping the AAR directly - "shortService" is an Android 14+
 * type meant for tasks under ~3 minutes, nothing to do with microphone/calls.)
 *
 * lib/callForegroundService.ts, however, starts that same service requesting
 * `AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE` the moment
 * a call reaches CONNECTED. On API 34+ (both apps target API 35 via Expo SDK
 * 54), the OS requires the type passed to `startForeground()` to be a subset
 * of whatever that Service's AndroidManifest.xml entry declares - a mismatch
 * throws a fatal `MissingForegroundServiceTypeException` at the native/OS
 * level. This is NOT a JS exception - it can't be caught by a JS try/catch
 * around the notifee call, which is exactly why it presented as an
 * unconditional native crash a couple seconds after Accept (however long the
 * LiveKit handshake takes to reach CONNECTED), on BOTH apps, since both run
 * the identical lib/callForegroundService.ts against the identical notifee
 * AAR.
 *
 * Fixed by having THIS app's own generated AndroidManifest.xml re-declare
 * that same service (matched by `android:name`) with
 * `android:foregroundServiceType="microphone"` and `tools:replace` on that
 * attribute. Android's manifest merger gives the app module's own manifest
 * priority over a library/AAR manifest for the same component, and
 * `tools:replace` is what tells the merger to resolve the otherwise-fatal
 * attribute conflict by using the app's value instead of erroring out at
 * build time.
 */
function withNotifeeForegroundServiceType(config) {
  return withAndroidManifest(config, (config) => {
    // `tools:replace` below is only valid XML if this namespace is declared
    // on the manifest root - Expo's default generated manifest doesn't
    // declare it since nothing else in this project needed `tools:` yet.
    // Uses config-plugins' own helper (the same one Expo's built-in plugins
    // use for this) rather than hand-rolling the namespace check.
    AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);

    const manifest = config.modResults.manifest;
    const application = manifest.application && manifest.application[0];
    if (!application) {
      console.warn(
        '[withNotifeeAndroid] No <application> element found in AndroidManifest.xml - ' +
        'cannot override notifee\'s foreground service type. The app WILL crash on ' +
        'call connect until this is fixed manually.'
      );
      return config;
    }

    if (!application.service) {
      application.service = [];
    }

    const SERVICE_NAME = 'app.notifee.core.ForegroundService';
    const existing = application.service.find(
      (s) => s.$ && s.$['android:name'] === SERVICE_NAME
    );

    if (existing) {
      // Re-running prebuild - just make sure the override is still correct.
      existing.$['android:foregroundServiceType'] = 'microphone|phoneCall';
      existing.$['tools:replace'] = 'android:foregroundServiceType';
    } else {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone|phoneCall',
          'tools:replace': 'android:foregroundServiceType',
        },
      });
    }

    return config;
  });
}

function withNotifeeAndroid(config) {
  config = withNotifeeMavenRepo(config);
  config = withNotifeeForegroundServiceType(config);
  return config;
}

module.exports = withNotifeeAndroid;
