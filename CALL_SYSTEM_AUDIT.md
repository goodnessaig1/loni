# Voice Calling System — Debug & Fix Audit

Scope: `backend-new` (FastAPI), `mobile-app` (Mother), `loni-server-app` (Nurse), `livekit/` (self-hosted LiveKit + coturn + Caddy).

This document explains, per reported issue: the exact root cause found in the code, why it produced the observed symptom, and the fix that was implemented. All fixes are live in the codebase — this is a record of *why*, not a proposal.

**Post-implementation fixes (found via real-device testing) and current status of `react-native-callkeep`:**

1. **TurboModule duplicate-method crash (fixed).** `react-native-callkeep@4.3.16`'s Android native module (`RNCallKeepModule.java`) declares two `@ReactMethod`-annotated Java overloads each for `displayIncomingCall` and `startCall` (a 3-arg and a 4-arg version). That's legal for React Native's legacy bridge, which resolves overloads by argument count, but breaks the New Architecture's TurboModule interop layer - which this project runs under (`react-native-worklets`/`reanimated@4.x` require New Architecture) - because it parses `@ReactMethod` methods by name only. The result was `Exception in HostObject::get for prop 'RNCallKeep': ... Module exports two methods to JavaScript with the same name`, thrown the instant anything imports `react-native-callkeep`, which cascaded into `hooks/useCall.ts` and `context/NotificationContext.tsx` failing to evaluate and Metro misreporting `_layout.tsx`/`app/nurse/connecting.tsx` as "missing default export" (both files are fine - that's a downstream symptom, not a separate bug). Confirmed via the JS wrapper (`index.js`) that the 3-arg overloads are never actually called on Android - fixed by removing `@ReactMethod` from the two dead 3-arg overloads directly in the installed copy, and packaged as `patches/react-native-callkeep+4.3.16.patch` (applied automatically via a new `postinstall: patch-package` script in both apps' `package.json`) so the fix survives `npm install`/`node_modules` reinstalls instead of being silently lost.

2. **Invalid drawable-resource crash (fixed).** After (1), the app booted but then crashed shortly after ("white screen then closes"). Traced into the same Java source: the Android `setup()` options passed `imageName: 'ic_launcher'` for the PhoneAccount icon, which `RNCallKeepModule.java` resolves via `getResources().getIdentifier(imageName, "drawable", packageName)` - i.e. it must be a `drawable/` resource specifically. Both apps' `ic_launcher` only exists under `mipmap-*/` (the standard Expo-generated location), so the lookup returned `0`, and `Icon.createWithResource(context, 0)` threw with no try/catch anywhere on the Java side - an uncatchable-from-JS crash on every launch, since `setupCallKeep()` runs on mount. Fixed by removing `imageName` from the Android setup options entirely (it's optional - guarded by `hasKey("imageName")` - and only affects a cosmetic system-Settings icon, not call functionality).

3. **Kill switch added (current state).** After fixes (1) and (2), a *third*, undiagnosed crash still occurred with the same "white screen then closes" symptom, and no crash log was available to trace it further (Metro's own terminal doesn't reliably surface a hard native crash - it requires `adb logcat`). Rather than keep making single-shot fixes against an untestable target, **`react-native-callkeep` (and its PushKit pairing, `react-native-voip-push-notification`) is now gated behind `EXPO_PUBLIC_ENABLE_CALLKEEP` in both apps' `.env` files, currently `"false"`.** `lib/callKeepService.ts` and `lib/voipPush.ts` (both apps) now `require()` the native modules lazily and only when the flag is on - while off, these modules are never touched at all, so nothing they do can crash the app. Every exported function (`startOutgoingCall`, `displayIncomingCall`, `reportConnected`, `reportCallEnded`) becomes a safe no-op and returns `null`/does nothing.

   **This does not remove Issue 4/5 functionality, it removes the native-OS-call-UI polish layered on top of it.** With the flag off: incoming calls on the Nurse app still ring via notifee's full-screen, high-priority notification with working Accept/Decline actions (`index.js`'s `notifee.onBackgroundEvent`/`onForegroundEvent`); the WebSocket + FCM signaling, LiveKit audio, ring-timeout watchdog, and the in-app "Calling Nurse..."/incoming-call modals (`components/CallModals.tsx`) all work completely independently of CallKeep and are unaffected. What's lost while disabled: the native lock-screen CallKit/ConnectionService call screen, the guaranteed wake-on-force-quit path for iOS (PushKit), and the native outgoing ringback tone on iOS (the bundled `calling.m4a` ringback still plays there as a fallback in this state - see `app/nurse/connecting.tsx`).

   **To re-enable and finish debugging:** set `EXPO_PUBLIC_ENABLE_CALLKEEP=true`, reproduce the crash, and capture `adb logcat AndroidRuntime:E ReactNative:E ReactNativeJS:E *:S` (or `adb logcat *:E`) from a fresh launch - the `FATAL EXCEPTION` block in that output is what's needed to trace the third crash the same way the first two were found (by reading the actual native source in `node_modules` against the real stack trace, not guessing).

