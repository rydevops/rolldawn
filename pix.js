// pix.js — a tiny RGBA pixel buffer with the handful of drawing tools pixel art needs.
// Sprites and tiles are *painted in code* with this, so the game ships zero image files.
// Pure data + math: it runs in the browser and in Node (that's how the art gets tested).

const cache = new Map();

export function rgba(c) {
  if (Array.isArray(c)) return c.length > 3 ? c : [c[0], c[1], c[2], 255];
  let v = cache.get(c);
  if (v) return v;
  let h = String(c).replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255];
  cache.set(c, v);
  return v;
}

export const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');

export function mix(a, b, t) {
  const A = rgba(a), B = rgba(b);
  return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, '#000000', t);

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  static fromRows(rows, pal) {
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    return new Pix(w, h).stamp(rows, pal);
  }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.inside(x, y)) return this;
    const p = rgba(c);
    const i = (y * this.w + x) * 4;
    this.d[i] = p[0]; this.d[i + 1] = p[1]; this.d[i + 2] = p[2]; this.d[i + 3] = p[3];
    return this;
  }

  get(x, y) {
    if (!this.inside(x, y)) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }

  solid(x, y) { return this.inside(x, y) && this.d[(y * this.w + x) * 4 + 3] > 0; }

  clear(x, y) {
    if (!this.inside(x, y)) return this;
    const i = (y * this.w + x) * 4;
    this.d[i] = this.d[i + 1] = this.d[i + 2] = this.d[i + 3] = 0;
    return this;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  // Filled ellipse; pixel centres sampled at +0.5 so shapes stay symmetrical.
  ellipse(cx, cy, rx, ry, c) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  // Paint hand-drawn rows. '.' and ' ' are transparent; unknown letters throw (typo guard).
  stamp(rows, pal, ox = 0, oy = 0) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c === undefined) throw new Error(`pix.stamp: no colour for '${ch}' (row ${y}: ${row})`);
        this.set(ox + x, oy + y, c);
      }
    });
    return this;
  }

  blit(src, ox = 0, oy = 0, flip = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = flip ? src.w - 1 - x : x;
        const i = (y * src.w + sx) * 4;
        if (src.d[i + 3] === 0) continue;
        this.set(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
      }
    }
    return this;
  }

  clone() {
    const p = new Pix(this.w, this.h);
    p.d.set(this.d);
    return p;
  }

  flipX() {
    const p = new Pix(this.w, this.h);
    return p.blit(this, 0, 0, true);
  }

  // Add a 1px outline around everything opaque (grows the canvas by 1px on each side).
  outline(c, pad = 1) {
    const p = new Pix(this.w + pad * 2, this.h + pad * 2);
    p.blit(this, pad, pad);
    for (let y = -1; y <= this.h; y++) {
      for (let x = -1; x <= this.w; x++) {
        if (this.solid(x, y)) continue;
        if (this.solid(x - 1, y) || this.solid(x + 1, y) || this.solid(x, y - 1) || this.solid(x, y + 1)) {
          p.set(x + pad, y + pad, c);
        }
      }
    }
    return p;
  }

  // Same shape, one flat colour — used for hit flashes and fade-outs.
  silhouette(c) {
    const p = this.clone();
    const col = rgba(c);
    for (let i = 0; i < p.d.length; i += 4) {
      if (p.d[i + 3] > 0) { p.d[i] = col[0]; p.d[i + 1] = col[1]; p.d[i + 2] = col[2]; }
    }
    return p;
  }

  // Place this sprite centred inside a bigger transparent canvas.
  padTo(w, h, ox = null, oy = null) {
    const p = new Pix(w, h);
    return p.blit(this, ox ?? Math.floor((w - this.w) / 2), oy ?? Math.floor((h - this.h) / 2));
  }

  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d');
    const id = g.createImageData(this.w, this.h);
    id.data.set(this.d);
    g.putImageData(id, 0, 0);
    return c;
  }
}
