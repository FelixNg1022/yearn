# 运 (yùn) v2 — Design Spec

**Handoff document for Claude Code build.** Authored Wednesday 4pm. Target ship: Saturday night. Live demo: Sunday.

---

## 0. Context

运 is an iMessage oracle that does real Chinese numerology math (梅花易数, 小六壬, 八字) and interprets the deterministic kernel output via Claude. The v1 (already built, ~78 passing tests) is a single-user local-Mac process that talks to iMessage via `@photon-ai/imessage-kit`, with bun:sqlite for storage and a follow-up scheduler that closes the falsifiability loop 5 days after each reading.

v1 repo: https://github.com/FelixNg1022/yun (existing README is the authoritative reference for the kernel and current behavior).

v2 is the **hosted, multi-tenant production version** built on Spectrum, for Photon Residency 2 demo day. Same name, same kernel, same ritual — productionized so anyone can text it.

**Scope reality check:** WhatsApp Business verification is unattainable in the time window, so v2 ships as **iMessage-only via Spectrum's managed iMessage line**. Multi-channel is post-residency. This means the narrative pivots from "everywhere you are" to "productionized oracle, available to anyone with a blue bubble." That's still a strong story — the deterministic kernel + falsifiability + Felix's audience is the moat, not the channel count.

---

## 1. Scope (Locked)

### In

- Hosted Bun backend on Fly.io
- Turso (libSQL) for the DB, near-zero migration from bun:sqlite
- Spectrum (`spectrum-ts`) with `imessage` + `terminal` providers (terminal is for dev only)
- Conversational onboarding state machine (replaces single-user env var)
- All current kernel features preserved: 梅花易数, 小六壬, 八字, command set, follow-up loop
- Multi-tenant identity keyed by phone number
- Birth-time encryption at rest
- Auto-detected language (Han characters → 中文, otherwise English); existing `/lang` override preserved
- **Cast card PNG generation** via Satori + @resvg/resvg-js, auto-attached on each reading
- **"Called it" share prompt** on follow-up `yes`
- **Demo-mode toggle** (env var) that fires follow-ups in seconds instead of days
- `/delete` command (data deletion for privacy)
- Per-user rate limit (10 readings/day) to prevent abuse
- Landing page at yun.app — separate spec, separate repo (see §13)

### Out (defer post-residency)

- WhatsApp, Telegram, Discord, Slack, Instagram, SMS
- Pair / couple compatibility readings
- Weekly opt-in 八字 forecasts
- Calendar integration
- Group chats
- Web dashboard, `/history` visualizations
- Payments, premium tier
- I Ching coin-toss mode
- Xiaohongshu/WeChat custom providers

---

## 2. Branching

Do not break v1. Create a new branch `v2-spectrum` off `main`, or a new repo `yun-hosted` — Claude Code's call based on diff size. v1 stays as the existing local-Mac single-user submission (Build Challenge #8). v2 is the residency submission.

---

## 3. Architecture

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Bun (TS) | Already the v1 stack |
| Channel SDK | `spectrum-ts` with `imessage.config()` + `terminal.config()` providers | Per Photon docs |
| LLM | Anthropic SDK, model `claude-sonnet-4-6` | Upgrade from v1's Sonnet 4 |
| DB | Turso (libSQL, SQLite-wire-compatible) | Near-zero migration from `bun:sqlite` |
| Hosting | Fly.io, single-region VM, persistent | Long-running process for the in-proc scheduler |
| Card rendering | Satori (JSX → SVG) + @resvg/resvg-js (SVG → PNG) | Works in Bun |
| Encryption | AES-256-GCM via Bun's `crypto`, key from env | Birth times only |
| Logging | Structured JSON, no birth times ever | Privacy hygiene |
| Auth | `projectId` + `projectSecret` env vars per Spectrum docs | One config block |

**Authoritative SDK reference for Claude Code:** https://www.skills.sh/photon-hq/skills/spectrum (load this first; don't rely on training data for the SDK shape — it's recent).

---

## 4. Data Model

Three tables. Phone number is the primary user identifier — Spectrum already keys by it (`spectrum.send("+1...", ...)`), so we don't need a separate channels table for iMessage-only v2.

