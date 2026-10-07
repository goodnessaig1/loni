import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Resets the scroll position when the route changes (a new page should start at the top, as the
 * browser would do for a full page load). A `#hash` target scrolls to that element instead, and
 * back/forward navigation is left to the browser so it can restore the previous position.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);

  return null;
}
