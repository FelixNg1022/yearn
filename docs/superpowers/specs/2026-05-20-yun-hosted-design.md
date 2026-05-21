# 运 v2 (yun-hosted) — Design Spec

> Productionized, multi-tenant iMessage oracle built on Spectrum. Same kernel, same ritual — hosted so anyone with a blue bubble can text it.

---

## Goal

Migrate 运 from a single-user local-Mac process (`@photon-ai/imessage-kit`) to a hosted, multi-tenant Bun backend on Fly.io, using the `spectrum-ts` SDK and Turso (libSQL) for the database. All v1 kernel math is preserved unchanged.

---

## Repository

New repo: `~/Developer/yun-hosted` (separate from v1). The v1 repo remains as the Build Challenge #8 submission.

---

## Verified Spectrum API

Type-checked against `spectrum-ts@1.9.2` with `strict: true, skipLibCheck: true`.

```ts
import { Spectrum } from "spectrum-ts";
import { imessage, terminal } from "spectrum-ts/providers";
import { attachment } from "spectrum-ts";

const app = await Spectrum({
  projectId: process.env.PROJECT_ID!,
  projectSecret: process.env.PROJECT_SECRET!,
  providers: [
    imessage.config(),
    ...(process.env.NODE_ENV !== "production" ? [terminal.config()] : []),
  ],
});

// Inbound message loop
for await (const [space, message] of app.messages) {
  const phone: string = space.phone;        // E.164 — user identity key
  const text = message.content.type === "text" ? message.content.text : "";

  await space.responding(async () => {
    await message.reply("text response");
    await space.send(attachment(pngBuffer, { mimeType: "image/png" }));
  });
}

// Proactive send (scheduler follow-ups, no inbound message)
const iMsg = imessage(app);
const space = await iMsg.space({ phone });  // NOTE: 'phone' not 'id'
await space.send("follow-up text");
```

---

## Architecture

| Layer | Choice |
|---|---|
| Runtime | Bun (TypeScript) |
| Channel SDK | `spectrum-ts` — `imessage` + `terminal` providers |
| LLM | `@anthropic-ai/sdk`, model `claude-sonnet-4-6` |
| DB | Turso (libSQL, SQLite-wire-compatible) via `@libsql/client` |
| ULID | `ulidx` package for reading primary keys |
| Hosting | Fly.io, single-region, persistent VM |
| Card rendering | `satori` (JSX → SVG) + `@resvg/resvg-js` (SVG → PNG) |
| Encryption | `node:crypto` AES-256-GCM for birth times |
| Logging | Structured JSON; phone logged as truncated hash; never log birth data |

---

## Module Layout

```
src/
  index.ts          — Spectrum app init, message loop, scheduler init, shutdown
  config.ts         — env loading + validation (fail-fast at startup)
  db.ts             — Turso client + all query helpers
  crypto.ts         — AES-256-GCM encrypt/decrypt (birth times only)
  lang.ts           — detectLang(text): 'en' | 'zh'; STRINGS map for bilingual copy
  router.ts         — inbound classifier: command | onboarding | outcome | query
  onboarding.ts     — 4-state FSM: pending_date → pending_time → pending_location → complete
  commands.ts       — /help /history /stats /methods /lang /setup /delete
  outcomes.ts       — yes/no/mixed parser (preserved from v1)
  query.ts          — kernel → LLM → store → send pipeline
  llm.ts            — Anthropic SDK wrapper, prompt builder
  scheduler.ts      — follow-up loop; demo-mode toggle
  card/
    render.ts       — renderCastCard(reading, mode) → Buffer (PNG)
    template.tsx    — Satori JSX template
    fonts.ts        — font buffer loading (Noto Sans SC + Inter + mono)
  kernel/           — PRESERVED FROM v1 UNCHANGED
    meihua.ts
    liuren.ts
    bazi.ts
    iching.ts
    trigrams.ts
    data/           — hexagrams.json etc.
    lunar.ts        — (if present in v1)
  spectrum/
    app.ts          — Spectrum() init, exports app singleton
    send.ts         — sendText(phone, text), sendCard(phone, text, png), sendFollowUp(phone, text)
tests/
  kernel/           — v1 kernel tests (copy, must stay green)
  *.test.ts         — new tests for each module
```

**Hard rules:**
- `kernel/` is copied verbatim from v1 — no refactoring the math
- v1's 78 kernel tests must pass without modification
- `spectrum/send.ts` owns the Spectrum `app` reference so scheduler never imports Spectrum types directly

---

## Data Model

