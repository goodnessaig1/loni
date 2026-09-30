// Dynamic config layer over app.json.
//
// Injects the Google Maps API key (react-native-maps, used for the driver's
// turn-by-turn navigation and the mother's live-tracking map) from an
// environment variable so the key is never committed. Set it in `.env` /
// your EAS build env:
//
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
//
// When no key is set we deliberately DON'T write an empty
// `com.google.android.geo.API_KEY` meta-data entry - an empty value makes
// the Maps SDK throw "API key not found" on the first <MapView> render.
// (The app keeps working; the ride screens just show a non-map fallback -
// see components/MapsCompat.tsx.)
module.exports = ({ config }) => {
  const googleMapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
  if (!googleMapsApiKey) return config;

  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...(config.ios && config.ios.config),
        googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config),
        googleMaps: { apiKey: googleMapsApiKey },
      },
    },
  };
};