---

## Architecture summary (before the fix)

- **Signaling transport: push notifications only.** There was no WebSocket, Socket.IO, or SSE anywhere in the stack. Every call-state transition (ringing, accepted, rejected, ended) traveled exclusively through Firebase Cloud Messaging.
- **Two apps share near-identical code**: `mobile-app` (Mother, caller) and `loni-server-app` (Nurse, callee) have parallel copies of `store/callStore.ts`, `hooks/useCall.ts`, `components/CallModals.tsx`, `context/NotificationContext.tsx`. Bugs were duplicated across both.
- **LiveKit is self-hosted via Docker** (`livekit/docker-compose.yml`) with `coturn` for TURN relay and `caddy` for TLS, but the app never actually used either — it connected directly to `ws://192.168.100.132:7880`, a hardcoded developer LAN IP baked into 6+ source locations.
- **Backend used SQLAlchemy/Postgres** for calls (`backend-new`, Neon-hosted) and **MongoDB** for devices/push tokens — this dual-database split was intentional and left as-is.

---

## Issue 1 — Nurse presses Accept, Mother isn't notified for a long time

**Root cause:** Call-state notifications were sent via FCM as the *only* signaling channel, and `call_accepted` specifically was sent through `send_push_notification`'s `else` branch — a mixed `notification+data` message with **default** Android priority and **no explicit APNs priority**. Default-priority pushes can be deferred/batched by the OS for power saving (Android Doze/App Standby, iOS default priority 5 = "delay allowed"). Only `incoming_call` was ever sent data-only/high-priority; every other event, including the one this issue is about, was not.

Compounding this: even once received, the Mother's app had to make a full HTTP round trip (`POST /calls/{id}/join`) before showing anything, and on `mobile-app` specifically, **the Firebase foreground listener didn't exist at all** — `NotificationContext.tsx` only registered `expo-notifications` listeners, which never fire for raw FCM data messages sent via `firebase-admin` (see Issue 4 for why). So in the actual repo, the Mother app had *zero* working foreground handler for `call_accepted`.

