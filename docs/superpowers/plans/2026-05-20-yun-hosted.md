# 运 v2 (yun-hosted) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hosted, multi-tenant iMessage oracle on Spectrum + Turso + Fly.io, preserving all v1 kernel math and extending with onboarding FSM, cast card PNG generation, share prompts, and demo mode.

**Architecture:** New repo `yun-hosted`. Inbound messages arrive via `spectrum-ts` message loop keyed by `space.phone`; the router dispatches to onboarding FSM, command handler, outcome handler, or query pipeline. Proactive follow-ups are sent by an in-process scheduler using `imessage(app).space({ phone })`. All DB calls are async via `@libsql/client` (Turso).

**Tech Stack:** Bun, TypeScript, spectrum-ts 1.9.2, @libsql/client, @anthropic-ai/sdk, satori, @resvg/resvg-js, ulidx, node:crypto (AES-256-GCM)

**Source reference:** v1 lives at `~/Developer/yun_with_photon/src/` — copy kernel unchanged, adapt everything else.

---

## File Map

```
yun-hosted/
  src/
    index.ts          — app entry: Spectrum loop + scheduler start + shutdown
    config.ts         — env validation (fail-fast)
    db.ts             — Turso client, schema, typed query helpers
    crypto.ts         — AES-256-GCM encrypt/decrypt for birth times
    lang.ts           — detectLang(), STRINGS bilingual copy map
    router.ts         — inbound classifier: delete-confirm | command | onboarding | outcome | share | query
    onboarding.ts     — 4-state FSM: pending_date → pending_time → pending_location → complete
    commands.ts       — /help /history /stats /methods /lang /setup /delete
    outcomes.ts       — yes/no/mixed parser (verbatim from v1)
    query.ts          — kernel → LLM → store → send
    llm.ts            — Anthropic SDK wrapper, prompt builder
    scheduler.ts      — follow-up loop with demo-mode toggle
    card/
      fonts.ts        — load font ArrayBuffers from src/card/fonts/
      template.tsx    — Satori JSX card layout
      render.ts       — renderCastCard() → Buffer
    spectrum/
      app.ts          — singleton Spectrum() init, exports app + iMsg narrower
      send.ts         — sendText(), sendCard(), sendFollowUp()
    kernel/           — COPIED VERBATIM from v1 src/divination/
      meihua.ts
      liuren.ts
      bazi.ts
      iching.ts
      trigrams.ts
      data/
        hexagrams.json
  tests/
    kernel/           — COPIED VERBATIM from v1 tests/ (kernel tests only)
    config.test.ts
    crypto.test.ts
    lang.test.ts
    outcomes.test.ts
    db.test.ts
    onboarding.test.ts
    scheduler.test.ts
    card.test.ts
  src/card/fonts/
    inter-400.ttf
    noto-sans-sc-400.ttf
    jetbrains-mono-400.ttf
  Dockerfile
  fly.toml
  .env.example
  package.json
  tsconfig.json
```

---

## Task 1: Repo initialization

**Files:**
- Create: `~/Developer/yun-hosted/` (new repo)
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`

- [ ] **Step 1: Create repo and init git**

```bash
mkdir ~/Developer/yun-hosted && cd ~/Developer/yun-hosted
git init
bun init -y
```

- [ ] **Step 2: Install dependencies**

```bash
bun add spectrum-ts @libsql/client @anthropic-ai/sdk satori @resvg/resvg-js ulidx lunar-typescript
bun add -d @types/bun @types/react typescript react
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Write package.json**

```json
{
  "name": "yun-hosted",
  "module": "src/index.ts",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch run src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^19",
    "typescript": "^5"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.90.0",
    "@libsql/client": "^0.14.0",
    "@resvg/resvg-js": "^2.6.2",
    "lunar-typescript": "^1.8.6",
    "react": "^19",
    "satori": "^0.12.0",
    "spectrum-ts": "^1.9.2",
    "ulidx": "^2.3.0"
  }
}
```

- [ ] **Step 5: Write .gitignore**

```
node_modules/
.env
*.db
*.db-shm
*.db-wal
*.log
dist/
```

- [ ] **Step 6: Write .env.example**

```bash
ANTHROPIC_API_KEY=
PROJECT_ID=
PROJECT_SECRET=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
BIRTH_ENCRYPTION_KEY=          # 32-byte AES key: openssl rand -base64 32
FOLLOW_UP_DAYS=5
DEMO_FOLLOW_UP_SECONDS=        # unset in prod; set to e.g. 30 for demo
SCHEDULER_INTERVAL_SECONDS=60
RATE_LIMIT_PER_DAY=10
LOG_LEVEL=info
NODE_ENV=development
```

- [ ] **Step 7: Copy kernel from v1**

```bash
mkdir -p src/kernel tests/kernel
cp ~/Developer/yun_with_photon/src/divination/*.ts src/kernel/
cp -r ~/Developer/yun_with_photon/src/divination/data src/kernel/data
cp ~/Developer/yun_with_photon/tests/meihua.test.ts tests/kernel/
cp ~/Developer/yun_with_photon/tests/liuren.test.ts tests/kernel/
cp ~/Developer/yun_with_photon/tests/bazi.test.ts tests/kernel/
cp ~/Developer/yun_with_photon/tests/iching.test.ts tests/kernel/
cp ~/Developer/yun_with_photon/tests/trigrams.test.ts tests/kernel/
```

- [ ] **Step 8: Update kernel import paths in copied test files**

In each `tests/kernel/*.test.ts`, change `'../src/divination/X.ts'` → `'../../src/kernel/X.ts'`:

```bash
sed -i '' "s|'../src/divination/|'../../src/kernel/|g" tests/kernel/*.test.ts
sed -i '' 's|"../src/divination/|"../../src/kernel/|g' tests/kernel/*.test.ts
```

- [ ] **Step 9: Run kernel tests — must all pass**

```bash
bun test tests/kernel/
```

Expected: 78+ tests pass, 0 failures.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: init repo, deps, copy kernel from v1"
```

---

## Task 2: Config / env validation

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/config.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("config", () => {
  const saved = { ...process.env };

  afterEach(() => {
    // restore
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, saved);
  });

  test("throws when required var is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => {
      const { config } = require("../src/config.ts");
      config.anthropicApiKey();
    }).toThrow("ANTHROPIC_API_KEY");
  });

  test("followUpDays defaults to 5", () => {
    delete process.env.FOLLOW_UP_DAYS;
    const { config } = require("../src/config.ts");
    expect(config.followUpDays()).toBe(5);
  });

  test("demoFollowUpSeconds returns undefined when unset", () => {
    delete process.env.DEMO_FOLLOW_UP_SECONDS;
    const { config } = require("../src/config.ts");
    expect(config.demoFollowUpSeconds()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/config.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write src/config.ts**

```typescript
// src/config.ts
function required(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === "") throw new Error(`Missing required env var: ${key}`);
  return v.trim();
}

