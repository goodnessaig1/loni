// Dynamic config layer over app.json.
//
// Injects the Google Maps API key (react-native-maps, live ride-tracking
// map) from an environment variable so the key is never committed. Set it
// in `.env` / your EAS build env:
//
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
//
// When no key is set we skip the `com.google.android.geo.API_KEY`
// meta-data entirely - an empty value makes the Maps SDK throw
// "API key not found" on the first map render.
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
