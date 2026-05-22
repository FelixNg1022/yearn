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
  openRouterApiKey: () => required("OPENROUTER_API_KEY"),
  projectId: () => required("PROJECT_ID"),
  projectSecret: () => required("PROJECT_SECRET"),
  tursoUrl: () => required("TURSO_DATABASE_URL"),
  tursoToken: () => required("TURSO_AUTH_TOKEN"),
  birthEncryptionKey: () => required("BIRTH_ENCRYPTION_KEY"),
  /** Fallback follow-up delay used when no time horizon can be extracted from the question. */
  followUpDays: () => Number(optional("FOLLOW_UP_DAYS", "5")),
  /** Days to wait *after* the predicted event before asking how it played out. */
  followUpBufferDays: () => Number(optional("FOLLOW_UP_BUFFER_DAYS", "1")),
  /** When true, use a small Claude call to extract a horizon if the regex heuristic finds nothing. */
  useLlmHorizonFallback: () => optional("USE_LLM_HORIZON_FALLBACK", "true").toLowerCase() !== "false",
  demoFollowUpSeconds: (): number | undefined => optionalNum("DEMO_FOLLOW_UP_SECONDS"),
  schedulerIntervalSeconds: () => Number(optional("SCHEDULER_INTERVAL_SECONDS", "60")),
  rateLimitPerDay: () => Number(optional("RATE_LIMIT_PER_DAY", "10")),
  logLevel: () => optional("LOG_LEVEL", "info"),
  isDev: () => optional("NODE_ENV", "development") !== "production",
};
