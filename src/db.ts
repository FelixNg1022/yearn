import { createClient, type Client, type InValue, type Row } from "@libsql/client";
import { ulid } from "ulidx";

// NOTE: `Lang` is also exported from `src/lang.ts` (Task 5) as a structural duplicate
// of the same string literal union. Keep them in sync.
export type Lang = "en" | "zh";
export type OnboardingState = "pending_name" | "pending_date" | "pending_time" | "pending_location" | "complete";
export type Method = "meihua" | "liuren";

import { type LuckyStone } from "./card/stones.ts";

export type { LuckyStone };

export interface ProfileCardData {
  luckyNumber: number;
  luckyColor: string;
  luckyStone: LuckyStone;
  millionaireChance: number;
  meetLoveAge: number;
  projection: string;
  /** Present when stats were LLM-generated; used to avoid re-rolling on /profile. */
  statsVersion?: number;
}

export interface UserRow {
  phone: string;
  lang: Lang;
  onboarding_state: OnboardingState;
  name: string | null;
  birth_iso_encrypted: string | null;
  birth_tz: string | null;
  has_hour_pillar: 0 | 1;
  bazi_pillars: string | null;
  pending_date_json: string | null;
  pending_time_json: string | null;
  created_at: number;
  last_seen_at: number;
  readings_today: number;
  readings_today_reset_at: number;
  delete_pending: 0 | 1;
  profile_card_json: string | null;   // JSON-encoded ProfileCardData
  next_daily_at: number;              // epoch ms — next 8am local delivery
  daily_card_enabled: 0 | 1;
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
  predicted_horizon_days: number | null;
  question_type: "general" | "specific" | null;
  predicted_probability: number | null;
  // Joined from outcomes table — present when getRecentReadings is called
  outcome?: "yes" | "no" | "mixed" | null;
  user_note?: string | null;
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
  name?: string | null;
  birth_iso_encrypted?: string | null;
  birth_tz?: string | null;
  has_hour_pillar?: 0 | 1;
  bazi_pillars?: string | null;
  pending_date_json?: string | null;
  pending_time_json?: string | null;
  created_at: number;
  last_seen_at: number;
  readings_today: number;
  readings_today_reset_at: number;
  delete_pending?: 0 | 1;
}

export interface SetOnboardingStateExtra {
  name?: string | null;
  birth_iso_encrypted?: string | null;
  birth_tz?: string | null;
  has_hour_pillar?: 0 | 1;
  bazi_pillars?: string | null;
  // For pending_*_json: presence of the key controls behavior. If the key is
  // present, the column is set to its value (including null). If the key is
  // absent, the column is left untouched.
  pending_date_json?: string | null;
  pending_time_json?: string | null;
  // When true, both pending_*_json columns are forced to SQL NULL,
  // overriding any pending_*_json values also passed in `extra`.
  clear_pending?: boolean;
}

export interface Db {
  getUser(phone: string): Promise<UserRow | null>;
  saveProfileCardData(phone: string, data: ProfileCardData): Promise<void>;
  enableDailyCard(phone: string, nextAt: number): Promise<void>;
  getUsersDueForDailyCard(now: number): Promise<UserRow[]>;
  getCompleteUsersWithoutDailyCard(): Promise<UserRow[]>;
  setNextDailyAt(phone: string, nextAt: number): Promise<void>;
  upsertUser(u: UpsertUser): Promise<void>;
  touchLastSeen(phone: string, now: number): Promise<void>;
  setUserLang(phone: string, lang: Lang): Promise<void>;
  setOnboardingState(phone: string, state: OnboardingState, extra?: SetOnboardingStateExtra): Promise<void>;
  setUserName(phone: string, name: string): Promise<void>;
  setDeletePending(phone: string, pending: 0 | 1): Promise<void>;
  deleteUser(phone: string): Promise<void>;
  recordReading(r: Omit<ReadingRow, "id" | "followed_up"> & { followed_up?: 0 | 1 }): Promise<string>;
  getRecentReadings(phone: string, limit: number): Promise<ReadingRow[]>;
  getPendingFollowUps(now: number): Promise<ReadingRow[]>;
  markFollowedUp(readingId: string): Promise<void>;
  /** Most recent reading awaiting an outcome reply after follow-up was sent. */
  getMostRecentPendingOutcome(phone: string, responseWindowMs: number): Promise<ReadingRow | null>;
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
  onboarding_state TEXT NOT NULL DEFAULT 'pending_name',
  name TEXT,
  birth_iso_encrypted TEXT,
  birth_tz TEXT,
  has_hour_pillar INTEGER NOT NULL DEFAULT 1,
  bazi_pillars TEXT,
  pending_date_json TEXT,
  pending_time_json TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  readings_today INTEGER NOT NULL DEFAULT 0,
  readings_today_reset_at INTEGER NOT NULL,
  delete_pending INTEGER NOT NULL DEFAULT 0,
  profile_card_json TEXT,
  next_daily_at INTEGER NOT NULL DEFAULT 0,
  daily_card_enabled INTEGER NOT NULL DEFAULT 0
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
  followed_up INTEGER NOT NULL DEFAULT 0,
  predicted_horizon_days INTEGER,
  question_type TEXT,
  predicted_probability INTEGER
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
    name: row.name as string | null,
    birth_iso_encrypted: row.birth_iso_encrypted as string | null,
    birth_tz: row.birth_tz as string | null,
    has_hour_pillar: (row.has_hour_pillar as number) as 0 | 1,
    bazi_pillars: row.bazi_pillars as string | null,
    pending_date_json: row.pending_date_json as string | null,
    pending_time_json: row.pending_time_json as string | null,
    created_at: row.created_at as number,
    last_seen_at: row.last_seen_at as number,
    readings_today: row.readings_today as number,
    readings_today_reset_at: row.readings_today_reset_at as number,
    delete_pending: (row.delete_pending as number) as 0 | 1,
    profile_card_json: row.profile_card_json as string | null,
    next_daily_at: (row.next_daily_at as number) ?? 0,
    daily_card_enabled: ((row.daily_card_enabled as number) ?? 0) as 0 | 1,
  };
}

