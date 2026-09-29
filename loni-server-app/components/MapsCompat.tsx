import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';

/**
 * `react-native-maps` is a native module (a Fabric component under the New
 * Architecture). If the running dev client / build doesn't include the
 * compiled native side, rendering `<MapView>` throws a fatal error that
 * closes the app - and there is no pure-JS way to register a missing
 * native component.
 *
 * So maps are OFF by default and the ride screens render a neutral
 * fallback panel. To turn them on you need a native rebuild that includes
 * react-native-maps, a real Google Maps key, AND the opt-in flag:
 *
 *     EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...   # required - no key => no map
 *     EXPO_PUBLIC_ENABLE_MAPS=1
 *
 * Belt and suspenders: even when enabled we (a) require it defensively and
 * (b) wrap it in an error boundary, so a registration failure degrades to
 * the fallback instead of crashing.
 */
const FLAG = process.env.EXPO_PUBLIC_ENABLE_MAPS;
const HAS_KEY = !!(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
// Maps need BOTH: an explicit opt-in AND a real API key. Rendering
// <MapView> without a key throws "API key not found" and (in a release
// build) can take the app down.
const ENABLED = (FLAG === '1' || FLAG === 'true') && HAS_KEY;

let RNMaps: any = null;
if (ENABLED) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    RNMaps = require('react-native-maps');
  } catch {
    RNMaps = null;
  }
}

const FallbackMap = ({ style, children }: ViewProps) => (
  <View style={[styles.fallback, style]}>{children}</View>
);
const Noop = () => null;

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode; style?: any },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn('[MapsCompat] map render failed, using fallback', e);
  }
  render() {
    if (this.state.failed) return <View style={[styles.fallback, this.props.style]} />;
    return this.props.children;
  }
}

export const MAPS_AVAILABLE: boolean = !!(RNMaps && RNMaps.default);

const RealMap = RNMaps?.default;

export const MapView: any = MAPS_AVAILABLE
  ? React.forwardRef(({ children, ...props }: any, ref: any) => (
      <MapErrorBoundary style={props.style}>
        <RealMap ref={ref} {...props}>{children}</RealMap>
      </MapErrorBoundary>
    ))
  : FallbackMap;

export const Marker: any = MAPS_AVAILABLE ? RNMaps.Marker : Noop;
export const Polyline: any = MAPS_AVAILABLE ? RNMaps.Polyline : Noop;
export const PROVIDER_GOOGLE: any = MAPS_AVAILABLE ? RNMaps.PROVIDER_GOOGLE : undefined;

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#E9EAEE' },
});