```sql
CREATE TABLE users (
  phone TEXT PRIMARY KEY,                  -- E.164 format
  lang TEXT NOT NULL DEFAULT 'en',         -- 'en' | 'zh'; set on first message
  onboarding_state TEXT NOT NULL DEFAULT 'pending_date',
  -- pending_date | pending_time | pending_location | complete
  birth_iso_encrypted TEXT,                -- AES-256-GCM ciphertext + iv (JSON blob)
  birth_tz TEXT,                           -- e.g. '+08:00' (resolved during onboarding)
  has_hour_pillar INTEGER NOT NULL DEFAULT 1,  -- 0 if user skipped birth time
  bazi_pillars TEXT,                       -- JSON {year, month, day, hour}; null until onboarding complete
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  readings_today INTEGER NOT NULL DEFAULT 0,
  readings_today_reset_at INTEGER NOT NULL
);

CREATE TABLE readings (
  id TEXT PRIMARY KEY,                     -- ulid
  phone TEXT NOT NULL REFERENCES users(phone),
  question TEXT NOT NULL,
  method TEXT NOT NULL,                    -- 'meihua' | 'liuren'
  cast_json TEXT NOT NULL,                 -- full kernel output (hexagrams, palace, lunar ts, etc.)
  interpretation TEXT NOT NULL,
  lang TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  follow_up_at INTEGER NOT NULL,
  followed_up INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE outcomes (
  reading_id TEXT PRIMARY KEY REFERENCES readings(id),
  outcome TEXT NOT NULL,                   -- 'yes' | 'no' | 'mixed'
  user_note TEXT,                          -- optional, if user added text
  responded_at INTEGER NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0        -- did they tap the share prompt
);

CREATE INDEX idx_readings_phone ON readings(phone, created_at DESC);
CREATE INDEX idx_readings_follow_up ON readings(follow_up_at, followed_up);
```

**Migration note:** v1's schema is close to this; the diff is `users.onboarding_state`, `birth_iso_encrypted` (was `OWNER_BIRTH` env), `birth_tz`, `has_hour_pillar`, `readings_today*`. Port the SQL, write a one-time migration if needed.

---

## 5. Module Layout

```
src/
  index.ts                  # Spectrum app entry, message loop, scheduler init
  config.ts                 # env loading + validation
  db.ts                     # Turso client + query helpers
  crypto.ts                 # AES-256-GCM encrypt/decrypt for birth times
  lang.ts                   # detectLang(text), commandStrings(lang)
  router.ts                 # inbound classifier (command? onboarding? outcome? query?)
  onboarding.ts             # state machine
  commands.ts               # /help /history /stats /methods /lang /setup /delete
  outcomes.ts               # yes/no/mixed parser (en + zh)
  query.ts                  # full query pipeline: kernel → LLM → store → send
  llm.ts                    # Anthropic SDK wrapper, prompt builder
  scheduler.ts              # follow-up loop, demo-mode toggle
  card/
    render.ts               # renderCastCard(reading) → Buffer (PNG)
    template.tsx            # Satori JSX template
    fonts.ts                # font loading (Han + Latin)
  kernel/                   # ← PRESERVE FROM v1 UNCHANGED
    meihua.ts
    liuren.ts
    bazi.ts
    hexagrams.json
    lunar.ts
  spectrum/
    app.ts                  # Spectrum() init with providers
    send.ts                 # wrappers: sendText, sendCard, sendFollowUp
tests/                      # ← PRESERVE v1 TESTS, add new ones
```

**Hard rule:** the `kernel/` directory is preserved as-is. Don't refactor the math. v1's 78 tests must continue to pass. Any test failure in the kernel suite is a regression and must be fixed by reverting the change.

---

## 6. Onboarding State Machine

First message from a new phone number kicks off this flow. The router checks `users.onboarding_state` before treating a message as a query.

| State | Bot says | Expects | On valid input |
|---|---|---|---|
| `pending_date` (initial) | "Welcome to 运. To cast your readings, I need three things. First — what's your birth date? (e.g., October 22, 2002 or 2002-10-22)" | parseable date | store, advance to `pending_time` |
| `pending_time` | "Got it. What time were you born? (e.g., 6:00 PM or 18:00) — or say 'skip' if you don't know, and I'll cast without your hour pillar." | parseable time OR `skip`/`不知道` | store time (or set `has_hour_pillar=0`), advance to `pending_location` |
| `pending_location` | "And where were you born? (city + country, e.g., Shanghai, China)" | text — resolve via simple lookup table for common locales; fall back to asking for offset if ambiguous | compute ISO + TZ, encrypt+store birth_iso, compute & store 八字 pillars, advance to `complete`, send the 八字 cast as the welcome moment |
| `complete` | normal query handler | — | — |

