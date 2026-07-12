/**
 * Expo config plugin: adds notifee's local Android Maven repository to the
 * root `android/build.gradle`.
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
const { withProjectBuildGradle } = require('@expo/config-plugins');

const NOTIFEE_REPO_MARKER = '@notifee/react-native/android/libs';
const NOTIFEE_REPO_LINE =
  '    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" } // notifee local repo - see plugins/withNotifeeAndroid.js';

function withNotifeeAndroid(config) {
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

module.exports = withNotifeeAndroid;
