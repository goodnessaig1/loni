// Dynamic config layer over app.json.
//
// The only thing this does today is inject the Google Maps API key
// (used by react-native-maps for the driver's turn-by-turn navigation and
// the mother's live-tracking map) from an environment variable, so the key
// never has to be committed. Set it in `.env` / your EAS build env:
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