**Skip-time path:** if user says skip, store nulled hour pillar, fall back to 梅花易数 + 小六壬 only (don't attempt 八字 — flag this in `users.has_hour_pillar=0`). Kernel already supports running without 八字 context.

**Language:** detect from the first message before sending the welcome prompt. If first message contains Han characters → set `lang='zh'` and use Chinese prompts throughout onboarding. Otherwise English. `/lang en|zh` works at any time.

**Timezone resolution:** maintain a JSON lookup table for ~50 most common birth locations (Shanghai → +08:00, Vancouver → -08:00, NYC → -05:00, London → +00:00, etc.). Anything not in the table — ask user "what's the timezone, e.g., +08:00 for China?". Don't over-engineer.

---

## 7. Router

Pseudocode:

```ts
async function route(phone: string, text: string) {
  const user = await getOrCreateUser(phone, detectLang(text));
  await touchLastSeen(phone);

  if (text.startsWith('/')) return handleCommand(user, text);

  if (user.onboarding_state !== 'complete') return handleOnboarding(user, text);

  const pendingFollowUp = await findPendingFollowUpFor(phone);
  if (pendingFollowUp && looksLikeOutcome(text, user.lang)) {
    return handleOutcomeReply(user, pendingFollowUp, text);
  }

  if (await isRateLimited(user)) return sendRateLimitMessage(user);
  return handleQuery(user, text);
}
```

`looksLikeOutcome` is v1's existing outcome parser — preserve it.

---

## 8. LLM Layer

- Model: `claude-sonnet-4-6` via `@anthropic-ai/sdk`
- Temperature: keep v1's value (whatever it is — don't change without reason)
- Prompt structure: same as v1 (system prompt + kernel cast block + user's 八字 context + recent reading history + user question)
- Output: plain text interpretation in the user's language

Critical: **the LLM never picks the hexagram**. It only interprets the kernel output. This is the entire technical credibility story for the residency pitch — don't accidentally let the LLM "improve" the cast.

---

## 9. Cast Card Rendering

New module. Generates a PNG attached to every reading reply.

**Function signature:**

```ts
async function renderCastCard(reading: {
  question: string;
  cast: KernelOutput;       // hexagrams or liuren palace
  interpretation: string;   // first 2-3 lines only — full text is in the message body
  lang: 'en' | 'zh';
  timestamp: Date;
}): Promise<Buffer>          // PNG bytes
```

**Template design (Satori JSX):**

- Canvas: 1080×1350 (4:5 — optimal for Instagram + Xiaohongshu)
- Top: 运 wordmark, small, top-left
- Hero: hexagram glyph visualization (6 horizontal lines, solid = yang, broken = yin), large, centered. For 小六壬 readings, show the palace name in calligraphic Chinese instead.
- Below hero: hexagram Chinese name (large) + English name + number (e.g., "恆 · Perseverance · 32")
- Right side or below: the deterministic kernel math block from v1 (the `lunar:`, `upper:`, `lower:`, `line:` four-liner) in mono font — this is the visual differentiator
- Bottom third: 2-3 line interpretation excerpt
- Footer: timestamp + "yun.app" small
- Aesthetic: clean, low-saturation. Cream/off-white background, deep ink color for text. One subtle accent for the changing-line indicator. Avoid mystical clip art.

**Fonts:** Load Noto Sans SC (for 中文) + Inter or similar (for Latin) + a mono font for the kernel block. Bundle font files in the repo (Satori requires explicit font buffer loading).

**Send path:** v1 sends text-only. v2 sends text body + card image attachment. Verify Spectrum's iMessage provider supports image attachments — per the docs it should (iMessage is the richest provider).

---

## 10. Follow-up Scheduler

Preserve v1's in-process loop. Add demo-mode toggle.

```
every SCHEDULER_INTERVAL_SECONDS:
  rows = readings WHERE follow_up_at <= now() AND followed_up = 0
  for each row:
    send follow-up DM to row.phone (lang-aware)
    UPDATE readings SET followed_up = 1 WHERE id = row.id
```

**New: demo mode.** When `DEMO_FOLLOW_UP_SECONDS` is set, override `FOLLOW_UP_DAYS` and schedule follow-ups that many seconds after each reading instead of 5 days. This is essential for the live demo — Felix can text a question on stage and 30 seconds later the follow-up arrives.

**Pre-seed for demo:** before the demo, create a real reading ~4 days 23 hours ago for the demo phone so a "natural" 5-day follow-up arrives during the demo without the toggle. Have demo-mode as backup.

---

## 11. "Called It" Share Prompt

After a `yes` outcome on a reading, immediately follow up with:

> "this was a hit. want a shareable card? — reply `share` and I'll send you one."

If user replies `share` (or `分享`):
- Render a "called it" card: original question, the cast, "outcome: yes ✓", soft brand mark
- Send as image attachment
- Set `outcomes.shared = 1`

Different template from the standard cast card — same dimensions, but adds the outcome indicator and a "called it" headline. Reuse `renderCastCard` infra with a `mode: 'outcome'` parameter.

This is the viral mechanic. Don't bury it. Surface it on every `yes`.

---

## 12. Privacy & Security

- **Birth time encrypted at rest** via AES-256-GCM. Key from `BIRTH_ENCRYPTION_KEY` env (32 bytes, base64). Store ciphertext + IV as JSON blob.
- **Never log raw birth times.** Logger should redact or hash any field named `birth*`.
- **Phone numbers** logged as truncated hash (e.g., last 4 + sha256-prefix), not raw.
- **`/delete` command** drops the user row + all their readings + outcomes. Confirmation prompt: "this deletes all your readings and your 八字. Reply `confirm delete` to proceed." On confirm, hard-delete.
- **Rate limit**: 10 readings per phone per 24h rolling window. Use `users.readings_today` + `readings_today_reset_at`.
- **No exposed endpoints other than Spectrum's webhook.** No public HTTP routes for the agent server.

---

## 13. Environment Variables

| Key | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | workspace with credits |
| `PROJECT_ID` | yes | Spectrum project id (from app.photon.codes) |
| `PROJECT_SECRET` | yes | Spectrum project secret |
| `TURSO_DATABASE_URL` | yes | libsql:// URL |
| `TURSO_AUTH_TOKEN` | yes | Turso DB token |
| `BIRTH_ENCRYPTION_KEY` | yes | 32-byte AES key, base64 |
| `FOLLOW_UP_DAYS` | no | default 5 |
| `DEMO_FOLLOW_UP_SECONDS` | no | when set, overrides FOLLOW_UP_DAYS (for demo) |
| `SCHEDULER_INTERVAL_SECONDS` | no | default 60 |
| `RATE_LIMIT_PER_DAY` | no | default 10 |
| `LOG_LEVEL` | no | default `info` |

---

## 14. Spectrum Integration Notes

From the docs (https://docs.photon.codes/docs/spectrum-ts/introduction):

```ts
import { Spectrum } from "spectrum-ts";
import { imessage, terminal } from "spectrum-ts/providers";

const app = await Spectrum({
  projectId: process.env.PROJECT_ID!,
  projectSecret: process.env.PROJECT_SECRET!,
  providers: [
    imessage.config(),
    ...(process.env.NODE_ENV !== 'production' ? [terminal.config()] : []),
  ],
});

for await (const [space] of app.messages) {
  // space.phone (or equivalent) → user identifier
  // space.message → inbound text or attachment
  // space.send(...) → outbound
}
```

**Open question for Claude Code to resolve from the docs/skills.sh:** exact field names on `space` for the phone number, and exact attachment API for sending images (`space.send(card, {attachment: pngBuffer})` or similar). Verify against the skill reference before implementing.

**Terminal provider in dev:** during local development, the terminal provider lets the engineer type messages into stdin and see responses in stdout. Use it heavily — don't burn iMessage line capacity on dev testing.

---

## 15. Command Set

Existing + new:

| Command | Effect | New? |
|---|---|---|
| `/help` | list commands in user's language | preserved |
| `/history` | last 5 readings, hexagram shorthand | preserved |
| `/stats` | total count + hit rate | preserved |
| `/methods` | one-liners on each method | preserved |
| `/lang en\|zh` | switch language | preserved |
| `/setup` | re-trigger onboarding | preserved, behavior changes (now FSM not env) |
| `/delete` | delete all data, with confirmation | **new** |

---

## 16. Build Sequencing

| When | Block | Deliverables |
|---|---|---|
| **Wed evening (~5h)** | Foundation | Domain bought (yun.app), Photon project provisioned, iMessage line provisioned, Fly.io app created, Turso DB created, schema migrated, v1 code running against Turso single-user (sanity check) |
| **Thu (~12h)** | Spectrum + multi-tenant | Replace imessage-kit with spectrum-ts, terminal provider working in dev, multi-tenant identity by phone, onboarding state machine end-to-end, language auto-detect, encryption |
| **Fri (~12h)** | Card + share + demo mode | Satori card rendering, auto-attach on every reading, "called it" share prompt, `DEMO_FOLLOW_UP_SECONDS` toggle, `/delete` command, rate limit, full test pass |
| **Sat AM (~5h)** | Website | yun.app single page deployed to Vercel (separate repo) |
| **Sat PM (~6h)** | Polish + demo prep | Pre-seed demo reading, dry-run live demo, shoot notes for producer, edge-case fixes, font polish on the cast card |
| **Sun AM** | Rehearsal | Run the live demo flow end-to-end at least 3 times |

---

## 17. Live Demo Plan (Sunday — Felix-side, not Claude Code's responsibility)

- Pre-seeded reading from ~5 days prior on demo line; "natural" follow-up arrives during demo
- `DEMO_FOLLOW_UP_SECONDS=30` as backup if the pre-seeded one's timing is off
- One audience member texts the bot live from a printed QR (pre-arranged, not random)
- Show the cast card image rendering inline — that's the visual hero
- Pre-recorded backup clip of the full flow in case of network/API failure on stage

---

## 18. Website Spec (separate repo, separate sequencing — not Claude Code's primary target)

Single-page site at yun.app, Next.js + Tailwind, deploy to Vercel. Top to bottom:

1. **Hero** — 运 wordmark, tagline ("an oracle that calls back"), demo gif from v1 README, "text +1-XXX to start" CTA + iMessage deep link + QR code
2. **Kernel-is-real block** — the raw cast snippet from v1 README ("upper: (7+3+2) mod 8 = 4 → 震…"), framed as the differentiator. One paragraph: most AI divination is vibes; 运's hexagrams are deterministic math, only interpretation is LLM.
3. **How it works** — three steps with a tiny inline gif of the follow-up exchange
4. **Footer** — GitHub link, Felix's handle, MIT, Photon Residency credit

No blog, no docs, no pricing. Half a day of build.

---

## 19. Demo Video Concept (producer team owns the shoot — not Claude Code's responsibility)

~60-second narrative arc: *the oracle that calls back*.

- **0:00–0:08** Cold open. Phone on desk, notification, hand opens iMessage. VO/text: "I've practiced 易经 for years. The hardest part isn't the cast. It's having someone to text it to."
- **0:08–0:22** User types a real question. 运 replies — the cast block types onto screen line by line, then the interpretation card slides in. The card is the hero shot.
- **0:22–0:35** "The math is real" beat. Split-screen: generic AI divination on left ("the universe says trust your heart"), 运 on right (deterministic kernel block). VO: "the hexagram isn't AI — the math is a thousand years old. only the interpretation is new."
- **0:35–0:50** Time-jump card ("5 days later"). New notification. 运: "did it work out?" User: "yes." Cut to the "called it" share card rendering.
- **0:50–1:00** End card: 运 logo, yun.app, "free. no signup. just text."

Bilingual subtitles (中/英). Felix-as-protagonist B-roll optional (易经 book, 八字 chart) for credibility.

---

## 20. Open Decisions for Felix (need answers before Claude Code starts)

1. **Branch vs new repo?** Recommend new branch `v2-spectrum` on existing repo; Claude Code defaults to that unless you say otherwise.
2. **Sonnet 4.6 ok?** v1 uses Sonnet 4. v2 upgrades. Any reason to stay on 4?
3. **Fly.io account ready?** Need org + payment method set up before Claude Code can `flyctl deploy`.
4. **Photon project provisioned?** Sign up at app.photon.codes, create project, grab `PROJECT_ID` + `PROJECT_SECRET`, request iMessage line. Do this Wed evening — don't block Thursday on it.
5. **Turso account?** Sign up at turso.tech, create DB, grab URL + token. ~5 min.
6. **Card design**: any branding direction (color palette, fonts) you want locked in, or trust Claude Code to default to clean cream/ink? You can iterate Saturday.

---

## Appendix: What's Different From v1

| Aspect | v1 | v2 |
|---|---|---|
| Hosting | Local Mac, Messages.app running | Fly.io VM, hosted |
| Channel SDK | `@photon-ai/imessage-kit` | `spectrum-ts` (`imessage` + `terminal` providers) |
| DB | `bun:sqlite` file | Turso (libSQL) |
| User model | Single owner (env var) | Multi-tenant by phone |
| Onboarding | `OWNER_BIRTH` env var | Conversational FSM |
| Birth time storage | Env var (plaintext) | AES-256-GCM encrypted in DB |
| Language | `/lang` only | Auto-detect + `/lang` override |
| Reply | Text only | Text + cast card PNG |
| "Called it" | Internal `/stats` only | Surface as share prompt on `yes` |
| Demo follow-up | Fixed 5 days | `DEMO_FOLLOW_UP_SECONDS` toggle |
| `/delete` | None | New |
| Rate limit | None | 10/day per phone |
| Kernel (`meihua`, `liuren`, `bazi`, `hexagrams.json`) | Built, 78 tests | **Preserved unchanged** |

End of spec.
