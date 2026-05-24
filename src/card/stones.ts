/** Lucky stone ids — must match filenames in src/card/html/assets/stones/*.svg */
export const VALID_STONES = [
  "jade",
  "clear-quartz",
  "amethyst",
  "rose-quartz",
  "black-obsidian",
  "tiger-eye",
  "citrine",
  "red-agate",
  "lapis-lazuli",
  "moonstone",
  "green-phantom",
  "red-coral",
] as const;

export type LuckyStone = (typeof VALID_STONES)[number];

const LEGACY_ALIASES: Record<string, LuckyStone> = {
  emerald: "jade",
  ruby: "red-agate",
  sapphire: "lapis-lazuli",
};

/** Map LLM / legacy stone names to a valid SVG filename stem. */
export function normalizeStone(input: string | undefined | null): LuckyStone {
  if (!input) return "jade";
  const lower = input.trim().toLowerCase().replace(/\s+/g, "-");
  if (LEGACY_ALIASES[lower]) return LEGACY_ALIASES[lower];
  if ((VALID_STONES as readonly string[]).includes(lower)) return lower as LuckyStone;
  return "jade";
}
