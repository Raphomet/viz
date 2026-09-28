// Zine: a punk photocopy fanzine page, pasted up with scissors and glue and
// run through a tired office copier. Ransom-note headline letters cut from a
// dozen different magazines, each on its own scrap of card; a coarse halftone
// photo (a pogoing crowd, a record on the platter, tower blocks at night)
// torn out and taped down; safety pins; a typewritten column that keeps
// typing itself; marker scrawls; toner streaks, lid shadow and copier dust.
// Pure black toner on one sheet of paper, plus, in the drop, a second colour
// of stock pasted in (a fluoro strip, a sticker, a marching tape).
//
// Music, each in its own place:
//   kick   one headline letter is re-cut: a new scrap from a new magazine is
//          slapped down in its slot (lifted, then pressed flat, its paste-up
//          shadow snapping back). In the crowd photo the front rows pogo.
//   clap   a marker gesture draws itself on the page: a ring round a word,
//          an arrow, an underline, a star; once the page is marked up, a
//          tally of claps grows in the corner
//   bass   the halftone swells: the photo's dots fatten and darken (toner up)
//   hats   copier dust flickers; lit windows in the tower blocks trade places
//   energy the typewriter types faster, the record spins faster, the marching
//          tape runs faster
//   drop   the page is re-copied: the copier's light bar sweeps across and
//          leaves a denser paste-up behind it (a second photo, a three-word
//          ransom headline, fluoro stock, pins, a marching tape). The
//          breakdown is re-copied back to a sparse, quiet sheet.
// Every 16 bars (a param) the page is re-copied anyway, one generation more
// worn, so the page keeps changing across a set.
//
// Technique: the paste-up is drawn with Canvas 2D into an offscreen canvas as
// a coded image (red = tone, green = "this is a photo, screen it", blue =
// "this is the coloured stock"), and a WebGL2 shader plays the copier: it
// spreads and thresholds the toner with a static grain (so greys copy as a
// stipple and edges go crunchy), screens photos with a rotated dot screen,
// punches wear dropouts into solid blacks, and adds streaks, lid shadow, dust
// and the scan light.

