/**
 * The mother's side of partner sync. The backend sends `partner_connected`, `partner_left` (and the
 * Notification Centre rows that go with them) over the WebSocket and as pushes; this refreshes what
 * shows them - the support-partner list and the notification bell - and says so in the app.
 */
import Toast from 'react-native-toast-message';
import { queryClient } from './queryClient';

type Listener = () => void;
const listeners = new Set<Listener>();

/** EmergencyContactsContext subscribes so its list refetches when a partner joins or leaves. */
export function onPartnerChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isPartnerEvent(type: unknown): type is string {
  return typeof type === 'string' && type.startsWith('partner_');
}

// WS and push both deliver each event; toast once.
const shown = new Map<string, number>();

export function applyPartnerEvent(type: string, data: any, opts: { title?: string; body?: string } = {}) {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  listeners.forEach((fn) => { try { fn(); } catch { /* a listener must not break the others */ } });

  const key = `${type}:${data?.partner_name ?? ''}`;
  const now = Date.now();
  if ((shown.get(key) ?? 0) > now - 10_000) return;
  shown.set(key, now);
  if (type === 'partner_connected') {
    Toast.show({ type: 'success', text1: opts.title || 'Support partner connected', text2: opts.body || `${data?.partner_name ?? 'Your partner'} joined your support circle.` });
  } else if (type === 'partner_left') {
    Toast.show({ type: 'info', text1: opts.title || 'Support partner left', text2: opts.body });
  }
}

/** After the app was closed or offline: quietly refetch what partner events would have refreshed. */
export function resyncPartners() {
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}
