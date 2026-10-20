# Loni AI: how a message is handled

Loni is for every woman (not pregnant, trying to conceive, pregnant, postpartum, menopausal). Three things sit around the model besides the safety rules:
**memory** (short tags of what she shared, never her words; she can view, switch off, delete: `checkins/memory.py`),
**live facility look-up** (hours / phone / address come from Google Places or web search with a source line, never from the model's memory: `lookup.py`),
and **proactive check-ins** (`app/modules/checkins`).


```
message ─► save ─► triage (rules, deterministic) ─► [classifier: can only RAISE urgency] ─► decide
                                                                                            │
   emergency ─► fixed message from messages.py, model NOT called ──────────────────────────┤
   urgent    ─► fixed "get checked today" line ─► model (urgent directive, no reassurance) ┤
   other     ─► model (system prompt + her stage + answer pattern for the question type) ──┤
                                                                                            ▼
                                       safety.validate (appends corrections) ─► save ─► audit event (no message text)
```

| File | Job |
| --- | --- |
| `triage.py` | Danger-sign rules, urgency levels, question types, the app actions to offer |
| `classifier.py` | Small model call that can only raise urgency; fails open to the rules |
| `messages.py` | The fixed emergency / urgent messages (the only text a mother sees without the model) |
| `prompts.py` | System prompt, per-turn directives |
| `lookup.py` | Finds a facility's hours, address and phone (Google Places, optional web search); detects the question; builds the source line |
| `context.py` | Name + stage handed to the model (nothing else from her profile) |
| `safety.py` | Post-checks on the model's answer: reassurance on a red flag, doses, "stop your medicine", invented bookings, and the short "not medical advice" reminder every health answer must carry |
| `tests/triage_cases.py` | The gold set. Add a line whenever a real message is mis-triaged |

## Human review

Every urgent, emergency or mental-health reply is queued in `ai_safety_events` (decision and rule ids only, no message text).
Admins list them at `GET /api/v1/ai-chat/admin/safety-events`, open the conversation at `.../{id}/conversation`, and
mark them reviewed at `POST .../{id}/review`. Opening a conversation is an admin-only, deliberate act.

## Needs clinician sign-off BEFORE release

1. Every rule in `triage.py` (what counts as emergency vs urgent), including the 37-week threshold and the combinations.
2. Every message in `messages.py`, including the first-aid lines (seizure: left side, nothing in the mouth; newborn: keep warm).
3. The Nigerian Pidgin phrases (needs a native speaker) and the emergency number (`EMERGENCY_PHONE`, default 112).
4. `tests/triage_cases.py`: expected urgency for each case.

## Known limits (be honest about these)

- Keyword rules cannot recognise every phrasing. On an unseen set of paraphrases they caught about half of the emergencies
  before the classifier layer existed, which is why the classifier (and the clinician-reviewed gold set) are required.
- No clinical knowledge base / retrieval is wired in yet: answers rely on the model plus the safety rules.
  A versioned, clinician-approved KB is the next step.
- Triage is English-centred. Yoruba, Igbo and Hausa are not covered; the classifier may help but is untested.
- It cannot see whether a nurse, driver or hospital is available, so it never claims one is.

## Setting up the facility look-up
Needs `GOOGLE_MAPS_API_KEY` with the Places API enabled (the same key the rides feature uses). `WEB_SEARCH_API_KEY` (Tavily) is an optional fallback.
With neither, Loni says it cannot check live details and suggests calling the facility; it never guesses. `safety.py` also catches any phone
number or "open 24 hours" claim that did not come from a look-up.
