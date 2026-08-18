#!/usr/bin/env node
/**
 * Generates the static PNG marker images used by the map's rotating overlays:
 * the self-location puck and the crew direction cones.
 *
 *   node scripts/generate-map-marker-assets.js        (npm run assets:markers)
 *
 * ── Why these two are images and the field pins are not ───────────────────
 * A <Marker> with React children is rasterised to a bitmap on every layout,
 * which is the failure class documented in src/hooks/useMarkerSnapshot.ts.
 * Rotating markers are the worst case: they are the ones users stare at, and
 * on iOS Google Maps a rotating view-marker with tracksViewChanges=true costs
 * a redraw every frame.
 *
 * The puck and the cone are pure geometry — circles and a triangle — so they
 * can be generated offline and handed to the native SDK as plain images, which
 * skips React rasterisation entirely. Field pins cannot: their glyphs come from
 * the Ionicons TTF, which ships as a font with a codepoint map and no vector
 * paths, so there is nothing to draw offline without adding an image toolchain.
 *
 * Android additionally de-duplicates identical image URIs across markers
 * (MapMarkerManager.AirMapMarkerSharedIcon), so all crew members on one colour
 * share a single bitmap.
 *
 * Output: assets/map/*.png at 1x / 2x / 3x so Image.resolveAssetSource picks
 * the density-correct variant — a single-density marker image would render
 * physically tiny on a 3x screen.
 *
 * Zero dependencies: PNG encoding uses Node's built-in zlib.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── PNG encoding ───────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Drawing surface (supersampled for antialiasing) ────────────────────────
const SS = 4;

function createSurface(sizeDp, scale) {
  const size = Math.round(sizeDp * scale) * SS;
  return { size, sizeDp, scale, px: new Float64Array(size * size * 4) };
}

/** Source-over composite of a straight (non-premultiplied) colour. */
function blend(surface, x, y, [r, g, b, a]) {
  if (a <= 0 || x < 0 || y < 0 || x >= surface.size || y >= surface.size) return;
  const i = (y * surface.size + x) * 4;
  const px = surface.px;
  const outA = a + px[i + 3] * (1 - a);
  if (outA <= 0) return;
  px[i] = (r * a + px[i] * px[i + 3] * (1 - a)) / outA;
  px[i + 1] = (g * a + px[i + 1] * px[i + 3] * (1 - a)) / outA;
  px[i + 2] = (b * a + px[i + 2] * px[i + 3] * (1 - a)) / outA;
  px[i + 3] = outA;
}

const toDevice = (surface, v) => v * surface.scale * SS;

function fillCircle(surface, cxDp, cyDp, rDp, color) {
  const cx = toDevice(surface, cxDp);
  const cy = toDevice(surface, cyDp);
  const r = toDevice(surface, rDp);
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(surface.size - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(surface.size - 1, Math.ceil(cx + r)); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) blend(surface, x, y, color);
    }
  }
}

/** Annulus from rInner to rOuter — used for the puck's outer confidence ring. */
function fillRing(surface, cxDp, cyDp, rInnerDp, rOuterDp, color) {
  const cx = toDevice(surface, cxDp);
  const cy = toDevice(surface, cyDp);
  const rI = toDevice(surface, rInnerDp);
  const rO = toDevice(surface, rOuterDp);
  const rI2 = rI * rI;
  const rO2 = rO * rO;
  for (let y = Math.max(0, Math.floor(cy - rO)); y <= Math.min(surface.size - 1, Math.ceil(cy + rO)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rO)); x <= Math.min(surface.size - 1, Math.ceil(cx + rO)); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rO2 && d2 >= rI2) blend(surface, x, y, color);
    }
  }
}

function fillTriangle(surface, pts, color) {
  const p = pts.map(([x, y]) => [toDevice(surface, x), toDevice(surface, y)]);
  const minX = Math.max(0, Math.floor(Math.min(...p.map((q) => q[0]))));
  const maxX = Math.min(surface.size - 1, Math.ceil(Math.max(...p.map((q) => q[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...p.map((q) => q[1]))));
  const maxY = Math.min(surface.size - 1, Math.ceil(Math.max(...p.map((q) => q[1]))));
  const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d1 = sign(px, py, p[0][0], p[0][1], p[1][0], p[1][1]);
      const d2 = sign(px, py, p[1][0], p[1][1], p[2][0], p[2][1]);
      const d3 = sign(px, py, p[2][0], p[2][1], p[0][0], p[0][1]);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(hasNeg && hasPos)) blend(surface, x, y, color);
    }
  }
}

