// Dynamic config layer over app.json.
//
// Injects the Google Maps API key (react-native-maps, used for the live
// ride-tracking map) from an environment variable so the key is never
// committed. Set it in `.env` / your EAS build env:
//
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
//
// Everything else still comes from app.json.
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
