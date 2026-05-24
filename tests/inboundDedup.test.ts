import { describe, expect, test } from "bun:test";
import { InboundDedup, inboundMessageKey } from "../src/spectrum/dedup.ts";

describe("InboundDedup", () => {
  test("drops the same message id twice", () => {
    const dedup = new InboundDedup(60_000);
    expect(dedup.isDuplicate("msg-1", 1_000)).toBe(false);
    expect(dedup.isDuplicate("msg-1", 1_500)).toBe(true);
  });

  test("allows the same id after TTL expires", () => {
    const dedup = new InboundDedup(1_000);
    expect(dedup.isDuplicate("msg-2", 0)).toBe(false);
    expect(dedup.isDuplicate("msg-2", 500)).toBe(true);
    expect(dedup.isDuplicate("msg-2", 1_001)).toBe(false);
  });
});

describe("inboundMessageKey", () => {
  test("prefers message id when present", () => {
    expect(inboundMessageKey({ id: "abc", timestamp: 1 }, "+1", "hi")).toBe("abc");
  });

  test("falls back to phone + timestamp + text", () => {
    expect(inboundMessageKey({ timestamp: 42 }, "+1555", "hello")).toBe("+1555:42:hello");
  });
});
