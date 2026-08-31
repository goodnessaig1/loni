const { withAndroidManifest } = require('@expo/config-plugins');

function withMainActivityLocked(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application && manifest.application[0];
    if (!application) return config;

    const activity = application.activity && application.activity.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (activity) {
      activity.$['android:showWhenLocked'] = 'true';
      activity.$['android:turnScreenOn'] = 'true';
    }

    return config;
  });
}

module.exports = withMainActivityLocked;
