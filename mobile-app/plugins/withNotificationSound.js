const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Safely copies assets/notification.mp3 into the Android res/raw directory
 * during `npx expo prebuild`. This ensures the file is not lost when the
 * android directory is cleaned/regenerated.
 */
module.exports = function withNotificationSound(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resRawDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'raw'
      );

      // Create raw directory if it doesn't exist
      if (!fs.existsSync(resRawDir)) {
        fs.mkdirSync(resRawDir, { recursive: true });
      }

      const sourceFile = path.join(projectRoot, 'assets', 'notification.mp3');
      const targetFile = path.join(resRawDir, 'notification.mp3');

      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log(`[ConfigPlugin] Copied notification.mp3 to res/raw`);
      } else {
        console.warn(`[ConfigPlugin] Warning: Could not find ${sourceFile}`);
      }

      return config;
    },
  ]);
};