function toReading(row: Row): ReadingRow {
  const horizon = row.predicted_horizon_days;
  const prob = row.predicted_probability;
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
    predicted_horizon_days: horizon == null ? null : (horizon as number),
    question_type: (row.question_type as "general" | "specific" | null) ?? null,
    predicted_probability: prob == null ? null : (prob as number),
  };
}

export async function openDb(url: string, authToken: string): Promise<Db> {
  const client: Client = createClient({ url, authToken: authToken || undefined });

  for (const stmt of SCHEMA.trim().split(";").map(s => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }

  // Additive migrations for databases that predate a column.
  // libsql / SQLite has no `ADD COLUMN IF NOT EXISTS`, so we probe via PRAGMA.
  const cols = await client.execute("PRAGMA table_info(readings)");
  const hasHorizon = cols.rows.some((r) => r.name === "predicted_horizon_days");
  if (!hasHorizon) {
    await client.execute("ALTER TABLE readings ADD COLUMN predicted_horizon_days INTEGER");
  }

  const userCols = await client.execute("PRAGMA table_info(users)");
  const hasName = userCols.rows.some((r) => r.name === "name");
  if (!hasName) {
    await client.execute("ALTER TABLE users ADD COLUMN name TEXT");
  }
  const readingCols = await client.execute("PRAGMA table_info(readings)");
  const hasQtype = readingCols.rows.some((r) => r.name === "question_type");
  if (!hasQtype) {
    await client.execute("ALTER TABLE readings ADD COLUMN question_type TEXT");
    await client.execute("ALTER TABLE readings ADD COLUMN predicted_probability INTEGER");
  }

  const userColsV2 = await client.execute("PRAGMA table_info(users)");
  const names = userColsV2.rows.map((r) => r.name as string);
  if (!names.includes("profile_card_json")) {
    await client.execute("ALTER TABLE users ADD COLUMN profile_card_json TEXT");
  }
  if (!names.includes("next_daily_at")) {
    await client.execute("ALTER TABLE users ADD COLUMN next_daily_at INTEGER NOT NULL DEFAULT 0");
  }
  if (!names.includes("daily_card_enabled")) {
    await client.execute("ALTER TABLE users ADD COLUMN daily_card_enabled INTEGER NOT NULL DEFAULT 0");
  }

  return {
    async getUser(phone) {
      const r = await client.execute({ sql: "SELECT * FROM users WHERE phone = ?", args: [phone] });
      return r.rows[0] ? toUser(r.rows[0]) : null;
    },

    async upsertUser(u) {
      await client.execute({
        sql: `INSERT INTO users (phone, lang, onboarding_state, name, birth_iso_encrypted, birth_tz,
              has_hour_pillar, bazi_pillars, pending_date_json, pending_time_json,
              created_at, last_seen_at, readings_today,
              readings_today_reset_at, delete_pending)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(phone) DO UPDATE SET
                lang = excluded.lang,
                onboarding_state = excluded.onboarding_state,
                name = COALESCE(excluded.name, name),
                birth_iso_encrypted = COALESCE(excluded.birth_iso_encrypted, birth_iso_encrypted),
                birth_tz = COALESCE(excluded.birth_tz, birth_tz),
                has_hour_pillar = excluded.has_hour_pillar,
                bazi_pillars = COALESCE(excluded.bazi_pillars, bazi_pillars),
                pending_date_json = COALESCE(excluded.pending_date_json, pending_date_json),
                pending_time_json = COALESCE(excluded.pending_time_json, pending_time_json),
                last_seen_at = excluded.last_seen_at`,
        args: [
          u.phone, u.lang, u.onboarding_state,
          u.name ?? null,
          u.birth_iso_encrypted ?? null, u.birth_tz ?? null,
          u.has_hour_pillar ?? 1, u.bazi_pillars ?? null,
          u.pending_date_json ?? null, u.pending_time_json ?? null,
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
      // Static SET clauses for the bazi/birth columns: COALESCE keeps existing
      // values when caller passes null/undefined.
      const sets: string[] = [
        "onboarding_state = ?",
        "name = COALESCE(?, name)",
        "birth_iso_encrypted = COALESCE(?, birth_iso_encrypted)",
        "birth_tz = COALESCE(?, birth_tz)",
        "has_hour_pillar = COALESCE(?, has_hour_pillar)",
        "bazi_pillars = COALESCE(?, bazi_pillars)",
      ];
      const args: InValue[] = [
        state,
        extra.name ?? null,
        extra.birth_iso_encrypted ?? null,
        extra.birth_tz ?? null,
        extra.has_hour_pillar ?? null,
        extra.bazi_pillars ?? null,
      ];

      // pending_*_json semantics:
      //   clear_pending=true  → both columns forced to NULL
      //   key present in extra → column set to that value (string OR null)
      //   key absent          → column unchanged
      if (extra.clear_pending) {
        sets.push("pending_date_json = NULL");
        sets.push("pending_time_json = NULL");
      } else {
        if ("pending_date_json" in extra) {
          sets.push("pending_date_json = ?");
          args.push(extra.pending_date_json ?? null);
        }
        if ("pending_time_json" in extra) {
          sets.push("pending_time_json = ?");
          args.push(extra.pending_time_json ?? null);
        }
      }

      args.push(phone);
      await client.execute({
        sql: `UPDATE users SET ${sets.join(", ")} WHERE phone = ?`,
        args,
      });
    },

    async setUserName(phone, name) {
      await client.execute({ sql: "UPDATE users SET name = ? WHERE phone = ?", args: [name, phone] });
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
      const followedUp = r.followed_up ?? 0;
      await client.execute({
        sql: `INSERT INTO readings (id, phone, question, method, cast_json, interpretation, lang, created_at, follow_up_at, followed_up, predicted_horizon_days, question_type, predicted_probability)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, r.phone, r.question, r.method, r.cast_json, r.interpretation, r.lang,
          r.created_at, r.follow_up_at, followedUp,
          r.predicted_horizon_days ?? null,
          r.question_type ?? null,
          r.predicted_probability ?? null,
        ],
      });
      return id;
    },

    async getRecentReadings(phone, limit) {
      const r = await client.execute({
        sql: `SELECT r.*, o.outcome, o.user_note
              FROM readings r
              LEFT JOIN outcomes o ON o.reading_id = r.id
              WHERE r.phone = ?
              ORDER BY r.created_at DESC LIMIT ?`,
        args: [phone, limit],
      });
      const VALID_OUTCOMES = new Set(["yes", "no", "mixed"]);
      return r.rows.map((row) => {
        const raw = row.outcome as string | null;
        return {
          ...toReading(row),
          outcome: (raw && VALID_OUTCOMES.has(raw) ? raw : null) as "yes" | "no" | "mixed" | null,
          user_note: (row.user_note as string | null) ?? null,
        };
      });
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

    async getMostRecentPendingOutcome(phone, responseWindowMs) {
      const now = Date.now();
      const oldestFollowUp = now - responseWindowMs;
      const r = await client.execute({
        sql: `SELECT r.* FROM readings r
              LEFT JOIN outcomes o ON o.reading_id = r.id
              WHERE r.phone = ? AND r.followed_up = 1 AND o.reading_id IS NULL
                AND r.follow_up_at <= ? AND r.follow_up_at > ?
              ORDER BY r.follow_up_at DESC LIMIT 1`,
        args: [phone, now, oldestFollowUp],
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

    async saveProfileCardData(phone, data) {
      await client.execute({
        sql: "UPDATE users SET profile_card_json = ? WHERE phone = ?",
        args: [JSON.stringify(data), phone],
      });
    },

    async enableDailyCard(phone, nextAt) {
      await client.execute({
        sql: "UPDATE users SET daily_card_enabled = 1, next_daily_at = ? WHERE phone = ?",
        args: [nextAt, phone],
      });
    },

    async getUsersDueForDailyCard(now) {
      const r = await client.execute({
        sql: "SELECT * FROM users WHERE daily_card_enabled = 1 AND onboarding_state = 'complete' AND next_daily_at > 0 AND next_daily_at <= ?",
        args: [now],
      });
      return r.rows.map(toUser);
    },

    async getCompleteUsersWithoutDailyCard() {
      const r = await client.execute({
        sql: "SELECT * FROM users WHERE onboarding_state = 'complete' AND birth_tz IS NOT NULL AND (daily_card_enabled = 0 OR next_daily_at = 0)",
        args: [],
      });
      return r.rows.map(toUser);
    },

    async setNextDailyAt(phone, nextAt) {
      await client.execute({
        sql: "UPDATE users SET next_daily_at = ? WHERE phone = ?",
        args: [nextAt, phone],
      });
    },

    async close() {
      client.close();
    },
  };
}
