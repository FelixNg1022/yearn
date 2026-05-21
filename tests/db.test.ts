import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { openDb, type Db } from "../src/db.ts";

const TEST_URL = "file:test-yun.db";

describe("db", () => {
  let db: Db;

  beforeEach(async () => {
    db = await openDb(TEST_URL, "");
  });

  afterEach(async () => {
    await db.close();
    try {
      Bun.spawnSync(["rm", "-f", "test-yun.db"]);
    } catch {}
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
      predicted_horizon_days: null,
      question_type: null,
      predicted_probability: null,
    });
    expect(typeof id).toBe("string");
    const rows = await db.getRecentReadings("+11234567890", 5);
    expect(rows.length).toBe(1);
    expect(rows[0]!.question).toBe("will it work?");
    expect(rows[0]!.predicted_horizon_days).toBeNull();
  });

  test("recordReading persists predicted_horizon_days and round-trips it", async () => {
    const now = Date.now();
    await db.upsertUser({
      phone: "+11234567899",
      lang: "en",
      onboarding_state: "complete",
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    await db.recordReading({
      phone: "+11234567899",
      question: "will the email come in 3 days?",
      method: "meihua",
      cast_json: "{}",
      interpretation: "yes",
      lang: "en",
      created_at: now,
      follow_up_at: now + 4 * 86400_000,
      predicted_horizon_days: 3,
      question_type: "general",
      predicted_probability: null,
    });
    const rows = await db.getRecentReadings("+11234567899", 5);
    expect(rows[0]!.predicted_horizon_days).toBe(3);
  });

  test("setOnboardingState persists pending_date_json and reads it back", async () => {
    const now = Date.now();
    await db.upsertUser({
      phone: "+15555550000",
      lang: "en",
      onboarding_state: "pending_date",
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    await db.setOnboardingState("+15555550000", "pending_time", {
      pending_date_json: JSON.stringify({ year: 2002, month: 10, day: 22 }),
    });
    const user = await db.getUser("+15555550000");
    expect(user?.onboarding_state).toBe("pending_time");
    expect(user?.pending_date_json).toBe(JSON.stringify({ year: 2002, month: 10, day: 22 }));
  });

  test("setOnboardingState with pending_time_json='null' (skipped sentinel) writes the literal string 'null'", async () => {
    const now = Date.now();
    await db.upsertUser({
      phone: "+15555550002",
      lang: "en",
      onboarding_state: "pending_time",
      pending_date_json: JSON.stringify({ year: 2002, month: 10, day: 22 }),
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    await db.setOnboardingState("+15555550002", "pending_location", {
      pending_time_json: JSON.stringify(null),
    });
    const user = await db.getUser("+15555550002");
    expect(user?.onboarding_state).toBe("pending_location");
    expect(user?.pending_time_json).toBe("null");
    expect(user?.pending_date_json).toBe(JSON.stringify({ year: 2002, month: 10, day: 22 }));
  });

  test("setOnboardingState without clear_pending or pending_* keys leaves pending fields untouched", async () => {
    const now = Date.now();
    const dateJson = JSON.stringify({ year: 2002, month: 10, day: 22 });
    const timeJson = JSON.stringify({ hour: 18, minute: 0 });
    await db.upsertUser({
      phone: "+15555550003",
      lang: "en",
      onboarding_state: "pending_location",
      pending_date_json: dateJson,
      pending_time_json: timeJson,
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    await db.setOnboardingState("+15555550003", "complete", {
      birth_iso_encrypted: "X",
      birth_tz: "+08:00",
      has_hour_pillar: 1,
      bazi_pillars: "{}",
    });
    const user = await db.getUser("+15555550003");
    expect(user?.onboarding_state).toBe("complete");
    expect(user?.pending_date_json).toBe(dateJson);
    expect(user?.pending_time_json).toBe(timeJson);
  });

  test("completing onboarding clears pending_*_json", async () => {
    const now = Date.now();
    await db.upsertUser({
      phone: "+15555550001",
      lang: "en",
      onboarding_state: "pending_location",
      pending_date_json: JSON.stringify({ year: 2002, month: 10, day: 22 }),
      pending_time_json: JSON.stringify({ hour: 18, minute: 0 }),
      created_at: now,
      last_seen_at: now,
      readings_today: 0,
      readings_today_reset_at: now,
    });
    await db.setOnboardingState("+15555550001", "complete", {
      birth_iso_encrypted: "{}",
      birth_tz: "+08:00",
      has_hour_pillar: 1,
      bazi_pillars: "{}",
      clear_pending: true,
    });
    const user = await db.getUser("+15555550001");
    expect(user?.onboarding_state).toBe("complete");
    expect(user?.pending_date_json).toBeNull();
    expect(user?.pending_time_json).toBeNull();
  });
});
