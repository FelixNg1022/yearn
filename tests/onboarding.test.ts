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
