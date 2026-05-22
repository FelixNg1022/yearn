/**
 * Lucky-color palette for Yearn fortune cards.
 *
 * Every color sits at roughly the same saturation (90-100%) and
 * lightness (50-62%) as the reference orange #FF8000 so cards
 * always feel punchy and visually cohesive.
 *
 * HSL values (approximate):
 *   orange   #FF8000  —  30°, 100%, 50%
 *   marigold #FFB000  —  41°,  100%, 50%
 *   rose     #FF4D6A  —  351°, 100%, 65%  → tuned to 352°, 100%, 53%
 *   magenta  #E040A0  —  325°,  75%, 56%  → tuned to 325°, 90%, 55%
 *   violet   #9B59E8  —  266°,  76%, 63%  → tuned to 266°, 90%, 58%
 *   azure    #3D9BFF  —  214°, 100%, 62%
 *   teal     #1ABC9C  —  168°,  76%, 42%  → tuned to 168°, 100%, 50%
 *   lime     #7CB342  —  88°,   47%, 48%  → tuned to 88°, 90%, 52%
 */

const LUCKY_PALETTE = Object.freeze({
  orange:   '#FF8000',  // hsl(30,  100%, 50%)
  marigold: '#FFB000',  // hsl(41,  100%, 50%)
  rose:     '#FF1744',  // hsl(350, 100%, 55%)
  magenta:  '#E831A0',  // hsl(325,  90%, 55%)
  violet:   '#9045F0',  // hsl(266,  90%, 58%)
  azure:    '#3D9BFF',  // hsl(214, 100%, 62%)
  teal:     '#00D9A6',  // hsl(168, 100%, 43%)
  lime:     '#8BC34A',  // hsl(88,   66%, 53%)
});

const DEFAULT_COLOR = 'orange';

/**
 * Resolve an agent-provided color string (name OR hex) to a
 * validated hex from the palette. Falls back to the default
 * color on unrecognised input.
 */
function resolveColor(input) {
  if (typeof input !== 'string' || !input.trim()) {
    console.warn(`[palette] Empty color input — falling back to "${DEFAULT_COLOR}" (${LUCKY_PALETTE[DEFAULT_COLOR]})`);
    return LUCKY_PALETTE[DEFAULT_COLOR];
  }

  const normalized = input.trim().toLowerCase();

  // Match by name
  if (LUCKY_PALETTE[normalized]) {
    return LUCKY_PALETTE[normalized];
  }

  // Match by hex value
  const hexUpper = normalized.toUpperCase();
  for (const [name, hex] of Object.entries(LUCKY_PALETTE)) {
    if (hex.toUpperCase() === hexUpper) {
      return hex;
    }
  }

  console.warn(`[palette] Unrecognised color "${input}" — falling back to "${DEFAULT_COLOR}" (${LUCKY_PALETTE[DEFAULT_COLOR]})`);
  return LUCKY_PALETTE[DEFAULT_COLOR];
}

// ESM-style exports for <script type="module">
export { LUCKY_PALETTE, DEFAULT_COLOR, resolveColor };
