import { describe, expect, test } from "bun:test";
import {
  isSpectrumRateLimited,
  rateLimitRetryDelayMs,
  reconnectDelayMs,
} from "../src/spectrum/reconnect.ts";

describe("isSpectrumRateLimited", () => {
  test("detects message text", () => {
    expect(isSpectrumRateLimited(new Error("SpectrumCloudError: Too many requests"))).toBe(true);
  });

  test("detects status code", () => {
    expect(isSpectrumRateLimited({ status: 429, message: "nope" })).toBe(true);
  });
});

describe("reconnectDelayMs", () => {
  test("uses longer delays for 429", () => {
    const err = new Error("Too many requests");
    expect(reconnectDelayMs(1, err)).toBeGreaterThanOrEqual(30_000);
  });

  test("uses shorter delays for other errors", () => {
    expect(reconnectDelayMs(1, new Error("socket closed"))).toBeLessThan(15_000);
  });
});

describe("rateLimitRetryDelayMs", () => {
  test("grows with attempt", () => {
    expect(rateLimitRetryDelayMs(3)).toBeGreaterThanOrEqual(45_000);
  });
});