(function () {
  const PAPERS = [
    { name: 'Toner on bond', paper: '#ECE9E0', ink: '#131313', acc: '#FF4F9C' },
    { name: 'Fluoro pink stock', paper: '#F5A3C7', ink: '#17121A', acc: '#F2EA45' },
    { name: 'Canary stock', paper: '#F0E176', ink: '#16140E', acc: '#FF5B8F' },
    { name: 'Reversed copy', paper: '#161616', ink: '#E8E5DC', acc: '#E8367E' },
  ];
  const SUBJECTS = ['Rotate', 'Crowd', 'Record', 'Tower blocks'];

  // Faces from web/fonts.js, each with a fallback of the same kind.
  const FACES = [
    ['Anton', 400, 'Impact, sans-serif'],
    ['Archivo Black', 400, '"Arial Black", sans-serif'],
    ['Bebas Neue', 400, 'Impact, sans-serif'],
    ['Abril Fatface', 400, 'Didot, Georgia, serif'],
    ['Playfair Display', 900, 'Georgia, serif'],
    ['Rye', 400, 'Georgia, serif'],
    ['Special Elite', 400, '"Courier New", monospace'],
    ['Bungee', 400, 'Impact, sans-serif'],
    ['Rubik Mono One', 400, '"Arial Black", sans-serif'],
    ['Alfa Slab One', 400, 'Rockwell, Georgia, serif'],
    ['Oswald', 700, '"Arial Narrow", sans-serif'],
    ['Libre Baskerville', 700, 'Georgia, serif'],
    ['Russo One', 400, 'sans-serif'],
    ['Syne', 800, 'sans-serif'],
    ['Josefin Sans', 700, 'sans-serif'],
    ['Unica One', 400, 'sans-serif'],
  ];
  const fontStr = (F, px) => F[1] + ' ' + px + 'px "' + F[0] + '", ' + F[2];

  // All wording original.
  const DENSE_HEADS = [
    ['TOO LOUD', 'TO SLEEP'], ['KICK DRUM', 'HEART'], ['SWEAT &', 'STATIC'],
    ['DARK ROOM', 'DANCING'], ['FEEDBACK', 'FOREVER'], ['MOVE YOUR', 'BONES'],
    ['BASEMENT', 'HEAT'], ['LOUDER', 'CLOSER', 'LATER'],
  ];
  const SPARSE_HEADS = [
    ['STILL', 'HERE'], ['3 AM'], ['HUSH'], ['COME DOWN', 'SLOW'], ['AFTER', 'HOURS'], ['HUM'],
  ];
  const LABELS = [
    'NIGHT NOISE  no.7  20p', 'NIGHT NOISE  no.8  free', 'NIGHT NOISE  no.9  pay what u can',
    'NIGHT NOISE  special issue', 'NIGHT NOISE  no.11  copy + pass on',
  ];
  const MARCH = ['LOUDER', 'CLOSER', 'LATER', 'AGAIN', 'ALL NIGHT', 'EVERYBODY IN'];
  const STICKERS = [['FREE', 'TAKE 1'], ['DO NOT', 'FOLD'], ['COPY', 'ME'], ['PASS', 'IT ON']];
  const COPY =
    'we got in through the side door at eleven and the room was already hot. somebody had taped foil over the windows ' +
    'so the street could not see us and we could not see the street. the first record was too loud xxxxxxx exactly loud enough. ' +
    'the speakers were borrowed, the lights were one red bulb and a bike lamp, the floor was sticky and nobody cared. ' +
    'you do not need a stage. you need a wall to lean on, a friend with a tape deck, and a kick drum that keeps going. ' +
    'at two the bass came back in and the whole room went up at once, like a wave in a bath. at three we traded shirts. ' +
    'at four the neighbours knocked and we turned it down xxxx for a minute. this page was written on the night bus home. ' +
    'photocopy it. leave it on a seat. the next one is somewhere else. bring someone who has never been. ';

  const BEAT = 60 / 124;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeInOut = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  // The coded paste-up. Red is tone (0 black toner, 255 bare paper); green
  // marks photo areas the copier screens as halftone; blue marks coloured
  // stock. Paste-up is opaque paper over paper, so plain source-over painting
  // of these codes behaves exactly like glue.
  const PAPER = 'rgb(255,0,0)', INK = 'rgb(0,0,0)', ACC = 'rgb(255,0,255)', ACCINK = 'rgb(0,0,255)';
  const tone = (v) => 'rgb(' + (v | 0) + ',0,0)';
  const photo = (v, a) => (a === undefined ? 'rgb(' + (v | 0) + ',255,0)' : 'rgba(' + (v | 0) + ',255,0,' + a.toFixed(3) + ')');

  // A torn or scissor-cut polygon around a w×h rectangle.
  function cutRect(rng, w, h, step, amp) {
    const pts = [];
    const edge = (x0, y0, x1, y1, nx, ny) => {
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
      for (let i = 0; i < n; i++) {
        const u = i / n, j = (rng() - 0.5) * 2 * amp;
        pts.push([lerp(x0, x1, u) + nx * j, lerp(y0, y1, u) + ny * j]);
      }
    };
    edge(0, 0, w, 0, 0, 1); edge(w, 0, w, h, 1, 0); edge(w, h, 0, h, 0, 1); edge(0, h, 0, 0, 1, 0);
    return pts;
  }
  function polyPath(g, pts, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + ox, pts[i][1] + oy);
    g.closePath();
  }
  // A marker line with a little hand wobble.
  function wobbleLine(rng, x0, y0, x1, y1, n, amp) {
    const pts = [], nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
    const ph = rng() * 6.28;
    for (let i = 0; i <= n; i++) {
      const u = i / n, w = Math.sin(u * 3.1 + ph) * amp + (rng() - 0.5) * amp * 0.4;
      pts.push([lerp(x0, x1, u) + nx / L * w, lerp(y0, y1, u) + ny / L * w]);
    }
    return pts;
  }

  // ------------------------------------------------------------ copier shader
  const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_res;
uniform float u_k, u_pitch, u_ang, u_gain, u_grit, u_gen, u_speck, u_time, u_scan, u_seed;
uniform vec3 u_paper, u_ink, u_acc;
out vec4 o;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + 1.0), f.x), f.y); }
void main(){
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / u_res;
  vec2 v = px / u_k;
  vec3 c = texture(u_src, uv).rgb;
  // Toner spread: the copy is a little fatter and rounder than the original.
  vec2 d = vec2((0.35 + 0.6 * u_gen * u_grit) * u_k) / u_res;
  float t4 = (texture(u_src, uv + vec2(d.x, 0)).r + texture(u_src, uv - vec2(d.x, 0)).r +
              texture(u_src, uv + vec2(0, d.y)).r + texture(u_src, uv - vec2(0, d.y)).r) * 0.25;
  float dark = 1.0 - mix(c.r, t4, 0.45);
  float dens = vn(v / 38.0 + u_seed) * 0.6 + vn(v / 9.0 + u_seed * 1.7) * 0.4;
  // Static grain: the paper and drum, not animated, so greys stipple without shimmering.
  float grain = h21(floor(px) + u_seed * 31.0);
  float thr = 0.5 + (dens - 0.5) * 0.3 * u_grit + (grain - 0.5) * (0.45 + 0.4 * u_grit);
  float inkT = smoothstep(thr - 0.05, thr + 0.05, dark);
  // Halftone: a rotated dot screen, dots fattened by the bass.
  float ca = cos(u_ang), sa = sin(u_ang);
  vec2 q = mat2(ca, -sa, sa, ca) * px / u_pitch;
  vec2 f = fract(q) - 0.5;
  float dh = clamp((dark - 0.5) * (1.35 + 0.5 * u_gain) + 0.5 + 0.14 * u_gain, 0.0, 1.0);
  float rad = sqrt(dh) * 0.73 * (1.0 + (dens - 0.5) * 0.3 * u_grit);
  float aa = 1.0 / u_pitch;
  float inkH = 1.0 - smoothstep(rad - aa, rad + aa, length(f));
  float ink = mix(inkT, inkH, step(0.5, c.g));
  // Wear: white dropouts bitten out of solid toner.
  float drop = smoothstep(0.7, 0.9, vn(v / 5.0 + u_seed * 3.0)) * step(0.5, grain) * (0.3 + 0.7 * u_gen) * u_grit;
  ink *= 1.0 - drop * 0.9;
  // Drum streaks: a few speckled vertical bands that wander slowly.
  float W = u_res.x / u_k, H = u_res.y / u_k;
  float streak = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float xs = h21(vec2(fi, u_seed)) * W + sin(u_time * 0.05 + fi * 2.0) * 8.0;
    float wd = 0.7 + 3.0 * h21(vec2(fi, 7.0 + u_seed));
    float dx = (v.x - xs) / wd;
    streak += exp(-dx * dx) * (0.25 + 0.5 * vn(vec2(fi * 10.0, v.y / 40.0 + u_time * 0.15)));
  }
  ink = max(ink, step(grain, streak * (0.25 + 0.3 * u_gen) * u_grit));
  // The lid never quite shuts: grey streaky border.
  float de = min(min(v.x, v.y), min(W - v.x, H - v.y));
  float edge = exp(-de / 3.2) * (0.5 + 0.5 * vn(vec2(v.x / 3.0, v.y / 60.0)));
  ink = max(ink, step(grain, edge * (0.5 + 0.5 * u_grit)));
  // Copier dust: sparse specks re-rolled a few times a second with the hats,
  // plus a fixed scatter baked into this generation.
  float ts = mod(floor(u_time * 8.0), 61.0);
  float sp = h21(floor(v / 2.0) * 0.731 + vec2(ts * 13.17, ts * 7.31) + 0.5);
  ink = max(ink, step(1.0 - u_speck * 0.003, sp));
  ink = max(ink, step(0.9994 - 0.0008 * u_gen, h21(floor(v / 1.5) + u_seed * 7.0)));
  vec3 paper = mix(u_paper, u_acc, clamp(c.b, 0.0, 1.0)) * (0.975 + 0.035 * dens);
  vec3 col = mix(paper, u_ink, clamp(ink, 0.0, 1.0) * 0.97);
  // The scan light: a pale green-white bar with a soft spill.
  if (u_scan > -1000.0) {
    float sx = (px.x - u_scan) / u_k;
    col = mix(col, vec3(0.93, 1.0, 0.95), exp(-sx * sx / 14.0) * 0.92);
    col = mix(col, vec3(0.86, 0.97, 0.9), exp(-sx * sx / 700.0) * 0.3);
  }
  o = vec4(col, 1.0);
}`;

  VIZ.register({
    id: 'zine',
    name: 'Zine',
    order: 511,
    params: [
      { key: 'reaction', label: 'Reaction', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'grit', label: 'Copier grit', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'screen', label: 'Halftone coarseness', type: 'range', min: 2.5, max: 10, default: 4.2, step: 0.1 },
      { key: 'bars', label: 'Re-copy every (bars)', type: 'range', min: 4, max: 64, default: 16, step: 1 },
      { key: 'stock', label: 'Paper stock', type: 'select', options: PAPERS.map((q) => q.name), default: 0 },
      { key: 'subject', label: 'Photo', type: 'select', options: SUBJECTS, default: 0 },
      { key: 'headline', label: 'Headline (blank = rotate, / breaks line)', type: 'text', default: '' },
    ],
    actions: [
      { id: 'recopy', label: 'Re-copy the page', run() { this.wantCopy = true; } },
    ],
    gallery: {
      title: 'Zine',
      technique: 'Canvas 2D paste-up drawn as a coded image (tone / halftone flag / coloured-stock flag), run through a WebGL2 "copier" shader: toner spread and noisy threshold, rotated halftone screen, wear dropouts, drum streaks, lid shadow, dust and a scan-light wipe between pages',
      brief: 'A punk photocopy fanzine page that comes to life. Ransom-note headline letters cut from different magazines on scraps of card, a coarse halftone photo (a pogoing crowd, a spinning record, tower blocks at night) torn out and taped down, safety pins, a typewritten column that keeps typing, marker scrawls, toner streaks and copier dust, black toner on one colour of stock. Each kick re-cuts one headline letter and slaps the new scrap down, and the front of the crowd pogos; each clap draws a marker gesture (a ring, an arrow, an underline, a star) or adds a tally mark; the bass fattens the halftone dots; hats make copier dust flicker and windows trade places; the energy speeds the typing and the spinning record. The drop is a re-copy: the copier light sweeps across and leaves a denser paste-up with a second photo, a bigger headline, fluoro stock, pins and a marching tape; the breakdown is re-copied back to a sparse sheet.',
      lineage: [
        'Descends from the late-70s and 80s punk and DIY fanzine: scissors-and-glue paste-up, ransom-note lettering cut from magazines, halftone photos copied until they turn to dots and soot, typewriter text, marker, tape and safety pins, all flattened by a cheap photocopier into one black on whatever paper was to hand. Evoked, not copied: every word is original and the zine name is invented.',
        'Process: to keep it distinct from the Grunge poster (magazine offset, several inks, sliding type bands) the look is carried by the copier rather than by layered type: everything is drawn as a coded paste-up and a shader decides what the copier does with it, so greys become stipple, edges go crunchy, photos become a real dot screen and solids get worn. The kick was kept to one letter at a time (the headline re-cuts itself letter by letter, a wave of changing faces that stays legible) plus the crowd pogo inside the photo, so it lands in two small places; the clap got a different verb (a hand with a marker); the drop and breakdown are page turns via the copier\'s light bar rather than cuts. Continuous motion comes from the typing, the record, the marching tape, a slowly rotating dot screen (a faint moiré over the photos) and the crowd.',
        'Iterations: v1 had marker scrawls that never showed in the drop (a black ring on a black record, and a target index that always picked the same photo), copier-dust specks that lined up in rows (float precision in the hash), a lid shadow too wide, a crowd too dark to read and a lowercase l that read as I; fixed with a white paint pen on photos, a cycling target, a smaller hash domain, a narrower lid shadow, a backlit haze behind black silhouettes and caps-only L and I. The first jolt run caught the drop\'s page-turn light bar still sweeping at the first measured kick, so the drop switch was made quicker. The breakdown page had a dead hole under a short headline, so the column now tucks up under it.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.st) this.init(); },

    init() {
      this.st = {
        rng: mulberry(0x21e5),
        prev: new Float32Array(9), lastKick: -9, lastSnare: -9, kickCount: 0, snareCount: 0,
        lowEnv: 0, bassEnv: 0, hatEnv: 0, energy: 0, dense: false,
        page: null, old: null, scanT0: -9, lastCopy: 0, kicksSinceCopy: 0, gen: 0,
        headIdx: [0, 0], subjIdx: 0, lastT: null, clk: 0, typed: 0, spin: 0, march: 0,
      };
      this.wantCopy = false;
      this.metrics = new Map();
    },

    // ----------------------------------------------------------------- letters
    measure(g, F, ch) {
      const key = F[0] + '|' + ch;
      let m = this.metrics.get(key);
      if (m) return m;
      g.font = fontStr(F, 100);
      const mm = g.measureText(ch);
      m = {
        L: mm.actualBoundingBoxLeft || 0, R: mm.actualBoundingBoxRight || mm.width,
        A: mm.actualBoundingBoxAscent || 72, D: mm.actualBoundingBoxDescent || 0,
      };
      const ok = !window.VIZ_FONTS || window.VIZ_FONTS.has(F[0]);
      if (ok) this.metrics.set(key, m);
      return m;
    },

    recut(L, rng, dense) {
      L.face = FACES[Math.floor(rng() * FACES.length)];
      const r = rng();
      L.style = r < 0.46 ? 'paper' : r < 0.72 ? 'black' : r < 0.86 ? 'grey' : dense ? 'acc' : 'paper';
      L.lower = /[A-HJKM-Z]/.test(L.ch) && rng() < 0.22;
      L.rot = (rng() - 0.5) * 0.24;
      L.dy = (rng() - 0.5) * 0.12;
      L.sc = 0.86 + rng() * 0.22;
      L.pad = 0.02 + rng() * 0.16;
      L.cut = [];
      for (let i = 0; i < 8; i++) L.cut.push((rng() - 0.5) * 0.09);
      L.fill = 0.72 + rng() * 0.2;
    },

    // ------------------------------------------------------------------ layout
    // A page is generated whole from a seed at each re-copy. Positions are
    // fractions of the stage so it composes at 16:9 and square alike.
    makePage(W, H, dense, params, t) {
      const st = this.st, rng = st.rng;
      const wide = W / H > 1.3;
      const custom = (params.headline || '').trim().toUpperCase();
      let lines;
      if (custom) {
        lines = custom.includes('/') ? custom.split('/').map((s) => s.trim()).filter(Boolean) : custom.split(/\s+/);
        if (!custom.includes('/') && lines.length > 3) lines = [lines.slice(0, Math.ceil(lines.length / 2)).join(' '), lines.slice(Math.ceil(lines.length / 2)).join(' ')];
      } else {
        const pool = dense ? DENSE_HEADS : SPARSE_HEADS, k = dense ? 0 : 1;
        lines = pool[st.headIdx[k] % pool.length]; st.headIdx[k]++;
      }
      const subjPick = (n) => {
        const fixed = params.subject | 0;
        if (fixed > 0 && n === 0) return fixed - 1;
        const s = (st.subjIdx + n) % 3; return s;
      };
      const sA = subjPick(0), sB = (sA + 1 + (rng() < 0.5 ? 0 : 1)) % 3;
      if ((params.subject | 0) === 0) st.subjIdx = (st.subjIdx + 1) % 3;

      const P = { t0: t, dense, W, H, lines, seed: (rng() * 1e9) | 0 };
      P.rot = (rng() - 0.5) * 0.02; P.ox = (rng() - 0.5) * 10; P.oy = (rng() - 0.5) * 8;
      const photoAt = (subj, x, y, w, h, rot) => ({
        subj, x, y, w, h, rot, seed: (rng() * 1e9) | 0,
        torn: cutRect(mulberry((rng() * 1e9) | 0), w, h, 10, 3.2),
        tape: [rng() < 0.8, rng() < 0.6, rng() < 0.5],
        tapeRot: [(rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5],
      });
      let head, col, tally, label;
      P.photos = [];
      if (wide) {
        if (dense) {
          P.photos.push(photoAt(sA, W * 0.47, H * 0.05, W * 0.49, H * 0.63, (rng() - 0.5) * 0.06));
          P.photos.push(photoAt(sB, W * 0.3, H * 0.62, W * 0.25, H * 0.33, (rng() - 0.5) * 0.12 + 0.05));
          head = { x: W * 0.035, y: H * 0.07, w: W * 0.6, L: H * 0.2 };
          col = { x: W * 0.04, y: H * 0.66, w: W * 0.235, h: H * 0.3 };
          tally = { x: W * 0.6, y: H * 0.78 };
          label = { x: W * 0.62, y: H * 0.72 };
        } else {
          P.photos.push(photoAt(sA, W * 0.53, H * 0.1, W * 0.41, H * 0.64, (rng() - 0.5) * 0.07));
          head = { x: W * 0.06, y: H * 0.12, w: W * 0.42, L: H * 0.25 };
          col = { x: W * 0.06, y: H * 0.62, w: W * 0.36, h: H * 0.32 };
          tally = { x: W * 0.56, y: H * 0.86 };
          label = { x: W * 0.62, y: H * 0.8 };
        }
      } else {
        P.photos.push(photoAt(sA, W * 0.42, H * 0.05, W * 0.54, H * 0.46, (rng() - 0.5) * 0.06));
        if (dense) P.photos.push(photoAt(sB, W * 0.04, H * 0.3, W * 0.34, H * 0.24, (rng() - 0.5) * 0.12));
        head = { x: W * 0.05, y: H * 0.57, w: W * 0.9, L: H * (dense ? 0.14 : 0.12) };
        col = { x: W * 0.05, y: H * 0.05, w: W * 0.33, h: H * (dense ? 0.22 : 0.44) };
        tally = { x: W * 0.62, y: H * 0.92 };
        label = { x: W * 0.46, y: H * 0.52 };
      }

      // Headline slots: every letter owns a fixed slot so a re-cut never
      // reflows its neighbours.
      const slotW = (ch) => (ch === ' ' ? 0.36 : /[IJ1!]/.test(ch) ? 0.5 : /[MW&]/.test(ch) ? 0.95 : 0.74);
      const letters = [], lineBoxes = [];
      let units = 0;
      for (const ln of lines) { let u = 0; for (const ch of ln) u += slotW(ch) + 0.06; units = Math.max(units, u); }
      const S = Math.min(head.L, head.w / units);
      let y = head.y + S * 0.55;
      lines.forEach((ln, li) => {
        let x = head.x + (li % 2 ? S * (0.2 + rng() * 0.5) : rng() * S * 0.2);
        const x0 = x;
        for (const ch of ln) {
          const sw = slotW(ch) * S;
          if (ch !== ' ') {
            const L = { ch, x: x + sw / 2, y: y + (rng() - 0.5) * S * 0.08, sw, S, slapT: -9, line: li };
            this.recut(L, rng, dense);
            letters.push(L);
          }
          x += sw + 0.06 * S;
        }
        lineBoxes.push({ x: x0 - S * 0.1, y: y - S * 0.55, w: x - x0 + S * 0.1, h: S * 1.1 });
        y += S * 1.12;
      });
      P.head = { letters, S, boxes: lineBoxes };
      // A short sparse headline would leave a hole above the column: tuck
      // the column up under whatever the headline turned out to be.
      if (wide && !dense) { col.y = Math.min(H * 0.62, y - S * 0.35 + H * 0.05); col.h = H * 0.95 - col.y; }
      P.col = col; P.tally = tally;
      P.label = { x: label.x, y: label.y, text: pick(rng, LABELS), rot: (rng() - 0.5) * 0.06 };

      // Coloured stock, only in the drop.
      P.strips = [];
      if (dense) {
        const b = lineBoxes[lineBoxes.length > 1 ? 1 : 0];
        P.strips.push({
          x: b.x - S * 0.25, y: b.y - S * 0.08, w: b.w + S * 0.5, h: b.h + S * 0.16, rot: (rng() - 0.5) * 0.06,
          torn: cutRect(mulberry((rng() * 1e9) | 0), b.w + S * 0.5, b.h + S * 0.16, 14, 4),
        });
        const ph = P.photos[0];
        P.sticker = { x: ph.x + ph.w * (0.78 + rng() * 0.05), y: ph.y + ph.h * 0.1, r: H * 0.075, words: pick(rng, STICKERS), rot: (rng() - 0.5) * 0.5 };
        P.tape = wide
          ? { x: W * 0.6, y: H * 0.905, w: W * 0.46, h: H * 0.068, rot: -0.05 }
          : { x: W * 0.02, y: H * 0.86, w: W * 1.0, h: H * 0.06, rot: -0.04 };
        P.tape.word = pick(rng, MARCH);
      }
      // Safety pins through the photos.
      P.pins = P.photos.map((ph, i) => ({
        x: ph.x + (i ? ph.w * 0.85 : ph.w * 0.08), y: ph.y + ph.h * (i ? 0.1 : 0.04),
        rot: (i ? 0.5 : -0.35) + (rng() - 0.5) * 0.4, len: H * 0.12, show: dense || i === 0,
      }));
      // Where a marker gesture can land.
      P.targets = lineBoxes.map((b) => b).concat(P.photos.map((ph) => ({
        x: ph.x + ph.w * (0.25 + rng() * 0.3), y: ph.y + ph.h * (0.3 + rng() * 0.3), w: ph.w * 0.3, h: ph.h * 0.25,
      })));
      P.scrawls = []; P.tallies = [];
      P.typedStart = st.typed;
      return P;
    },

    recopy(t, params, W, H) {
      const st = this.st;
      st.old = st.page;
      st.gen = st.gen >= 6 ? 0 : st.gen + 1;
      st.page = this.makePage(W, H, st.dense, params, t);
      st.scanT0 = st.old ? t : -9;
      st.lastCopy = t; st.kicksSinceCopy = 0;
    },

    // ---------------------------------------------------------------- analysis
    analyse(s, t, dt, params, W, H) {
      const st = this.st;
      if (s[0] > 45 && s[0] - st.prev[0] > 14 && t - st.lastKick > 0.22) {
        st.lastKick = t; st.kickCount++; st.kicksSinceCopy++;
        this.onKick(t);
      }
      if (s[4] > 38 && s[4] - st.prev[4] > 15 && t - st.lastSnare > 0.14) {
        st.lastSnare = t; st.snareCount++;
        this.onClap(t);
      }
      st.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      const low = Math.max(s[0], s[1]) / 100;
      st.lowEnv += (low - st.lowEnv) * k(0.4);
      // Slow enough that the sidechain pump reads as a swell, not a thump.
      st.bassEnv += (low - st.bassEnv) * k(0.45);
      const hat = Math.max(s[6], s[7], s[8]) / 100;
      st.hatEnv += (hat - st.hatEnv) * (hat > st.hatEnv ? k(0.01) : k(0.08));
      const e = clamp(0.5 * low + 0.3 * hat + 0.3 * (s[2] + s[3]) / 200, 0, 1);
      st.energy += (e - st.energy) * k(1.5);
      if (!st.dense && st.lowEnv > 0.34) { st.dense = true; this.wantCopy = true; }
      else if (st.dense && st.lowEnv < 0.18) { st.dense = false; this.wantCopy = true; }
      // The page turns on its own every so many bars (by kicks when there is
      // a beat, by the clock when there is not).
      const bars = params.bars;
      if (st.kicksSinceCopy >= bars * 4 || t - st.lastCopy > bars * 4 * BEAT * 1.6) this.wantCopy = true;
    },

    onKick(t) {
      const st = this.st, P = st.page;
      if (!P) return;
      const Ls = P.head.letters;
      // One letter per headline line in the drop, one in total otherwise.
      const nLines = P.lines.length;
      const per = P.dense ? nLines : 1;
      for (let j = 0; j < per; j++) {
        const onLine = P.dense ? Ls.filter((L) => L.line === j) : Ls;
        if (!onLine.length) continue;
        const L = onLine[(st.kickCount * (P.dense ? 1 : 3) + j * 2) % onLine.length];
        this.recut(L, st.rng, P.dense);
        L.slapT = t; L.slapDir = st.rng() < 0.5 ? -1 : 1;
      }
    },

    onClap(t) {
      const st = this.st, P = st.page, rng = st.rng;
      if (!P) return;
      if (P.scrawls.length >= (P.dense ? 4 : 3)) {
        P.tallies.push({ t0: t, j: (rng() - 0.5) });
        if (P.tallies.length > 20) P.tallies.length = 0;
        return;
      }
      const ti = (P.scrawls.length + (P.seed % 7)) % P.targets.length, tg = P.targets[ti];
      // On a photo the marker would vanish into the dark halftone, so it is
      // a white paint pen there, as zine makers used.
      const onPhoto = ti >= P.head.boxes.length;
      const kinds = ['ring', 'under', 'arrow', 'star', 'ring', 'cross'];
      const kind = kinds[(st.snareCount + (rng() * 2 | 0)) % kinds.length];
      const polys = [];
      const cx = tg.x + tg.w / 2, cy = tg.y + tg.h / 2;
      if (kind === 'ring') {
        const rx = tg.w / 2 + 12, ry = tg.h / 2 + 10, a0 = rng() * 6.28, turns = 1.12 + rng() * 0.12;
        const pts = [];
        for (let i = 0; i <= 48; i++) {
          const a = a0 + (i / 48) * turns * Math.PI * 2, wob = 1 + (rng() - 0.5) * 0.04 + 0.05 * Math.sin(a * 2 + a0);
          pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob + (i / 48) * 6]);
        }
        polys.push(pts);
      } else if (kind === 'under') {
        polys.push(wobbleLine(rng, tg.x, tg.y + tg.h + 4, tg.x + tg.w, tg.y + tg.h + 1, 14, 2));
        polys.push(wobbleLine(rng, tg.x + tg.w * 0.95, tg.y + tg.h + 10, tg.x + tg.w * 0.05, tg.y + tg.h + 12, 14, 2));
      } else if (kind === 'arrow') {
        const ex = tg.x - 6, ey = cy, sx = ex - 70 - rng() * 40, sy = ey + (rng() < 0.5 ? -1 : 1) * (40 + rng() * 30);
        const pts = [];
        for (let i = 0; i <= 18; i++) {
          const u = i / 18, bow = Math.sin(u * Math.PI) * 26;
          pts.push([lerp(sx, ex, u), lerp(sy, ey, u) - bow]);
        }
        polys.push(pts);
        const a = Math.atan2(ey - pts[16][1], ex - pts[16][0]);
        polys.push([[ex - Math.cos(a - 0.5) * 18, ey - Math.sin(a - 0.5) * 18], [ex, ey], [ex - Math.cos(a + 0.5) * 18, ey - Math.sin(a + 0.5) * 18]]);
      } else if (kind === 'star') {
        const sx = tg.x + tg.w + 18, sy = tg.y + 6, r = 20, pts = [];
        for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; pts.push([sx + Math.cos(a) * r + (rng() - 0.5) * 3, sy + Math.sin(a) * r + (rng() - 0.5) * 3]); }
        polys.push(pts);
      } else {
        const r = Math.min(tg.w, tg.h) * 0.5;
        polys.push(wobbleLine(rng, cx - r, cy - r, cx + r, cy + r, 10, 3));
        polys.push(wobbleLine(rng, cx + r, cy - r, cx - r, cy + r, 10, 3));
      }
      let n = 0; for (const q of polys) n += q.length;
      P.scrawls.push({ t0: t, polys, n, w: 6 + rng() * 2, white: onPhoto });
    },

    // ----------------------------------------------------------------- drawing
    drawLetter(g, L, t, react) {
      const since = t - L.slapT;
      const lift = since >= 0 && since < 0.3 ? Math.pow(1 - easeOut(since / 0.2), 1) * (since < 0.2 ? 1 : 0) : 0;
      const S = L.S, bw = L.sw * (1 + L.pad), bh = S * (0.98 + L.pad);
      g.save();
      g.translate(L.x, L.y + L.dy * S - lift * S * 0.06 * react);
      g.rotate(L.rot + lift * 0.18 * react * (L.slapDir || 1));
      const sc = 1 + lift * 0.22 * react;
      g.scale(sc, sc);
      const c = L.cut, hw = bw / 2, hh = bh / 2;
      const pts = [[-hw + c[0] * S, -hh + c[1] * S], [hw + c[2] * S, -hh + c[3] * S], [hw + c[4] * S, hh + c[5] * S], [-hw + c[6] * S, hh + c[7] * S]];
      // Paste-up shadow: the copier sees the edge of the scrap as a grey line.
      const so = 1.6 + lift * 9 * react;
      g.fillStyle = tone(lift > 0 ? 110 : 70);
      polyPath(g, pts, so * 0.8, so);
      g.fill();
      g.fillStyle = L.style === 'black' ? INK : L.style === 'grey' ? photo(200) : L.style === 'acc' ? ACC : PAPER;
      polyPath(g, pts);
      g.fill();
      const F = L.face, ch = L.lower ? L.ch.toLowerCase() : L.ch;
      const m = this.measure(g, F, ch);
      const gw = m.L + m.R, gh = m.A + m.D;
      const k = Math.min(bw * 0.84 / gw, bh * L.fill / gh) * L.sc;
      g.font = fontStr(F, 100);
      g.fillStyle = L.style === 'black' ? PAPER : L.style === 'acc' ? ACCINK : INK;
      g.scale(k, k);
      g.fillText(ch, (m.L - m.R) / 2, (m.A - m.D) / 2);
      g.restore();
    },

    drawPhoto(g, ph, t, P) {
      const st = this.st;
      g.save();
      g.translate(ph.x + ph.w / 2, ph.y + ph.h / 2);
      g.rotate(ph.rot);
      g.translate(-ph.w / 2, -ph.h / 2);
      g.fillStyle = tone(80);
      polyPath(g, ph.torn, 2, 2.5); g.fill();
      g.save();
      polyPath(g, ph.torn); g.clip();
      if (ph.subj === 0) this.crowd(g, ph, t);
      else if (ph.subj === 1) this.record(g, ph, t);
      else this.towers(g, ph, t);
      g.restore();
      // Tape: copies as a pale stippled haze with darker edges.
      const tp = [[ph.w * 0.9, -4], [ph.w * 0.05, ph.h + 2], [ph.w * 0.5, -6]];
      for (let i = 0; i < 3; i++) {
        if (!ph.tape[i] || (i === 2 && !P.dense)) continue;
        g.save();
        g.translate(tp[i][0], tp[i][1]);
        g.rotate((i === 0 ? 0.7 : i === 1 ? 0.6 : 0) + ph.tapeRot[i]);
        g.fillStyle = tone(212);
        g.fillRect(-34, -11, 68, 22);
        g.fillStyle = tone(150);
        g.fillRect(-34, -11, 68, 1.2); g.fillRect(-34, 9.8, 68, 1.2);
        g.restore();
      }
      g.restore();
    },

    crowd(g, ph, t) {
      const st = this.st, w = ph.w, h = ph.h, rng = mulberry(ph.seed);
      let gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, photo(60)); gr.addColorStop(0.55, photo(150)); gr.addColorStop(1, photo(205));
      g.fillStyle = gr; g.fillRect(-4, -4, w + 8, h + 8);
      // Stage lights: two beams and a hot spot behind the crowd.
      const lx = w * (0.35 + rng() * 0.3);
      for (let b = 0; b < 3; b++) {
        const ang = -0.5 + b * 0.5 + Math.sin(t * 0.3 + b) * 0.08;
        const g2 = g.createLinearGradient(lx, 0, lx + Math.sin(ang) * h, h);
        g2.addColorStop(0, photo(240, 0.85)); g2.addColorStop(1, photo(120, 0));
        g.fillStyle = g2;
        g.beginPath(); g.moveTo(lx - 6, -2); g.lineTo(lx + 6, -2);
        g.lineTo(lx + Math.sin(ang) * h * 1.2 + h * 0.18, h * 1.2); g.lineTo(lx + Math.sin(ang) * h * 1.2 - h * 0.18, h * 1.2);
        g.fill();
      }
      const rg = g.createRadialGradient(lx, h * 0.05, 0, lx, h * 0.05, h * 0.55);
      rg.addColorStop(0, photo(250, 0.95)); rg.addColorStop(1, photo(150, 0));
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
      // Figures, back rows lighter (haze), the front row black and cropped.
      const kickSince = t - st.lastKick;
      const react = this.react;
      const rows = [
        { y: 0.5, s: 0.08, tone: 95, n: 11, jump: 0.35 },
        { y: 0.64, s: 0.11, tone: 45, n: 8, jump: 0.7 },
        { y: 0.8, s: 0.16, tone: 4, n: 5, jump: 1 },
      ];
      for (const R of rows) {
        const sz = h * R.s * 1.5;
        g.fillStyle = photo(R.tone); g.strokeStyle = photo(R.tone);
        g.lineCap = 'round'; g.lineJoin = 'round';
        for (let i = 0; i < R.n; i++) {
          const fx = (i + 0.5 + (rng() - 0.5) * 0.7) / R.n * w * 1.08 - w * 0.04;
          const ph0 = rng() * 6.28, delay = rng() * 0.09, arms = rng();
          const u = (kickSince - delay) / 0.36;
          const jump = u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0;
          const bob = Math.sin(t * 2.1 + ph0) * 0.04 * (0.4 + st.bassEnv);
          const fy = h * R.y - (jump * 0.32 * R.jump * react + bob) * sz;
          const hr = sz * 0.2;
          // Body and shoulders.
          g.beginPath();
          g.ellipse(fx, fy + sz * 0.62, sz * 0.36, sz * 0.4, 0, Math.PI, 0);
          g.lineTo(fx + sz * 0.4, fy + sz * 2); g.lineTo(fx - sz * 0.4, fy + sz * 2);
          g.fill();
          g.beginPath(); g.arc(fx, fy + sz * 0.22, hr, 0, Math.PI * 2); g.fill();
          // Arms up for some, swaying with the pad.
          g.lineWidth = sz * 0.13;
          const sway = Math.sin(t * 1.3 + ph0) * (0.15 + 0.25 * st.energy) + jump * 0.25;
          const armUp = (side) => {
            const sx = fx + side * sz * 0.3, sy = fy + sz * 0.55;
            const a = -Math.PI / 2 + side * (0.35 + sway * side);
            const ex = sx + Math.cos(a + side * 0.4) * sz * 0.45, ey = sy + Math.sin(a + side * 0.4) * sz * 0.45;
            const hx = ex + Math.cos(a) * sz * 0.5, hy = ey + Math.sin(a) * sz * 0.5;
            g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
            g.beginPath(); g.arc(hx, hy, sz * 0.08, 0, Math.PI * 2); g.fill();
          };
          if (arms < 0.55) armUp(-1);
          if (arms > 0.35) armUp(1);
        }
      }
    },

    record(g, ph, t) {
      const st = this.st, w = ph.w, h = ph.h;
      let gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, photo(205)); gr.addColorStop(1, photo(150));
      g.fillStyle = gr; g.fillRect(-4, -4, w + 8, h + 8);
      const R = Math.min(w, h) * 0.5, cx = w * 0.46, cy = h * 0.54;
      // Platter with strobe dots on its rim.
      g.fillStyle = photo(40); g.beginPath(); g.arc(cx, cy, R * 1.02, 0, Math.PI * 2); g.fill();
      const rot = st.spin;
      g.fillStyle = photo(185);
      for (let i = 0; i < 60; i++) {
        const a = rot * 0.999 + i / 60 * Math.PI * 2;
        g.fillRect(cx + Math.cos(a) * R * 0.985 - 1.2, cy + Math.sin(a) * R * 0.985 - 1.2, 2.4, 2.4);
      }
      g.fillStyle = photo(14); g.beginPath(); g.arc(cx, cy, R * 0.94, 0, Math.PI * 2); g.fill();
      // Grooves and the gaps between tracks.
      g.lineWidth = 1.1;
      for (let i = 0; i < 26; i++) {
        const r = R * (0.37 + i / 26 * 0.56);
        g.strokeStyle = i % 7 === 3 ? photo(95) : photo(i % 2 ? 42 : 26);
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      }
      // The sheen: two fixed light wedges, as from a window.
      if (g.createConicGradient) {
        const cg = g.createConicGradient(-0.6, cx, cy);
        cg.addColorStop(0, photo(200, 0)); cg.addColorStop(0.06, photo(200, 0.75)); cg.addColorStop(0.13, photo(200, 0));
        cg.addColorStop(0.5, photo(200, 0)); cg.addColorStop(0.56, photo(200, 0.6)); cg.addColorStop(0.63, photo(200, 0));
        cg.addColorStop(1, photo(200, 0));
        g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, R * 0.93, 0, Math.PI * 2); g.arc(cx, cy, R * 0.35, 0, Math.PI * 2, true); g.fill();
      }
      // Label, rotating: text round the rim and a bold mark.
      g.save();
      g.translate(cx, cy); g.rotate(rot);
      g.fillStyle = photo(225); g.beginPath(); g.arc(0, 0, R * 0.34, 0, Math.PI * 2); g.fill();
      g.fillStyle = photo(20);
      g.beginPath(); g.arc(0, 0, R * 0.34, -0.4, 0.9); g.arc(0, 0, R * 0.2, 0.9, -0.4, true); g.fill();
      g.font = '700 ' + (R * 0.06).toFixed(1) + 'px "Space Mono", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const txt = 'SIDE A  33 RPM  PLAY LOUD  ';
      for (let i = 0; i < txt.length; i++) {
        const a = 1.2 + i / txt.length * Math.PI * 1.45;
        g.save(); g.rotate(a); g.translate(0, -R * 0.27); g.fillText(txt[i], 0, 0); g.restore();
      }
      g.font = (R * 0.13).toFixed(1) + 'px "Rubik Mono One", sans-serif';
      g.fillText('N/N', 0, R * 0.12);
      g.fillStyle = photo(5); g.beginPath(); g.arc(0, 0, R * 0.025, 0, Math.PI * 2); g.fill();
      // A scratch that goes round with it.
      g.strokeStyle = photo(120); g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, R * 0.7, 2.1, 2.5); g.stroke();
      g.restore();
      // Tonearm.
      const px0 = cx + R * 1.12, py0 = cy - R * 0.85;
      g.fillStyle = photo(60); g.beginPath(); g.arc(px0, py0, R * 0.12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = photo(235); g.lineWidth = R * 0.035; g.lineCap = 'round';
      const ax = cx + R * 0.55, ay = cy + R * 0.42;
      g.beginPath(); g.moveTo(px0, py0); g.quadraticCurveTo(cx + R * 1.0, cy + R * 0.2, ax, ay); g.stroke();
      g.save(); g.translate(ax, ay); g.rotate(0.9); g.fillStyle = photo(30); g.fillRect(-R * 0.06, -R * 0.1, R * 0.12, R * 0.2); g.restore();
    },

    towers(g, ph, t) {
      const st = this.st, w = ph.w, h = ph.h, rng = mulberry(ph.seed);
      let gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, photo(18)); gr.addColorStop(0.75, photo(85)); gr.addColorStop(1, photo(60));
      g.fillStyle = gr; g.fillRect(-4, -4, w + 8, h + 8);
      const mx = w * (0.7 + rng() * 0.15), my = h * 0.2, mr = h * 0.08;
      const mg = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3);
      mg.addColorStop(0, photo(180, 0.8)); mg.addColorStop(1, photo(80, 0));
      g.fillStyle = mg; g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
      g.fillStyle = photo(240); g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      // Clouds drifting across the moon.
      for (let c = 0; c < 3; c++) {
        const cx = ((rng() * w + t * (4 + c * 3) * (0.5 + st.energy)) % (w * 1.6)) - w * 0.3, cy = h * (0.12 + c * 0.1);
        const cg = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.2);
        cg.addColorStop(0, photo(120, 0.6)); cg.addColorStop(1, photo(60, 0));
        g.fillStyle = cg; g.beginPath(); g.ellipse(cx, cy, w * 0.2, h * 0.05, 0, 0, Math.PI * 2); g.fill();
      }
      // Blocks.
      const kickSince = t - st.lastKick;
      const nb = 5;
      for (let b = 0; b < nb; b++) {
        const bx = w * (b / nb) + (rng() - 0.5) * w * 0.06, bw = w * (0.13 + rng() * 0.08);
        const top = h * (0.25 + rng() * 0.35), fl = Math.floor((h - top) / 11);
        g.fillStyle = photo(8 + b * 5); g.fillRect(bx, top, bw, h - top + 4);
        const cols = Math.max(3, Math.floor(bw / 9));
        const kickRow = Math.floor(hash2(b, st.kickCount, 5) * fl);
        for (let r = 0; r < fl; r++) {
          for (let c = 0; c < cols; c++) {
            const base = hash2(b * 97 + c, r, 1);
            const tick = Math.floor(t * 0.4 + base * 5);
            let lit = hash2(b * 97 + c, r * 31 + tick, 3) < 0.28 + 0.2 * st.energy;
            if (hash2(b * 97 + c, r + Math.floor(t * 8) * 7, 9) < st.hatEnv * 0.08) lit = !lit;
            let v = lit ? 215 : 30;
            if (r === kickRow && kickSince < 0.35 && b === st.kickCount % nb) v = lerp(250, v, easeOut(kickSince / 0.35));
            g.fillStyle = photo(v);
            g.fillRect(bx + 3 + c * (bw - 6) / cols, top + 5 + r * 11, (bw - 6) / cols - 3, 6);
          }
        }
      }
    },

    drawPin(g, pin) {
      if (!pin.show) return;
      g.save();
      g.translate(pin.x, pin.y); g.rotate(pin.rot);
      const L = pin.len;
      g.lineCap = 'round'; g.lineJoin = 'round';
      // Shadow first, then the steel with its bright highlight.
      g.strokeStyle = tone(110); g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(3, 3); g.lineTo(L + 3, 3 - 5); g.moveTo(3, 3 + 8); g.lineTo(L + 3, 3 + 8 - 3); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(L, -5);
      g.moveTo(0, 8); g.lineTo(L * 0.92, 5);
      g.stroke();
      g.beginPath(); g.arc(-2, 4, 5.5, Math.PI * 0.4, Math.PI * 1.65); g.stroke();
      g.strokeStyle = PAPER; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(4, -0.2); g.lineTo(L * 0.8, -4.2); g.stroke();
      // Clasp.
      g.fillStyle = INK;
      g.beginPath(); g.moveTo(L - 4, -9); g.lineTo(L + 9, -7); g.quadraticCurveTo(L + 14, 0, L + 8, 7); g.lineTo(L - 6, 7); g.closePath(); g.fill();
      g.fillStyle = PAPER; g.fillRect(L - 2, -4, 9, 1.4);
      g.restore();
    },

    drawColumn(g, P, t, dt) {
      const st = this.st, C = P.col;
      const fs = P.dense ? 12 : 13.5, lh = fs * 1.28;
      g.font = fs + 'px "Special Elite", "Courier New", monospace';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const cw = g.measureText('M').width || fs * 0.6;
      const perLine = Math.max(8, Math.floor(C.w / cw));
      if (!P.wrapped || P.wrapped.per !== perLine) {
        const words = COPY.split(' ');
        const out = []; let cur = '';
        for (const wd of words) {
          if (!wd) continue;
          if ((cur + ' ' + wd).trim().length > perLine) { out.push(cur); cur = wd; } else cur = (cur ? cur + ' ' : '') + wd;
        }
        if (cur) out.push(cur);
        const starts = []; let n = 0;
        for (const l of out) { starts.push(n); n += l.length + 1; }
        P.wrapped = { per: perLine, lines: out, starts, total: n };
      }
      const Wp = P.wrapped;
      const maxLines = Math.max(3, Math.floor(C.h / lh));
      let pos = (st.typed - P.typedStart + 260) % Wp.total;
      let li = 0;
      while (li + 1 < Wp.lines.length && Wp.starts[li + 1] <= pos) li++;
      const ci = Math.floor(pos - Wp.starts[li]);
      // Top-anchored until the column fills, then it scrolls a line at a time.
      const first = Math.max(0, li - (maxLines - 1));
      for (let r = 0; r <= li - first; r++) {
        const idx = first + r;
        const line = Wp.lines[idx % Wp.lines.length];
        const n = idx === li ? Math.min(ci, line.length) : line.length;
        const y = C.y + fs + r * lh;
        for (let i = 0; i < n; i++) {
          const ch = line[i];
          if (ch === ' ') continue;
          const hs = hash2(idx, i, 77);
          g.fillStyle = hs < 0.12 ? tone(95) : INK;
          g.fillText(ch, C.x + i * cw + (hs - 0.5) * 0.8, y + (hash2(idx, i, 78) - 0.5) * 1.4);
        }
      }
    },

    drawLabel(g, P) {
      const Lb = P.label;
      g.save();
      g.translate(Lb.x, Lb.y); g.rotate(Lb.rot);
      g.font = '700 13px "Space Mono", monospace';
      g.textAlign = 'left'; g.textBaseline = 'middle';
      const w = g.measureText(Lb.text).width + 16;
      g.fillStyle = tone(80); g.fillRect(1.5, 2, w, 22);
      g.fillStyle = INK; g.fillRect(0, 0, w, 22);
      g.fillStyle = PAPER; g.fillText(Lb.text, 8, 11.5);
      g.restore();
    },

    drawTape(g, P, W) {
      const T = P.tape, st = this.st;
      g.save();
      g.translate(T.x, T.y); g.rotate(T.rot);
      g.fillStyle = tone(90); g.fillRect(2, 2.5, T.w, T.h);
      g.fillStyle = ACC; g.fillRect(0, 0, T.w, T.h);
      g.beginPath(); g.rect(0, 0, T.w, T.h); g.clip();
      g.font = (T.h * 0.78).toFixed(1) + 'px "Anton", Impact, sans-serif';
      g.textAlign = 'left'; g.textBaseline = 'middle';
      const unit = T.word + '  •  ';
      const uw = g.measureText(unit).width;
      const off = -(st.march % uw);
      g.fillStyle = ACCINK;
      for (let x = off; x < T.w; x += uw) g.fillText(unit, x, T.h * 0.54);
      g.restore();
    },

    drawSticker(g, P) {
      const S = P.sticker;
      g.save();
      g.translate(S.x, S.y); g.rotate(S.rot);
      g.fillStyle = tone(90); g.beginPath(); g.arc(2, 3, S.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = ACC; g.beginPath(); g.arc(0, 0, S.r, 0, Math.PI * 2); g.fill();
      g.fillStyle = ACCINK; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = (S.r * 0.52).toFixed(1) + 'px "Archivo Black", sans-serif';
      g.fillText(S.words[0], 0, -S.r * 0.2);
      g.font = (S.r * 0.34).toFixed(1) + 'px "Special Elite", monospace';
      g.fillText(S.words[1], 0, S.r * 0.34);
      g.restore();
    },

    drawMarks(g, P, t) {
      g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const s of P.scrawls) {
        const u = clamp((t - s.t0) / 0.26, 0, 1);
        let left = Math.max(2, Math.floor(s.n * easeOut(u)));
        g.lineWidth = s.w;
        g.strokeStyle = s.white ? PAPER : INK;
        for (const q of s.polys) {
          if (left < 2) break;
          const m = Math.min(q.length, left);
          g.beginPath(); g.moveTo(q[0][0], q[0][1]);
          for (let i = 1; i < m; i++) g.lineTo(q[i][0], q[i][1]);
          g.stroke();
          left -= q.length;
        }
      }
      // Tallies: four down, one across.
      const T = P.tally;
      g.strokeStyle = INK;
      g.lineWidth = 5;
      P.tallies.forEach((m, i) => {
        const grp = Math.floor(i / 5), k = i % 5;
        const u = easeOut((t - m.t0) / 0.15);
        const gx = T.x + grp * 46, gy = T.y;
        g.beginPath();
        if (k < 4) {
          const x = gx + k * 8 + m.j * 2;
          g.moveTo(x, gy - 14); g.lineTo(x + m.j * 3, gy - 14 + 30 * u);
        } else {
          g.moveTo(gx - 6, gy + 8); g.lineTo(gx - 6 + 42 * u, gy + 8 - 20 * u);
        }
        g.stroke();
      });
    },

    drawPage(g, P, t, dt, react) {
      g.save();
      const cx = P.W / 2, cy = P.H / 2;
      const st = this.st;
      g.translate(cx + P.ox + Math.sin(st.clk * 0.07) * 4, cy + P.oy + Math.cos(st.clk * 0.05) * 3);
      g.rotate(P.rot + Math.sin(st.clk * 0.04) * 0.003);
      g.translate(-cx, -cy);
      for (const s of P.strips) {
        g.save(); g.translate(s.x, s.y); g.rotate(s.rot);
        g.fillStyle = tone(90); polyPath(g, s.torn, 2, 2.5); g.fill();
        g.fillStyle = ACC; polyPath(g, s.torn); g.fill();
        g.restore();
      }
      for (const ph of P.photos) this.drawPhoto(g, ph, t, P);
      this.drawColumn(g, P, t, dt);
      this.drawLabel(g, P);
      if (P.tape) this.drawTape(g, P, P.W);
      for (const L of P.head.letters) this.drawLetter(g, L, t, react);
      if (P.sticker) this.drawSticker(g, P);
      for (const pin of P.pins) this.drawPin(g, pin);
      this.drawMarks(g, P, t);
      g.restore();
    },

    // ---------------------------------------------------------------------- GL
    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      this.glCanvas = c; this.gl = gl;
      if (!gl) return;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('zine shader: ' + gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('zine link: ' + gl.getProgramInfoLog(prog));
      this.prog = prog;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const loc = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.vao = vao;
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.u = {};
      for (const n of ['u_src', 'u_res', 'u_k', 'u_pitch', 'u_ang', 'u_gain', 'u_grit', 'u_gen', 'u_speck', 'u_time', 'u_scan', 'u_seed', 'u_paper', 'u_ink', 'u_acc']) this.u[n] = gl.getUniformLocation(prog, n);
    },

    // -------------------------------------------------------------------- draw
    draw(p, signals, params, ctx) {
      if (!this.st) this.init();
      const st = this.st, W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = st.lastT === null ? 1 / 60 : clamp(t - st.lastT, 0, 0.1);
      st.lastT = t;
      const react = params.reaction;
      this.react = react;
      if (!st.page || st.page.W !== W || st.page.H !== H) { st.page = null; st.old = null; this.recopy(t, params, W, H); st.scanT0 = -9; }
      this.analyse(signals, t, dt, params, W, H);
      const scanning = t - st.scanT0 < 1.15;
      if (this.wantCopy && !scanning) { this.wantCopy = false; this.recopy(t, params, W, H); }
      st.clk += dt * (0.5 + st.energy);
      st.typed += dt * (5 + 38 * st.energy + 10 * st.hatEnv);
      st.spin += dt * Math.PI * 2 * (0.3 + 0.5 * st.energy);
      st.march += dt * (30 + 90 * st.energy);

      const pd = p.pixelDensity();
      const w = Math.max(1, Math.round(p.width * pd)), h = Math.max(1, Math.round(p.height * pd));
      if (!this.src) { this.src = document.createElement('canvas'); this.sg = this.src.getContext('2d'); }
      if (this.src.width !== w || this.src.height !== h) { this.src.width = w; this.src.height = h; }
      const g = this.sg, k = w / W;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
      g.setTransform(k, 0, 0, k, 0, 0);

      const u = (t - st.scanT0) / 1.1;
      let scanX = -1e4;
      if (st.old && u < 1) {
        const sx = lerp(-30, W + 30, easeInOut(u));
        scanX = sx * k;
        g.save(); g.beginPath(); g.rect(sx, -10, W + 40, H + 20); g.clip();
        this.drawPage(g, st.old, t, dt, react); g.restore();
        g.save(); g.beginPath(); g.rect(-10, -10, sx + 10, H + 20); g.clip();
        this.drawPage(g, st.page, t, dt, react); g.restore();
      } else {
        st.old = null;
        this.drawPage(g, st.page, t, dt, react);
      }

      if (this.gl === undefined) {
        try { this.initGL(); } catch (e) { console.warn(e.message); this.gl = null; }
      }
      const gl = this.gl, pal = PAPERS[clamp(params.stock | 0, 0, PAPERS.length - 1)];
      const dc = p.drawingContext;
      if (!gl) {
        // No WebGL2: show the paste-up in plain black and white.
        dc.save();
        dc.filter = 'grayscale(1) brightness(4.7)';
        dc.drawImage(this.src, 0, 0, W, H);
        dc.restore();
        return;
      }
      const gc = this.glCanvas;
      if (gc.width !== w || gc.height !== h) { gc.width = w; gc.height = h; }
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.src);
      const U = this.u;
      const rgb = (hx) => { const n = parseInt(hx.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
      gl.uniform1i(U.u_src, 0);
      gl.uniform2f(U.u_res, w, h);
      gl.uniform1f(U.u_k, k);
      gl.uniform1f(U.u_pitch, Math.max(2.2, params.screen * k * (st.dense ? 1.15 : 1)));
      gl.uniform1f(U.u_ang, 0.785 + st.clk * 0.012);
      gl.uniform1f(U.u_gain, clamp(st.bassEnv * 1.3 * react, 0, 1.6));
      gl.uniform1f(U.u_grit, params.grit);
      gl.uniform1f(U.u_gen, st.gen / 6);
      gl.uniform1f(U.u_speck, st.hatEnv * (0.4 + react * 0.6));
      gl.uniform1f(U.u_time, t);
      gl.uniform1f(U.u_scan, scanX);
      gl.uniform1f(U.u_seed, (st.page.seed % 997) / 97);
      gl.uniform3fv(U.u_paper, rgb(pal.paper));
      gl.uniform3fv(U.u_ink, rgb(pal.ink));
      gl.uniform3fv(U.u_acc, rgb(pal.acc));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      dc.save();
      dc.globalAlpha = 1; dc.globalCompositeOperation = 'source-over';
      dc.drawImage(gc, 0, 0, W, H);
      dc.restore();
    },
  });
})();
