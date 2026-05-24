import { resolveColor, DEFAULT_COLOR, LUCKY_PALETTE } from './palette.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CARDS = ['profile', 'daily', 'social'];
const VALID_STONES = [
  'jade', 'clear-quartz', 'amethyst', 'rose-quartz', 'black-obsidian',
  'tiger-eye', 'citrine', 'red-agate', 'lapis-lazuli', 'moonstone',
  'green-phantom', 'red-coral',
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a FORTUNE_DATA object for a given card type.
 * Returns { valid: boolean, errors: string[] }.
 */
function validateFortuneData(data, cardType) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['data is not an object'] };
  }

  if (!data.name) errors.push('name is missing');

  if (cardType === 'profile') {
    if (data.profile == null) {
      errors.push('profile object is missing');
    } else {
      if (data.profile.luckyNumber == null) errors.push('profile.luckyNumber is missing');
      if (!data.profile.luckyColor) errors.push('profile.luckyColor is missing');
      if (!data.profile.luckyStone) errors.push('profile.luckyStone is missing');
      else if (!VALID_STONES.includes(data.profile.luckyStone))
        errors.push(`profile.luckyStone "${data.profile.luckyStone}" is not one of: ${VALID_STONES.join(', ')}`);
      if (!data.profile.projection) errors.push('profile.projection is missing');
    }
  }

  if (cardType === 'daily') {
    if (data.daily == null) {
      errors.push('daily object is missing');
    } else {
      if (!data.daily.date) errors.push('daily.date is missing');
      if (!data.daily.avoid) errors.push('daily.avoid is missing');
      if (data.daily.luck == null) {
        errors.push('daily.luck object is missing');
      } else {
        for (const key of ['general', 'relationship', 'academic', 'career']) {
          if (data.daily.luck[key] == null) errors.push(`daily.luck.${key} is missing`);
        }
      }
    }
  }

  if (cardType === 'social') {
    if (data.social == null) {
      errors.push('social object is missing');
    } else {
      if (!data.social.shareUrl) errors.push('social.shareUrl is missing');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a string to an integer, returning undefined on failure. */
function toInt(val) {
  if (val == null) return undefined;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? undefined : n;
}

/** Parse a luck score: coerce to number, clamp 0–5. */
function toLuckScore(val) {
  if (val == null) return undefined;
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return undefined;
  return Math.max(0, Math.min(5, n));
}

/** Validate and resolve a stone name. Falls back to jade with a warning. */
function resolveStone(input) {
  if (!input) return undefined;
  const lower = input.trim().toLowerCase().replace(/\s+/g, '-');
  const legacy = { emerald: 'jade', ruby: 'red-agate', sapphire: 'lapis-lazuli' };
  if (legacy[lower]) return legacy[lower];
  if (VALID_STONES.includes(lower)) return lower;
  console.warn(`[data] Unrecognised stone "${input}" — falling back to "jade"`);
  return 'jade';
}

// ---------------------------------------------------------------------------
// Default ingestion: URL query params
// ---------------------------------------------------------------------------

/**
 * Parse FORTUNE_DATA from window.location.search.
 *
 * Flat param scheme:
 *   ?card=profile&name=Teri&luckyNumber=12&luckyColor=orange
 *   &luckyStone=emerald&projection=...&date=...&avoid=...
 *   &general=3&relationship=2&academic=5&career=4&shareUrl=...
 */
// Sample data shown when no query params are provided
const SAMPLE_DATA = {
  name: 'Teri Shim',
  profile: {
    luckyNumber: 12,
    luckyColor: 'orange',
    luckyStone: 'jade',
    millionaireChance: 73,
    meetLoveAge: 27,
    projection: 'you will be struck with wanderlust and spend your life exploring...',
  },
  daily: {
    date: 'may 24, 2026',
    avoid: 'red shoes',
    luck: { general: 3, relationship: 2, academic: 5, career: 5 },
  },
  social: {
    shareUrl: 'https://yearn.cards/share/teri',
  },
};

function loadFromQueryParams() {
  const p = new URLSearchParams(window.location.search);

  // If no meaningful params provided, use sample data
  const hasParams = [...p.keys()].some(k => k !== 'card');
  if (!hasParams) {
    const card = VALID_CARDS.includes(p.get('card')) ? p.get('card') : 'profile';
    return { card, data: SAMPLE_DATA };
  }

  const card = VALID_CARDS.includes(p.get('card')) ? p.get('card') : 'profile';

  const luckyColorRaw = p.get('luckyColor') || undefined;
  const luckyColor = luckyColorRaw ? resolveColor(luckyColorRaw) : undefined;
  const luckyColorName = luckyColorRaw
    ? Object.entries(LUCKY_PALETTE).find(([, hex]) => hex === luckyColor)?.[0] ?? luckyColorRaw
    : undefined;

  const data = {
    name: p.get('name') || undefined,
    profile: {
      luckyNumber: toInt(p.get('luckyNumber')),
      luckyColor: luckyColorName,
      luckyStone: resolveStone(p.get('luckyStone')),
      millionaireChance: toInt(p.get('millionaireChance')),
      meetLoveAge: toInt(p.get('meetLoveAge')),
      projection: p.get('projection') || undefined,
    },
    daily: {
      date: p.get('date') || undefined,
      avoid: p.get('avoid') || undefined,
      luck: {
        general: toLuckScore(p.get('general')),
        relationship: toLuckScore(p.get('relationship')),
        academic: toLuckScore(p.get('academic')),
        career: toLuckScore(p.get('career')),
      },
    },
    social: {
      shareUrl: p.get('shareUrl') || undefined,
    },
  };

  return { card, data };
}

// ---------------------------------------------------------------------------
// ██  SWAP POINT — change this one line to switch ingestion method  ██
// ---------------------------------------------------------------------------

function loadFortuneData() {
  // ▸ Default: read from URL query params
  return loadFromQueryParams();

  // ▸ Alternate A — fetch from a JSON endpoint:
  //   return loadFromJsonEndpoint('/api/fortune');

  // ▸ Alternate B — read from a host-injected global:
  //   return loadFromPostedData();
}

// ---------------------------------------------------------------------------
// Alternate ingestion A: JSON endpoint
// ---------------------------------------------------------------------------

/**
 * Fetch a FORTUNE_DATA object from a remote URL.
 * The endpoint must return JSON matching the FORTUNE_DATA schema,
 * plus a top-level "card" field for the card type.
 *
 * Usage (swap into loadFortuneData above):
 *   return loadFromJsonEndpoint('/api/fortune');
 *
 * @param {string} url — the endpoint URL
 * @returns {Promise<{ card: string, data: object }>}
 */
async function loadFromJsonEndpoint(url) {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`[data] Fetch failed: ${response.status} ${response.statusText}`);
    return { card: 'profile', data: {} };
  }

  const json = await response.json();
  const card = VALID_CARDS.includes(json.card) ? json.card : 'profile';

  // Normalise color through the palette
  if (json.profile?.luckyColor) {
    json.profile.luckyColor = resolveColor(json.profile.luckyColor);
    json.profile.luckyColor =
      Object.entries(LUCKY_PALETTE).find(([, hex]) => hex === json.profile.luckyColor)?.[0]
      ?? json.profile.luckyColor;
  }

  // Validate stone
  if (json.profile?.luckyStone) {
    json.profile.luckyStone = resolveStone(json.profile.luckyStone);
  }

  // Clamp luck scores
  if (json.daily?.luck) {
    for (const key of ['general', 'relationship', 'academic', 'career']) {
      if (json.daily.luck[key] != null) {
        json.daily.luck[key] = Math.max(0, Math.min(5, Number(json.daily.luck[key]) || 0));
      }
    }
  }

  return { card, data: json };
}

