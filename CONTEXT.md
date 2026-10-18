# LONI: Full Application Context

> One document that explains the whole LONI system: what it is, who uses it, how every part is built, how the parts talk to each other, how to run it, and what is still unfinished.
> Written 2026-10-18 from a full read of the monorepo. Paths are relative to the repo root. When you change something important, update the relevant section here.
> Two other docs already exist and go deeper on one topic: `CALL_SYSTEM_AUDIT.md` (voice calling debug history) and `backend-new/app/modules/ai_chat/README.md` / `backend-new/app/modules/checkins/README.md` (AI and check-ins).

---

## 1. What LONI is

**LONI ("Your Companion Through Motherhood")** is a maternal and women's health platform for Nigeria (₦ pricing, Lagos/Abuja context, Nigerian hospital pathways). It puts support "in the mother's pocket" by combining five things in one place:

| Pillar | What it is |
| --- | --- |
| **Loni AI** (also called "Luma" / "LONI Bot") | A 24/7 AI companion for women's health: pregnancy, postpartum, periods, contraception, fertility, menopause, sexual and breast health, wellbeing. Has emergency triage, memory, hospital look-ups and proactive daily check-ins. Not a doctor. |
| **Human nurses** | Verified nurses take **voice calls** from mothers (LiveKit) when an AI answer is not enough. |
| **Emergency rides** | A mother requests an **emergency ride**; verified **drivers** nearby are offered the trip, first to accept wins; live tracking; her emergency contacts can follow. |
| **Partners & family** | A mother invites a **support partner** (husband, relative). The partner gets their own dashboard (her journey, shared updates, emergency alerts, live ride location). She controls what is shared. |
| **Community** | A feed where mothers post, like, comment, and see viewers. |

Plus a paid tier, **LONI Plus** (7-day free trial; care plan, nutrition, weekly report, hospital bag, labour prep, priority features), and a marketing website.

**Audiences:** mothers/women (main app), nurses, drivers, support partners, admins.

**Brand:** primary pink `#D62D88` (web hero `#f7389d`), CalSans (headings) + Helixa (body) in the apps, Public Sans + Archivo Narrow on the web. Support email `support@lonimum.com`. Domain `lonimum.com`.

---

## 2. Repository map

