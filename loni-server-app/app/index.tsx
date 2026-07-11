import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import WebView from 'react-native-webview';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 justify-center flex !-mt-20 items-center">
            <View style={{ width: 100, height: 100, overflow: 'hidden' }}>
              <WebView
                originWhitelist={['*']}
                source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /></head><body style="margin:0;padding:0;background-color:transparent;display:flex;justify-content:center;align-items:center;"><svg fill="none" height="100%" width="100%" viewBox="0 0 300 300" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="i0" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="30.5" y2="30.5" x1="-29.5" y1="-30"><stop offset="0%" stop-color="#f684bb" /><stop offset="56%" stop-color="#bb4478" /><stop offset="100%" stop-color="#7d3b57" /></linearGradient><linearGradient id="i1" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="31.5" y2="34" x1="-30.5" y1="-30.5"><stop offset="0%" stop-color="#c8195f" /><stop offset="56%" stop-color="#b91d61" /><stop offset="100%" stop-color="#b91d61" /></linearGradient><linearGradient id="i2" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="31" y2="31" x1="-29" y1="-29.5"><stop offset="0%" stop-color="#a21251" /><stop offset="56%" stop-color="#803c5a" /><stop offset="100%" stop-color="#6e113a" /></linearGradient><linearGradient id="i3" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="30.5" y2="30.5" x1="-30" y1="-29.5"><stop offset="0%" stop-color="#fac337" /><stop offset="56%" stop-color="#feb806" /><stop offset="100%" stop-color="#ff0571" /></linearGradient></defs><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i5"><g transform="translate(-509.091,509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="-509.091 509.091; 0 0; 0 0; -509.091 509.091; -509.091 509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="9.091 9.091; 9.091 9.091; 8.551 8.551; 8.551 8.551; 9.091 9.091; 9.091 9.091" keyTimes="0; 0.39; 0.41; 0.49; 0.51; 1" keySplines="0 0 1 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i0)" /></g></g></g></g></g></g></g></g></g></g><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i7"><g transform="translate(509.091,-509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="509.091 -509.091; 0 0; 0 0; 509.091 -509.091; 509.091 -509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="9.091 9.091; 9.091 9.091; 8.551 8.551; 8.551 8.551; 9.091 9.091; 9.091 9.091" keyTimes="0; 0.39; 0.41; 0.49; 0.51; 1" keySplines="0 0 1 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i1)" /></g></g></g></g></g></g></g></g></g></g><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i8"><g transform="translate(509.091,509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="509.091 509.091; 0 0; 0 0; 509.091 509.091; 509.091 509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="9.091 9.091; 9.091 9.091; 8.551 8.551; 8.551 8.551; 9.091 9.091; 9.091 9.091" keyTimes="0; 0.39; 0.41; 0.49; 0.51; 1" keySplines="0 0 1 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i2)" /></g></g></g></g></g></g></g></g></g></g><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i9"><g transform="translate(-509.091,-509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="-509.091 -509.091; 0 0; 0 0; -509.091 -509.091; -509.091 -509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091) translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i3)" /></g></g></g></g></g></g></g></g></g><g opacity="0" id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)" /></g></g></g></svg></body></html>` }} 
                style={{ width: 100, height: 100, backgroundColor: 'transparent' }} 
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                bounces={false}
              />
            </View>
          </View>
    );
  }

  if (user) {
    if (user.user_type === 'user') {
      return <Redirect href="/(auth)/role-selection" />;
    } else if (user.user_type === 'nurse') {
      if (!user.nurse_profile) {
        return <Redirect href="/(auth)/complete-profile-nurse" />;
      }
      if (user.account_status === 'pending') {
        return <Redirect href="/(auth)/verification-progress" />;
      }
      return <Redirect href="/(tabs)" />;
    } else if (user.user_type === 'driver') {
      if (!user.driver_profile) {
        return <Redirect href="/(auth)/complete-profile-vehicle" />;
      }
      if (user.account_status === 'pending') {
        return <Redirect href="/(auth)/verification-progress" />;
      }
      return <Redirect href="/(tabs)" />;
    } else {
      // Catch-all for any other roles trying to use the provider app
      return <Redirect href="/(auth)/role-selection" />;
    }
  } else {
    return <Redirect href="/(auth)" />;
  }
}
