import { resolveColor, DEFAULT_COLOR } from './palette.js';

/**
 * FORTUNE_DATA shape — a single object drives all three card types.
 *
 * {
 *   name: string,                        — display name for the footer
 *   profile: {
 *     luckyNumber:  number,              — displayed large in the number block
 *     luckyColor:   string,              — palette name or hex
 *     luckyStone:   string,              — one of the 12 stone ids (e.g. jade, amethyst)
 *     millionaireChance: number,         — percentage chance (0-100)
 *     meetLoveAge:  number,              — age when you meet your love
 *     projection:   string,              — the broad reading paragraph
 *   },
 *   daily: {
 *     date:   string,                    — e.g. "may 22, 2026"
 *     avoid:  string,                    — thing to avoid today
 *     luck: {
 *       general:      number (0-5),
 *       relationship: number (0-5),
 *       academic:     number (0-5),
 *       career:       number (0-5),
 *     },
 *   },
 *   social: {
 *     shareUrl: string,                  — URL for the QR code
 *   },
 * }
 */

/** Hardcoded sample data for visual testing. */
const SAMPLE_DATA = {
  name: 'Teri Shim',
  shareUrl: 'https://yearn-three.vercel.app/',
  profile: {
    luckyNumber: 12,
    luckyColor: 'orange',
    luckyStone: 'jade',
    millionaireChance: 73,
    meetLoveAge: 27,
    projection:
      'you will be struck with wanderlust and spend your life exploring...',
  },
  daily: {
    date: 'may 21, 2026',
    avoid: 'red shoes',
    luck: {
      general: 3,
      relationship: 2,
      academic: 5,
      career: 5,
    },
  },
  social: {
    shareUrl: 'https://yearn-three.vercel.app/',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const safe = (val) => (val != null && val !== '' ? val : '\u2014');

/** Display stone id as readable label (e.g. clear-quartz → clear quartz). */
const formatStoneName = (id) =>
  safe(id).replace(/-/g, ' ');

const clampScore = (n) => Math.max(0, Math.min(5, Number(n) || 0));

const CALENDAR_SVG = `<img src="assets/icons/calendar.svg" alt="" class="daily-cal-icon">`;

function shareUrlFromData(data) {
  return data?.shareUrl || data?.social?.shareUrl || null;
}

function renderQRFooter(shareUrl, footerEl) {
  if (!shareUrl || !footerEl) return;
  footerEl.classList.add('card__footer--with-qr');
  const slot = document.createElement('div');
  slot.className = 'card__footer-qr';
  slot.dataset.shareUrl = shareUrl;
  footerEl.appendChild(slot);
}

function meterHTML(label, filled, tier) {
  const n = clampScore(filled);
  const cls = tier === 'primary' ? 'meter--primary' : 'meter--secondary';
  const cells = Array.from({ length: 5 }, (_, i) => {
    const cellCls = i < n ? 'meter__cell meter__cell--filled' : 'meter__cell';
    return `<span class="${cellCls}"></span>`;
  }).join('');
  return `
    <div class="${cls}">
      <span class="meter__label">${label}</span>
      <div class="meter__cells">${cells}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// PROFILE CARD
// ---------------------------------------------------------------------------

function renderProfile(data, cardEl) {
  const p = data?.profile ?? {};
  const name = safe(data?.name);

  cardEl.querySelector('.card__header-title').textContent = 'your fortune profile';

  const body = cardEl.querySelector('.card__body');
  body.innerHTML = `
    <div class="profile-row">
      <div class="profile-item">
        <div class="profile-block">
          <span class="profile-block__value${String(safe(p.luckyNumber)).length >= 3 ? ' profile-block__value--small' : ''}">${safe(p.luckyNumber)}</span>
        </div>
        <span class="profile-item__label">lucky number</span>
      </div>
      <div class="profile-item">
        <div class="profile-block">
          <div class="profile-block__stone" id="stone-slot">
            <img
              src="assets/stones/${encodeURIComponent(p.luckyStone || 'jade')}.svg"
              alt="${formatStoneName(p.luckyStone)}"
              class="profile-block__stone-img"
              onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='assets/stones/jade.svg';}else{this.style.display='none';}"
            >
          </div>
          <span class="profile-block__stone-name">${formatStoneName(p.luckyStone)}</span>
        </div>
        <span class="profile-item__label">lucky rock</span>
      </div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat">
        <span class="profile-stat__value">${safe(p.millionaireChance)}%</span>
        <span class="profile-stat__label">to become a millionaire</span>
      </div>
      <div class="profile-stat">
        <span class="profile-stat__value">at ${safe(p.meetLoveAge)}</span>
        <span class="profile-stat__label">you will meet your love</span>
      </div>
    </div>
    <div class="profile-projection">
      <span class="profile-projection__label">projection</span>
      <p class="profile-projection__text">${safe(p.projection)}</p>
    </div>`;

  const footer = cardEl.querySelector('.card__footer');
  footer.textContent = `prepared for ${name}`;
  renderQRFooter(shareUrlFromData(data), footer);
}

// ---------------------------------------------------------------------------
// DAILY READING CARD
// ---------------------------------------------------------------------------

function renderDaily(data, cardEl) {
  const d = data?.daily ?? {};
  const luck = d.luck ?? {};
  const name = safe(data?.name);

  cardEl.querySelector('.card__header-title').innerHTML =
    `<span class="daily-header-row">${CALENDAR_SVG} ${safe(d.date)}</span>`;

  const avoidText = (() => {
    const raw = safe(d.avoid);
    const words = raw.split(/\s+/);
    return words.length > 6 ? words.slice(0, 6).join(' ') + '...' : raw;
  })();

  const body = cardEl.querySelector('.card__body');
  body.innerHTML = `
    <div class="daily-avoid">
      <span class="daily-avoid__label">try to avoid</span>
      <span class="daily-pill">${avoidText}</span>
    </div>
    <div class="daily-meters">
      ${meterHTML('General Luck', luck.general, 'primary')}
      ${meterHTML('Relationship Luck', luck.relationship, 'secondary')}
      ${meterHTML('Academic Luck', luck.academic, 'secondary')}
      ${meterHTML('Career Luck', luck.career, 'secondary')}
    </div>`;

  const footer = cardEl.querySelector('.card__footer');
  footer.textContent = `prepared for ${name}`;
  renderQRFooter(shareUrlFromData(data), footer);
}

// ---------------------------------------------------------------------------
// SOCIAL CARD
// ---------------------------------------------------------------------------

function renderSocial(data, cardEl) {
  const s = data?.social ?? {};
  const shareUrl = shareUrlFromData(data);
  cardEl.classList.add('card--social');

  cardEl.querySelector('.card__header-title').textContent = '';
  cardEl.querySelector('.card__header').style.display = 'none';

  const body = cardEl.querySelector('.card__body');
  body.innerHTML = `
    <div class="social-content">
      <h2 class="social-headline">
        <span>you yearn for it,</span>
        <span>you get it...</span>
      </h2>
      <p class="social-share">share with your friends</p>
      <div class="social-flowers">
        <img src="assets/flowers/flower-group.svg" alt="">
      </div>
      <div class="social-bottom">
        <div id="qr-slot" class="social-qr" data-share-url="${safe(s?.shareUrl ?? data?.shareUrl)}"></div>
      </div>
    </div>`;

  // QR image injected server-side before Playwright screenshot (vendor qr.js is not scannable).

  const footer = cardEl.querySelector('.card__footer');
  footer.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export { SAMPLE_DATA, renderProfile, renderDaily, renderSocial };