Monorepo `https://github.com/goodnessaig1/loni.git`. Current branch `ft-community-and-theme`; other branches: `master`, `ft-ai`, `ft-backend-init`, `ft-driver`, `ft-emergency-support`, `ft-landing-page`, `ft-partner`, `ft-push-notifications`, `ft-voice-calling`. At the time of writing, ~80 files (backend-new and mobile-app) have **uncommitted** work (dark mode, subscriptions, care plan, AI, check-ins, women's health, etc.).

| Folder | What it is | Status |
| --- | --- | --- |
| `backend-new/` | **FastAPI** backend (Python). The live API, WebSocket and AI. | **Active, the real backend** |
| `mobile-app/` | **Expo / React Native app for mothers/women** ("Loni", `com.loni.app`). | **Active** |
| `loni-server-app/` | **Expo / React Native app for nurses, drivers and support partners** ("Loni Server", `com.loni.server`). | **Active** |
| `loni-web/` | **React + Vite marketing website** (home, drivers, nurses, partners, about, legal) + a partner verify page. | **Active** |
| `livekit/` | Docker stack for self-hosted **LiveKit** (voice), Redis, coturn (TURN), Caddy (TLS). | Active infra |
| `backend/` | The **original Node/Express + Drizzle** backend (auth + health only). | **Legacy, superseded by `backend-new`** |
| `scripts/update-lan-ip.sh` | Rewrites every file that hardcodes your machine's LAN IP when it changes. | Dev helper |
| `CALL_SYSTEM_AUDIT.md` | Long record of voice-call bugs found and fixed. | Reference |
| `brain/`, `.claude/` | Local AI-assistant scratch/config (`brain/.../implementation_plan.md` is empty). | Ignore |

Not in the repo (gitignored): `.env` files, `node_modules`, `dist`, `venv`. `GoogleService-Info.plist` / `google-services.json` for Firebase ARE present in both apps.

---

## 3. System architecture

```
                        ┌──────────────────────────── loni-web (Vercel) ─────────────────────────────┐
                        │ marketing site; /verify page for support partners → POST /auth/setup-partner │
                        └─────────────────────────────────────────────────────────────────────────────┘
 mobile-app (Mother)  ─┐                                                       ┌─► PostgreSQL (Neon)   users, calls, rides, subscriptions,
 loni-server-app       ├──  HTTPS REST  /api/v1/*   ───►  backend-new (FastAPI)│                      care, check-ins, community, notifications…
 (Nurse/Driver/Partner)│     + WebSocket /api/v1/calls/ws  ◄── live events ───┤─► MongoDB            AI chat sessions & messages,
                        │                                                      │                      device push tokens, AI safety audit
 loni-web ─────────────┘                                                       ├─► LiveKit (self-hosted) voice rooms (token issued by API; webhooks back)
                                                                               ├─► Firebase FCM  push (data-only, high priority) · APNs VoIP (PushKit)
                                                                               ├─► Cloudinary    profile pictures, documents, community images
                                                                               ├─► Brevo         transactional email (OTP, invites)
                                                                               ├─► Google Maps   Directions, Places (hospitals, facility look-up), Geocoding
                                                                               └─► LLM           OpenAI / Abacus RouteLLM (deepseek) / Ollama (local)
```

**Two databases on purpose:** Postgres (relational, SQLAlchemy async + Alembic) and MongoDB (Motor) for chat transcripts, device tokens and the AI safety audit trail.

**Real-time:** one authenticated WebSocket per foregrounded client (`wss://<host>/api/v1/calls/ws?token=<JWT>`). The server pushes `{"type": ..., "data": ...}` frames for calls, rides, account approval, community. **FCM push is the wake-up fallback**, never the source of truth. All `call.*`/`ride_*` pushes are data-only, Android `priority=high`, APNs priority 10. Clients de-dupe (WS + FCM both fire by design).

**Auth:** email + password → JWT (HS256, `SECRET_KEY`, default 8-day expiry). Sent as `Authorization: Bearer` over REST and `?token=` on the WebSocket. Mobile stores it in `expo-secure-store` under key `userToken`.

**API envelope:** most endpoints return `{"success": true, "message": "...", "data": {...}}`; errors are `{"success": false, "message": "..."}` with the real HTTP status (custom handlers in `app/main.py`; validation errors become **400**, not 422). A few ride endpoints return the model directly.

---

## 4. People, roles and account lifecycle

`users.user_type`: `user` (a mother/woman, the default), `nurse`, `driver`, `partner`, `admin` (`rider` exists in the enum, unused).

`users.status` (the woman's stage): `pregnant`, `newMom` (postpartum), `ttc` (trying to conceive), `general` (not pregnant; women's health in general). Null = unknown. Pregnancy week is **recomputed live** from `pregnancy_start_date` whenever the user is read (`app/utils/user_enrichment.py`); trimester boundaries are 1–12 / 13–27 / 28+. Postpartum "baby age" is in weeks.

`users.account_status`: `pending` → `active` → `suspended`. Nurses and drivers start `pending` and need **admin approval** (`PATCH /admin/users/{id}/status`), which notifies them over WS + FCM (`account_status` event / `account_approved` push).

**Flows**
- **Register** (`POST /auth/register`): name, email, password, stage fields. A 4-digit **email OTP** is generated (and also printed to the server console in dev) and emailed via Brevo. `verify-email` → verified. "Phone verification" (`add-phone` / `verify-phone`) also uses an **emailed OTP**, there is **no SMS provider**.
- **Support partner:** a mother adds contacts (`POST /users/emergency-contacts` or `/invite-partner`). The backend creates a `partner` user with an unusable password and emails an invite. The partner completes setup (set password + phone) on the web `/verify?email=…` page or in the server app (`/auth/setup-partner`, `/auth/verify-partner-setup`). A `EmergencyContact` row links them with **per-contact permissions** `location`, `updates`, `emergency` and a `pending → connected` status.
- **Nurse onboarding:** role selection → complete profile (hospital, years of experience, documents) → `pending` → review → `active`.
- **Driver onboarding** (state machine in `driver_training/onboarding.py`): training modules → **aptitude test** (random 10 questions, 3 attempts, pass at 8/10, answers never exposed to the client) → personal info → vehicle info → documents → under review → approved.

---

## 5. Backend (`backend-new/`)

### 5.1 Stack and layout
FastAPI 0.137, Python 3.13, SQLAlchemy 2 async + asyncpg, Alembic, Pydantic 2, Motor (Mongo), firebase-admin, LiveKit API, httpx, OpenAI SDK, Cloudinary, Brevo (`sib-api-v3-sdk`). Tests: pytest + anyio + aiosqlite.

```
backend-new/
  app/main.py            app, CORS (*), exception handlers, startup/shutdown (Mongo, Firebase, background workers)
  app/api/router.py      mounts every module under /api/v1; app/api/deps.py = get_current_user / get_admin_user
  app/core/              config.py (settings), database.py, mongo_db.py, security.py (JWT/bcrypt), ws_manager.py
  app/modules/<name>/    models.py · schemas.py · router.py · service(s).py   (one folder per feature)
  app/utils/             user_enrichment.py (stage/week/trimester), partner_content.py (week-by-week partner copy), generateId.py
  app/scripts/           seed_admin.py, seed_aptitude_questions.py, migrate_contacts*.py
  db/migrations/         Alembic (versions/ has 15 revisions)
  tests/                 435 tests, fakes.py (fake Mongo), triage_cases.py (safety gold set)
```
Docs: `/docs` (Swagger), `/redoc`, OpenAPI at `/api/v1/openapi.json`.

### 5.2 Run it
```bash
cd backend-new && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt && pip install -r tests/requirements-test.txt
# create .env (see 5.3), then:
alembic upgrade head
uvicorn app.main:app --reload --port 8000
python -m pytest tests -q           # 435 pass
```
Default `DATABASE_URL` in the local `.env` is local Postgres (`localhost/loni`); a Neon URL is kept commented. **Never run migrations against a shared DB by accident.**

### 5.3 Environment variables (`app/core/config.py`)
| Group | Variables |
| --- | --- |
| Core | `DATABASE_URL`, `SECRET_KEY` (**change the default**), `ACCESS_TOKEN_EXPIRE_MINUTES` (8 days), `FRONTEND_URL`, `PROJECT_NAME` |
| Email | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` |
| Media | `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` |
| Push | `FIREBASE_SERVICE_ACCOUNT` (JSON string), `APNS_VOIP_AUTH_KEY` (.p8 contents), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` (`com.loni.server`), `APNS_USE_SANDBOX` |
| Mongo | `MONGODB_URI` |
| LiveKit | `LIVEKIT_URL` (backend→LiveKit, internal), `LIVEKIT_PUBLIC_URL` (wss URL phones use), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| AI | `AI_ENVIRONMENT` (`production`=Abacus, `openai`, `local`=Ollama), `OPENAI_API_KEY`, `ABACUS_API_KEY`, `OLLAMA_BASE_URL`, `AI_TRIAGE_CLASSIFIER` (true), `EMERGENCY_PHONE` ("112") |
| Facility look-up | `FACILITY_LOOKUP_ENABLED` (true), `GOOGLE_MAPS_API_KEY` (Places API enabled), `WEB_SEARCH_API_KEY` (optional Tavily fallback) |
| Check-ins | `CHECKINS_ENABLED` (**false**), `CHECKIN_TICK_SECONDS` (900), `CHECKIN_DEFAULT_TZ` (Africa/Lagos), `CHECKIN_DEFAULT_HOUR` (9), `CHECKIN_END_HOUR` (20), `CHECKIN_MAX_PER_DAY` (2) |
| Rides | `RIDE_BASE_FARE` 1500, `RIDE_PER_KM` 200, `RIDE_PER_MIN` 50, `RIDE_MIN_FARE` 2000, `RIDE_SEARCH_RADIUS_KM` 8, `RIDE_SEARCH_RADIUS_MAX_KM` 20, `RIDE_OFFER_TIMEOUT_SECONDS` 120 |
| Driver test | `APTITUDE_QUESTION_COUNT` 10, `APTITUDE_MAX_ATTEMPTS` 3, `APTITUDE_PASS_SCORE` 8 |

### 5.4 Modules, endpoints and tables
Prefix for everything: `/api/v1`.

| Module (prefix) | Purpose | Key endpoints | Tables / stores |
| --- | --- | --- | --- |
| **auth** (`/auth`) | Registration, login, OTP, password reset, partner setup | `register`, `login`, `verify-email`, `resend-otp`, `forgot-password`, `reset-password`, `add-phone`, `verify-phone`, `setup-partner`, `verify-partner-setup` | `otps` |
| **users** (`/users`) | Profile, stage, emergency contacts/partners, notification history, nurse/driver profiles | `GET me`, `PATCH update-profile`, **`PATCH stage`**, `PUT me/password`, `POST/GET emergency-contacts`, `DELETE emergency-contacts/{id}`, `PATCH …/permissions`, `POST invite-partner`, `GET partner-connection`, `GET partner-dashboard`, `GET notifications`, `POST notifications/mark-read`, `POST profile-picture`, `POST upload-document`, `POST profile/nurse`, driver profile steps, `PATCH online-status`, `PATCH profile`, `PATCH nurse-profile` | `users`, `emergency_contacts`, `nurse_profiles`, `driver_profiles` |
| **calls** (`/calls`) | Mother ↔ nurse voice calls (LiveKit) | `POST request`, `{id}/accept`, `{id}/join`, `{id}/reject`, `{id}/end`, `{id}/rate`, `GET history`, `GET stats`; **WS `/calls/ws`**; LiveKit webhook `POST /livekit/webhook` | `calls`, `call_participants`, `call_events` |
| **rides** (`/rides`) | Emergency ride dispatch | `POST quote`, `GET hospitals`, `POST request`, `GET active`, `GET history`, driver: `available`, `stats`, `PATCH availability`, `POST location`, `{id}/accept|decline|arrived|start|complete`, rider: `{id}/cancel|rate`, `GET {id}`, `GET {id}/route` | `rides`, `ride_events`, `ride_offers` |
| **driver-training** (`/driver-training`, `/admin/aptitude`) | Driver signup flow + admin question bank | `start`, `onboarding`, `modules`, `modules/complete`, aptitude status/start/submit; admin CRUD + seed + attempts | `aptitude_questions`, `aptitude_attempts`, `driver_training_progress` (content in `seeds/*.json`) |
| **notifications** (`/notifications`) | Device registration and push | `POST/GET devices`, `POST test` | Mongo `devices`; Postgres `notification_logs` (the Notification Centre) |
| **ai-chat** (`/ai-chat`) | Loni AI sessions, streaming messages, admin review | sessions CRUD, `POST sessions/{id}/messages` (**SSE stream**), `GET/POST admin/safety-events…` | Mongo `sessions`, `messages`, `ai_safety_events` |
| **checkins** (`/checkins`) | Proactive daily check-ins + Loni's memory | `GET/PUT preferences`, `GET/DELETE memory`, `POST {id}/opened`, admin `preview` / `run` | `checkin_preferences`, `checkin_logs`, `wellbeing_notes` |
| **subscriptions** (`/subscriptions`) | LONI Plus trial/cancel/resume | `plans`, `me`, `POST trial`, `cancel`, `resume` | `subscriptions` |
| **care** (`/care`, LONI Plus only) | Daily care plan, nutrition, weekly report, hospital bag, labour prep | `overview`, `today`, `PUT today/{key}`, `nutrition`, `weekly-report`, `hospital-bag`, `labour-prep[/{slug}]` | `care_task_logs`, `hospital_bag_checks` (content in `care/content.py`) |
| **community** (`/community`) | Feed, likes, comments, views | `posts`, `images`, `posts/{id}/like`, `…/comments`, `views` | `community_posts`, `community_post_stats`, `community_likes`, `community_comments`, `community_views` |
| **admin** (`/admin`) | Approve nurses/drivers | `GET users`, `PATCH users/{id}/status` | — |
| **health** (`/health`) | Liveness + DB check | `GET /` | `health_checks` |

### 5.5 Data model essentials
- **users:** id (12-char string), name, email (unique), bcrypt password, `status`, `account_status`, `user_type`, `pregnancy_week` / `pregnancy_start_date` / `baby_age` / `trimester`, phone, gender, verification flags, `profile_picture`, `referral_code`/`referred_by`, `is_online`.
- **driver_profiles** carry live GPS (`current_lat/lng`, `heading`, `location_updated_at`), `is_available`, `active_ride_id`, ratings, trips and earnings.
- **Counters live in separate stats rows** (`community_post_stats`) so hot counter writes never touch the post row. Views are **buffered and batch-written** every 3 s (`community/view_buffer.py`).
- **Soft deletes** on posts (`deleted_at`).
- All timestamps are timezone-aware UTC.

### 5.6 Background work (started in `app/main.py`)
- Community **view flusher** (every 3 s; flushes on shutdown).
- **Check-in scheduler** (every 15 min, only if `CHECKINS_ENABLED`; Postgres advisory lock so one instance runs).
- Per-call **ring-timeout watchdog** (45 s → MISSED/TIMEOUT) and per-ride **offer-timeout watchdog** (120 s per round, two rounds, then `NO_DRIVERS`), each in its own DB session.

### 5.7 Voice calls (mother → nurse)
`POST /calls/request` creates a `Call` (status RINGING, room `room-<uuid>`). If `nurse_id` is set that nurse is rung; otherwise **all online nurses**. States: REQUESTED → RINGING → ACCEPTED → CONNECTING → CONNECTED → ENDED (+ MISSED, REJECTED, CANCELLED, FAILED, TIMEOUT, RECONNECTING). Nurse `accept` → the backend issues LiveKit tokens; both apps `join` the room. State changes are broadcast over WS and mirrored by data-only FCM; iOS can use **PushKit VoIP** (direct to APNs) to wake a killed app. LiveKit webhooks update call status. Details, root causes and fixes of every call bug: `CALL_SYSTEM_AUDIT.md`.

### 5.8 Emergency rides
`quote` (fare + route + ETA, no row) → `request` (mother's pickup lat/lng, destination hospital from Google Places, optional `notify_contacts`). Dispatch finds online, available drivers near pickup (8 km, widening to 20 km), creates `RideOffer`s, **first accept wins**. Ride states: SEARCHING → DRIVER_ASSIGNED → DRIVER_EN_ROUTE → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED (+ CANCELLED, NO_DRIVERS, FAILED). Driver GPS heartbeats stream to the mother and, if she opted in, to connected emergency contacts (`ws_only` for the high-rate location events). Fare = `max(min, base + per_km·km + per_min·min)` rounded up to ₦100; **no payment integration** (fare is a displayed number and recorded driver earnings). Without a Maps key it falls back to straight-line distance.

### 5.8b LONI Plus subscriptions
One row per user. Plans (server-side so prices change without an app release): monthly ₦9,900 and annual ₦5,900 (as in the Figma, which looks like a design typo; verify). **7-day free trial, once per user, no card taken.** Access is **computed from dates**, never a stored flag: `trialing | active | cancelled` all grant access until `current_period_end`; then `expired`. Cancelling keeps access to period end; `resume` undoes it. `require_plus` (a FastAPI dependency) gates `/care/*`. **No payment provider is connected**; a provider webhook would set `status='active'` and `current_period_end`.

### 5.8c Care plan (LONI Plus)
Content is curated copy in `care/content.py` (daily tasks by stage: pregnancy / postpartum / general, nutrition, hospital bag checklist, 4 labour-prep guides). Only what the mother ticks is stored. The client sends its **local date**; the server clamps it to ±1 day of UTC today (no back-filling). The weekly report is **rule-based** from the last 7 days of ticks (not AI).

### 5.8d Stage changes
`PATCH /users/stage` (`users/stage.py`) switches trimester / recovery stage / pregnant ↔ postpartum ↔ trying-to-conceive ↔ general. It moves `pregnancy_start_date` (otherwise the live recompute would undo it).

---

## 6. Loni AI in depth (`app/modules/ai_chat`, `app/modules/checkins`)

### 6.1 Principles
Loni is for **every woman**. It is warm, human-sounding and a good listener, but **honest that it is an AI**, never claims to be a nurse, never discourages real care, and always keeps a human (LONI nurse, her doctor, her partner) in the picture. Safety is enforced in **code**, not just in the prompt.

### 6.2 What happens to each message (`ai_chat/service.py::stream_chat_message`)
1. Save her message (Mongo).
2. **Triage** (`triage.py`): deterministic regex rules classify urgency `emergency | urgent | routine | educational`, domain, question type, and which app buttons to offer. Handles misspellings, a few Nigerian Pidgin phrases, negation ("no bleeding"), general questions vs first-person, stage context (waters breaking before 37 weeks is an emergency; "can't feel the baby move" is normal at 12 weeks; pregnancy-only rules are skipped for non-pregnant women). ~270 triage tests driven by the gold set in `tests/triage_cases.py`; rule of thumb: **never under-triage**.
3. **Classifier** (`classifier.py`): a small second LLM call that can only **raise** urgency (4 s timeout, fails open to rules).
4. If she is replying inside a **check-in** chat, record the response (`good | rough | question | concerning`).
5. **Emergency:** send a fixed pre-written message from `messages.py` immediately (the LLM is **not called**), with buttons: Request Emergency Ride, Talk to a Nurse, Call emergency services (`EMERGENCY_PHONE`). Emergency messages always include "LONI is not an ambulance".
6. **Facility look-up** (`lookup.py`): hospital hours/phone/address questions go to Google Places (+ optional Tavily). Results are injected as a `LOOKUP RESULTS` block; the reply ends with an automatic "Source: … call to confirm" footer. No area given → the AI asks. No key / nothing found → the AI says it can't check, never guesses.
7. **Memory** (`checkins/memory.py`): learn mood/symptom/topic **tags** from what she says (fixed vocab, **never her words**), and tell the model what she mentioned recently.
8. **Urgent:** a fixed "get checked today" line first, then the model under a no-reassurance directive. **Routine/educational:** model answer shaped by the question type (cycle, contraception, fertility, menopause, sexual/breast/urinary health, medication, test results, nutrition, newborn, emotional, decision support, partner/family, care navigation…).
9. **Safety validator** (`safety.py`) post-checks the answer: reassurance on a red flag, doses, "stop your medicine", invented bookings, **phone numbers or "open 24/7" claims not backed by a look-up**, and appends the short "not medical advice" reminder to health answers.
10. Save the reply with its `meta` (urgency, actions, sources) and write a **privacy-safe audit event** (decision + rule ids only, no text) to `ai_safety_events`. Urgent/emergency/mental-health events are queued for **human review** (admin endpoints).

The stream is **SSE**: `data: {"meta": {...}}` first, then `data: {"content": "..."}` chunks, then `data: [DONE]`.

### 6.3 LLM providers
`AI_ENVIRONMENT=production` → Abacus RouteLLM (`deepseek-v4-flash`); `openai` → `gpt-3.5-turbo`; `local` → Ollama `qwen3:8b`. Temperature 0.5. The system prompt (`prompts.py`) covers identity, voice, listening mode, answer structure, safety rules, what LONI can actually do, Nigerian context, women's health, emotional support, newborns, privacy.

### 6.4 Proactive check-ins ("Loni says hello")
Scheduler → for each woman: **category** (`preg_t1/t2/t3/term`, `pp_early/active/extended`, `women`, `ttc`, `general`) and **care level** (`standard | enhanced | intensive`, raised by recent danger, mental-health flags, worrying answers, or low-mood days) → **guards** (opted out, quiet hours **in her timezone**, already sent today, 2/day cap, too soon for her level, active/chatting today, ride in progress, no device) → **claim** the slot with an `INSERT` into `checkin_logs` (UNIQUE `(user_id, dedupe_key)`; only the inserter sends, so duplicates are impossible) → create an AI chat seeded with the hello + quick replies, a Notification Centre row, and the push. Tapping the notification opens that chat. Follow-ups after urgent/mental-health conversations (20–48 h later). Silent users are eased to weekly after 3 ignored hellos. Hellos can pick up what she said ("how's the headache?"), mark milestones, and vary wording. **Off by default**; use `GET /checkins/admin/preview` first.

### 6.5 Memory controls
Women can see (`GET /checkins/memory`), switch off (`remember=false`) and erase (`DELETE /checkins/memory`) everything Loni remembers. The Privacy screen in the mother app exposes this.

### 6.6 What still needs a human
Clinician sign-off on triage rules, the fixed emergency messages (incl. first-aid lines), check-in wording and the Pidgin phrases; a clinician-approved knowledge base (none yet); Yoruba/Igbo/Hausa support (none).

---

## 7. Mother app (`mobile-app/`)

### 7.1 Stack
Expo SDK 54, React Native 0.81, **New Architecture**, expo-router 6 (file-based routing), **NativeWind 4** (Tailwind `className`), TanStack Query 5, zustand, axios, formik + yup, LiveKit (`@livekit/react-native`, `livekit-client`), `react-native-callkeep`, `@notifee/react-native`, `@react-native-firebase/{app,messaging}`, expo-notifications/location/secure-store/image-picker/linear-gradient/blur, react-native-maps, react-native-markdown-display, react-native-sse (AI streaming), lottie. Bundle id `com.loni.app`, scheme `loni`, light/dark/system theme (`userInterfaceStyle: automatic`).

### 7.2 Run
```bash
cd mobile-app && npm install            # postinstall runs patch-package (callkeep patch)
npx expo prebuild                        # native projects are generated (ios/ android/ exist locally)
npx expo run:ios | run:android           # needs a dev build: native modules (LiveKit, Firebase, CallKeep) don't work in Expo Go
npx tsc --noEmit -p .                    # typecheck;  npm run lint
```
`api/client.ts` hardcodes `API_URL` (currently a LAN/hotspot IP). Change it, or run `scripts/update-lan-ip.sh <ip>`. Optional env: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (maps), `EXPO_PUBLIC_LIVEKIT_URL`, `EXPO_PUBLIC_ENABLE_CALLKEEP` (**kill switch**, native call UI is off by default), `EXPO_PUBLIC_CALL_UI_MODE`. Custom config plugins in `plugins/` patch native projects (notification sound, notifee Maven repo, LiveKit `setup()`, CallKeep).

### 7.3 Provider tree (`app/_layout.tsx`)
`ThemeProvider` → `QueryClientProvider` (shared client in `lib/queryClient.ts`) → `AuthProvider` → `NotificationProvider` → `EmergencyContactsProvider` → `ThemedShell` (Stack, `CallModals`, `StatusBar`, `Toast`; also mounts `useSubscriptionSync` and `useSyncTimezone`). `index.js` (true entry) calls `registerGlobals()` (LiveKit WebRTC), registers the FCM background handler, notifee, CallKeep. Logout clears the whole query cache.

### 7.4 Screens (expo-router)
| Area | Routes |
| --- | --- |
| Entry | `index` (redirect by auth) |
| Auth `(auth)/` | `index` (welcome), `onboarding`, `register` (Pregnant / New mom / Not pregnant / Trying to conceive + stage pickers), `verify`, `phone`, `verify-phone`, `permissions`, `emergency-contacts`, `success`, `login`, `reset-password`, `create-password` |
| Tabs `(tabs)/` | `index` (Home), `chat` (topic cards), `upgrade` (LoniPlus manage / redirects to subscribe), `profile`; hidden `community` |
| Home | greeting, pregnancy card (pregnant/postpartum only) → `journey`, Today's tip, grid (Recovery Plan, Emergency Ride, Talk to a Nurse), My Community, Add Support Partner, LONI Plus banner (free) or care cards (members) |
| AI chat | `chat/conversation` (SSE streaming, quick-reply chips, safety strips + action buttons), `chat/history` |
| Care (LONI Plus) | `care/today`, `nutrition`, `report`, `hospital-bag`, `labour`, `labour/[slug]` |
| Subscription | `subscribe/index`, `subscribe/welcome`, `profile/cancel-subscription` |
| Calls | `nurse/connecting`, `nurse/rating`; in-call UI is `components/CallModals.tsx` (global) |
| Rides | `ride/request`; tracker `components/RideTrackerModal.tsx` |
| Profile | `pregnancy-status` (stage picker with confirm), `profile/emergency-contacts`, `profile/privacy-permissions` (+ Loni's Memory controls), `profile/theme`, `notification-settings`, `notifications/index` (real history) |
| Other | `recovery/index`, `journey`, `+not-found` |

### 7.5 Code organisation
- `api/` axios wrappers per feature (`care`, `checkins`, `community`, `emergencyContacts`, `rides`, `socket`, `subscription`). `hooks/` React Query hooks (`useCare`, `useCommunity`, `useSubscription`, `useStage`, `useCheckins`, `useNotificationFeed`, `useAIChat`, `useCall`, `useLiveKit`, `useRides`…). `store/` zustand (`callStore`, `rideStore`). `lib/` pure helpers (`pregnancy.ts`, `journey.ts`, `chatTopics.ts`, `theme.ts`, `textColor.ts`, call/ride event handlers, CallKeep, audio session).
- **Theming:** `lib/theme.ts` palettes (light/dark tokens: bg, card, surface, border, text…, brand constants), `context/ThemeContext.tsx` (Light/Dark/System, persisted in SecureStore `themePreference`), `HelixaText`/`CalText` pick a theme-aware default colour. StyleSheet files use `makeStyles(palette)`.
- **Optimistic updates** with rollback for care ticks and community likes; **keyset pagination** for the feed; community live updates via a WS topic subscription.
- **Real-time:** `api/socket.ts` keeps the WebSocket alive (25 s ping), routes `call_*`, `ride_*`, `community_*` events into stores/caches.
- **Push taps:** `NotificationContext` handles FCM `onMessage` (foreground banner for check-ins), `onNotificationOpenedApp`, `getInitialNotification` → `lib/checkinLinks.ts` opens the chat.

### 7.6 Stage-aware UI
`user.status` drives the pregnancy card, tips, chat topic cards, care-plan content and the Profile row ("Pregnancy Status" vs "My Journey"). Women who are not pregnant see no pregnancy card or hospital-bag/labour cards.

---

## 8. Nurse / Driver / Partner app (`loni-server-app/`)

One app, three experiences, chosen by `user_type` (`lib/driverOnboarding.ts::getPostAuthRoute`). Bundle id `com.loni.server`, scheme `loni-server`, **light mode only**. Same stack and native plugins as the mother app plus `expo-task-manager` (background location), `expo-haptics`, `expo-speech`, date pickers, `react-native-voip-push-notification` (PushKit). `API_URL` is hardcoded in `api/client.ts` (a different LAN IP from the mother app; use the script).

| Role | Route group | What they do |
| --- | --- | --- |
| **Nurse** | `(tabs)` (home, history, profile) + `incoming-call` | Go online/offline, receive incoming-call requests (full-screen notifee / CallKeep), accept, talk in LiveKit, see call history; edit profile. Onboarding: `role-selection` → `complete-profile-nurse` → `review-profile-nurse` → `verification-progress` (waits for admin approval; reacts to `account_status` over WS/FCM/polling). |
| **Driver** | `(driver)` (home, history, profile), `driver/request/[id]`, `driver/trip/[id]` (+ `complete`) | Training modules → aptitude test → personal/vehicle/document steps → approval. Then: drag-to-go-online toggle, receive ride offers, accept, navigate (pickup → hospital), complete. `components/driver/DriverRuntime.tsx` owns GPS: foreground streaming while available, background + foreground service on a trip. |
| **Partner** | `(partner)` (home, profile), `partner/notifications`, `partner/ride/[id]`, `partner/settings`, `partner/shared-location`, `partner/support` | Sees the mother's pregnancy journey by week, "Her Latest Updates" (canned week-in-review copy from `partner_content.py`), emergency alerts with a live map and ride tracking. First login shows `connected`/`whats-shared`. Support phone/email in `lib/support.ts` are **placeholders**. |

State: zustand `callStore`/`rideStore`, React Query, contexts for auth/notifications/emergency contacts. Libraries under `lib/` mirror the mother app (`callEvents`, `rideEvents`, `partnerEvents`, `accountStatus`, `voipPush`, `driverLocation`…).

---

## 9. Website (`loni-web/`)

React 19 + Vite + Tailwind 4 + framer-motion + react-router 8 + lucide-react. Deployed on **Vercel** (`vercel.json` rewrites everything to `index.html`). Scripts: `npm run dev | build | lint | preview`.

- **Routes** (`src/App.tsx`): `/` home, `/drivers`, `/nurses`, `/partners`, `/about`, `/privacy`, `/terms`, `/disclaimer`, `/verify` (partner account setup: password + phone → OTP via `POST /auth/setup-partner` + `/auth/verify-partner-setup`; uses `src/utils/api.ts`, base URL `VITE_API_BASE_URL` or `http://localhost:8000`).
- **Home sections:** Hero → Intro → RoadsShowcase → Problem → Emergency → LoniBot → Nurse → Community → Partner → Journey → Pricing (Free vs LONI Plus, 7-day trial) → Footer.
- **Design approach:** built from Figma with a custom **"Figma-canvas unit"** system (`components/showcase/designUnits.ts`): desktop compositions are absolutely positioned on a fixed canvas and scaled with container query units; stacked layouts below the `lg` breakpoint. Scroll-triggered animations use framer-motion (`once: false`). Brand token `--color-brand: #d62d88` in `src/index.css`.
- `src/config/site.ts` holds all CTA/social links; most are **placeholders** (`#download`, `#drivers`, `https://www.instagram.com/`). Store/social URLs still need to be added.

---

## 10. LiveKit infrastructure (`livekit/`)

`docker-compose.yml`: **livekit-server** (7880 signalling, 7881 TCP, 7882/udp, UDP 50000-50050), **redis**, **coturn** (TURN, host network; secrets via CLI flags from `livekit/.env`: `PUBLIC_IP`, `COTURN_SECRET`, `DOMAIN`), **caddy** (TLS reverse proxy). `livekit.yaml`: `node_ip` **must be set per environment** (currently a LAN IP), webhook → `http://host.docker.internal:8000/api/v1/livekit/webhook`, dev API key/secret (**replace for production**). `scripts/deploy.sh|start.sh|stop.sh`. Phones must reach `LIVEKIT_PUBLIC_URL` over cellular, so production needs a real domain + TURN.

---

## 11. Legacy and miscellaneous

- `backend/` (Node, Express 5, Drizzle ORM, Postgres, Cloudinary, Brevo, Swagger at `/api-docs`): only `auth` and `health`. **Not used by the apps**; kept for reference. Safe to ignore.
- `CALL_SYSTEM_AUDIT.md` (~64 KB): the definitive history of the voice-call fixes (WebSocket signalling added, FCM priority, `registerGlobals()`, audio session, LiveKit native setup, CallKeep crashes and its kill switch, webhook receiver fix, duplicate `/join`, dead-token pruning).
- `scripts/update-lan-ip.sh <ip>`: rewrites `backend-new/.env`, `livekit/.env`, `livekit/livekit.yaml`, `mobile-app/api/client.ts`, `loni-server-app/api/client.ts`.

---

## 12. Local development, end to end

1. `livekit/`: set `.env` + `livekit.yaml` `node_ip`, `docker compose up` (needed only for voice calls).
2. `backend-new/`: venv, `.env`, `alembic upgrade head`, `uvicorn app.main:app --reload --port 8000`. Local MongoDB on `27017`. Seed (run from `backend-new/` with the venv active): `python app/scripts/seed_admin.py` (admin account) and `python app/scripts/seed_aptitude_questions.py`.
3. Find your LAN IP (`ipconfig getifaddr en0`) and run `scripts/update-lan-ip.sh <ip>` so devices can reach the API.
4. `mobile-app/` and `loni-server-app/`: `npm install`, `npx expo prebuild`, `npx expo run:ios|android` (dev builds; Firebase config files are present).
5. `loni-web/`: `npm install && npm run dev` (set `VITE_API_BASE_URL`).
6. To test check-ins safely: leave `CHECKINS_ENABLED=false`, then `GET /api/v1/checkins/admin/preview` as an admin.

---

## 13. Conventions to follow

- **Backend:** one folder per feature; routers thin, logic in `service.py`; new tables need a model **and** an Alembic revision, and the model module must be imported in `db/migrations/env.py` and `tests/conftest.py`; return the `{success,message,data}` envelope; use `HTTPException(detail=...)` (becomes `message`); keep clinical/safety logic deterministic and tested; every behaviour change gets tests (`pytest -q`).
- **Safety content** (triage rules, fixed messages, check-in copy) lives in code with a source comment and must be clinician-reviewed before release. When a real message is mis-triaged, **add it to `tests/triage_cases.py` first**.
- **Mobile apps:** `className` (NativeWind) for layout, theme tokens (`useTheme().colors`) for colour so dark mode works; data via React Query hooks; invalidate/seed caches instead of refetching; never hardcode API URLs in new code (use `api/client.ts`); typecheck with `npx tsc --noEmit -p .` (currently clean).
- **Web:** component folders per section, Figma-unit scaling for desktop, stacked layout for mobile; keep CTA links in `config/site.ts`.
- **Secrets:** never commit `.env` (gitignored). Firebase client config files are committed on purpose (public identifiers).

---

## 14. Known gaps, risks and TODOs (be honest)

**Security / production-readiness**
- `SECRET_KEY` default is a placeholder; CORS is `*` with credentials; OTPs are 4 digits from `random` (not `secrets`) and are **printed to the console**; phone "verification" is an email OTP (no SMS).
- `backend-new/.env` historically held a Neon URL with credentials (commented); rotate if it was ever committed or shared. `livekit.yaml` has dev API key/secret and a LAN `node_ip`.
- Support partners' account password is set later via OTP; invite flow trusts the email owner.
- The Privacy screen footer says "LONI is HIPAA-compliant" (a claim that has not been verified; HIPAA is a US law, Nigeria's NDPA is the relevant regime). Review privacy/terms/disclaimer copy with counsel.

**Product**
- **No payment provider.** Subscriptions are trial-only; "Change payment method" and "Download invoices" show a notice; expired users cannot buy. Annual price (₦5,900) is cheaper than one month (₦9,900): confirm.
- LONI Plus does not yet gate AI message limits (the design shows a "free messages left" counter; no limit exists).
- Not built from Figma: "Add your hospitals" screen, extra ride-pill states ("Notifying your support circle", "Almost there"…), Apple Watch quick-reply notification actions (watch mirroring and tap-to-open work).
- Check-in scheduler scans all eligible women each tick (fine at thousands; at scale store a `next_due_at`). Likes still write one stats row per post (hot-post contention; see sharded counters / Redis plan). Community view buffer is in-process.
- No clinician-approved knowledge base for the AI; English-centred triage (Pidgin only partly).
- Recovery Reminders toggle is local only; several Privacy toggles (location sharing etc.) are not persisted.
- The mother app's `Recovery Plan` screen (`recovery/index.tsx`) uses a hardcoded local task list that is **not persisted or stage-aware** (the LONI Plus care plan is the real, server-backed version).

**Engineering**
- Three LAN IPs are hardcoded (mother app, server app, `livekit.yaml`) plus a fallback LiveKit URL in `mobile-app/hooks/useLiveKit.ts`. Use env/EAS config for real builds.
- The mother app and server app **duplicate** a lot of code (call store/hooks/modals, notification context, audio/CallKeep libs). Bugs have had to be fixed twice; consider a shared package.
- Native call UI (CallKeep) is behind a kill switch after unexplained crashes; see `CALL_SYSTEM_AUDIT.md` for how to resume debugging.
- The FCM Firebase setup requires the native config files and a service-account JSON on the server.
- The new AI/care/check-in/subscription work has backend tests (435) and typechecks, but has **not been exercised on physical devices**; verify push, taps, and screens on a real phone before release.
- `ft-*` branches and ~80 uncommitted files: decide what to commit and open PRs.

---

## 15. Recent work log (so the history is not lost)

- **Website** (`loni-web`): built from Figma, pages for drivers, nurses, partners, about, privacy, terms, disclaimer; spacing/animation fixes.
- **Community feed** (backend + mobile): posts, likes, inline comments, views/viewers, live updates, share modal; counters split into a stats table; view write-behind buffer.
- **Dark mode** across the mother app (Light/Dark/System, Theme screen, dark artwork).
- **Mother-app features from Figma:** LONI Plus (subscribe, welcome, manage, cancel), pregnancy card + Today's tip, Your Journey, interactive Pregnancy Status, Care screens (today, nutrition, weekly report, hospital bag, labour prep), real Notifications screen.
- **Loni AI:** emergency triage + classifier + fixed safety messages + output validator + prompt rewrite + human-review queue; women's health for everyone (not only pregnancy); memory; live hospital hours/phone look-up with sources; proactive check-ins with follow-up flows; tap-to-chat from notifications.

---

## 16. Glossary

- **Mother / woman** = a `user_type=user` account. **Partner** = support partner/relative. **Nurse**, **Driver**, **Admin** as above.
- **Triage** = the deterministic danger-sign check before the AI answers. **Check-in** = a proactive "hello" from Loni. **Care level** = standard / enhanced / intensive. **Memory** = tags Loni keeps about her days.
- **LONI Plus** = paid tier (7-day trial). **Luma** = alternate name for the AI in parts of the UI. **WAT** = Africa/Lagos timezone.
- **PushKit / VoIP push** = Apple's only guaranteed way to wake a killed app for a call. **CallKeep** = native call UI library. **LiveKit** = WebRTC voice infrastructure.
