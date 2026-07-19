# AI Study Platform (white-label prototype)

A working prototype of an AI study tool for coaching institutes: students log in
through their institute's branded portal and get a personalized AI tutor with
five actions — Learn a Topic, Solve a Doubt, Revision Notes, Practice Questions,
Test Yourself — that remembers their strengths, weaknesses, and progress across
sessions.

## Quick start

```bash
npm install
cp .env.example .env
npm run seed        # creates a demo institute + student
npm start            # http://localhost:3000
```

Log in with:
- Institute code: `DEMO123`
- Email: `riya@example.com`
- Password: `password123`

**Without an API key, the server runs in MOCK MODE** — you'll see the full UI
and profile-memory flow with a canned tutor response, at zero cost. To get real
tutoring responses, put a Groq API key in `.env`:

```
GROQ_API_KEY=gsk_...
```

(Get one at https://console.groq.com/keys)

## What's actually here

This is a real, runnable prototype — not a mockup. What it does:

- **Multi-tenant auth**: institutes are identified by a code; students log in
  with email/password scoped to their institute. Sessions are JWTs.
- **The pedagogy engine** (`lib/systemPrompt.js`): this is the actual product.
  It encodes the rules you described — diagnose before teaching, guide with
  hints rather than handing over answers, adapt to class/board/exam, always
  end with a next step, optimize for confidence — as a structured system
  prompt built fresh for every request from the student's live profile.
- **Memory that persists**: after each AI turn, the model is asked to emit a
  small structured `<profile_update>` block (topic mastery deltas, new
  strengths/weaknesses, completed topics, inferred learning style). The server
  parses it, strips it from what the student sees, and merges it into that
  student's stored profile — so the *next* session starts smarter.
- **Five real actions**, each with its own flow logic in the prompt (see
  `ACTION_INSTRUCTIONS` in `lib/systemPrompt.js`): learn, doubt, notes,
  practice, test.
- **A working dashboard UI** (`public/`): plain HTML/CSS/JS, no build step —
  action picker, live chat with the tutor, and a sidebar showing the student's
  current strengths/weaknesses/completed topics, refreshed after every turn
  where the memory changed.

## What's intentionally simplified (and what to do about it before production)

| Prototype choice | Why | Production path |
|---|---|---|
| JSON files as the datastore (`db/store.js`) | Zero install friction, no native deps to compile | Swap for Postgres/MySQL behind the same function signatures in `store.js` |
| Institute resolved by a code the student types | Simple to demo without DNS/subdomain setup | Resolve institute from the embed origin or subdomain automatically |
| "Curated academic knowledge base" | Not built here — this app currently relies on the model's own knowledge | For real accuracy/curriculum-alignment guarantees, add a retrieval layer (RAG) over licensed/verified textbook content per board/exam, and pass retrieved snippets into the system prompt |
| Profile updates trust the model's self-reported JSON | Keeps the architecture simple | Add server-side validation/bounds-checking on mastery deltas before trusting them, and consider a periodic "real" assessment (e.g. a proctored quiz) to recalibrate |
| No institute admin panel | Out of scope for this pass | Build an admin UI for institutes to see enrollment, usage, and student progress dashboards — the data model already supports it |
| Single hardcoded model call, no streaming | Simplicity | Add streaming (SSE) for a snappier chat feel on longer explanations |

## Project structure

```
server.js                 Express entrypoint
db/store.js                Datastore (JSON-file backed)
db/seed.js                 Demo data
lib/auth.js                 JWT session signing/verification
lib/systemPrompt.js         The pedagogy engine — start here to tune behavior
lib/aiClient.js              Groq API call + mock mode + profile_update parsing
routes/auth.js               Login / enroll
routes/tutor.js               Main AI action endpoint, applies memory updates
routes/profile.js             Read a student's learning profile
middleware/authenticate.js    Route protection
public/                        Login page + dashboard (no build step)
```

## Extending it

- **New action** (e.g. "Explain My Mistake"): add an entry to `ACTION_INSTRUCTIONS`
  in `lib/systemPrompt.js`, add a card in `dashboard.html`, add it to
  `ACTION_LABELS`/`ACTION_PLACEHOLDER` in `dashboard.js`.
- **Per-institute branding**: `institutes.json` already stores `brandColor`
  and `logoText`; extend `createInstitute`/an admin route to set a logo image,
  custom domain, etc.
- **Embedding into an institute's site**: point an `<iframe>` at `/dashboard.html`
  (post-login) or `/index.html`, or build a small `postMessage`-based widget
  wrapper — the backend doesn't need to change either way.
