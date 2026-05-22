/**
 * qr.js — Minimal dependency-free QR Code generator.
 * Supports: byte mode, EC Level L, versions 1–10 (up to 271 bytes).
 * Output: renders to a <canvas> element.
 * License: public domain.
 */

// ===== Galois Field GF(256) =====
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; EXP[i + 255] = x;
    LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11D : 0);
  }
}
function gfMul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }

// ===== Reed-Solomon =====
function rsGenPoly(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

function rsEncode(data, ecCount) {
  const gen = rsGenPoly(ecCount);
  const ecc = new Uint8Array(ecCount);
  for (const d of data) {
    const fb = d ^ ecc[0];
    for (let i = 0; i < ecCount - 1; i++) ecc[i] = ecc[i + 1] ^ gfMul(fb, gen[i + 1]);
    ecc[ecCount - 1] = gfMul(fb, gen[ecCount]);
  }
  return ecc;
}

// ===== BCH error correction for format/version info =====
function bchRem(data, gen) {
  const gDeg = 31 - Math.clz32(gen);
  let d = data;
  while (d !== 0) { const dDeg = 31 - Math.clz32(d); if (dDeg < gDeg) break; d ^= gen << (dDeg - gDeg); }
  return d;
}
function formatInfoBits(mask) {
  const data = (0b01 << 3) | mask; // EC Level L = 01
  return ((data << 10) | bchRem(data << 10, 0b10100110111)) ^ 0b101010000010010;
}
function versionInfoBits(ver) {
  return (ver << 12) | bchRem(ver << 12, 0b1111100100101);
}

// ===== Version tables (EC Level L) =====
// [totalCW, dataCW, ecPerBlock, g1Blocks, g1DataCW, g2Blocks, g2DataCW]
const VER = [
  null,
  [26,19,7,1,19,0,0],[44,34,10,1,34,0,0],[70,55,15,1,55,0,0],
  [100,80,20,1,80,0,0],[134,108,26,1,108,0,0],[172,136,18,2,68,0,0],
  [196,156,20,2,78,0,0],[242,194,24,2,97,0,0],[292,232,30,2,116,0,0],
  [346,274,18,2,68,2,69],
];
const ALIGN = [null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

// ===== Data Encoding (byte mode) =====
function encodeData(text, version) {
  const bytes = new TextEncoder().encode(text);
  const dataCW = VER[version][1];
  const bits = [];
  bits.push(0,1,0,0); // mode: byte
  const countBits = version <= 9 ? 8 : 16;
  for (let i = countBits - 1; i >= 0; i--) bits.push((bytes.length >> i) & 1);
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  const cap = dataCW * 8;
  for (let i = 0; i < Math.min(4, cap - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const pads = [0xEC, 0x11]; let pi = 0;
  while (bits.length < cap) { const pb = pads[pi++ % 2]; for (let i = 7; i >= 0; i--) bits.push((pb >> i) & 1); }
  const cw = new Uint8Array(dataCW);
  for (let i = 0; i < dataCW; i++) { let v = 0; for (let b = 0; b < 8; b++) v = (v << 1) | bits[i*8+b]; cw[i] = v; }
  return cw;
}

// ===== Build interleaved codeword bit stream =====
function buildBits(text, version) {
  const [,dataCW,ecPB,g1C,g1D,g2C,g2D] = VER[version];
  const data = encodeData(text, version);
  const blocks = []; let off = 0;
  for (let i = 0; i < g1C; i++) { blocks.push(data.slice(off, off+g1D)); off += g1D; }
  for (let i = 0; i < g2C; i++) { blocks.push(data.slice(off, off+g2D)); off += g2D; }
  const ecBlocks = blocks.map(b => rsEncode(b, ecPB));
  const interleaved = [];
  const maxD = Math.max(g1D, g2D || 0);
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.length) interleaved.push(b[i]);
  for (let i = 0; i < ecPB; i++) for (const e of ecBlocks) interleaved.push(e[i]);
  const bits = [];
  for (const byte of interleaved) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  return bits;
}

// ===== Matrix =====
function createMatrix(ver) {
  const sz = 4*ver+17;
  return { size: sz, mod: Array.from({length:sz},()=>new Uint8Array(sz)), fn: Array.from({length:sz},()=>new Uint8Array(sz)) };
}
function setMod(m, r, c, v) { m.mod[r][c] = v ? 1 : 0; m.fn[r][c] = 1; }

function placeFinder(m, row, col) {
  const sz = m.size;
  for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
    const r = row+dr, c = col+dc;
    if (r < 0 || r >= sz || c < 0 || c >= sz) continue;
    const outer = dr===-1||dr===7||dc===-1||dc===7;
    const border = dr===0||dr===6||dc===0||dc===6;
    const inner = dr>=2&&dr<=4&&dc>=2&&dc<=4;
    setMod(m, r, c, !outer && (border || inner));
  }
}

function placeAlign(m, row, col) {
  for (let dr=-2;dr<=2;dr++) for (let dc=-2;dc<=2;dc++)
    setMod(m, row+dr, col+dc, Math.abs(dr)===2||Math.abs(dc)===2||(dr===0&&dc===0));
}

function placeFunctionPatterns(m, ver) {
  const sz = m.size;
  placeFinder(m,0,0); placeFinder(m,0,sz-7); placeFinder(m,sz-7,0);
  for (let i=8;i<sz-8;i++) { setMod(m,6,i,i%2===0); setMod(m,i,6,i%2===0); }
  for (const r of ALIGN[ver]) for (const c of ALIGN[ver]) {
    if (r<=8&&c<=8) continue; if (r<=8&&c>=sz-8) continue; if (r>=sz-8&&c<=8) continue;
    placeAlign(m,r,c);
  }
  setMod(m, sz-8, 8, true);
  for (let i=0;i<=8;i++) { if(i!==6){m.fn[8][i]=1;m.fn[i][8]=1;} }
  for (let i=0;i<7;i++) { m.fn[8][sz-1-i]=1; m.fn[sz-1-i][8]=1; }
  if (ver>=7) for (let i=0;i<6;i++) for (let j=0;j<3;j++) { m.fn[i][sz-11+j]=1; m.fn[sz-11+j][i]=1; }
}

function placeData(m, bits) {
  const sz = m.size; let bi = 0, up = true;
  for (let col=sz-1;col>=1;col-=2) {
    if (col===6) col=5;
    for (let i=0;i<sz;i++) {
      const row = up ? sz-1-i : i;
      if (!m.fn[row][col]) { m.mod[row][col] = bi<bits.length ? bits[bi] : 0; bi++; }
      if (col>0 && !m.fn[row][col-1]) { m.mod[row][col-1] = bi<bits.length ? bits[bi] : 0; bi++; }
    }
    up = !up;
  }
}

function placeFormatInfo(m, mask) {
  const sz = m.size, info = formatInfoBits(mask);
  const c1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const c2 = [[sz-1,8],[sz-2,8],[sz-3,8],[sz-4,8],[sz-5,8],[sz-6,8],[sz-7,8],[8,sz-8],[8,sz-7],[8,sz-6],[8,sz-5],[8,sz-4],[8,sz-3],[8,sz-2],[8,sz-1]];
  for (let i=0;i<15;i++) { const b=(info>>i)&1; m.mod[c1[i][0]][c1[i][1]]=b; m.mod[c2[i][0]][c2[i][1]]=b; }
}

function placeVersionInfo(m, ver) {
  if (ver<7) return;
  const sz=m.size, info=versionInfoBits(ver);
  for (let i=0;i<18;i++) { const b=(info>>i)&1, r=Math.floor(i/3), c=i%3; m.mod[r][sz-11+c]=b; m.mod[sz-11+c][r]=b; }
}

// ===== Masking =====
const MASKS = [
  (r,c)=>(r+c)%2===0, (r)=>r%2===0, (_,c)=>c%3===0, (r,c)=>(r+c)%3===0,
  (r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0, (r,c)=>(r*c)%2+(r*c)%3===0,
  (r,c)=>((r*c)%2+(r*c)%3)%2===0, (r,c)=>((r+c)%2+(r*c)%3)%2===0,
];

function applyMask(m, mi) {
  const fn=MASKS[mi], sz=m.size;
  for (let r=0;r<sz;r++) for (let c=0;c<sz;c++) if (!m.fn[r][c] && fn(r,c)) m.mod[r][c]^=1;
}

function penalty(m) {
  const sz=m.size, md=m.mod; let p=0;
  for (let r=0;r<sz;r++){let run=1;for(let c=1;c<sz;c++){if(md[r][c]===md[r][c-1])run++;else{if(run>=5)p+=run-2;run=1;}}if(run>=5)p+=run-2;}
  for (let c=0;c<sz;c++){let run=1;for(let r=1;r<sz;r++){if(md[r][c]===md[r-1][c])run++;else{if(run>=5)p+=run-2;run=1;}}if(run>=5)p+=run-2;}
  for (let r=0;r<sz-1;r++) for (let c=0;c<sz-1;c++){const v=md[r][c];if(v===md[r][c+1]&&v===md[r+1][c]&&v===md[r+1][c+1])p+=3;}
  const pat=[1,0,1,1,1,0,1];
  for(let r=0;r<sz;r++) for(let c=0;c<=sz-7;c++){let ok=true;for(let i=0;i<7;i++)if(md[r][c+i]!==pat[i]){ok=false;break;}if(ok){let bef=c>=4,aft=c+10<sz;if(bef)for(let i=1;i<=4;i++)if(md[r][c-i]){bef=false;break;}if(aft)for(let i=7;i<=10;i++)if(md[r][c+i]){aft=false;break;}if(bef||aft)p+=40;}}
  for(let c=0;c<sz;c++) for(let r=0;r<=sz-7;r++){let ok=true;for(let i=0;i<7;i++)if(md[r+i][c]!==pat[i]){ok=false;break;}if(ok){let bef=r>=4,aft=r+10<sz;if(bef)for(let i=1;i<=4;i++)if(md[r-i][c]){bef=false;break;}if(aft)for(let i=7;i<=10;i++)if(md[r+i][c]){aft=false;break;}if(bef||aft)p+=40;}}
  let dark=0;for(let r=0;r<sz;r++)for(let c=0;c<sz;c++)if(md[r][c])dark++;
  p+=Math.abs(Math.floor(dark*100/(sz*sz)/5)-10)*10;
  return p;
}

// ===== Generate =====
function generate(text) {
  const bytes = new TextEncoder().encode(text);
  let ver=0;
  for (let v=1;v<=10;v++){const cap=VER[v][1]-(v<=9?2:3);if(bytes.length<=cap){ver=v;break;}}
  if (!ver) throw new Error('Text too long for QR versions 1-10');
  const bits = buildBits(text, ver);
  let bestMask=0, bestPen=Infinity, bestM=null;
  for (let mask=0;mask<8;mask++) {
    const m=createMatrix(ver);
    placeFunctionPatterns(m,ver); placeData(m,bits); applyMask(m,mask);
    placeFormatInfo(m,mask); placeVersionInfo(m,ver);
    const p=penalty(m);
    if (p<bestPen){bestPen=p;bestMask=mask;bestM=m;}
  }
  return bestM;
}

// ===== Canvas rendering =====
export function generateQR(text, canvas, opts = {}) {
  const { quietZone = 2, fg = '#000000', bg = '#FFFFFF' } = opts;
  const matrix = generate(text);
  const sz = matrix.size;
  const total = sz + 2 * quietZone;
  const scale = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / total));
  const offset = Math.floor((canvas.width - total * scale) / 2);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  for (let r = 0; r < sz; r++) for (let c = 0; c < sz; c++) {
    if (matrix.mod[r][c]) ctx.fillRect(offset + (c + quietZone) * scale, offset + (r + quietZone) * scale, scale, scale);
  }
}
