/**
 * Expo config plugin: declares the Android native `ConnectionService` that
 * `react-native-callkeep`'s self-managed calling mode needs.
 *
 * ROOT CAUSE of the undiagnosed "third crash" that led to the
 * `EXPO_PUBLIC_ENABLE_CALLKEEP` kill switch: `react-native-callkeep` does
 * NOT ship an Expo config plugin for Android at all (confirmed - no
 * `app.plugin.js` in node_modules/react-native-callkeep; the only plugin in
 * this project, `withCallKeepIOS.js`, only touches iOS entitlements). Its
 * own install docs (docs/android-installation.md, not bundled in the npm
 * package - fetched from
 * https://github.com/react-native-webrtc/react-native-callkeep - "Android
 * common step installation") require BOTH of these to be added to
 * `android/app/src/main/AndroidManifest.xml` by hand:
 *
 *   <uses-permission android:name="android.permission.BIND_TELECOM_CONNECTION_SERVICE"/>
 *
 *   <service android:name="io.wazo.callkeep.VoiceConnectionService"
 *       android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
 *       android:foregroundServiceType="microphone"
 *       android:exported="true">
 *     <intent-filter>
 *       <action android:name="android.telecom.ConnectionService" />
 *     </intent-filter>
 *   </service>
 *
 * Neither was ever present - confirmed by grepping both the library's own
 * bundled AndroidManifest.xml (which only declares <uses-permission>
 * entries, no <service>) and this app's generated
 * android/app/src/main/AndroidManifest.xml (no match for
 * "VoiceConnectionService" anywhere).
 *
 * `CK.setup({ android: { selfManaged: true, ... } })` calls
 * `TelecomManager.registerPhoneAccount()`, and `displayIncomingCall()` /
 * `startCall()` call `telecomManager.addNewIncomingCall()` /
 * `.placeCall()` - all of which hand off to Android's Telecom subsystem,
 * which then needs to BIND to `VoiceConnectionService` to actually run the
 * call. Without a manifest entry telling Telecom that component exists (and
 * without the `BIND_TELECOM_CONNECTION_SERVICE` permission securing that
 * bind, which Android requires for security - only the OS's own Telecom
 * process holds this permission), the framework has nothing to bind to.
 * This is a well-documented cause of a hard crash at exactly the moment a
 * call is accepted or placed - the framework has already gone far enough to
 * try to start the connection, then fails with no component to route to -
 * which matches the "both apps crash the instant a call connects" symptom
 * exactly, and happens identically on both apps since both call
 * `CK.setup({ selfManaged: true })` (mobile-app for outgoing calls,
 * loni-server-app for incoming calls) against the same unpatched library.
 *
 * Also required per the library's README ("Android Self Managed Mode"
 * section) but likewise never added: `android.permission.READ_CALL_LOG` -
 * this one is a plain top-level Android permission, added directly to both
 * app.json's `android.permissions` array instead of through this plugin.
 */
const { withAndroidManifest, AndroidConfig, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = 'io.wazo.callkeep.VoiceConnectionService';
const BIND_PERMISSION = 'android.permission.BIND_TELECOM_CONNECTION_SERVICE';

function withPhoneAccountIcon(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resPath = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      if (!fs.existsSync(resPath)) {
        fs.mkdirSync(resPath, { recursive: true });
      }
      const iconPath = path.join(resPath, 'phone_account_icon.xml');
      // A simple phone vector icon for Telecom
      const iconXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24.0"
    android:viewportHeight="24.0">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M6.62,10.79c1.44,2.83 3.76,5.14 6.59,6.59l2.2,-2.2c0.27,-0.27 0.67,-0.36 1.02,-0.24 1.12,0.37 2.33,0.57 3.57,0.57 0.55,0 1,0.45 1,1V20c0,0.55 -0.45,1 -1,1 -9.39,0 -17,-7.61 -17,-17 0,-0.55 0.45,-1 1,-1h3.5c0.55,0 1,0.45 1,1 0,1.25 0.2,2.45 0.57,3.57 0.11,0.35 0.03,0.74 -0.25,1.02l-2.2,2.2z"/>
</vector>`;
      fs.writeFileSync(iconPath, iconXml);
      return config;
    },
  ]);
}

function withCallKeepAndroid(config) {
  config = withPhoneAccountIcon(config);
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);
    const manifest = config.modResults.manifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const hasBindPermission = manifest['uses-permission'].some(
      (p) => p.$ && p.$['android:name'] === BIND_PERMISSION
    );
    if (!hasBindPermission) {
      manifest['uses-permission'].push({ $: { 'android:name': BIND_PERMISSION } });
    }

    const application = manifest.application && manifest.application[0];
    if (!application) {
      console.warn(
        '[withCallKeepAndroid] No <application> element found in AndroidManifest.xml - ' +
        'cannot declare VoiceConnectionService. Native calls WILL crash until this is fixed manually.'
      );
      return config;
    }

    if (!application.service) {
      application.service = [];
    }

    let service = application.service.find(
      (s) => s.$ && s.$['android:name'] === SERVICE_NAME
    );
    if (!service) {
      service = { $: {} };
      application.service.push(service);
    }

    service.$['android:name'] = SERVICE_NAME;
    service.$['android:permission'] = BIND_PERMISSION;
    service.$['android:foregroundServiceType'] = 'microphone';
    // Telecom runs in a different process/app entirely and must be able to
    // bind to this service across that boundary - `exported` must be true
    // (and, since this service declares an intent-filter, Android's build
    // tooling requires `android:exported` to be explicit at all once the
    // app targets API 31+, or the manifest merge fails outright).
    service.$['android:exported'] = 'true';

    if (!service['intent-filter'] || service['intent-filter'].length === 0) {
      service['intent-filter'] = [
        {
          action: [{ $: { 'android:name': 'android.telecom.ConnectionService' } }],
        },
      ];
    }

    return config;
  });
}

module.exports = withCallKeepAndroid;
