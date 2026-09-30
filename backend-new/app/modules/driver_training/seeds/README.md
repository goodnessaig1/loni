# Driver training seed data

## `aptitude_questions.json`

The "well" of driver aptitude questions. Each entry:

| field          | type      | notes                                                            |
| -------------- | --------- | ---------------------------------------------------------------- |
| `key`          | string    | Stable unique id used for idempotent upserts. Never reuse.      |
| `question`     | string    | Prompt shown to the driver.                                     |
| `options`      | string[]  | Answer choices, in display order (min 2).                       |
| `answer_index` | int       | 0-based index into `options` of the correct answer.             |
| `category`     | string    | Optional grouping.                                              |
| `is_visible`   | bool      | Defaults to `true`. Admins may hide a question later; a re-seed |
|                |           | never overrides an admin's manual visibility choice.            |

A random `APTITUDE_QUESTION_COUNT` (default 10) of the **visible** questions is
served per attempt. Drivers get `APTITUDE_MAX_ATTEMPTS` (default 3) tries and
must score at least `APTITUDE_PASS_SCORE` (default 8) to pass. The correct
answer is never exposed on any driver-facing endpoint.

### Seeding

Any of these can be run against any database, any time (idempotent):

```bash
# Standalone script
python -m app.scripts.seed_aptitude_questions

# or hit the admin endpoint (requires an admin token)
POST /api/v1/admin/aptitude/questions/seed
```

New `key`s are inserted; existing ones have their text/options/answer refreshed.
Admins can also add questions that are not in this file through
`POST /api/v1/admin/aptitude/questions`.

## `training_modules.json`

Static content for the 5 pre-trip training modules, served as-is by
`GET /api/v1/driver-training/modules`. Edit the copy here; no migration needed.
`layout: "checklist"` renders tappable checkpoints; `layout: "reading"` renders
numbered sections with bullet lists and callout notes.
