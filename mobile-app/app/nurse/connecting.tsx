import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useCall } from '../../hooks/useCall';

/**
 * Issue 6 fix: this used to be a full screen with its own "Connecting you
 * to a nurse..." UI, ringback playback, and cancel button - a SEPARATE
 * implementation from components/CallModals.tsx's own "Calling Nurse..."
 * modal, which then took over once the call was accepted. That's exactly
 * the "unnecessary transitions between multiple screens" this issue
 * describes: navigating here, watching this screen's UI, then watching it
 * get replaced by a different UI a moment later.
 *
 * CallModals.tsx (mounted once, globally, in app/_layout.tsx) is now the
 * single source of truth for the entire outgoing-call experience end to
 * end - ringback tone included. This route's only remaining job is to
 * trigger `requestCall()` (in case anything still navigates here to start
 * a call) and get out of the way immediately; it renders nothing itself.
 */
export default function ConnectingNurseScreen() {
  const router = useRouter();
  const { requestCall } = useCall();
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    requestCall(undefined).catch((e) => {
      console.error('[Call/Mother] Failed to request call', e);
    });
    // Return immediately - CallModals shows the actual "Calling..." UI as
    // soon as the store's `isOutgoing` flag flips true, whether or not
    // this route is even still on the navigation stack.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  return null;
}
