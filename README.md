# yearn

**Real Chinese numerology. Gen Z energy. Delivered to iMessage every morning.**

[**yearn-three.vercel.app**](https://yearn-three.vercel.app) · Built on [Spectrum / Photon](https://photon.codes)

---

## What it is

yearn is a fortune bot that lives in your iMessage. Tap the landing page, say hi, and yearn reads your 八字 (Chinese four pillars) to deliver a personalized daily fortune card at 8am every morning.

> The math is real. The hexagrams are computed deterministically from lunar timestamps — the LLM only interprets the output, it never picks the cast.

## How it works

1. User visits the landing page → taps "get your daily fortune"
2. iMessage opens with `hi yearn` pre-filled
3. yearn onboards: name → birthday → birth time → city
4. A **profile card** is generated and sent (lucky number, color, lucky stone + broad reading)
5. Every morning at **8am local time**, a **daily reading card** arrives automatically
6. Days later, yearn checks in to ask if the prediction came true

## The divination engine

Most AI-divination apps are LLM vibes dressed up as hexagrams. yearn has a deterministic kernel that runs before the LLM ever touches the output:

| Method | How it's computed |
| --- | --- |
| **梅花易数** (default) | Hexagram from lunar timestamp of your message — year-branch + month + day + hour-branch → upper/lower trigrams + changing line, traditional 先天 1–8 mapping |
| **小六壬** | Three-palace cast (大安 / 留连 / 速喜 / 赤口 / 小吉 / 空亡) from lunar month / day / hour |
| **八字** | Four pillars computed once at onboarding, used as context for every reading |

## Stack

| Layer | Tech |
| --- | --- |
| Messaging | [Spectrum SDK](https://photon.codes) (iMessage) |
| Runtime | Bun + TypeScript |
| LLM | OpenRouter |
| Database | Turso (libSQL / SQLite) |
| Card rendering | Playwright + custom HTML/CSS card system |
| Landing page | React + Vite + Tailwind + Framer Motion |
| Backend deploy | Railway |
| Frontend deploy | Vercel |

## Repo structure

```text
src/
├── index.ts          entry point — HTTP server, Spectrum listener, scheduler
├── router.ts         message routing
├── onboarding.ts     name → date → time → city flow
├── commands.ts       /help, /profile, /stats, etc.
├── query.ts          divination pipeline (cast → classify → interpret → record)
├── scheduler.ts      follow-up reminders + daily card delivery
├── dailyCard.ts      morning card generation
├── db.ts             Turso schema + migrations
├── llm.ts            OpenRouter client (interpret, scores, lucky attrs, timezone)
├── lang.ts           strings (en + zh) + timezone map
├── card/             Playwright renderer + HTML/CSS card system
├── kernel/           deterministic divination math (梅花 / 六壬 / 八字)
└── spectrum/         Spectrum SDK wiring

web/                  landing page (React + Vite)
```

## Running locally

```bash
bun install
cp .env.example .env   # fill in your keys
bun run src/index.ts
```

### Required env vars

| Variable | Description |
| --- | --- |
| `PROJECT_ID` | Photon project ID (photon.codes dashboard) |
| `PROJECT_SECRET` | Photon project secret |
| `OPENROUTER_API_KEY` | openrouter.ai API key |
| `TURSO_DATABASE_URL` | `libsql://<db>-<org>.turso.io` — or `file:./yun.db` for local SQLite |
| `TURSO_AUTH_TOKEN` | Turso auth token (leave blank for local file DB) |
| `BIRTH_ENCRYPTION_KEY` | 32-byte AES key — generate with `openssl rand -base64 32` |

### Optional env vars

| Variable | Default | Description |
| --- | --- | --- |
| `FOLLOW_UP_DAYS` | `5` | Days before sending a follow-up check-in |
| `FOLLOW_UP_BUFFER_DAYS` | `1` | Buffer days after predicted event before asking outcome |
| `RATE_LIMIT_PER_DAY` | `10` | Max readings per user per day |
| `SCHEDULER_INTERVAL_SECONDS` | `60` | Scheduler tick interval |
| `DEMO_FOLLOW_UP_SECONDS` | — | Override follow-up delay for live demos |

## iMessage commands

| Command | What it does |
| --- | --- |
| `/profile` | Your fortune profile card |
| `/history` | Last 5 readings |
| `/stats` | Total readings + hit rate |
| `/methods` | Intro to each divination method |
| `/lang en\|zh` | Switch language |
| `/setup` | Redo your 八字 setup |
| `/delete` | Delete all your data |
| `/help` | List all commands |

Any message without `/` is a divination question. Include `小六壬` or `liuren` to switch methods.

## Tests

```bash
bun test
```

## Landing page

```bash
cd web && npm install && npm run dev
```

Deploy `web/` to Vercel with root directory set to `web`.

---

MIT License
