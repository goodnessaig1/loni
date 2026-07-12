/**
 * Minimal Expo config plugin for react-native-callkeep + PushKit on iOS.
 *
 * react-native-callkeep (installed, previously unused - see
 * CALL_SYSTEM_AUDIT.md) does NOT ship its own `app.plugin.js`, so it isn't
 * auto-configured by Expo prebuild the way `@config-plugins/react-native-webrtc`
 * is. Autolinking still picks up its native iOS/Android code automatically
 * (that part needs no plugin - it's standard RN autolinking), but one iOS
 * entitlement genuinely needs to be set explicitly: `aps-environment`,
 * which tells iOS whether to use the sandbox or production APNs
 * environment for this build. This MUST match the backend's
 * `APNS_USE_SANDBOX` setting (backend-new/app/core/config.py) or every
 * VoIP push will be rejected/silently dropped as `BadDeviceToken`.
 *
 * This plugin only touches `Entitlements.plist` via the official,
 * documented `withEntitlementsPlist` mod - it does not attempt to
 * hand-patch AppDelegate source (react-native-voip-push-notification's
 * native module registers itself as the PKPushRegistry delegate
 * internally and does not require AppDelegate edits for basic
 * registration + delivery).
 *
 * Usage: referenced by absolute path in app.json's `plugins` array:
 *   ["./plugins/withCallKeepIOS.js", { "apsEnvironment": "development" }]
 *
 * IMPORTANT: after changing this file or app.json, you must run
 * `npx expo prebuild --clean` for it to take effect, then build/run on a
 * real device with a paid Apple Developer account (VoIP pushes do not work
 * in the iOS Simulator at all - Simulator has no PushKit/APNs connectivity).
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

function withCallKeepIOS(config, { apsEnvironment = 'development' } = {}) {
  return withEntitlementsPlist(config, (config) => {
    config.modResults['aps-environment'] = apsEnvironment;
    return config;
  });
}

module.exports = withCallKeepIOS;
