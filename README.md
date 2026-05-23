# yearn

**Your personal fortune bestie on iMessage — real Chinese numerology, Gen Z energy.**

Tap the landing page → iMessage opens → say hi → yearn reads your 八字 and delivers a daily fortune card straight to your phone every morning at 8am.

<p align="center">
  <img src="./demo.gif" alt="demo" width="520">
</p>

## How it works

1. User visits the landing page and taps "get your daily fortune"
2. iMessage opens with `hi yearn` pre-filled — user hits send
3. yearn onboards them: name → birthday → birth time → city
4. A profile card is generated and sent (lucky number, color, stone + broad reading)
5. Every morning at 8am local time, a daily reading card lands in their iMessage

## The math is real

Most AI-divination apps are LLM vibes with hexagram decoration. yearn has a deterministic kernel:

- **梅花易数** — hexagrams computed from the lunar timestamp of your message (year-branch + month + day + hour-branch → upper/lower trigrams + changing line, traditional 先天 1–8 mapping)
- **小六壬** — three-palace cast (大安 / 留连 / 速喜 / 赤口 / 小吉 / 空亡) from lunar month / day / hour-branch
- **八字** — your four pillars, computed once at onboarding

The LLM *never picks* the hexagram. It only interprets the structured kernel output.

## Stack

| Layer | Tech |
|---|---|
| Messaging | [Spectrum SDK](https://photon.codes) (iMessage) |
| Runtime | Bun + TypeScript |
| LLM | OpenRouter (`openrouter/free`) |
| Database | Turso (libSQL / SQLite) |
| Card rendering | Playwright + custom HTML card system |
| Landing page | React + Vite + Tailwind + Framer Motion |

## Repo structure

```
src/          — Bun backend (iMessage agent)
  index.ts    — entry point: Spectrum listener + HTTP server + scheduler
  router.ts   — message routing logic
  onboarding.ts
  commands.ts
  query.ts    — divination pipeline
  scheduler.ts — follow-up reminders + daily card delivery
  dailyCard.ts
  db.ts       — Turso schema + migrations
  llm.ts      — OpenRouter client
  lang.ts     — strings (en + zh)
  card/       — Playwright card renderer + HTML card system
  kernel/     — deterministic divination math (梅花 / 六壬 / 八字)
  spectrum/   — Spectrum SDK wiring

web/          — Landing page (React + Vite)
```

## Run locally

```bash
bun install
cp .env.example .env   # fill in your keys
bun run src/index.ts
```

### Required env vars

| Key | Notes |
|---|---|
| `PROJECT_ID` | Photon project id (photon.codes dashboard) |
| `PROJECT_SECRET` | Photon project secret |
| `OPENROUTER_API_KEY` | openrouter.ai |
| `TURSO_DATABASE_URL` | `libsql://<db>-<org>.turso.io` or `file:./yun.db` for local |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `BIRTH_ENCRYPTION_KEY` | 32-byte AES key: `openssl rand -base64 32` |

### Optional

| Key | Default | Notes |
|---|---|---|
| `FOLLOW_UP_DAYS` | `5` | Days before follow-up reminder |
| `FOLLOW_UP_BUFFER_DAYS` | `1` | Days after event before asking outcome |
| `RATE_LIMIT_PER_DAY` | `10` | Max questions per user per day |
| `SCHEDULER_INTERVAL_SECONDS` | `60` | How often the scheduler ticks |

## Commands (in iMessage)

| Command | Effect |
|---|---|
| `/help` | list all commands |
| `/profile` | your profile card |
| `/history` | last 5 readings |
| `/stats` | total count + hit rate |
| `/methods` | intro to each divination method |
| `/lang en\|zh` | switch language |
| `/setup` | redo your 八字 setup |
| `/delete` | delete all your data |

Any message without `/` is treated as a divination question. Include `小六壬` or `liuren` to switch methods.

## Tests

```bash
bun test
```

## Landing page (web/)

```bash
cd web
npm install
npm run dev       # local dev
npm run build     # build to web/dist/
```

Deploy `web/` to Vercel — set root directory to `web` and it builds automatically.

MIT License.
