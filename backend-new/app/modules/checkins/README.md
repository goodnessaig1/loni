# Wellness check-ins ("Loni says hello")

```
scheduler (every 15 min, one instance via advisory lock)
   └─ for each mother: category + care level ─► guards (policy.py) ─► claim the slot (INSERT) ─► deliver
                                                                          │
              AI chat session seeded with the hello + quick replies ◄──────┤  Notification Centre row ◄─┤  push ◄─┘
                                                                          │
   she taps ─► app opens that chat ─► her reply is recorded (good / rough / question / concerning)
                                    ─► the AI continues with a check-in directive (+ triage/safety as always)
                                    ─► the response changes her care level and rhythm next time
```

**Categories** (`content.category_of`): preg_t1, preg_t2, preg_t3, preg_term (37+ weeks), pp_early (0-6 wks), pp_active (7-12), pp_extended, general.

**Care level** (`policy.care_level`): `intensive` after an urgent/emergency AI conversation in the last 72h, a mental-health flag in 7 days,
or two worrying answers in 3 days; `enhanced` for term / early postpartum, one worrying answer, or danger in the last 14 days; else `standard`.
Level sets the rhythm: standard 1 hello per 2-3 days (by category), enhanced/intensive daily. Three ignored hellos in a row ease it to weekly.

**Guards** (a hello is skipped when any applies; `GET /checkins/admin/preview` shows how many were held back by which):
opted out, quiet hours (before her preferred hour / from 20:00 **in her timezone**), already sent for her local date,
2 proactive messages already today, too soon for her level, chatted with Loni or logged care today, a ride in progress, no registered device.
No device does NOT use up the day, so she still gets one when she installs the app.

**Duplicate protection**: `checkin_logs` has UNIQUE(user_id, dedupe_key) ("daily:<her local date>", "followup:<safety event id>").
A message is sent only by the process whose INSERT succeeded, so racing schedulers, retries and restarts cannot double-send.

**Follow-ups**: 20-48h after an urgent/emergency or mental-health AI conversation she gets one gentle "how are you now?" (once per event).

## Turning it on
Off by default (`CHECKINS_ENABLED=false`). Before enabling in production:
1. `GET /api/v1/checkins/admin/preview` (admin) and read the "would_send" list.
2. Set `CHECKINS_ENABLED=true` (in-process scheduler), or leave it off and call `POST /api/v1/checkins/admin/run?confirm=true` from an external cron.
3. Have the wording in `content.py` reviewed by a maternal-health professional.