function optional(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function optionalNum(key: string): number | undefined {
  const v = process.env[key];
  if (!v || v.trim() === "") return undefined;
  const n = Number(v.trim());
  return isNaN(n) ? undefined : n;
}

export const config = {
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  projectId: () => required("PROJECT_ID"),
  projectSecret: () => required("PROJECT_SECRET"),
  tursoUrl: () => required("TURSO_DATABASE_URL"),
  tursoToken: () => required("TURSO_AUTH_TOKEN"),
  birthEncryptionKey: () => required("BIRTH_ENCRYPTION_KEY"),
  followUpDays: () => Number(optional("FOLLOW_UP_DAYS", "5")),
  demoFollowUpSeconds: (): number | undefined => optionalNum("DEMO_FOLLOW_UP_SECONDS"),
  schedulerIntervalSeconds: () => Number(optional("SCHEDULER_INTERVAL_SECONDS", "60")),
  rateLimitPerDay: () => Number(optional("RATE_LIMIT_PER_DAY", "10")),
  logLevel: () => optional("LOG_LEVEL", "info"),
  isDev: () => optional("NODE_ENV", "development") !== "production",
};
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun test tests/config.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat: config module with env validation"
```

---

## Task 3: Database layer

**Files:**
- Create: `src/db.ts`
- Create: `tests/db.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/db.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { openDb, type Db } from "../src/db.ts";

// Use a local SQLite file for tests (libsql supports file: URLs)
const TEST_URL = "file:test-yun.db";

describe("db", () => {
  let db: Db;

  beforeEach(async () => {
    db = await openDb(TEST_URL, "");
  });

  afterEach(async () => {
    await db.close();
    // Clean up test db file
    try { Bun.spawnSync(["rm", "-f", "test-yun.db"]); } catch {}
  });

  test("getUser returns null for unknown phone", async () => {
    const user = await db.getUser("+10000000000");
    expect(user).toBeNull();
  });

  test("upsertUser then getUser roundtrips", async () => {
    const now = Date.now();
    await db.upsertUser({
      phone: "+11234567890",
      lang: "en",
      onboarding_state: "pending_date",
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    const user = await db.getUser("+11234567890");
    expect(user?.phone).toBe("+11234567890");
    expect(user?.onboarding_state).toBe("pending_date");
  });

  test("recordReading then getRecentReadings", async () => {
    const now = Date.now();
    await db.upsertUser({
      phone: "+11234567890",
      lang: "en",
      onboarding_state: "complete",
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    const id = await db.recordReading({
      phone: "+11234567890",
      question: "will it work?",
      method: "meihua",
      cast_json: "{}",
      interpretation: "yes",
      lang: "en",
      created_at: now,
      follow_up_at: now + 5 * 86400_000,
    });
    expect(typeof id).toBe("string");
    const rows = await db.getRecentReadings("+11234567890", 5);
    expect(rows.length).toBe(1);
    expect(rows[0]!.question).toBe("will it work?");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/db.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write src/db.ts**

```typescript
// src/db.ts
import { createClient, type Client, type Row } from "@libsql/client";
import { ulid } from "ulidx";

export type Lang = "en" | "zh";
export type OnboardingState = "pending_date" | "pending_time" | "pending_location" | "complete";
export type Method = "meihua" | "liuren";

export interface UserRow {
  phone: string;
  lang: Lang;
  onboarding_state: OnboardingState;
  birth_iso_encrypted: string | null;   // JSON blob: { iv, ct, at }
  birth_tz: string | null;              // e.g. "+08:00"
  has_hour_pillar: 0 | 1;
  bazi_pillars: string | null;          // JSON {year, month, day, hour}
  created_at: number;
  last_seen_at: number;
  readings_today: number;
  readings_today_reset_at: number;
  delete_pending: 0 | 1;
}

export interface ReadingRow {
  id: string;
  phone: string;
  question: string;
  method: Method;
  cast_json: string;
  interpretation: string;
  lang: Lang;
  created_at: number;
  follow_up_at: number;
  followed_up: 0 | 1;
}

export interface OutcomeRow {
  reading_id: string;
  outcome: "yes" | "no" | "mixed";
  user_note: string | null;
  responded_at: number;
  shared: 0 | 1;
}

export interface UpsertUser {
  phone: string;
  lang: Lang;
  onboarding_state: OnboardingState;
  birth_iso_encrypted?: string | null;
  birth_tz?: string | null;
  has_hour_pillar?: 0 | 1;
  bazi_pillars?: string | null;
  created_at: number;
  last_seen_at: number;
  readings_today: number;
  readings_today_reset_at: number;
  delete_pending?: 0 | 1;
}

export interface Db {
  getUser(phone: string): Promise<UserRow | null>;
  upsertUser(u: UpsertUser): Promise<void>;
  touchLastSeen(phone: string, now: number): Promise<void>;
  setUserLang(phone: string, lang: Lang): Promise<void>;
  setOnboardingState(phone: string, state: OnboardingState, extra?: Partial<UserRow>): Promise<void>;
  setDeletePending(phone: string, pending: 0 | 1): Promise<void>;
  deleteUser(phone: string): Promise<void>;
  recordReading(r: Omit<ReadingRow, "id" | "followed_up">): Promise<string>;
  getRecentReadings(phone: string, limit: number): Promise<ReadingRow[]>;
  getPendingFollowUps(now: number): Promise<ReadingRow[]>;
  markFollowedUp(readingId: string): Promise<void>;
  getMostRecentPendingOutcome(phone: string, withinMs: number): Promise<ReadingRow | null>;
  recordOutcome(o: OutcomeRow): Promise<void>;
  getMostRecentYesOutcome(phone: string): Promise<(OutcomeRow & { question: string }) | null>;
  markShared(readingId: string): Promise<void>;
  getStats(phone: string): Promise<{ total: number; with_outcome: number; yes: number; no: number; mixed: number }>;
  incrementReadingsToday(phone: string, now: number): Promise<void>;
  close(): Promise<void>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
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
  readings_today_reset_at INTEGER NOT NULL,
  delete_pending INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS readings (
  id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS outcomes (
  reading_id TEXT PRIMARY KEY REFERENCES readings(id),
  outcome TEXT NOT NULL,
  user_note TEXT,
  responded_at INTEGER NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_readings_phone ON readings(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_follow_up ON readings(follow_up_at, followed_up);
`;

function toUser(row: Row): UserRow {
  return {
    phone: row.phone as string,
    lang: row.lang as Lang,
    onboarding_state: row.onboarding_state as OnboardingState,
    birth_iso_encrypted: row.birth_iso_encrypted as string | null,
    birth_tz: row.birth_tz as string | null,
    has_hour_pillar: (row.has_hour_pillar as number) as 0 | 1,
    bazi_pillars: row.bazi_pillars as string | null,
    created_at: row.created_at as number,
    last_seen_at: row.last_seen_at as number,
    readings_today: row.readings_today as number,
    readings_today_reset_at: row.readings_today_reset_at as number,
    delete_pending: (row.delete_pending as number) as 0 | 1,
  };
}

function toReading(row: Row): ReadingRow {
  return {
    id: row.id as string,
    phone: row.phone as string,
    question: row.question as string,
    method: row.method as Method,
    cast_json: row.cast_json as string,
    interpretation: row.interpretation as string,
    lang: row.lang as Lang,
    created_at: row.created_at as number,
    follow_up_at: row.follow_up_at as number,
    followed_up: (row.followed_up as number) as 0 | 1,
  };
}

export async function openDb(url: string, authToken: string): Promise<Db> {
  const client: Client = createClient({ url, authToken });

  // Create schema (batch is atomic)
  for (const stmt of SCHEMA.trim().split(";").map(s => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }

  return {
    async getUser(phone) {
      const r = await client.execute({ sql: "SELECT * FROM users WHERE phone = ?", args: [phone] });
      return r.rows[0] ? toUser(r.rows[0]) : null;
    },

    async upsertUser(u) {
      await client.execute({
        sql: `INSERT INTO users (phone, lang, onboarding_state, birth_iso_encrypted, birth_tz,
              has_hour_pillar, bazi_pillars, created_at, last_seen_at, readings_today,
              readings_today_reset_at, delete_pending)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(phone) DO UPDATE SET
                lang = excluded.lang,
                onboarding_state = excluded.onboarding_state,
                birth_iso_encrypted = COALESCE(excluded.birth_iso_encrypted, birth_iso_encrypted),
                birth_tz = COALESCE(excluded.birth_tz, birth_tz),
                has_hour_pillar = excluded.has_hour_pillar,
                bazi_pillars = COALESCE(excluded.bazi_pillars, bazi_pillars),
                last_seen_at = excluded.last_seen_at`,
        args: [
          u.phone, u.lang, u.onboarding_state,
          u.birth_iso_encrypted ?? null, u.birth_tz ?? null,
          u.has_hour_pillar ?? 1, u.bazi_pillars ?? null,
          u.created_at, u.last_seen_at,
          u.readings_today, u.readings_today_reset_at,
          u.delete_pending ?? 0,
        ],
      });
    },

    async touchLastSeen(phone, now) {
      await client.execute({ sql: "UPDATE users SET last_seen_at = ? WHERE phone = ?", args: [now, phone] });
    },

    async setUserLang(phone, lang) {
      await client.execute({ sql: "UPDATE users SET lang = ? WHERE phone = ?", args: [lang, phone] });
    },

    async setOnboardingState(phone, state, extra = {}) {
      await client.execute({
        sql: `UPDATE users SET
          onboarding_state = ?,
          birth_iso_encrypted = COALESCE(?, birth_iso_encrypted),
          birth_tz = COALESCE(?, birth_tz),
          has_hour_pillar = COALESCE(?, has_hour_pillar),
          bazi_pillars = COALESCE(?, bazi_pillars)
          WHERE phone = ?`,
        args: [
          state,
          extra.birth_iso_encrypted ?? null,
          extra.birth_tz ?? null,
          extra.has_hour_pillar ?? null,
          extra.bazi_pillars ?? null,
          phone,
        ],
      });
    },

    async setDeletePending(phone, pending) {
      await client.execute({ sql: "UPDATE users SET delete_pending = ? WHERE phone = ?", args: [pending, phone] });
    },

    async deleteUser(phone) {
      await client.batch([
        { sql: "DELETE FROM outcomes WHERE reading_id IN (SELECT id FROM readings WHERE phone = ?)", args: [phone] },
        { sql: "DELETE FROM readings WHERE phone = ?", args: [phone] },
        { sql: "DELETE FROM users WHERE phone = ?", args: [phone] },
      ], "write");
    },

    async recordReading(r) {
      const id = ulid();
      await client.execute({
        sql: `INSERT INTO readings (id, phone, question, method, cast_json, interpretation, lang, created_at, follow_up_at, followed_up)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        args: [id, r.phone, r.question, r.method, r.cast_json, r.interpretation, r.lang, r.created_at, r.follow_up_at],
      });
      return id;
    },

    async getRecentReadings(phone, limit) {
      const r = await client.execute({
        sql: "SELECT * FROM readings WHERE phone = ? ORDER BY created_at DESC LIMIT ?",
        args: [phone, limit],
      });
      return r.rows.map(toReading);
    },

    async getPendingFollowUps(now) {
      const r = await client.execute({
        sql: "SELECT * FROM readings WHERE follow_up_at <= ? AND followed_up = 0",
        args: [now],
      });
      return r.rows.map(toReading);
    },

    async markFollowedUp(readingId) {
      await client.execute({ sql: "UPDATE readings SET followed_up = 1 WHERE id = ?", args: [readingId] });
    },

    async getMostRecentPendingOutcome(phone, withinMs) {
      const cutoff = Date.now() - withinMs;
      const r = await client.execute({
        sql: `SELECT r.* FROM readings r
              LEFT JOIN outcomes o ON o.reading_id = r.id
              WHERE r.phone = ? AND r.followed_up = 1 AND o.reading_id IS NULL AND r.created_at > ?
              ORDER BY r.created_at DESC LIMIT 1`,
        args: [phone, cutoff],
      });
      return r.rows[0] ? toReading(r.rows[0]) : null;
    },

    async recordOutcome(o) {
      await client.execute({
        sql: `INSERT INTO outcomes (reading_id, outcome, user_note, responded_at, shared)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(reading_id) DO NOTHING`,
        args: [o.reading_id, o.outcome, o.user_note ?? null, o.responded_at, o.shared],
      });
    },

    async getMostRecentYesOutcome(phone) {
      const r = await client.execute({
        sql: `SELECT o.*, r.question FROM outcomes o
              JOIN readings r ON r.id = o.reading_id
              WHERE r.phone = ? AND o.outcome = 'yes' AND o.shared = 0
              ORDER BY o.responded_at DESC LIMIT 1`,
        args: [phone],
      });
      if (!r.rows[0]) return null;
      const row = r.rows[0];
      return {
        reading_id: row.reading_id as string,
        outcome: "yes",
        user_note: row.user_note as string | null,
        responded_at: row.responded_at as number,
        shared: 0,
        question: row.question as string,
      };
    },

    async markShared(readingId) {
      await client.execute({ sql: "UPDATE outcomes SET shared = 1 WHERE reading_id = ?", args: [readingId] });
    },

    async getStats(phone) {
      const r = await client.execute({
        sql: `SELECT
          COUNT(*) as total,
          COUNT(o.reading_id) as with_outcome,
          SUM(CASE WHEN o.outcome = 'yes' THEN 1 ELSE 0 END) as yes,
          SUM(CASE WHEN o.outcome = 'no' THEN 1 ELSE 0 END) as no,
          SUM(CASE WHEN o.outcome = 'mixed' THEN 1 ELSE 0 END) as mixed
          FROM readings r LEFT JOIN outcomes o ON o.reading_id = r.id
          WHERE r.phone = ?`,
        args: [phone],
      });
      const row = r.rows[0]!;
      return {
        total: row.total as number,
        with_outcome: row.with_outcome as number,
        yes: (row.yes as number) || 0,
        no: (row.no as number) || 0,
        mixed: (row.mixed as number) || 0,
      };
    },

    async incrementReadingsToday(phone, now) {
      const DAY_MS = 86_400_000;
      await client.execute({
        sql: `UPDATE users SET
          readings_today = CASE
            WHEN readings_today_reset_at < ? THEN 1
            ELSE readings_today + 1
          END,
          readings_today_reset_at = CASE
            WHEN readings_today_reset_at < ? THEN ?
            ELSE readings_today_reset_at
          END
          WHERE phone = ?`,
        args: [now - DAY_MS, now - DAY_MS, now, phone],
      });
    },

    async close() {
      client.close();
    },
  };
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun test tests/db.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/db.ts tests/db.test.ts
git commit -m "feat: Turso DB layer with typed query helpers"
```

---

## Task 4: Crypto module

**Files:**
- Create: `src/crypto.ts`
- Create: `tests/crypto.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/crypto.test.ts
import { describe, test, expect } from "bun:test";
import { encrypt, decrypt } from "../src/crypto.ts";

const KEY = Buffer.from("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", "base64"); // 32 bytes of 0x00

describe("crypto", () => {
  test("encrypt then decrypt returns original string", () => {
    const plain = "2002-10-22T18:00:00+08:00";
    const enc = encrypt(plain, KEY);
    const dec = decrypt(enc, KEY);
    expect(dec).toBe(plain);
  });

  test("different encryptions of same plaintext produce different ciphertexts", () => {
    const plain = "2002-10-22T18:00:00+08:00";
    const a = encrypt(plain, KEY);
    const b = encrypt(plain, KEY);
    expect(a.ct).not.toBe(b.ct); // different IVs
  });

  test("JSON roundtrip (stored as string)", () => {
    const plain = "1990-01-01T00:00:00+00:00";
    const enc = encrypt(plain, KEY);
    const json = JSON.stringify(enc);
    const dec = decrypt(JSON.parse(json), KEY);
    expect(dec).toBe(plain);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/crypto.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write src/crypto.ts**

```typescript
// src/crypto.ts
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { config } from "./config.ts";

const ALGO = "aes-256-gcm";

export interface Encrypted {
  iv: string;   // 12-byte nonce, hex
  ct: string;   // ciphertext, hex
  at: string;   // 16-byte auth tag, hex
}

function loadKey(): Buffer {
  return Buffer.from(config.birthEncryptionKey(), "base64");
}

export function encrypt(plaintext: string, key?: Buffer): Encrypted {
  const k = key ?? loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, k, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const at = cipher.getAuthTag();
  return { iv: iv.toString("hex"), ct: ct.toString("hex"), at: at.toString("hex") };
}

export function decrypt(enc: Encrypted, key?: Buffer): string {
  const k = key ?? loadKey();
  const decipher = createDecipheriv(ALGO, k, Buffer.from(enc.iv, "hex"));
  decipher.setAuthTag(Buffer.from(enc.at, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ct, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptToJson(plaintext: string): string {
  return JSON.stringify(encrypt(plaintext));
}

export function decryptFromJson(json: string): string {
  return decrypt(JSON.parse(json) as Encrypted);
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun test tests/crypto.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/crypto.ts tests/crypto.test.ts
git commit -m "feat: AES-256-GCM crypto for birth time encryption"
```

---

## Task 5: Lang detection + bilingual strings

**Files:**
- Create: `src/lang.ts`
- Create: `tests/lang.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/lang.test.ts
import { describe, test, expect } from "bun:test";
import { detectLang, STRINGS } from "../src/lang.ts";

describe("detectLang", () => {
  test("returns zh for CJK-heavy text", () => {
    expect(detectLang("我今天能找到工作吗")).toBe("zh");
  });

  test("returns en for Latin text", () => {
    expect(detectLang("will I get the job")).toBe("en");
  });

  test("returns en for empty string", () => {
    expect(detectLang("")).toBe("en");
  });
});

describe("STRINGS", () => {
  test("has both en and zh for rate limit", () => {
    expect(STRINGS.rateLimited.en).toBeTruthy();
    expect(STRINGS.rateLimited.zh).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/lang.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/lang.ts**

```typescript
// src/lang.ts
export type Lang = "en" | "zh";

const CJK = /[㐀-鿿豈-﫿]/;

export function detectLang(text: string): Lang {
  if (!text) return "en";
  const chars = Array.from(text);
  const cjk = chars.filter((c) => CJK.test(c)).length;
  return cjk / chars.length > 0.3 ? "zh" : "en";
}

export const TZ_MAP: Record<string, string> = {
  "shanghai": "+08:00", "beijing": "+08:00", "shenzhen": "+08:00",
  "guangzhou": "+08:00", "chengdu": "+08:00", "chongqing": "+08:00",
  "hangzhou": "+08:00", "wuhan": "+08:00", "nanjing": "+08:00",
  "hong kong": "+08:00", "taipei": "+08:00", "singapore": "+08:00",
  "tokyo": "+09:00", "osaka": "+09:00", "seoul": "+09:00",
  "new york": "-05:00", "nyc": "-05:00", "boston": "-05:00",
  "miami": "-05:00", "toronto": "-05:00",
  "chicago": "-06:00", "dallas": "-06:00", "houston": "-06:00",
  "denver": "-07:00", "phoenix": "-07:00",
  "los angeles": "-08:00", "la": "-08:00", "san francisco": "-08:00",
  "sf": "-08:00", "seattle": "-08:00", "vancouver": "-08:00",
  "london": "+00:00", "dublin": "+00:00",
  "paris": "+01:00", "berlin": "+01:00", "amsterdam": "+01:00",
  "rome": "+01:00", "madrid": "+01:00", "barcelona": "+01:00",
  "stockholm": "+01:00", "oslo": "+01:00", "zurich": "+01:00",
  "moscow": "+03:00", "dubai": "+04:00",
  "mumbai": "+05:30", "delhi": "+05:30", "bangalore": "+05:30",
  "bangkok": "+07:00", "jakarta": "+07:00",
  "sydney": "+11:00", "melbourne": "+11:00", "auckland": "+13:00",
};

export function resolveTimezone(location: string): string | null {
  const key = location.toLowerCase().trim();
  for (const [k, v] of Object.entries(TZ_MAP)) {
    if (key.includes(k)) return v;
  }
  return null;
}

export const STRINGS = {
  welcome: {
    en: "Welcome to 运. To cast your readings, I need three things. First — what's your birth date? (e.g., October 22, 2002 or 2002-10-22)",
    zh: "欢迎来到运。帮我确认三件事，才能起卦。首先——你的出生日期是什么？（如：2002年10月22日 或 2002-10-22）",
  },
  askTime: {
    en: "Got it. What time were you born? (e.g., 6:00 PM or 18:00) — or say 'skip' if you don't know.",
    zh: "好的。你的出生时间是几点？（如：18:00 或下午6点）——不知道的话回「跳过」。",
  },
  askLocation: {
    en: "And where were you born? (city + country, e.g., Shanghai, China)",
    zh: "你在哪里出生？（城市+国家，如：中国深圳）",
  },
  askTimezone: {
    en: "I don't have that city in my lookup table. What's your UTC timezone offset? (e.g., +08:00 for China, -05:00 for NYC)",
    zh: "我没找到那个城市。请输入你的时区偏移？（如中国 +08:00，纽约 -05:00）",
  },
  onboardingComplete: {
    en: "Got it — your 八字 is set. Ask me anything.",
    zh: "好了——八字已记录。随时问卦。",
  },
  invalidDate: {
    en: "I couldn't read that as a date. Try: 2002-10-22 or October 22, 2002.",
    zh: "无法识别这个日期，试试：2002-10-22 或 2002年10月22日。",
  },
  invalidTime: {
    en: "I couldn't read that as a time. Try: 18:00 or 6:00 PM. Or say 'skip'.",
    zh: "无法识别这个时间，试试：18:00 或 下午6点。或者回「跳过」。",
  },
  rateLimited: {
    en: "you've asked 10 times today — come back tomorrow.",
    zh: "今天已问了10次——明天再来吧。",
  },
  deletePrompt: {
    en: "This will permanently delete all your readings and your 八字. Reply 'confirm delete' to proceed, or anything else to cancel.",
    zh: "这将永久删除你的所有卦象和八字数据。回「confirm delete」确认，或回其他内容取消。",
  },
  deleteConfirmed: {
    en: "Done. All your data has been deleted.",
    zh: "已删除。你的所有数据已清除。",
  },
  deleteCancelled: {
    en: "Cancelled.",
    zh: "已取消。",
  },
  sharePrompt: {
    en: "this was a hit. want a shareable card? — reply 'share' and I'll send you one.",
    zh: "这次准了。要生成一张分享卡吗？回「分享」我就发给你。",
  },
  followUpNote: {
    en: "(reply 'yes', 'no', or 'mixed' in a few days when I check back.)",
    zh: "（过几日我来问结果，届时回 yes / no / mixed 即可。）",
  },
};
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun test tests/lang.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lang.ts tests/lang.test.ts
git commit -m "feat: lang detection, timezone lookup table, bilingual strings"
```

---

## Task 6: Spectrum app init + send wrappers

**Files:**
- Create: `src/spectrum/app.ts`
- Create: `src/spectrum/send.ts`

No unit tests for these (they wrap external network calls); integration tested via terminal provider in Task 16.

- [ ] **Step 1: Write src/spectrum/app.ts**

```typescript
// src/spectrum/app.ts
import { Spectrum } from "spectrum-ts";
import { imessage, terminal } from "spectrum-ts/providers";
import { config } from "../config.ts";

export type SpectrumApp = Awaited<ReturnType<typeof Spectrum>>;

let _app: SpectrumApp | null = null;

export async function initSpectrum(): Promise<SpectrumApp> {
  const providers = [
    imessage.config(),
    ...(config.isDev() ? [terminal.config()] : []),
  ];

  _app = await Spectrum({
    projectId: config.projectId(),
    projectSecret: config.projectSecret(),
    providers,
  });

  return _app;
}

export function getApp(): SpectrumApp {
  if (!_app) throw new Error("Spectrum not initialized — call initSpectrum() first");
  return _app;
}
```

- [ ] **Step 2: Write src/spectrum/send.ts**

```typescript
// src/spectrum/send.ts
import { attachment } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers";
import type { Lang } from "../db.ts";
import { STRINGS } from "../lang.ts";
import { getApp } from "./app.ts";

async function getSpace(phone: string) {
  const iMsg = imessage(getApp());
  return iMsg.space({ phone });
}

export async function sendText(phone: string, text: string): Promise<void> {
  const space = await getSpace(phone);
  await space.send(text);
}

export async function sendCard(phone: string, text: string, png: Buffer): Promise<void> {
  const space = await getSpace(phone);
  await space.send(text);
  await space.send(attachment(png, { mimeType: "image/png", name: "cast.png" }));
}

export async function sendFollowUp(phone: string, question: string, lang: Lang, days: number): Promise<void> {
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;
  const text =
    lang === "zh"
      ? `${days} 天前你问：「${q}」——后来怎么样？回 yes / no / mixed（可加一句备注）。`
      : `${days} days ago you asked: "${q}" — how did it play out? reply: yes / no / mixed (feel free to add a note).`;
  await sendText(phone, text);
}

export async function sendShareInvite(phone: string, lang: Lang): Promise<void> {
  await sendText(phone, STRINGS.sharePrompt[lang]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/spectrum/
git commit -m "feat: Spectrum app init and send wrappers"
```

---

## Task 7: Outcomes parser

**Files:**
- Create: `src/outcomes.ts`
- Create: `tests/outcomes.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/outcomes.test.ts
import { describe, test, expect } from "bun:test";
import { parseOutcome, looksLikeOutcome } from "../src/outcomes.ts";

describe("parseOutcome", () => {
  test("parses 'yes'", () => {
    expect(parseOutcome("yes")?.outcome).toBe("yes");
  });

  test("parses 'no'", () => {
    expect(parseOutcome("no")?.outcome).toBe("no");
  });

  test("parses 'mixed'", () => {
    expect(parseOutcome("mixed")?.outcome).toBe("mixed");
  });

  test("parses Chinese yes tokens", () => {
    expect(parseOutcome("是的")?.outcome).toBe("yes");
    expect(parseOutcome("准了")?.outcome).toBe("yes");
  });

  test("captures trailing note", () => {
    const r = parseOutcome("yes, it worked!");
    expect(r?.outcome).toBe("yes");
    expect(r?.note).toBe("it worked!");
  });

  test("returns null for unrecognized text", () => {
    expect(parseOutcome("what should I do?")).toBeNull();
  });
});

describe("looksLikeOutcome", () => {
  test("short text without question marks", () => {
    expect(looksLikeOutcome("yes it worked")).toBe(true);
  });

  test("text with question mark is not an outcome", () => {
    expect(looksLikeOutcome("will I get the job?")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/outcomes.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/outcomes.ts**

```typescript
// src/outcomes.ts
export interface ParsedOutcome {
  outcome: "yes" | "no" | "mixed";
  note: string | null;
}

const YES = ["yes", "y", "是", "是的", "对", "对了", "中", "中了", "准", "准了", "played out", "it did"];
const NO = ["no", "n", "否", "不", "不是", "没有", "没中", "didn't", "it didn't", "it did not", "did not"];
const MIXED = ["mixed", "maybe", "sort of", "kind of", "不確定", "不确定", "一半", "一半一半", "模糊", "差不多"];

function matchLongest(lower: string, tokens: string[]): number | null {
  let best: number | null = null;
  for (const tok of tokens) {
    if (!lower.startsWith(tok)) continue;
    const next = lower.charAt(tok.length);
    const clean = next === "" || /[\s.,!?。，！？]/.test(next);
    if (clean && (best === null || tok.length > best)) best = tok.length;
  }
  return best;
}

function remainder(text: string, prefixLen: number): string | null {
  const rest = text.slice(prefixLen).replace(/^[\s.,!?。，！？]+/, "").trim();
  return rest.length > 0 ? rest : null;
}

export function parseOutcome(text: string): ParsedOutcome | null {
  const lower = text.trim().toLowerCase();
  const yesLen = matchLongest(lower, YES);
  if (yesLen !== null) return { outcome: "yes", note: remainder(text.trim(), yesLen) };
  const noLen = matchLongest(lower, NO);
  if (noLen !== null) return { outcome: "no", note: remainder(text.trim(), noLen) };
  const mixLen = matchLongest(lower, MIXED);
  if (mixLen !== null) return { outcome: "mixed", note: remainder(text.trim(), mixLen) };
  return null;
}

export function looksLikeOutcome(text: string): boolean {
  return text.length < 200 && !text.includes("?") && !text.includes("？");
}

export function isShareRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "share" || t === "分享";
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun test tests/outcomes.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/outcomes.ts tests/outcomes.test.ts
git commit -m "feat: outcomes parser (yes/no/mixed, zh + en)"
```

---

## Task 8: LLM layer

**Files:**
- Create: `src/llm.ts`

No unit test (mocks the API); tested end-to-end via terminal provider.

- [ ] **Step 1: Write src/llm.ts**

```typescript
// src/llm.ts
import Anthropic from "@anthropic-ai/sdk";
import type { Lang, ReadingRow, UserRow } from "./db.ts";
import { config } from "./config.ts";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are 运 (yùn), an iMessage oracle. You do NOT generate hexagrams or palaces — they are computed deterministically from the timestamp of the user's message and handed to you. Your job is to interpret.

Rules:
- Respond in the user's language (en or zh). Match their register — casual iMessage, not formal.
- Answer in THREE short paragraphs, no more:
  1. What the cast literally says about their question. Anchor in the hexagram/palace name and the changing line (if one).
  2. How their 八字 modulates it. Day master, element balance, relevant pillar interactions. Be specific, not generic.
  3. One concrete action or watchpoint for the next 3–7 days. Commit.
- Never hedge into uselessness. No "it depends," no "consider possibly." Take a read. Say it.
- Never add disclaimers like "this is just for fun" or "for entertainment only." The whole point is taking the question seriously.
- If the question is obviously not a divination question (e.g. "what's 2+2"), reply briefly that you only read questions about intentions, decisions, and situations — then invite them to try again.
- Keep the reply under 180 words. No markdown headers. Plain text suitable for iMessage.`;

export interface InterpretInput {
  question: string;
  lang: Lang;
  kernel: unknown;
  user: UserRow;
  recent: ReadingRow[];
}

export interface LlmClient {
  interpret(input: InterpretInput): Promise<string>;
}

export function createLlm(): LlmClient {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey() });

  return {
    async interpret(input) {
      const { question, lang, kernel, user, recent } = input;
      const bazi = user.bazi_pillars ? JSON.parse(user.bazi_pillars) : null;
      const recentBlock = recent.length
        ? recent.slice(0, 3).map((r, i) => {
            const date = new Date(r.created_at).toISOString().slice(0, 10);
            return `  ${i + 1}. [${date}] "${r.question.slice(0, 80)}"`;
          }).join("\n")
        : "  (none)";

      const userPrompt = [
        `QUESTION: ${question}`,
        "",
        "CAST (deterministic kernel output):",
        JSON.stringify(kernel, null, 2),
        "",
        "USER 八字 CONTEXT:",
        bazi ? JSON.stringify(bazi, null, 2) : "  (not set — no hour pillar)",
        "",
        "PAST READINGS (last 3):",
        recentBlock,
        "",
        `Respond in ${lang === "zh" ? "中文" : "English"}. Be specific. Commit to a reading.`,
      ].join("\n");

      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = res.content.find((c) => c.type === "text");
      if (!block || block.type !== "text") throw new Error("Anthropic response missing text block");
      return block.text.trim();
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/llm.ts
git commit -m "feat: LLM wrapper, claude-sonnet-4-6, three-paragraph prompt"
```

---

## Task 9: Query pipeline

**Files:**
- Create: `src/query.ts`

- [ ] **Step 1: Write src/query.ts**

```typescript
// src/query.ts
import type { Db, Lang, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { castMeihua } from "./kernel/meihua.ts";
import { castLiuren } from "./kernel/liuren.ts";
import type { MeihuaResult } from "./kernel/meihua.ts";
import type { LiurenResult } from "./kernel/liuren.ts";
import { STRINGS } from "./lang.ts";

const LIUREN_TRIGGERS = ["小六壬", "六壬", "liuren", "xiaoliuren"];

export function detectMethod(text: string): "meihua" | "liuren" {
  const lower = text.toLowerCase();
  return LIUREN_TRIGGERS.some((k) => lower.includes(k.toLowerCase())) ? "liuren" : "meihua";
}

function formatMeihuaHeader(r: MeihuaResult): string {
  const m = r.math;
  return [
    `🎴 梅花易数 · ${new Date(r.cast_at_iso).toLocaleString()}`,
    `lunar: ${r.lunar.year_gz}年 月${r.lunar.month} 日${r.lunar.day} ${r.lunar.hour_zhi}时`,
    `upper: (${m.year_zhi_num}+${m.lunar_month}+${m.lunar_day}) mod 8 = ${m.upper_mod} → ${m.upper_trigram}`,
    `lower: (+${m.hour_zhi_num}) mod 8 = ${m.lower_mod} → ${m.lower_trigram}`,
    `line:  ${m.changing_sum} mod 6 = ${m.changing_line} → line ${m.changing_line} changing`,
    `→ ${r.primary.name_zh} (${r.primary.num}), changing to ${r.changed.name_zh} (${r.changed.num})`,
  ].join("\n");
}

function formatLiurenHeader(r: LiurenResult): string {
  return [
    `🀄 小六壬 · ${new Date(r.cast_at_iso).toLocaleString()}`,
    `lunar: 月${r.lunar.month} 日${r.lunar.day} ${r.lunar.hour_zhi}时`,
    `月 → ${r.month_palace.name}`,
    `日 → ${r.day_palace.name}`,
    `时 → ${r.hour_palace.name}`,
  ].join("\n");
}

export interface QueryDeps {
  db: Db;
  llm: LlmClient;
  followUpMs: number;  // milliseconds until follow-up
}

export async function runQuery(
  phone: string,
  text: string,
  user: UserRow,
  receivedAt: Date,
  deps: QueryDeps,
): Promise<{ reply: string; castJson: string; method: "meihua" | "liuren"; kernel: unknown }> {
  const { db, llm, followUpMs } = deps;
  const method = detectMethod(text);
  const kernel = method === "liuren" ? castLiuren(receivedAt) : castMeihua(receivedAt);
  const lang: Lang = user.lang;

  const recent = await db.getRecentReadings(phone, 3);
  const interpretation = await llm.interpret({ question: text, lang, kernel, user, recent });

  const header = method === "liuren"
    ? formatLiurenHeader(kernel as LiurenResult)
    : formatMeihuaHeader(kernel as MeihuaResult);

  const now = receivedAt.getTime();
  await db.recordReading({
    phone,
    question: text,
    method,
    cast_json: JSON.stringify(kernel),
    interpretation,
    lang,
    created_at: now,
    follow_up_at: now + followUpMs,
  });

  await db.incrementReadingsToday(phone, now);

  const reply = `${header}\n\n${interpretation}\n\n${STRINGS.followUpNote[lang]}`;
  return { reply, castJson: JSON.stringify(kernel), method, kernel };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/query.ts
git commit -m "feat: query pipeline — kernel dispatch, LLM interpret, DB store"
```

---

## Task 10: Onboarding FSM

**Files:**
- Create: `src/onboarding.ts`
- Create: `tests/onboarding.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/onboarding.test.ts
import { describe, test, expect } from "bun:test";
import { parseDate, parseTime, buildBirthIso } from "../src/onboarding.ts";

describe("parseDate", () => {
  test("parses ISO date", () => {
    const r = parseDate("2002-10-22");
    expect(r?.year).toBe(2002);
    expect(r?.month).toBe(10);
    expect(r?.day).toBe(22);
  });

  test("parses 'October 22, 2002'", () => {
    const r = parseDate("October 22, 2002");
    expect(r?.year).toBe(2002);
    expect(r?.month).toBe(10);
    expect(r?.day).toBe(22);
  });

  test("returns null for garbage", () => {
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("parseTime", () => {
  test("parses 18:00", () => {
    const r = parseTime("18:00");
    expect(r?.hour).toBe(18);
    expect(r?.minute).toBe(0);
  });

  test("parses 6:30 PM", () => {
    const r = parseTime("6:30 PM");
    expect(r?.hour).toBe(18);
    expect(r?.minute).toBe(30);
  });

  test("parses skip token", () => {
    expect(parseTime("skip")).toBeNull();
    expect(parseTime("不知道")).toBeNull();
  });
});

describe("buildBirthIso", () => {
  test("builds ISO string from parts", () => {
    const iso = buildBirthIso({ year: 2002, month: 10, day: 22 }, { hour: 18, minute: 0 }, "+08:00");
    expect(iso).toBe("2002-10-22T18:00:00+08:00");
  });

  test("defaults to midnight when time is null", () => {
    const iso = buildBirthIso({ year: 2002, month: 10, day: 22 }, null, "+08:00");
    expect(iso).toBe("2002-10-22T00:00:00+08:00");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/onboarding.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/onboarding.ts**

```typescript
// src/onboarding.ts
import type { Db, OnboardingState, UserRow } from "./db.ts";
import type { Lang } from "./lang.ts";
import { STRINGS, resolveTimezone } from "./lang.ts";
import { encryptToJson } from "./crypto.ts";
import { computeBazi } from "./kernel/bazi.ts";

export interface DateParts { year: number; month: number; day: number }
export interface TimeParts { hour: number; minute: number }

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseDate(text: string): DateParts | null {
  const t = text.trim();
  // ISO: 2002-10-22
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return { year: +iso[1]!, month: +iso[2]!, day: +iso[3]! };
  // "October 22, 2002" or "22 October 2002"
  const words = t.match(/([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (words) {
    const m = MONTH_NAMES[words[1]!.toLowerCase()];
    if (m) return { year: +words[3]!, month: m, day: +words[2]! };
  }
  const words2 = t.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (words2) {
    const m = MONTH_NAMES[words2[2]!.toLowerCase()];
    if (m) return { year: +words2[3]!, month: m, day: +words2[1]! };
  }
  // Chinese: 2002年10月22日
  const zh = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (zh) return { year: +zh[1]!, month: +zh[2]!, day: +zh[3]! };
  // MM/DD/YYYY or DD/MM/YYYY — assume US (MM/DD)
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash && +slash[3]! > 1900) return { year: +slash[3]!, month: +slash[1]!, day: +slash[2]! };
  return null;
}

const SKIP_TOKENS = ["skip", "不知道", "跳过", "pass", "idk"];

export function parseTime(text: string): TimeParts | null {
  const t = text.trim().toLowerCase();
  if (SKIP_TOKENS.includes(t)) return null;  // intentional skip

  // 18:00 or 8:30
  const hhmm = t.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (hhmm) {
    let h = +hhmm[1]!;
    const min = +hhmm[2]!;
    const period = hhmm[3]?.toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return { hour: h, minute: min };
  }
  // "6 PM", "6PM"
  const hpm = t.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (hpm) {
    let h = +hpm[1]!;
    const period = hpm[2]!.toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return { hour: h, minute: 0 };
  }
  return null;   // unparseable — caller must re-prompt
}

export function isSkipToken(text: string): boolean {
  return SKIP_TOKENS.includes(text.trim().toLowerCase());
}

export function buildBirthIso(date: DateParts, time: TimeParts | null, tz: string): string {
  const h = time?.hour ?? 0;
  const min = time?.minute ?? 0;
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  const hh = String(h).padStart(2, "0");
  const mi = String(min).padStart(2, "0");
  return `${date.year}-${mm}-${dd}T${hh}:${mi}:00${tz}`;
}

// ── State machine handlers ────────────────────────────────────────────────────

interface OnboardingResult {
  reply: string;
  nextState: OnboardingState;
}

const PENDING_TIMES = new Map<string, DateParts>();   // phone → parsed date, held between states

export async function handleOnboarding(
  user: UserRow,
  text: string,
  db: Db,
): Promise<string> {
  const lang: Lang = user.lang;

  switch (user.onboarding_state) {
    case "pending_date": {
      const date = parseDate(text);
      if (!date) return STRINGS.invalidDate[lang];
      PENDING_TIMES.set(user.phone + ":date", date as unknown as DateParts);
      await db.setOnboardingState(user.phone, "pending_time");
      return STRINGS.askTime[lang];
    }

    case "pending_time": {
      const rawDate = PENDING_TIMES.get(user.phone + ":date");
      if (!rawDate) {
        await db.setOnboardingState(user.phone, "pending_date");
        return STRINGS.welcome[lang];
      }
      if (isSkipToken(text)) {
        PENDING_TIMES.set(user.phone + ":time", null as unknown as DateParts);
        await db.setOnboardingState(user.phone, "pending_location", { has_hour_pillar: 0 });
        return STRINGS.askLocation[lang];
      }
      const time = parseTime(text);
      if (!isSkipToken(text) && time === null) return STRINGS.invalidTime[lang];
      PENDING_TIMES.set(user.phone + ":time", time as unknown as DateParts);
      await db.setOnboardingState(user.phone, "pending_location");
      return STRINGS.askLocation[lang];
    }

    case "pending_location": {
      const rawDate = PENDING_TIMES.get(user.phone + ":date") as DateParts | undefined;
      const rawTime = PENDING_TIMES.get(user.phone + ":time") as TimeParts | null | undefined;

      if (!rawDate) {
        await db.setOnboardingState(user.phone, "pending_date");
        return STRINGS.welcome[lang];
      }

      // Try to resolve timezone from location text
      const tzMatch = resolveTimezone(text);

      // Check if text looks like a raw offset e.g. "+08:00"
      const offsetMatch = text.trim().match(/^[+-]\d{2}:\d{2}$/);

      const tz = tzMatch ?? (offsetMatch ? text.trim() : null);

      if (!tz) return STRINGS.askTimezone[lang];

      const birthIso = buildBirthIso(rawDate, rawTime ?? null, tz);
      const encrypted = encryptToJson(birthIso);
      const bazi = computeBazi(birthIso);

      await db.setOnboardingState(user.phone, "complete", {
        birth_iso_encrypted: encrypted,
        birth_tz: tz,
        has_hour_pillar: (rawTime !== null && rawTime !== undefined) ? 1 : 0,
        bazi_pillars: JSON.stringify(bazi),
      });

      // Clean up in-memory state
      PENDING_TIMES.delete(user.phone + ":date");
      PENDING_TIMES.delete(user.phone + ":time");

      return STRINGS.onboardingComplete[lang];
    }

    default:
      return "hmm — unexpected state. try /setup to restart.";
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun test tests/onboarding.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/onboarding.ts tests/onboarding.test.ts
git commit -m "feat: onboarding FSM — date/time/location parsing, birth encryption"
```

---

## Task 11: Commands

**Files:**
- Create: `src/commands.ts`

- [ ] **Step 1: Write src/commands.ts**

```typescript
// src/commands.ts
import type { Db, UserRow } from "./db.ts";
import type { Lang } from "./lang.ts";
import { STRINGS } from "./lang.ts";

export interface CommandResult {
  reply: string;
  sideEffect?: "set_delete_pending";
}

export async function handleCommand(
  text: string,
  user: UserRow,
  db: Db,
): Promise<CommandResult> {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1);
  const lang: Lang = user.lang;

  switch (cmd) {
    case "/help":
      return { reply: help(lang) };

    case "/history":
      return { reply: await history(user, db) };

    case "/stats":
      return { reply: await stats(user, db) };

    case "/methods":
      return { reply: methods(lang) };

    case "/lang": {
      const arg = args[0]?.toLowerCase();
      if (arg !== "en" && arg !== "zh") {
        return { reply: lang === "zh" ? "用法：/lang en 或 /lang zh" : "usage: /lang en | /lang zh" };
      }
      await db.setUserLang(user.phone, arg);
      return { reply: arg === "zh" ? "已切换为中文。" : "switched to English." };
    }

    case "/setup":
      await db.setOnboardingState(user.phone, "pending_date");
      return { reply: STRINGS.welcome[lang] };

    case "/delete":
      await db.setDeletePending(user.phone, 1);
      return { reply: STRINGS.deletePrompt[lang] };

    default:
      return { reply: lang === "zh" ? "不认识这个命令。试试 /help。" : "unknown command. try /help." };
  }
}

function help(lang: Lang): string {
  if (lang === "zh") {
    return [
      "运 — 命令一览",
      "/help        这条帮助",
      "/history     最近 5 次卦",
      "/stats       总次数 + 应验率",
      "/methods     三种方法简介",
      "/lang en|zh  切换语言",
      "/setup       重新录入八字",
      "/delete      删除所有数据",
      "",
      "直接发问题即可。含「小六壬 / liuren」切到小六壬。",
    ].join("\n");
  }
  return [
    "运 — commands",
    "/help        this message",
    "/history     last 5 readings",
    "/stats       total count + hit rate",
    "/methods     short intro to each method",
    "/lang en|zh  switch language",
    "/setup       re-enter your 八字",
    "/delete      delete all your data",
    "",
    "just text a question. include '小六壬' or 'liuren' for 小六壬 method.",
  ].join("\n");
}

async function history(user: UserRow, db: Db): Promise<string> {
  const recent = await db.getRecentReadings(user.phone, 5);
  if (recent.length === 0) {
    return user.lang === "zh" ? "还没有卦。问一个吧。" : "no readings yet. ask one.";
  }
  return recent.map((r, i) => {
    const date = new Date(r.created_at).toISOString().slice(0, 10);
    const q = r.question.length > 48 ? r.question.slice(0, 45) + "…" : r.question;
    return `${i + 1}. [${date}] ${r.method} · "${q}"`;
  }).join("\n");
}

async function stats(user: UserRow, db: Db): Promise<string> {
  const s = await db.getStats(user.phone);
  const zh = user.lang === "zh";
  if (s.total === 0) return zh ? "还没有卦。问一个吧。" : "no readings yet. ask one.";
  const decided = s.yes + s.no;
  const hitRate = decided > 0 ? Math.round((s.yes / decided) * 100) : null;
  const hitLine = hitRate === null
    ? zh ? "应验率：还没有明确结果" : "hit rate: no decided outcomes yet"
    : zh ? `应验率：${hitRate}% （准 ${s.yes} / 不准 ${s.no} / 一半 ${s.mixed}）`
          : `hit rate: ${hitRate}% (yes ${s.yes} / no ${s.no} / mixed ${s.mixed})`;
  return zh
    ? [`总卦数：${s.total}`, `有结果：${s.with_outcome} / ${s.total}`, hitLine].join("\n")
    : [`total readings: ${s.total}`, `with outcome: ${s.with_outcome} / ${s.total}`, hitLine].join("\n");
}

function methods(lang: Lang): string {
  if (lang === "zh") {
    return [
      "三法简介：",
      "• 梅花易数（默认）：根据发问时刻的阴历年月日时推卦。",
      "• 小六壬：月、日、时三宫推演。含「小六壬」或「liuren」切换。",
      "• 八字：入门时算一次，作为所有卦的解读背景。",
    ].join("\n");
  }
  return [
    "methods:",
    "• 梅花易数 (default): hexagram from lunar timestamp of your message.",
    "• 小六壬: three-palace cast. Include '小六壬' or 'liuren' to switch.",
    "• 八字: four pillars computed from birth data — context for every reading.",
  ].join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands.ts
git commit -m "feat: command handler — /help /history /stats /methods /lang /setup /delete"
```

---

## Task 12: Router

**Files:**
- Create: `src/router.ts`

- [ ] **Step 1: Write src/router.ts**

```typescript
// src/router.ts
import type { Db, UserRow } from "./db.ts";
import type { LlmClient } from "./llm.ts";
import { detectLang, STRINGS } from "./lang.ts";
import { handleOnboarding } from "./onboarding.ts";
import { handleCommand } from "./commands.ts";
import { parseOutcome, looksLikeOutcome, isShareRequest } from "./outcomes.ts";
import { runQuery } from "./query.ts";
import { renderCastCard } from "./card/render.ts";
import { sendText, sendCard, sendShareInvite } from "./spectrum/send.ts";
import { config } from "./config.ts";

const OUTCOME_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface RouterDeps {
  db: Db;
  llm: LlmClient;
}

export async function route(
  phone: string,
  text: string,
  receivedAt: Date,
  deps: RouterDeps,
): Promise<void> {
  const { db } = deps;
  const now = receivedAt.getTime();
  const trimmed = text.trim();

  // Ensure user exists
  let user = await db.getUser(phone);
  if (!user) {
    const lang = detectLang(trimmed);
    await db.upsertUser({
      phone,
      lang,
      onboarding_state: "pending_date",
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    user = (await db.getUser(phone))!;
    await sendText(phone, STRINGS.welcome[lang]);
    return;
  }

  await db.touchLastSeen(phone, now);

  // Delete confirmation gate
  if (user.delete_pending) {
    if (trimmed.toLowerCase() === "confirm delete") {
      await db.deleteUser(phone);
      await sendText(phone, STRINGS.deleteConfirmed[user.lang]);
    } else {
      await db.setDeletePending(phone, 0);
      await sendText(phone, STRINGS.deleteCancelled[user.lang]);
    }
    return;
  }

  // Commands
  if (trimmed.startsWith("/")) {
    const result = await handleCommand(trimmed, user, db);
    await sendText(phone, result.reply);
    return;
  }

  // Onboarding FSM
  if (user.onboarding_state !== "complete") {
    const reply = await handleOnboarding(user, trimmed, db);
    await sendText(phone, reply);
    return;
  }

  // Share request
  if (isShareRequest(trimmed)) {
    const yesOutcome = await db.getMostRecentYesOutcome(phone);
    if (yesOutcome) {
      const readings = await db.getRecentReadings(phone, 1);
      const reading = readings[0];
      if (reading) {
        const cast = JSON.parse(reading.cast_json);
        const png = await renderCastCard({
          question: yesOutcome.question,
          cast,
          interpretation: reading.interpretation,
          lang: user.lang,
          timestamp: new Date(reading.created_at),
          mode: "outcome",
        });
        await sendCard(phone, "🎯 called it.", png);
        await db.markShared(yesOutcome.reading_id);
      }
    }
    return;
  }

  // Outcome reply
  if (looksLikeOutcome(trimmed)) {
    const pending = await db.getMostRecentPendingOutcome(phone, OUTCOME_WINDOW_MS);
    if (pending) {
      const parsed = parseOutcome(trimmed);
      if (parsed) {
        await db.recordOutcome({
          reading_id: pending.id,
          outcome: parsed.outcome,
          user_note: parsed.note,
          responded_at: now,
          shared: 0,
        });
        const ack = outcomeAck(parsed.outcome, user.lang);
        await sendText(phone, ack);
        if (parsed.outcome === "yes") {
          await sendShareInvite(phone, user.lang);
        }
        return;
      }
    }
  }

  // Rate limit
  const refreshed = await db.getUser(phone);
  const daily = config.rateLimitPerDay();
  if (refreshed && refreshed.readings_today >= daily) {
    await sendText(phone, STRINGS.rateLimited[user.lang]);
    return;
  }

  // Query pipeline
  const followUpDays = config.demoFollowUpSeconds() !== undefined
    ? 0  // will be overridden to seconds below
    : config.followUpDays();
  const followUpMs = config.demoFollowUpSeconds() !== undefined
    ? config.demoFollowUpSeconds()! * 1000
    : followUpDays * 24 * 60 * 60 * 1000;

  const result = await runQuery(phone, trimmed, user, receivedAt, {
    db: deps.db,
    llm: deps.llm,
    followUpMs,
  });

  const cast = result.kernel;
  const png = await renderCastCard({
    question: trimmed,
    cast,
    interpretation: result.reply,
    lang: user.lang,
    timestamp: receivedAt,
    mode: "cast",
  });

  await sendCard(phone, result.reply, png);
}

function outcomeAck(outcome: "yes" | "no" | "mixed", lang: "en" | "zh"): string {
  if (lang === "zh") {
    if (outcome === "yes") return "好，记下来了：这次准了 ✅";
    if (outcome === "no") return "好，记下来了：这次没准 ❌";
    return "好，记下来了：一半一半 ⚖️";
  }
  if (outcome === "yes") return "logged: it played out ✅";
  if (outcome === "no") return "logged: it didn't ❌";
  return "logged: mixed ⚖️";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/router.ts
git commit -m "feat: router — delete gate, onboarding, outcome, share, query dispatch"
```

---

## Task 13: Scheduler

**Files:**
- Create: `src/scheduler.ts`
- Create: `tests/scheduler.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/scheduler.test.ts
import { describe, test, expect, mock } from "bun:test";
import { buildFollowUpText } from "../src/scheduler.ts";

describe("buildFollowUpText", () => {
  test("en follow-up message", () => {
    const msg = buildFollowUpText("will I get the job?", "en", 5);
    expect(msg).toContain("5 days ago");
    expect(msg).toContain("will I get the job?");
    expect(msg).toContain("yes / no / mixed");
  });

  test("zh follow-up message", () => {
    const msg = buildFollowUpText("我能找到工作吗", "zh", 5);
    expect(msg).toContain("5 天前");
    expect(msg).toContain("我能找到工作吗");
  });

  test("truncates long questions", () => {
    const long = "a".repeat(100);
    const msg = buildFollowUpText(long, "en", 5);
    expect(msg.length).toBeLessThan(300);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/scheduler.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write src/scheduler.ts**

```typescript
// src/scheduler.ts
import type { Db } from "./db.ts";
import type { Lang } from "./lang.ts";
import { sendFollowUp } from "./spectrum/send.ts";

export function buildFollowUpText(question: string, lang: Lang, days: number): string {
  const q = question.length > 80 ? question.slice(0, 77) + "…" : question;
  return lang === "zh"
    ? `${days} 天前你问：「${q}」——后来怎么样？回 yes / no / mixed（可加一句备注）。`
    : `${days} days ago you asked: "${q}" — how did it play out? reply: yes / no / mixed (feel free to add a note).`;
}

export interface SchedulerOptions {
  db: Db;
  intervalMs: number;
  followUpDays: number;
}

export interface Scheduler {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
}

export function createScheduler(opts: SchedulerOptions): Scheduler {
  const { db, intervalMs, followUpDays } = opts;
  let handle: ReturnType<typeof setInterval> | null = null;

  const tick = async (): Promise<void> => {
    const now = Date.now();
    const pending = await db.getPendingFollowUps(now);
    for (const reading of pending) {
      const user = await db.getUser(reading.phone);
      const lang: Lang = user?.lang ?? reading.lang;
      try {
        await sendFollowUp(reading.phone, reading.question, lang, followUpDays);
        await db.markFollowedUp(reading.id);
      } catch (err) {
        console.error(`[scheduler] failed DM for reading ${reading.id}:`, err);
      }
    }
  };

  return {
    tick,
    start() {
      if (handle) return;
      handle = setInterval(() => void tick().catch((e) => console.error("[scheduler] tick error:", e)), intervalMs);
    },
    stop() {
      if (handle) { clearInterval(handle); handle = null; }
    },
  };
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
bun test tests/scheduler.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.ts tests/scheduler.test.ts
git commit -m "feat: scheduler with demo-mode-aware follow-up loop"
```

---

## Task 14: Card fonts

**Files:**
- Create: `src/card/fonts/` (directory with 3 TTF files)
- Create: `src/card/fonts.ts`

- [ ] **Step 1: Download font files**

```bash
mkdir -p src/card/fonts

# Inter 400 (Latin)
curl -L "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" \
  -o src/card/fonts/inter-400.woff2

# Noto Sans SC 400 (Chinese)
curl -L "https://fonts.gstatic.com/s/notosanssc/v37/k3kCo84MPvpLmixcA63oeALhLOCT-xWNm8Hqd37g1OkDRZe7lR4sg1IzSy-MNbE9VgA.0.woff2" \
  -o src/card/fonts/noto-sans-sc-400.woff2

# JetBrains Mono 400 (mono for kernel block)
curl -L "https://fonts.gstatic.com/s/jetbrainsmono/v20/tDbY2o-flEEny0FZhsfKu5WU4xD-IQ-PuZJJXxfpAO-Lf1OEQQ.woff2" \
  -o src/card/fonts/jetbrains-mono-400.woff2
```

Verify sizes are reasonable (> 1KB):
```bash
ls -lh src/card/fonts/
```

Expected: 3 woff2 files, each > 10KB.

- [ ] **Step 2: Write src/card/fonts.ts**

```typescript
// src/card/fonts.ts
import { join } from "node:path";

const FONTS_DIR = join(import.meta.dir, "fonts");

export interface FontData {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
}

async function loadFont(filename: string): Promise<ArrayBuffer> {
  return Bun.file(join(FONTS_DIR, filename)).arrayBuffer();
}

let _fonts: FontData[] | null = null;

export async function loadFonts(): Promise<FontData[]> {
  if (_fonts) return _fonts;
  const [inter, noto, mono] = await Promise.all([
    loadFont("inter-400.woff2"),
    loadFont("noto-sans-sc-400.woff2"),
    loadFont("jetbrains-mono-400.woff2"),
  ]);
  _fonts = [
    { name: "Inter", data: inter, weight: 400, style: "normal" },
    { name: "Noto Sans SC", data: noto, weight: 400, style: "normal" },
    { name: "JetBrains Mono", data: mono, weight: 400, style: "normal" },
  ];
  return _fonts;
}
```

- [ ] **Step 3: Add fonts directory to .gitignore exception** (fonts are binary, commit them)

Edit `.gitignore` — ensure `src/card/fonts/` is NOT ignored (it's not matched by current rules, so nothing to change).

- [ ] **Step 4: Commit**

```bash
git add src/card/fonts/ src/card/fonts.ts
git commit -m "feat: card fonts — Inter, Noto Sans SC, JetBrains Mono"
```

---

## Task 15: Card template + render

**Files:**
- Create: `src/card/template.tsx`
- Create: `src/card/render.ts`
- Create: `tests/card.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/card.test.ts
import { describe, test, expect } from "bun:test";
import { renderCastCard } from "../src/card/render.ts";

const FAKE_CAST = {
  method: "meihua",
  primary: { name_zh: "恆", name_en: "Perseverance", num: 32 },
  changed: { name_zh: "豫", name_en: "Enthusiasm", num: 16 },
  changing_line: 3,
  math: {
    year_zhi_num: 7, lunar_month: 6, lunar_day: 10, hour_zhi_num: 4,
    upper_mod: 4, lower_mod: 8, changing_sum: 21,
    upper_trigram: "震", lower_trigram: "巽",
  },
  lunar: { year_gz: "甲辰", month: 6, day: 10, hour_zhi: "卯" },
  cast_at_iso: new Date().toISOString(),
};

describe("renderCastCard", () => {
  test("returns a PNG buffer for cast mode", async () => {
    const png = await renderCastCard({
      question: "Will I get the job?",
      cast: FAKE_CAST,
      interpretation: "The 恆 hexagram suggests steady persistence.",
      lang: "en",
      timestamp: new Date(),
      mode: "cast",
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png.length).toBeGreaterThan(1000);
    // PNG magic bytes: 89 50 4E 47
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4E);
    expect(png[3]).toBe(0x47);
  }, 15000);

  test("returns a PNG buffer for outcome mode", async () => {
    const png = await renderCastCard({
      question: "Will I get the job?",
      cast: FAKE_CAST,
      interpretation: "The 恆 hexagram suggests steady persistence.",
      lang: "en",
      timestamp: new Date(),
      mode: "outcome",
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png[0]).toBe(0x89);
  }, 15000);
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
bun test tests/card.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write src/card/template.tsx**

```tsx
// src/card/template.tsx
import React from "react";

export interface CardProps {
  question: string;
  hexagramNameZh: string;
  hexagramNameEn: string;
  hexagramNum: number;
  kernelBlock: string;       // the 4-line math block
  interpretationExcerpt: string;  // first 2 sentences
  timestamp: string;
  mode: "cast" | "outcome";
  lines?: number[];          // 6 booleans: true=yang, false=yin (for meihua)
  palaceName?: string;       // for liuren: show palace instead of hexagram
  changingLine?: number;     // 1-6
}

const CREAM = "#F5F0E8";
const INK = "#1A1A1A";
const ACCENT = "#8B6F47";
const MONO_BG = "#EFEFEA";

function HexagramLines({ lines, changingLine }: { lines: number[]; changingLine?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      {[...lines].reverse().map((yang, i) => {
        const lineNum = lines.length - i;
        const isChanging = changingLine === lineNum;
        return (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {yang === 1 ? (
              <div style={{
                width: 200, height: 16, background: isChanging ? ACCENT : INK, borderRadius: 2
              }} />
            ) : (
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ width: 88, height: 16, background: isChanging ? ACCENT : INK, borderRadius: 2 }} />
                <div style={{ width: 88, height: 16, background: isChanging ? ACCENT : INK, borderRadius: 2 }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CardTemplate(props: CardProps) {
  const {
    question, hexagramNameZh, hexagramNameEn, hexagramNum,
    kernelBlock, interpretationExcerpt, timestamp,
    mode, lines, palaceName, changingLine,
  } = props;

  const excerpt = interpretationExcerpt.length > 160
    ? interpretationExcerpt.slice(0, 157) + "…"
    : interpretationExcerpt;

  return (
    <div style={{
      width: 1080, height: 1350,
      background: CREAM,
      fontFamily: '"Noto Sans SC", Inter, sans-serif',
      display: "flex", flexDirection: "column",
      padding: "60px 72px",
      boxSizing: "border-box",
      color: INK,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
        <span style={{ fontSize: 28, fontWeight: 400, letterSpacing: 4, color: ACCENT }}>运</span>
        {mode === "outcome" && (
          <span style={{ fontSize: 22, color: ACCENT, letterSpacing: 1 }}>called it ✓</span>
        )}
      </div>

      {/* Question */}
      <div style={{
        fontSize: 28, color: INK, opacity: 0.6, marginBottom: 48,
        fontStyle: "italic", lineHeight: 1.4,
        maxWidth: 900,
        overflow: "hidden",
        display: "-webkit-box",
      }}>
        "{question.length > 80 ? question.slice(0, 77) + "…" : question}"
      </div>

      {/* Hero: hexagram or palace */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48, flex: 1 }}>
        {palaceName ? (
          <div style={{ fontSize: 140, lineHeight: 1, marginBottom: 32, color: INK }}>{palaceName}</div>
        ) : lines ? (
          <div style={{ marginBottom: 32 }}>
            <HexagramLines lines={lines} changingLine={changingLine} />
          </div>
        ) : null}

        <div style={{ fontSize: 72, fontWeight: 400, marginBottom: 8 }}>{hexagramNameZh}</div>
        <div style={{ fontSize: 26, color: ACCENT, letterSpacing: 2, marginBottom: 4 }}>
          {hexagramNameEn} · {hexagramNum}
        </div>
        {changingLine && (
          <div style={{ fontSize: 18, color: INK, opacity: 0.5, marginTop: 4 }}>
            line {changingLine} changing
          </div>
        )}
      </div>

      {/* Kernel math block */}
      <div style={{
        background: MONO_BG, borderRadius: 8, padding: "24px 28px", marginBottom: 36,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 18, lineHeight: 1.6, color: INK, opacity: 0.8,
        whiteSpace: "pre-wrap",
      }}>
        {kernelBlock}
      </div>

      {/* Interpretation excerpt */}
      <div style={{
        fontSize: 24, lineHeight: 1.6, color: INK, opacity: 0.85,
        marginBottom: 40, flex: 1,
      }}>
        {excerpt}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        opacity: 0.4, fontSize: 16,
      }}>
        <span>{timestamp}</span>
        <span>yun.app</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write src/card/render.ts**

```typescript
// src/card/render.ts
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import React from "react";
import { CardTemplate, type CardProps } from "./template.tsx";
import { loadFonts } from "./fonts.ts";

export interface RenderInput {
  question: string;
  cast: unknown;
  interpretation: string;
  lang: "en" | "zh";
  timestamp: Date;
  mode: "cast" | "outcome";
}

function extractCardProps(input: RenderInput): CardProps {
  const { question, cast, interpretation, lang, timestamp, mode } = input;
  const c = cast as Record<string, unknown>;
  const ts = timestamp.toISOString().slice(0, 16).replace("T", " ");
  const excerpt = interpretation.split(/[.。!！]/)[0] ?? interpretation;

  if (c.method === "liuren") {
    const month = (c.month_palace as { name: string }).name;
    const day = (c.day_palace as { name: string }).name;
    const hour = (c.hour_palace as { name: string }).name;
    return {
      question, lang, mode,
      hexagramNameZh: `${month}/${day}/${hour}`,
      hexagramNameEn: "小六壬",
      hexagramNum: 0,
      kernelBlock: [
        `月 → ${month}`,
        `日 → ${day}`,
        `时 → ${hour}`,
      ].join("\n"),
      interpretationExcerpt: excerpt,
      timestamp: ts,
      palaceName: month,
    };
  }

  // meihua
  const primary = c.primary as { name_zh: string; name_en: string; num: number; binary?: number[] };
  const changed = c.changed as { name_zh: string; name_en: string; num: number };
  const math = c.math as Record<string, number>;
  const lunar = c.lunar as Record<string, string | number>;

  const kernelBlock = [
    `lunar: ${lunar.year_gz}年 月${lunar.month} 日${lunar.day} ${lunar.hour_zhi}时`,
    `upper: (${math.year_zhi_num}+${math.lunar_month}+${math.lunar_day}) mod 8 = ${math.upper_mod} → ${math.upper_trigram}`,
    `lower: (+${math.hour_zhi_num}) mod 8 = ${math.lower_mod} → ${math.lower_trigram}`,
    `→ ${primary.name_zh} → ${changed.name_zh}`,
  ].join("\n");

  return {
    question, lang, mode,
    hexagramNameZh: primary.name_zh,
    hexagramNameEn: primary.name_en,
    hexagramNum: primary.num,
    kernelBlock,
    interpretationExcerpt: excerpt,
    timestamp: ts,
    lines: primary.binary,
    changingLine: math.changing_line as unknown as number,
  };
}

export async function renderCastCard(input: RenderInput): Promise<Buffer> {
  const fonts = await loadFonts();
  const props = extractCardProps(input);

  const svg = await satori(
    React.createElement(CardTemplate, props),
    {
      width: 1080,
      height: 1350,
      fonts: fonts.map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight,
        style: f.style,
      })),
    },
  );

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
```

- [ ] **Step 5: Run test — expect pass**

```bash
bun test tests/card.test.ts
```

Expected: 2 tests pass (may take 5–10 seconds for font loading).

- [ ] **Step 6: Commit**

```bash
git add src/card/
git commit -m "feat: Satori card rendering — cast and outcome modes, 1080×1350 PNG"
```

---

## Task 16: Main entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write src/index.ts**

```typescript
// src/index.ts
import { openDb } from "./db.ts";
import { createLlm } from "./llm.ts";
import { initSpectrum } from "./spectrum/app.ts";
import { route } from "./router.ts";
import { createScheduler } from "./scheduler.ts";
import { config } from "./config.ts";

async function main(): Promise<void> {
  // Fail-fast on missing env
  const dbUrl = config.tursoUrl();
  const dbToken = config.tursoToken();
  const followUpDays = config.followUpDays();
  const demoSecs = config.demoFollowUpSeconds();
  const schedulerMs = config.schedulerIntervalSeconds() * 1000;

  const db = await openDb(dbUrl, dbToken);
  const llm = createLlm();
  const app = await initSpectrum();

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "INFO",
    msg: "运 online",
    demo_follow_up_seconds: demoSecs ?? null,
    scheduler_interval_ms: schedulerMs,
  }));

  // Scheduler
  const scheduler = createScheduler({
    db,
    intervalMs: schedulerMs,
    followUpDays,
  });
  scheduler.start();

  // Message loop
  for await (const [space, message] of app.messages) {
    const phone = (space as unknown as { phone: string }).phone;
    if (!phone) continue;

    // Only handle DMs
    const spaceType = (space as unknown as { type?: string }).type;
    if (spaceType && spaceType !== "dm") continue;

    const text = message.content.type === "text" ? message.content.text : "";
    if (!text.trim()) continue;

    await space.responding(async () => {
      try {
        await route(phone, text, new Date(message.timestamp), { db, llm });
      } catch (err) {
        console.error(JSON.stringify({ ts: new Date().toISOString(), level: "ERROR", phone: phone.slice(-4), err: String(err) }));
      }
    });
  }

  // Graceful shutdown
  const shutdown = async (sig: string): Promise<void> => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "INFO", msg: `${sig} received` }));
    scheduler.stop();
    await db.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run all tests**

```bash
bun test
```

Expected: all tests pass, 0 failures.

- [ ] **Step 4: Smoke test with terminal provider**

Copy `.env.example` to `.env` and fill in credentials. Then:

```bash
bun run dev
```

Expected: "运 online" logged. Type a message in the terminal prompt. Verify you get an onboarding response.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: main entry — Spectrum loop, scheduler, graceful shutdown"
```

---

## Task 17: Fly.io deployment

**Files:**
- Create: `Dockerfile`
- Create: `fly.toml`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM oven/bun:1.2 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production
COPY . .

FROM oven/bun:1.2-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]
```

- [ ] **Step 2: Write fly.toml**

```toml
app = "yun-hosted"
primary_region = "sea"

[build]

[env]
  NODE_ENV = "production"

[http_service]
  # No public HTTP — Spectrum connects outbound via gRPC
  # Fly needs at least one port; bind to internal only
  internal_port = 8080
  force_https = false
  auto_stop_machines = false
  auto_start_machines = true

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

- [ ] **Step 3: Create Fly app**

```bash
flyctl launch --no-deploy --name yun-hosted --region sea
```

- [ ] **Step 4: Set secrets**

```bash
flyctl secrets set \
  ANTHROPIC_API_KEY="..." \
  PROJECT_ID="..." \
  PROJECT_SECRET="..." \
  TURSO_DATABASE_URL="..." \
  TURSO_AUTH_TOKEN="..." \
  BIRTH_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

- [ ] **Step 5: Deploy**

```bash
flyctl deploy
```

Expected: build succeeds, machine starts, logs show "运 online".

- [ ] **Step 6: Tail logs and send a test message**

```bash
flyctl logs
```

Send a message from your phone to the Spectrum iMessage line. Verify onboarding prompt arrives.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile fly.toml
git commit -m "chore: Fly.io deploy config"
```

---

## Spec Self-Review

### 1. Spec coverage check

| Spec requirement | Task |
|---|---|
| Turso DB, three tables + indexes | Task 3 |
| AES-256-GCM birth time encryption | Task 4 |
| Lang auto-detect + /lang override | Task 5, 12 |
| Spectrum imessage + terminal providers | Task 6 |
| Multi-tenant identity by phone | Task 3, 12 |
| Onboarding 4-state FSM | Task 10 |
| /help /history /stats /methods /lang /setup | Task 11 |
| /delete with confirm-delete gate | Task 11, 12 |
| Outcome parser (yes/no/mixed, zh+en) | Task 7 |
| Query pipeline: kernel → LLM → store | Task 9 |
| claude-sonnet-4-6, temperature unchanged | Task 8 |
| Follow-up scheduler | Task 13 |
| DEMO_FOLLOW_UP_SECONDS toggle | Task 13, 16 |
| Satori card PNG, 1080×1350 | Task 15 |
| Cast card attached to every reading | Task 12 |
| "Called it" share prompt on yes | Task 12 |
| share / 分享 → outcome card | Task 12 |
| Rate limit 10/day | Task 3 (incrementReadingsToday), 12 |
| Phone logged as truncated hash | Task 16 (phone.slice(-4)) |
| Never log birth times | Task 3 (encrypted blob only), 16 |
| Kernel preserved unchanged (78 tests) | Task 1 |
| Fly.io deployment | Task 17 |

### 2. Placeholder scan

No TBD, TODO, or "implement later" phrases found.

### 3. Type consistency

- `UserRow.lang: Lang` → used as `user.lang` throughout ✓
- `ReadingRow.id: string` (ULID) → `recordOutcome.reading_id: string` ✓
- `renderCastCard(input: RenderInput)` → called in router with matching shape ✓
- `sendCard(phone, text, png)` → called with `Buffer` from `renderCastCard` ✓
- `parseOutcome` returns `ParsedOutcome | null` → router checks null ✓
- `PENDING_TIMES` map in onboarding.ts uses `phone + ":date"` / `phone + ":time"` keys consistently ✓

---

Plan complete and saved to `docs/superpowers/plans/2026-05-20-yun-hosted.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast parallel iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