// ---------------------------------------------------------------------------
// Alternate ingestion B: host-injected global
// ---------------------------------------------------------------------------

/**
 * Read FORTUNE_DATA from window.FORTUNE_DATA, set by a host page
 * before this script runs (e.g. a server-rendered page or iframe host).
 *
 * Expected global shape:
 *   window.FORTUNE_DATA = { card: "daily", name: "Teri", profile: {…}, … }
 *
 * Usage (swap into loadFortuneData above):
 *   return loadFromPostedData();
 *
 * @returns {{ card: string, data: object }}
 */
function loadFromPostedData() {
  const raw = window.FORTUNE_DATA;
  if (!raw || typeof raw !== 'object') {
    console.warn('[data] window.FORTUNE_DATA not found or invalid — rendering empty card');
    return { card: 'profile', data: {} };
  }

  const card = VALID_CARDS.includes(raw.card) ? raw.card : 'profile';

  // Normalise color through the palette
  if (raw.profile?.luckyColor) {
    raw.profile.luckyColor = resolveColor(raw.profile.luckyColor);
    raw.profile.luckyColor =
      Object.entries(LUCKY_PALETTE).find(([, hex]) => hex === raw.profile.luckyColor)?.[0]
      ?? raw.profile.luckyColor;
  }

  // Validate stone
  if (raw.profile?.luckyStone) {
    raw.profile.luckyStone = resolveStone(raw.profile.luckyStone);
  }

  // Clamp luck scores
  if (raw.daily?.luck) {
    for (const key of ['general', 'relationship', 'academic', 'career']) {
      if (raw.daily.luck[key] != null) {
        raw.daily.luck[key] = Math.max(0, Math.min(5, Number(raw.daily.luck[key]) || 0));
      }
    }
  }

  return { card, data: raw };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export { loadFortuneData, validateFortuneData };