```sql
CREATE TABLE users (
  phone TEXT PRIMARY KEY,
  lang TEXT NOT NULL DEFAULT 'en',
  onboarding_state TEXT NOT NULL DEFAULT 'pending_date',
  birth_iso_encrypted TEXT,
  birth_tz TEXT,
  has_hour_pillar INTEGER NOT NULL DEFAULT 1,
  bazi_pillars TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  readings_today INTEGER NOT NULL DEFAULT 0,
  readings_today_reset_at INTEGER NOT NULL
);

CREATE TABLE readings (
  id TEXT PRIMARY KEY,                   -- ulid
  phone TEXT NOT NULL REFERENCES users(phone),
  question TEXT NOT NULL,
  method TEXT NOT NULL,
  cast_json TEXT NOT NULL,
  interpretation TEXT NOT NULL,
  lang TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  follow_up_at INTEGER NOT NULL,
  followed_up INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE outcomes (
  reading_id TEXT PRIMARY KEY REFERENCES readings(id),
  outcome TEXT NOT NULL,
  user_note TEXT,
  responded_at INTEGER NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_readings_phone ON readings(phone, created_at DESC);
CREATE INDEX idx_readings_follow_up ON readings(follow_up_at, followed_up);
```

---

## Key Flows

### Inbound message routing

```
space.phone → getOrCreateUser()
  → if starts with '/' → handleCommand()
  → else if onboarding_state !== 'complete' → handleOnboarding()
  → else if looksLikeOutcome() && pending follow-up → handleOutcome()
  → else if rate-limited → sendRateLimitMessage()
  → else → handleQuery()
```

### Onboarding FSM

| State | Prompt | Valid input | Transition |
|---|---|---|---|
| `pending_date` | "Welcome to 运. What's your birth date?" | parseable date | → `pending_time` |
| `pending_time` | "What time were you born? (or 'skip')" | time OR skip/不知道 | → `pending_location` |
| `pending_location` | "Where were you born? (city + country)" | city string | encrypt+store birth, compute 八字, → `complete` |
| `complete` | (normal query handler) | — | — |

Language auto-detected from first message (Han chars → zh). `/lang en|zh` works at any time.

### Follow-up scheduler

```
every SCHEDULER_INTERVAL_SECONDS:
  rows = readings WHERE follow_up_at <= now() AND followed_up = 0
  for each: sendFollowUp(row.phone, row.question, user.lang)
            markFollowedUp(row.id)
```

`DEMO_FOLLOW_UP_SECONDS` env var overrides `FOLLOW_UP_DAYS` when set.

### Card rendering

`renderCastCard(reading, mode: 'cast' | 'outcome') → Buffer`

- Canvas: 1080×1350 (4:5)
- Satori JSX → SVG → @resvg/resvg-js → PNG
- Fonts bundled: Noto Sans SC, Inter, a mono font
- Attached to every reading reply via `space.send(attachment(png, { mimeType: "image/png" }))`

### "Called it" share prompt

On `yes` outcome: send share invite. If user replies `share`/`分享`: render `mode: 'outcome'` card + set `outcomes.shared = 1`.

---

## Environment Variables

| Key | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — |
| `PROJECT_ID` | yes | — |
| `PROJECT_SECRET` | yes | — |
| `TURSO_DATABASE_URL` | yes | — |
| `TURSO_AUTH_TOKEN` | yes | — |
| `BIRTH_ENCRYPTION_KEY` | yes | — (32-byte AES key, base64) |
| `FOLLOW_UP_DAYS` | no | 5 |
| `DEMO_FOLLOW_UP_SECONDS` | no | unset |
| `SCHEDULER_INTERVAL_SECONDS` | no | 60 |
| `RATE_LIMIT_PER_DAY` | no | 10 |
| `LOG_LEVEL` | no | info |

---

## Build Phases

| Phase | Deliverables |
|---|---|
| **1 — Foundation** | New repo, deps, Turso schema, kernel copy + tests green, config/env, basic Spectrum init |
| **2 — Core routing** | Message loop, multi-tenant identity, router, onboarding FSM, commands, query pipeline, LLM, scheduler |
| **3 — Card + demo** | Satori card rendering, auto-attach, "called it" share prompt, demo-mode toggle, `/delete`, rate limit |
| **4 — Deploy** | Fly.io config, `fly deploy`, smoke test via terminal provider, pre-seed demo reading |

---

## Privacy

- Birth times: AES-256-GCM encrypted at rest; key from env only
- Phone numbers: logged as `sha256(phone).slice(0,8)` — never raw
- `/delete`: hard-deletes user + readings + outcomes after `confirm delete` reply
- No public HTTP routes beyond Spectrum's managed webhook

---

## What's Different From v1

| Aspect | v1 | v2 |
|---|---|---|
| Channel SDK | `@photon-ai/imessage-kit` | `spectrum-ts` |
| DB | `bun:sqlite` file | Turso (libSQL) |
| User model | Single owner (env var) | Multi-tenant by phone |
| Onboarding | `OWNER_BIRTH` env | Conversational FSM |
| Birth storage | Env var plaintext | AES-256-GCM in DB |
| Language | `/lang` only | Auto-detect + `/lang` |
| Reply | Text only | Text + PNG card |
| "Called it" | Internal `/stats` | Share prompt on `yes` |
| Demo follow-up | Fixed 5 days | `DEMO_FOLLOW_UP_SECONDS` toggle |
| `/delete` | None | New |
| Rate limit | In-memory (v1 limiter) | Per-user DB counter |
| Kernel | Built, 78 tests | Preserved unchanged |