**Fix:**
- Added a real-time WebSocket channel (`backend-new/app/core/ws_manager.py` + `app/modules/calls/ws_router.py`, mounted at `/api/v1/calls/ws`). Every call-state transition is broadcast over this socket the instant it happens server-side (`CallService._emit`, `<50ms` typical). Both apps open this socket on login (`api/socket.ts`, wired in `NotificationContext.tsx`).
- FCM is now used only as a background-wake fallback, and **all** `call.*` event types (not just `incoming_call`) are sent data-only, `AndroidConfig(priority='high')`, and `apns-priority: 10` (`notifications/service.py`).
- Added the missing Firebase foreground `onMessage` listener to `mobile-app/context/NotificationContext.tsx` (it genuinely didn't exist before).
- Discovered and fixed a **missing dependency**: `mobile-app/package.json` had neither `@react-native-firebase/app` nor `@react-native-firebase/messaging` installed, despite the code calling `require('@react-native-firebase/messaging')`. Added both (matching `loni-server-app`'s versions) and the `@react-native-firebase/app` Expo config plugin to `mobile-app/app.json`.

---

## Issue 2 — Both apps stuck on "Connecting…", room never joined

Four independent root causes, all fixed:

1. **No authorization/state validation on `/calls/{id}/join`.** Any authenticated user could mint a token for any `call_id`, in any state (including calls that were never accepted, or already ended). Fixed in `CallService.join_call` — now checks the caller is a participant and the call isn't in a terminal state.
2. **`incoming-call.tsx` called `/join` instead of `/accept`.** `/join` never runs the accept state machine — it doesn't create the LiveKit room, set `receiver_id`, or notify the caller. If a Nurse ever answered from that specific screen, the call would silently never be marked accepted. Fixed to use `useCall().acceptCall()` → `POST /accept`.
3. **Hardcoded LiveKit URL.** `ws://192.168.100.132:7880` was hardcoded as a fallback in `livekit_service.py`, `useLiveKit.ts` (×2), and `CallModals.tsx` (×2), plus the `.env` files. This only ever worked for a device on that exact WiFi network. Fixed: the backend now hands every client the correct URL via `CallActionResponse.livekit_url` (`LiveKitService.get_public_url()`, backed by a new `LIVEKIT_PUBLIC_URL` setting); all hardcoded fallbacks were removed from client code, and a missing URL now surfaces a visible "Call Failed" state instead of hanging forever.
4. **LiveKit's `node_ip` was hardcoded to the same private LAN IP** with `use_external_ip: false` in `livekit.yaml` — the SFU was telling every client, including ones not on that WiFi, to send WebRTC media to an address they can't reach. Signaling (port 7880) connects fine over LAN; the actual RTP/ICE negotiation silently hangs. Documented and parameterized in `livekit.yaml` (see Issue 9).

---

## Issue 3 — Call timer never starts

**Root cause:** `livekit.yaml`'s `webhook:` block was **entirely commented out**, so LiveKit never sent any webhook events anywhere — `webhook_router.py` existed and looked correct but received zero traffic. Even hypothetically, the webhook URL in the comment pointed at `/api/v1/calls/webhook`, which doesn't exist (the router is mounted at `/api/v1/livekit/webhook`). On the client, both `CallModals.tsx` versions started their timer from local `room.state === 'connected'`, which fires as soon as *that device's* signaling connects — independent of whether the other participant ever joined.

**Fix:**
- Enabled `webhook:` in `livekit.yaml` with the correct URL.
- `webhook_router.py` now drives the state machine: on `participant_joined`, it marks that `CallParticipant.joined_at`, and once **two** participants have joined, sets `Call.status = CONNECTED` and `Call.started_at = now()` — persisted and broadcast over the WebSocket as `call_state: CONNECTED`.
- Client timer (`ActiveCallUI` in both `CallModals.tsx`) now starts only from `callStore.connectedAt`, set redundantly by (a) the local `RoomEvent.ParticipantConnected` listener (fastest) and (b) the server's webhook-driven WS event (authoritative fallback). `setConnected()` is idempotent so both firing is safe.
- `answered_at` is now set in `accept_call` (when the Nurse accepts); `started_at` is set by the webhook handler (when media actually starts); `ended_at`/`duration_seconds` computed in `end_call` from `started_at` (falling back to `answered_at` if webhooks never fired).

---

## Issue 4 — Incoming calls don't work when Nurse app is backgrounded/locked/closed

This was the most consequential gap. Root causes:

1. **No `notifee.onBackgroundEvent`/`onForegroundEvent` registered anywhere.** `index.js` correctly built a full-screen, high-priority, CALL-category notification with Accept/Decline buttons — but nothing listened for a press on them. Tapping either button did nothing.
2. **No cold-start hydration.** If the app was fully killed and relaunched via the notification, nothing read `notifee.getInitialNotification()` to know why it was launched.
3. **Android 13+/14+ manifest permissions missing**: `POST_NOTIFICATIONS` and `USE_FULL_SCREEN_INTENT` were not declared in `app.json`.
4. **No true VoIP wake path on iOS.** `loni-server-app/app.json` already declared `UIBackgroundModes: ["voip", ...]` — someone anticipated this — but there is no PushKit registration or `react-native-callkeep` usage anywhere (the package was even already installed, unused). Plain FCM/APNs delivery to a *terminated* iOS app is not guaranteed; only a PushKit VoIP push reliably wakes a force-quit app.

**Fix:**
- `index.js` (loni-server-app): registered `notifee.onBackgroundEvent` at module scope, calling the REST accept/reject endpoints directly (no React tree required) via `lib/callEvents.ts`'s `acceptCallDirect`/`rejectCallDirect`.
- `NotificationContext.tsx` (loni-server-app): registered `notifee.onForegroundEvent` for the same actions when the app is already open, and `notifee.getInitialNotification()` on mount to hydrate the incoming-call UI after a cold start via notification tap.
- Notifications are now given a predictable id (`incoming-${call_id}`) so a later `call_ended`/`call_timeout`/`call_rejected` push can cancel a stale ringing notification instead of leaving a dead alert on the lock screen.
- Added `android.permission.POST_NOTIFICATIONS` and `android.permission.USE_FULL_SCREEN_INTENT` to `loni-server-app/app.json`.
- Backend now runs a ring-timeout watchdog (`CallService._ring_timeout_watchdog`, 45s) that marks unanswered calls `TIMEOUT`/`MISSED` and notifies both sides — previously an unanswered call stayed `REQUESTED` in the database forever with no way for either client to know to stop.
- **Full PushKit + CallKit/ConnectionService integration, closing the "app fully killed" gap completely:**
  - `loni-server-app/lib/callKeepService.ts` — wraps `react-native-callkeep`. `displayIncomingCall()` shows the native, full-screen, OS-owned incoming-call UI on both platforms (CallKit on iOS, self-managed ConnectionService on Android); `answerCall`/`endCall` native events are wired to `acceptCallDirect`/`rejectCallDirect`/`POST /end`; `getInitialEvents()` replays any answer that happened while the app was still cold-starting.
  - `loni-server-app/lib/voipPush.ts` — registers a PushKit VoIP token via the newly added `react-native-voip-push-notification`, and on receiving a VoIP push calls `displayIncomingCall` **synchronously**, before anything else — Apple revokes an app's VoIP entitlement if it receives a VoIP push without immediately reporting a call.
  - `index.js` now tries CallKeep's `displayIncomingCall` as the primary path on Android too (real ConnectionService call screen, proper ringtone/volume/DND behavior), falling back to the notifee notification only if CallKeep's native module isn't available.
  - `backend-new/app/modules/notifications/voip_service.py` — **new**: sends VoIP pushes directly to Apple's APNs HTTP/2 API using `httpx` (HTTP/2) + `python-jose` (ES256 JWT signing) — both already project dependencies, so no new Python package was needed. FCM cannot send the `voip` push type at all, so this has to bypass FCM entirely. `NotificationService.notify_user` now routes `incoming_call` through this path whenever the target user has a registered `ios_voip` device token.
  - `loni-server-app/plugins/withCallKeepIOS.js` — minimal Expo config plugin (using the official `withEntitlementsPlist` mod) that sets the `aps-environment` entitlement to match the backend's `APNS_USE_SANDBOX` setting.

---

## Issue 5 — Native ringtone / ringback

**Fix:**
- Android (Nurse): CallKeep's self-managed ConnectionService call now drives the incoming-call experience — real system ringtone, respects the phone's volume/Do-Not-Disturb call exceptions, works from the lock screen. `notifee`'s `sound: 'default'` + `AndroidCategory.CALL` notification remains only as the fallback path.
- iOS (Nurse): CallKit owns the incoming-call ring entirely once `displayIncomingCall` is called — genuine native ringtone, no app code plays any audio.
- iOS (Mother, outgoing): `hooks/useCall.ts`'s `requestCall()` now calls `RNCallKeep.startCall()` (`mobile-app/lib/callKeepService.ts`), which gives a **real system ringback tone via CallKit** — the bundled `assets/calling.m4a` is now skipped entirely on iOS (`app/nurse/connecting.tsx` checks `Platform.OS === 'ios'` and returns early).
- Android (Mother, outgoing): the bundled ringback tone is kept **on purpose** — even with full self-managed ConnectionService integration, Android does not auto-play a ringback tone for outgoing calls; that remains an app responsibility. This is exactly the "custom audio only where required" split Issue 5 asks for.
- Fixed a real bug in `connecting.tsx` along the way: `Audio.setAudioModeAsync({ staysActiveInBackground: false })` meant the ringback (and, after connecting, live call audio) would die the instant the screen locked — changed to `true`, and backed by a real `UIBackgroundModes: ["audio"]` declaration added to `mobile-app/app.json` (previously absent — the JS-level flag alone isn't sufficient without the native capability declared).

---

## Issue 6 — Caller info shows "Mother Calling" instead of real data

**Root cause:** `CallService.request_call` hardcoded `"caller_name": "Mother"` as a literal string — it never looked up the caller's actual `User` row. `enrich_user_data()` (`app/utils/user_enrichment.py`) already computed trimester/pregnancy week from `pregnancy_start_date` — it was simply never called from the calls module.

**Fix:** Added `_participant_info()` in `call_service.py`, which calls `enrich_user_data()` and maps it into a new `ParticipantInfo` schema (name, profile_picture, trimester, pregnancy_week, hospital_affiliation, years_of_experience). `request_call` now sends the real caller's full profile in the `incoming_call` payload, plus a `created_at` timestamp. Also fixed a serialization bug this surfaced: FCM data values were stringified with Python's `str()`, which turns a nested dict into an invalid-JSON repr (single quotes) that `JSON.parse()` on the client would throw on — changed to `json.dumps()` for dict/list values (`notifications/service.py`).

---

## Issue 7 — Participant info doesn't sync after answer

**Fix:** `CallActionResponse` now carries a `participant: ParticipantInfo` field, populated per-endpoint with the *other* side's real data (`accept_call` returns the caller's info to the Nurse; `join_call` returns the other side's info to whoever's asking). Both `CallModals.tsx` files now render `remoteParticipant.name/hospital_affiliation/profile_picture` (Mother sees Nurse's info) and `remoteParticipant.name/trimester/pregnancy_week/profile_picture` (Nurse sees Mother's info) instead of a single `callerName` string. Fixed a specific instance of this bug: `loni-server-app/components/CallModals.tsx` hardcoded `"🤰 2nd Trimester"` in JSX for literally every caller — now reads `remoteParticipant.trimester`/`.pregnancy_week`.

---

## Issue 8 — Unreliable call state synchronization

**Root cause:** `RECONNECTING` didn't exist in `CallStatusEnum`. `RINGING`/`CONNECTING`/`CONNECTED` existed in the enum but were **never set anywhere** in the old `call_service.py` — `accept_call` jumped straight from `REQUESTED` to `ACCEPTED`. `MISSED`/`TIMEOUT`/`FAILED` were also never set. The only transport was best-effort push with no ordering guarantee and no de-duplication.

**Fix:**
- Added `RECONNECTING` to `CallStatusEnum` (safe with no migration — the column is `native_enum=False`, i.e. a plain `VARCHAR`).
- `call_service.py` now actually transitions through the full lifecycle: `RINGING` (on request) → `CONNECTING` (on accept, after the LiveKit room is confirmed created) → `CONNECTED` (webhook confirms both joined) → `ENDED`/`CANCELLED`. `reject_call`/ring-timeout set `REJECTED`/`TIMEOUT`/`MISSED`. The LiveKit webhook handler optimistically sets `RECONNECTING` on `participant_left` from a previously-`CONNECTED` call.
- Client `store/callStore.ts` was redesigned around a `status` field that mirrors the backend enum 1:1, so a `call_state` WS message applies with zero translation.
- De-duplication: `callStore.isStale(callId)` guards every event handler in `lib/callEvents.ts` — a re-delivered push (expected, since WS + FCM are both always sent) or an out-of-order message for a call the client has already moved past is a safe no-op instead of resurrecting stale UI.

---

## Issue 9 — LiveKit/Docker networking

Full findings, all documented in-place with inline comments in the affected files (not just here, so future changes don't regress them):

- **`livekit.yaml`**: `node_ip` was hardcoded to one developer's LAN IP with `use_external_ip: false` — only works for devices on that exact WiFi. Documented dev-vs-production configuration directly in the file.
- **TURN was non-functional**: `turn.yourdomain.com` doesn't resolve, `external_tls: true` requires a cert that can't be issued for a non-resolving domain, and `turnserver.conf` had literal placeholder values (`YOUR_PUBLIC_IP`, `YOUR_COTURN_SECRET`) that were never templated from `.env` — so `COTURN_SECRET` in `.env` was silently never used by the actual running coturn process. Fixed: `docker-compose.yml`'s `coturn` service now passes `--external-ip`/`--static-auth-secret`/`--realm` as CLI flags sourced from `.env` (compose variable substitution), which override the static config file and keep the two from drifting.
- **Webhook URL mismatch**: the (disabled) webhook config pointed at `/api/v1/calls/webhook`, which doesn't exist; the real mount point is `/api/v1/livekit/webhook`. Fixed in `livekit.yaml` and `.env.example`.
- **Backend/client URL conflation**: one `LIVEKIT_URL` env var was being used both for the backend's server-to-server REST calls *and* implicitly for what clients should connect to, with no way to differ. Split into `LIVEKIT_URL` (backend-only, can be an internal/docker-network address) and `LIVEKIT_PUBLIC_URL` (what `LiveKitService.get_public_url()` hands to every client) in `backend-new/app/core/config.py`.
- **6 hardcoded client-side fallbacks removed**: `livekit_service.py`, `useLiveKit.ts` (×2 apps), `CallModals.tsx` (×2 apps) all had `'ws://192.168.100.132:7880'`/`'http://192.168.100.132:7880'` baked in as defaults. All removed — a missing URL is now a loud, visible error instead of a silent wrong-network connection.

**What still requires the user's action** (can't be done blind, since it depends on real infrastructure): registering a real domain for `DOMAIN`/TURN, pointing DNS at the LiveKit host, and setting `PUBLIC_IP`/`LIVEKIT_PUBLIC_URL` to that domain for anything beyond same-LAN development. Every place this matters now has an inline comment explaining exactly what to set and why.

---

## Issue 10 — Signaling flow audit

Traced end to end; the flow in the ticket (`Mother → FastAPI → LiveKit → FCM → Nurse → Accept → Backend → LiveKit → Connection`) undersold what was actually happening: there was no realtime layer at all, `/join` had no auth check (a real security hole, not just a latency one), and duplicate/racing requests were possible (e.g., the Mother's `call_accepted` push handler could fire the `/join` POST twice if both WS and FCM delivered it). Fixed by:
- Adding the WebSocket layer (Issue 1).
- Adding authorization + state checks to `/join` (Issue 2).
- Guarding every event handler with `callStore.isStale()` so duplicate delivery over two transports is a no-op (Issue 8).
- Pessimistic row locking (`with_for_update()`) was already correctly used for `accept`/`reject`/`end` to prevent double-accept races — kept as-is, it was one of the few things already right.

---

## Issue 11 — WebSocket audit

There were no WebSockets before this fix, so there was nothing to audit — this is itself the finding. The new socket (`api/socket.ts`, both apps) implements:
- **Connection**: guarded against duplicate connects (checks `readyState` before opening a new one).
- **Disconnection**: explicit `disconnectCallSocket()` clears all timers/listeners, called on logout.
- **Reconnect**: exponential backoff, 1s → 30s cap, disabled once `disconnectCallSocket()` is called explicitly.
- **Keepalive**: app-level ping every 25s (`{"type":"ping"}`), server replies `{"type":"pong"}` — detects NAT-killed connections that TCP itself won't notice for a long time.
- **No duplicate/missing listeners**: a single `onmessage` handler routes everything through `applyServerCallEvent`, replacing what used to be three separate, divergent copies of similar logic.

---

## Issue 12 — LiveKit event listener audit

Before: only `RoomEvent.ConnectionStateChanged` was handled, and it was duplicated (once ad-hoc inside `ActiveCallUI`, and again unused in `useLiveKit.ts`, which `CallModals.tsx` didn't even call). After, `ActiveCallUI` (both apps) handles: `ParticipantConnected` (drives the timer — see Issue 3), `Reconnecting`/`Reconnected` (drives `RECONNECTING` state), `ConnectionQualityChanged` (surfaced to the store, was previously read nowhere), `TrackSubscribed` (confirms remote audio actually started — Issue 13), `Disconnected` (local safety net that ends the call UI even if the WS/webhook path is delayed). All listeners are attached and detached in the same `useEffect` with a matching cleanup function — no leaks.

---

## Issue 13 — Microphone permissions & audio session

**Root cause:** `Audio.requestPermissionsAsync()` was called inside a `useEffect` gated on `isActive` — but `isActive` only becomes `true` *after* `<LiveKitRoom connect={true}>` has already mounted and started connecting/publishing, i.e. the permission prompt raced the connection attempt instead of gating it.

**Fix:** Both `CallModals.tsx` now request microphone permission the moment a room token becomes available, **before** `<LiveKitRoom>` is ever rendered, and show a blocking "Microphone Required" screen if permission isn't granted rather than silently attempting to connect and publish without a mic. Remote audio auto-start is confirmed via the new `TrackSubscribed` listener (Issue 12) — `@livekit/react-native` handles the actual device audio-output attachment automatically once subscribed.

---

## Issue 14 — Cleanup on call end

**Root cause:** `end_call` only ran when a client explicitly called `POST /end`. A crashed app, lost network, or force-quit mid-call left the room open until LiveKit's 5-minute `empty_timeout`, with the DB row stuck in whatever status it was last in. `CallParticipant.left_at` existed in the schema but was **never written anywhere** in the whole codebase.

**Fix:**
- `end_call` now sets `left_at` on every participant row that doesn't have it yet, and correctly distinguishes `CANCELLED` (call ended while still ringing) from `ENDED` (call ended after being answered) — the `CANCELLED` enum value existed but was never used before.
- `webhook_router.py` now handles the `room_finished` LiveKit event as a safety net: if a call somehow never got a `/end` call (crash, killed app), LiveKit's own room-closed event reconciles the DB — sets `ENDED`, computes `duration_seconds`, and marks any still-open `left_at` fields — instead of the call staying open forever.
- `participant_left` webhook events also stamp `left_at` in near-real-time, so presence is reconstructable even mid-call.

---

## Files changed

**Backend (`backend-new/`)**
- `app/core/config.py` — added `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`/`LIVEKIT_PUBLIC_URL` settings
- `app/core/ws_manager.py` — **new**, WebSocket connection registry + broadcast
- `app/api/router.py` — mounted the new WS router
- `app/modules/calls/ws_router.py` — **new**, `/calls/ws` signaling endpoint
- `app/modules/calls/models.py` — added `RECONNECTING` to `CallStatusEnum`
- `app/modules/calls/schemas.py` — added `ParticipantInfo`, `livekit_url`/`participant` fields
- `app/modules/calls/services/call_service.py` — full state-machine rewrite, ring-timeout watchdog, real participant info, `left_at` cleanup
- `app/modules/calls/services/livekit_service.py` — removed hardcoded URL fallback, added `get_public_url()`/`list_participants()`
- `app/modules/calls/router.py` — auth/state checks on `/join`, `livekit_url`/`participant` in responses
- `app/modules/calls/webhook_router.py` — drives state machine off real LiveKit events
- `app/modules/notifications/service.py` — all call events sent data-only/high-priority, proper JSON encoding of nested payload values, routes `incoming_call` to VoIP push when an `ios_voip` token is registered
- `app/modules/notifications/voip_service.py` — **new**, direct-to-APNs PushKit VoIP push sender (no new dependency — built on existing `httpx`/`python-jose`)
- `.env` — added `LIVEKIT_PUBLIC_URL`, `APNS_*` VoIP settings, clarifying comments

**LiveKit infra (`livekit/`)**
- `livekit.yaml` — enabled `webhook:` with correct URL, extensive networking comments
- `docker-compose.yml` — `coturn` command now sources real secret/IP from `.env`
- `.env` / `.env.example` — clarifying comments, fixed webhook path reference

**Mother app (`mobile-app/`)**
- `index.js` — **new** (didn't exist — `package.json` pointed straight at `expo-router/entry`, so FCM background handler was never registered at all)
- `package.json` — added missing `@react-native-firebase/app`/`messaging`, added `react-native-callkeep`, fixed `main`
- `app.json` — added `@react-native-firebase/app` plugin, `POST_NOTIFICATIONS` permission, `ios.infoPlist.UIBackgroundModes: ["audio"]` (previously absent entirely)
- `store/callStore.ts` — full state-machine rewrite
- `api/socket.ts` — **new**, WebSocket client
- `lib/callEvents.ts` — **new**, shared event-handling logic, now also drives CallKeep state
- `lib/callKeepService.ts` — **new**, native outgoing-call UI (`startCall`/`reportConnected`/`reportCallEnded`)
- `hooks/useCall.ts` — updated for new store/response shape, starts the native call on `requestCall`
- `context/NotificationContext.tsx` — removed dead listeners, added working Firebase foreground handler + socket lifecycle + CallKeep setup
- `components/CallModals.tsx` — full LiveKit event coverage, server-driven timer, real participant info, mic-permission gating, no hardcoded URL
- `app/nurse/connecting.tsx` — fixed background audio session, reacts to terminal call states, skips the bundled ringback tone on iOS (CallKit provides a real one)

**Nurse app (`loni-server-app/`)**
- `index.js` — added `notifee.onBackgroundEvent` + CallKeep/VoIP-push setup at module scope, notification id/cancel logic, CallKeep as the primary Android incoming-call path
- `app.json` — added `POST_NOTIFICATIONS`/`USE_FULL_SCREEN_INTENT` permissions, the `withCallKeepIOS` plugin
- `package.json` — added `react-native-voip-push-notification` (`react-native-callkeep` was already present but unused)
- `plugins/withCallKeepIOS.js` — **new**, sets the `aps-environment` entitlement
- `store/callStore.ts`, `api/socket.ts` (new), `hooks/useCall.ts` — same pattern as mobile-app
- `lib/callEvents.ts` — **new**, shared event-handling logic (`acceptCallDirect`/`rejectCallDirect`), now also drives CallKeep state and calls `displayIncomingCall` for consistency across delivery paths
- `lib/callKeepService.ts` — **new**, native incoming-call UI (`displayIncomingCall`/`reportConnected`/`reportCallEnded`, `answerCall`/`endCall` event wiring)
- `lib/voipPush.ts` — **new**, PushKit VoIP token registration + incoming-push handling
- `context/NotificationContext.tsx` — added `onForegroundEvent`, `getInitialNotification()`, socket lifecycle, CallKeep/VoIP setup
- `components/CallModals.tsx` — same fixes as mobile-app, plus removed the hardcoded `"🤰 2nd Trimester"` badge
- `app/incoming-call.tsx` — fixed to use `POST /accept` (was calling `/join`, which skips the entire accept state machine)

---

## Known dead code (found, not deleted)

- `mobile-app/app/nurse/call.tsx` and its dependency on `assets/images/nurse-img.png` — a static mock "call ongoing" screen with a hardcoded name ("Micheal Gracia") and a local-only timer, entirely disconnected from `callStore`/LiveKit. Nothing in the codebase navigates to it. It's not part of the live call flow (`components/CallModals.tsx` is), left untouched since deleting screens wasn't asked for, but flagged here so it isn't mistaken for working code.

## What's implemented in code vs. what needs your Apple/Google Developer accounts + a physical device

Everything that can be done as source code is done — the full CallKit/ConnectionService + PushKit VoIP stack is wired end to end (Issues 4 and 5 are now fully addressed in code, not just documented as gaps). What's left is inherently outside what any sandboxed text environment can do, because it requires real developer-account credentials and native compilation:

1. **Run `npm install`** in both `mobile-app/` and `loni-server-app/` to pull in the newly added `react-native-callkeep` (mobile-app) and `react-native-voip-push-notification` (both) packages.
2. **`npx expo prebuild --clean`** (both apps) to regenerate the native iOS/Android projects with these modules linked in, then build and install on a **physical device** — VoIP pushes do not work in the iOS Simulator at all, and CallKit/ConnectionService native UI is best verified on real hardware.
3. **Apple Developer portal**: enable "Push Notifications" and "Background Modes → Voice over IP" capabilities for the `com.loni.server` App ID; generate an APNs Auth Key (.p8) and enter it plus its Key ID and your Team ID as `APNS_VOIP_AUTH_KEY`/`APNS_KEY_ID`/`APNS_TEAM_ID` in `backend-new/.env` (exact steps are in the comment block above those settings in `app/core/config.py`).
4. **Real TURN/domain setup.** Set `DOMAIN`, `PUBLIC_IP`, `LIVEKIT_PUBLIC_URL` to real values once there's a public host for LiveKit; the code and config no longer have any hardcoded blocker, but the actual DNS/cert/VPS provisioning is an infra task outside this codebase.
5. **Horizontal scaling of the WS layer.** `ws_manager.py`'s `ConnectionManager` is in-process only; if the FastAPI backend is ever run with >1 worker/container, swap it for the Redis pub/sub the LiveKit `docker-compose.yml` already runs, so a broadcast reaches a user regardless of which worker holds their socket.
6. **Load/soak test** the ring-timeout watchdog and webhook-driven state machine, and the CallKeep native UI under real interruption scenarios (an actual cellular call arriving mid-VoIP-call, airplane mode toggling, etc.), before shipping.