/** Box-downsample the supersampled surface to final device pixels. */
function resolve(surface) {
  const out = Math.round(surface.sizeDp * surface.scale);
  const buf = Buffer.alloc(out * out * 4);
  for (let y = 0; y < out; y++) {
    for (let x = 0; x < out; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * surface.size + (x * SS + sx)) * 4;
          const sa = surface.px[i + 3];
          r += surface.px[i] * sa;
          g += surface.px[i + 1] * sa;
          b += surface.px[i + 2] * sa;
          a += sa;
        }
      }
      const n = SS * SS;
      const o = (y * out + x) * 4;
      // Un-premultiply so the PNG stores straight colour.
      buf[o] = a > 0 ? Math.round(Math.min(255, (r / a) * 255)) : 0;
      buf[o + 1] = a > 0 ? Math.round(Math.min(255, (g / a) * 255)) : 0;
      buf[o + 2] = a > 0 ? Math.round(Math.min(255, (b / a) * 255)) : 0;
      buf[o + 3] = Math.round(Math.min(255, (a / n) * 255));
    }
  }
  return { buf, size: out };
}

const hex = (h, alpha = 1) => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
  alpha,
];

// ─── Artwork ────────────────────────────────────────────────────────────────
// Geometry mirrors the previous React views 1:1 so the map looks unchanged:
//   SelfMarker  wrapper 60x60, ring d=36/2px, core d=22 w/ 3px white border,
//               inner dot d=8, HeadingArrow size=56 (arrow = 30% of size).
//   CrewMarker  HeadingArrow size=52.
const PUCK_DP = 60;
const CONE_DP = 52;

function drawPuck(surface, { color, withArrow, ringAlpha }) {
  const c = PUCK_DP / 2;
  fillRing(surface, c, c, 17, 19, hex(color, ringAlpha));
  if (withArrow) {
    const arrow = 56 * 0.3; // HeadingArrow: arrowSize = size * 0.3
    const top = (PUCK_DP - 56) / 2;
    fillTriangle(
      surface,
      [
        [c, top],
        [c - arrow / 2, top + arrow],
        [c + arrow / 2, top + arrow],
      ],
      hex(color),
    );
  }
  fillCircle(surface, c, c, 11, hex('#ffffff'));
  fillCircle(surface, c, c, 8, hex(color));
  fillCircle(surface, c, c, 4, hex('#ffffff'));
}

function drawCone(surface, color) {
  const c = CONE_DP / 2;
  const arrow = CONE_DP * 0.3;
  fillTriangle(
    surface,
    [
      [c, 0],
      [c - arrow / 2, arrow],
      [c + arrow / 2, arrow],
    ],
    hex(color),
  );
}

// Must stay in sync with CREW_COLORS in src/constants/map.ts.
const CREW_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#a855f7',
];

const OUT_DIR = path.join(__dirname, '..', 'assets', 'map');
const DENSITIES = [1, 2, 3];

function emit(name, sizeDp, draw) {
  for (const scale of DENSITIES) {
    const surface = createSurface(sizeDp, scale);
    draw(surface);
    const { buf, size } = resolve(surface);
    const suffix = scale === 1 ? '' : `@${scale}x`;
    const file = path.join(OUT_DIR, `${name}${suffix}.png`);
    fs.writeFileSync(file, encodePng(size, size, buf));
    console.log(`  ${path.relative(process.cwd(), file)}  ${size}x${size}`);
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log('Generating map marker assets…');

emit('self-puck', PUCK_DP, (s) => drawPuck(s, { color: '#22c55e', withArrow: true, ringAlpha: 0.35 }));
// Heading-unavailable variant: no arrow, because a north-pointing arrow when
// the compass is unavailable is a lie about where the user is facing.
emit('self-puck-noheading', PUCK_DP, (s) => drawPuck(s, { color: '#22c55e', withArrow: false, ringAlpha: 0.35 }));
// Go Dark: greyed, and never directional.
emit('self-puck-dark', PUCK_DP, (s) => drawPuck(s, { color: '#6b7280', withArrow: false, ringAlpha: 0.4 }));

CREW_COLORS.forEach((color, i) => {
  emit(`crew-cone-${i}`, CONE_DP, (s) => drawCone(s, color));
});

console.log('Done.');
