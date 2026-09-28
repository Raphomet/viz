// Iris — a giant psychedelic eye whose pupil is a window into another world.
//
// One WebGL2 fragment shader draws every plane of the eye, from the back:
//   - a night backdrop of faint stars and nebula haze, framed by a mandorla
//     of luminous lid lines (an eye of light rather than of flesh: no lashes,
//     no veins, no wet pink — the brief says arresting, not creepy);
//   - a pearly, iridescent "sclera" inside the mandorla, and an aura of rays
//     that carry the iris fibres out into the dark;
//   - the iris: periodic value-noise fibres in polar space (seamless round the
//     circle because the noise tiles in angle), spiral twist, crypts, a
//     collarette, a dark limbal ring and a pigment ruff at the pupil;
//   - the pupil: a starfall tunnel, or a Droste zoom into ever smaller irises;
//   - a wet window-shaped specular highlight with a hat-driven cross glint.
// Canvas 2D adds the foreground: out-of-focus motes drifting toward the
// viewer and short-lived glints thrown by the hats.
//
// Music vocabulary (each lands in a different plane):
//   kick  — the pupil snaps open, the eye swells a few percent, a ripple of
//           light runs out through the fibres into the aura, the limbal ring
//           blooms, and the tunnel surges forward;
//   clap  — the whole palette turns to a new harmony (a hue rotation that keeps
//           the colours' relations), the fibres flick round, and a flare ring
//           races outward;
//   bass  — the resting pupil size, iris glow and aura strength;
//   hats  — the specular highlight glints, iris glitter twinkles, and star
//           glints spark in the foreground;
//   drop  — colour floods the iris, the aura rays and lid lines switch on, the
//           pupil opens wide; the breakdown exhales to a dim, pastel, slow eye.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;
uniform float unitPx;
uniform vec2  center;     // eye centre, virtual units from stage centre
uniform float R;          // iris radius
uniform float rp;         // pupil radius
uniform float t;          // drift clock
uniform float rot;        // fibre rotation, in base cells (wrapped)
uniform float twist;      // spiral twist of the fibres
uniform float echo[96];   // kick history, newest first, one per frame
uniform float clapAge;    // seconds since the last clap
uniform mat3  hueM;       // hue rotation applied to the palette
uniform vec3  cInner, cMid, cOuter, cAccent;
uniform float energy;     // 0 quiet … 1 drop
uniform float bass;
uniform float pad;       // sustained mids: breathes the breakdown
uniform float punch;      // kick envelope
uniform float hat;        // hat envelope
uniform float travel;     // tunnel travel
uniform float zoomPh;     // Droste zoom phase
uniform float mode;       // 0 starfall, 1 iris tunnel
uniform float aura;
uniform vec2  lid;        // mandorla half-width, half-height
uniform vec2  tunOff;     // tunnel vanishing point offset
out vec4 outColor;

const float TAU = 6.2831853;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise that tiles with period per in x, so fibres close round the circle.
float vn(vec2 x, float per) {
  vec2 i = floor(x), f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float i0 = mod(i.x, per), i1 = mod(i.x + 1.0, per);
  float a = hash12(vec2(i0, i.y)), b = hash12(vec2(i1, i.y));
  float c = hash12(vec2(i0, i.y + 1.0)), d = hash12(vec2(i1, i.y + 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float vn2(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

float heard(float d) {
  float i = clamp(d / 6.0, 0.0, 94.0);
  int k = int(i);
  return mix(echo[k], echo[k + 1], i - float(k));
}

// Palette along the iris: gold ruff → mid → outer, hue-rotated as one.
vec3 pal(float s) {
  vec3 c = s < 0.5 ? mix(cInner, cMid, smoothstep(0.0, 0.5, s))
                   : mix(cMid, cOuter, smoothstep(0.5, 1.0, s));
  return max(hueM * c, 0.0);
}

// The iris at normalised radius s (0 pupil edge, 1 limbus) and angle a01.
// Returns emitted light.
vec3 irisAt(float s, float a01, float depthFade, float ringLight) {
  const float N = 64.0;
  float x = a01 * N + rot + twist * s * 6.0;
  // A slow warp of the fibres so they wander instead of radiating straight.
  x += 1.6 * (vn(vec2(x * 0.25, s * 2.0 + t * 0.07), N * 0.25) - 0.5);
  float f = 0.5 * vn(vec2(x, s * 2.5 - t * 0.05), N)
          + 0.32 * vn(vec2(x * 2.0 + 0.5, s * 5.0 + t * 0.03), N * 2.0)
          + 0.18 * vn(vec2(x * 4.0, s * 9.0), N * 4.0);
  float fib = smoothstep(0.28, 0.85, f);
  fib = fib * fib;

  // Crypts: dark lacunae, lit from within by the accent colour.
  float cr = vn(vec2(x * 0.5 + 7.0, s * 4.0 - t * 0.02), N * 0.5);
  float crypt = smoothstep(0.62, 0.78, cr) * smoothstep(0.15, 0.35, s) * smoothstep(0.95, 0.7, s);

  // Collarette: a wavy bright ring about a third of the way out.
  float cw = 0.34 + 0.035 * sin(a01 * TAU * 11.0 + t * 0.3) + 0.02 * sin(a01 * TAU * 5.0 - t * 0.2);
  float coll = exp(-pow((s - cw) / 0.035, 2.0));

  vec3 base = pal(s + 0.12 * (f - 0.5));
  float glow = 0.35 + 0.9 * energy + 0.5 * bass;
  vec3 col = base * (0.12 + 1.35 * fib) * glow;
  col += pal(0.05) * coll * (0.5 + 0.8 * energy + 0.8 * pad);
  col = mix(col, col * 0.2 + hueM * cAccent * 0.06 * (0.3 + energy), crypt * 0.8);
  // Pigment ruff at the pupil margin: a hot inner glow.
  col += pal(0.0) * exp(-s * 14.0) * (0.6 + 1.2 * punch + 0.6 * energy);
  // Limbal ring: the iris darkens into its rim.
  col *= mix(1.0, 0.18, smoothstep(0.82, 1.0, s));
  // Kick ripple and clap flare ride on the fibres, so the fibres light up.
  col += (pal(s) + 0.25) * ringLight * (0.25 + 1.4 * fib);
  // Glitter in the fibres, twinkling with the hats.
  vec2 gp = vec2(x * 2.0, s * 26.0);
  vec2 gc = floor(gp), gf = fract(gp) - 0.5;
  float gh = hash12(gc + 13.0);
  float pt = exp(-dot(gf, gf) * 40.0);
  float tw = 0.5 + 0.5 * sin(t * 9.0 + gh * 40.0);
  col += vec3(1.0, 0.95, 0.85) * step(0.9, gh) * pt * (0.3 + fib) * hat * tw * 2.5;
  return col * depthFade;
}

vec3 hsvHot(vec3 c) { return c + 0.15; }

void main() {
  vec2 P = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  vec2 q = P - center;
  float r = length(q);
  float a01 = atan(q.y, q.x) / TAU + 0.5;
  vec3 col = vec3(0.0);

  // ---------- backdrop: night, haze, stars
  // Deep night: one faint haze octave and a glow behind the eye, so the
  // frame's edges stay black and the eye owns the light.
  vec2 nb = P * 0.006 + vec2(t * 0.01, -t * 0.006);
  float neb = vn2(nb * 3.0);
  vec3 bg = vec3(0.002, 0.002, 0.008);
  bg += hueM * cOuter * (0.006 + 0.02 * smoothstep(0.4, 0.95, neb)) * (1.0 + 0.8 * energy);
  bg += hueM * cOuter * 0.03 * exp(-r / (R * 1.2)) * (0.4 + energy);
  vec2 sc = floor(P / 7.0);
  float sh = hash12(sc);
  if (sh > 0.975) {
    vec2 sp = (sc + 0.5 + 0.35 * (vec2(hash12(sc + 1.7), hash12(sc + 4.1)) - 0.5)) * 7.0;
    float sd = length(P - sp);
    float tw = 0.55 + 0.45 * sin(t * (2.0 + sh * 30.0) + sh * 90.0);
    bg += vec3(0.9, 0.9, 1.0) * exp(-sd * sd * 0.6) * tw * (0.5 + 0.8 * hat);
  }
  col = bg;

  // ---------- mandorla: luminous lid lines framing the eye
  float xn = q.x / lid.x;
  float h = lid.y * max(0.0, 1.0 - xn * xn);
  h = lid.y * pow(max(0.0, 1.0 - xn * xn), 0.85);
  float dl = abs(q.y) - h;          // < 0 inside the mandorla
  float inside = 1.0 - smoothstep(-6.0, 6.0, dl);
  float lidK = 0.3 + 0.7 * energy + 0.8 * punch + 0.6 * pad * (0.6 + 0.4 * sin(t * 1.3 - abs(q.x) * 0.01));
  float fadeX = smoothstep(1.0, 0.55, abs(xn));
  vec3 lidCol = hueM * mix(cInner, cAccent, 0.35);
  float lines = exp(-abs(dl) / 2.2) + 0.45 * exp(-abs(dl - 22.0) / 2.5) + 0.22 * exp(-abs(dl - 50.0) / 3.0);
  // The clap flare also runs along the lids.
  float lidFlare = exp(-clapAge * 4.0) * exp(-pow((abs(q.x) - clapAge * 900.0) / 60.0, 2.0));
  // Sclera: a dark pearl sheen inside the mandorla.
  float sheen = 0.5 + 0.5 * sin(r * 0.025 - t * 0.4 + a01 * TAU * 2.0);
  vec3 sclera = mix(hueM * cMid, hueM * cAccent, sheen) * (0.025 + 0.05 * energy) * smoothstep(R * 2.2, R, r);
  col += sclera * inside;

  // Aura: rays carrying the fibres out past the limbus, and the kick echo.
  if (r > R * 0.95) {
    float ra = vn(vec2(a01 * 48.0 + rot * 0.75, t * 0.15), 48.0);
    float rays = smoothstep(0.5, 0.95, ra) * exp(-(r - R) / (60.0 + 90.0 * energy));
    float echoL = heard(r - rp) * exp(-(r - R) / 260.0);
    vec3 auraCol = pal(0.85 + 0.3 * ra);
    col += auraCol * rays * aura * (0.06 + 0.5 * energy + 0.3 * bass + 0.3 * pad);
    col += auraCol * echoL * aura * (0.08 + 1.4 * rays / max(aura, 0.3));
    // Limbal bloom, the eye's corona.
    col += pal(1.0) * exp(-(r - R) / 18.0) * (0.25 + 0.35 * energy + 1.6 * punch);
  }

  col += lidCol * lines * (lidK + 3.0 * lidFlare) * fadeX;

  // ---------- iris
  float ringLight = 0.0;
  if (r < R + 2.0) {
    float s = clamp((r - rp) / (R - rp), 0.0, 1.0);
    float echoI = heard(max(r - rp, 0.0));
    float flare = exp(-clapAge * 3.5) * exp(-pow((r - rp - clapAge * 520.0) / 30.0, 2.0));
    ringLight = 1.2 * echoI + 1.3 * flare;
    vec3 ic = irisAt(s, a01, 1.0, ringLight);
    float irisMask = smoothstep(R + 1.5, R - 1.5, r) * smoothstep(rp - 1.5, rp + 1.5, r);
    col = mix(col, ic, irisMask);
  }

  // ---------- pupil: a window into another world
  if (r < rp + 2.0) {
    vec3 pc = vec3(0.0);
    float edge = r / rp;
    if (mode < 0.5) {
      // Starfall: stars on the walls of a tunnel, rushing out at the viewer.
      vec2 qt = q - tunOff * (1.0 - edge);
      float rt = max(length(qt), 0.5);
      float at = atan(qt.y, qt.x) / TAU + 0.5;
      float w = log(rp / rt);
      const float S = 28.0;
      float y = w * 4.0 + travel;
      vec2 cell = vec2(floor(at * S), floor(y));
      vec2 fr = vec2(fract(at * S), fract(y));
      float hsh = hash12(vec2(mod(cell.x, S), cell.y));
      vec2 sp = vec2(0.2 + 0.6 * hash12(cell + 3.3), 0.2 + 0.6 * hsh);
      vec2 dd = fr - sp;
      float sz = 0.05 + 0.1 * edge;
      float star = step(0.45, hsh) * exp(-dot(dd, dd) / (sz * sz));
      vec3 sCol = mix(vec3(1.0), pal(hash12(cell) ), 0.55);
      pc += sCol * star * (0.9 + 1.2 * punch) * smoothstep(0.0, 0.25, edge);
      // Glowing rings of the tunnel wall, streaming outward.
      float band = 0.5 + 0.5 * sin(y * TAU * 0.5);
      pc += hueM * cAccent * pow(band, 6.0) * 0.18 * edge * (0.4 + energy);
      // The light at the end.
      pc += pal(0.0) * exp(-rt / (rp * 0.08)) * (0.5 + 0.8 * bass + 0.8 * punch);
    } else {
      // Iris tunnel: the pupil holds a smaller iris, which holds a smaller
      // one, forever, and the zoom falls into them.
      float rho = clamp(rp / R, 0.2, 0.7);
      float L = log(max(r, 0.3) / rp) / log(rho) + zoomPh;
      float ft = fract(L);
      float s = (pow(rho, ft) - rho) / (1.0 - rho);
      float depth = log(max(r, 0.3) / rp) / log(rho);
      float fade = exp(-0.55 * depth);
      float sub = 1.0 - smoothstep(0.0, 0.08, ft) * 0.0;
      pc = irisAt(s, fract(a01 + floor(L) * 0.13), fade, 0.0) * sub;
      // Each nested limbus as a dark seam with a thin corona.
      pc *= smoothstep(0.0, 0.04, ft);
      pc += pal(1.0) * exp(-ft / 0.02) * fade * (0.4 + punch);
      pc += pal(0.0) * exp(-r / (rp * 0.05)) * (0.4 + bass);
    }
    // Depth: the pupil's rim is dark, like looking through a window.
    pc *= smoothstep(0.98, 0.78, edge) * 0.85 + 0.15;
    float pm = smoothstep(rp + 1.5, rp - 1.5, r);
    col = mix(col, pc, pm);
  }

  // ---------- wet specular highlight
  vec2 hl = vec2(-0.36 * R, 0.4 * R);
  vec2 hq = q - hl;
  float hd = length(max(abs(hq) - vec2(0.04 * R, 0.022 * R), 0.0));
  // A soft window: a bright core with a wet falloff, never a flat card.
  float spec = exp(-pow(hd / (0.03 * R), 2.0)) * 0.6 + exp(-hd / (0.07 * R)) * 0.15;
  float spec2 = smoothstep(0.03 * R, 0.0, length(q - vec2(0.3 * R, -0.28 * R)));
  float corn = exp(-pow((r - 0.86 * R) / 4.0, 2.0)) * smoothstep(0.2, 0.9, dot(normalize(q + 1e-4), normalize(vec2(-0.7, 0.7))));
  float hk = 0.55 + 0.25 * energy + 0.6 * hat;
  col += vec3(1.0, 0.98, 0.95) * (spec * hk + spec2 * 0.45 * hk + corn * 0.12);
  // Hat glint: a four-point cross flare from the highlight.
  float cross = exp(-abs(hq.y) / 1.3) * exp(-abs(hq.x) / (20.0 + 90.0 * hat))
              + exp(-abs(hq.x) / 1.3) * exp(-abs(hq.y) / (20.0 + 90.0 * hat));
  col += vec3(1.0, 0.97, 0.9) * cross * hat * 0.9;

  // Tone map: filmic-ish shoulder so blooms saturate gently, then sRGB.
  col = 1.0 - exp(-col * 1.25);
  outColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

  // Palettes: inner (pupil ruff), mid, outer, accent — as linear RGB.
  function lin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  }
  const PALETTES = [
    { name: 'Opal', c: ['#ffc85a', '#22d8c0', '#3553ff', '#ff4fb0'] },
    { name: 'Ember', c: ['#fff0a0', '#ff8a1f', '#d0206a', '#7a3cff'] },
    { name: 'Lagoon', c: ['#e2ff7a', '#12c49c', '#0b4fa8', '#ff7a59'] },
    { name: 'Orchid', c: ['#ffd6f2', '#c04dff', '#3d24a8', '#3effc8'] },
  ].map((p) => ({ name: p.name, c: p.c.map(lin) }));

  // Hue rotation about the grey axis (keeps luminance roughly, keeps the
  // palette's internal relations: a clap turns the whole harmony at once).
  function hueMatrix(a) {
    const c = Math.cos(a), s = Math.sin(a), k = 1 / 3, q = Math.sqrt(1 / 3);
    const m = (x, y) => (x === y ? c : 0) + (1 - c) * k + s * q * (
      (x === 0 && y === 1) ? -1 : (x === 1 && y === 0) ? 1 :
      (x === 0 && y === 2) ? 1 : (x === 2 && y === 0) ? -1 :
      (x === 1 && y === 2) ? -1 : (x === 2 && y === 1) ? 1 : 0);
    // column-major for GLSL
    return new Float32Array([m(0, 0), m(1, 0), m(2, 0), m(0, 1), m(1, 1), m(2, 1), m(0, 2), m(1, 2), m(2, 2)]);
  }

  const ECHO_LEN = 96;
  const RENDER_SCALE = 0.75;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function sprite(size, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  }
  function glintSprite(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const m = size / 2;
    const gr = g.createRadialGradient(m, m, 0, m, m, m * 0.35);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    for (const [w, h] of [[size, size * 0.06], [size * 0.06, size]]) {
      const lg = g.createRadialGradient(m, m, 0, m, m, m);
      lg.addColorStop(0, 'rgba(255,250,235,0.95)');
      lg.addColorStop(1, 'rgba(255,250,235,0)');
      g.fillStyle = lg;
      g.fillRect(m - w / 2, m - h / 2, w, h);
    }
    return c;
  }

  VIZ.register({
    id: 'iris',
    name: 'Iris',
    order: 210,

    params: [
      { key: 'palette', label: 'Colours', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'world', label: 'Inside the pupil', type: 'select', options: ['Starfall', 'Iris tunnel'], default: 0 },
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'clapTurn', label: 'Colour turn on clap', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'swirl', label: 'Fibre swirl', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'aura', label: 'Aura', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'drift', label: 'Drift', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    gallery: {
      title: 'Iris',
      technique: 'WebGL2 fragment shader (tileable polar value-noise fibres, starfall or Droste tunnel in the pupil, mandorla lid lines, aura, specular) under a Canvas 2D layer of additive bokeh motes and glint sprites',
      brief: 'A giant eye of light fills the stage: a mandorla of luminous lid lines over deep night, a pearly sheen, an aura of rays, and an iris of fine flowing fibres with a golden collarette and dark crypts, its whole harmony slowly turning. The pupil is a window into another world: stars rushing out of a tunnel, or (Iris tunnel) a Droste fall into ever smaller irises. The kick snaps the pupil open and swells the eye, blooms the limbal corona and sends a ripple of light out through the fibres into the rays while the tunnel surges; the clap turns the palette to a new harmony, flicks the fibres round and races a flare ring out and along the lids; the bass sets the resting pupil and glow; hats glint the wet highlight into a cross flare, twinkle glitter in the fibres and throw star glints; the drop floods the iris and opens the pupil wide, and the breakdown exhales to a small pupil, slow fibres and lid lines breathing with the pad.',
      lineage: [
        'Brief 10 (batch 02): the psychedelic eye, arresting not creepy. Chose an eye of light (mandorla lid lines, no lashes, veins or flesh-pink sclera) so it reads as cosmic rather than anatomical.',
        'Iris fibres are periodic value noise in polar space (the noise tiles in angle, so there is no seam at ±π), three octaves over a slow warp, with a twist that spirals them; the iris coordinate is normalised between pupil and limbus so a dilating pupil compresses the fibres like a real iris.',
        'Music vocabulary, one plane each: kick = pupil snap + 4.5% swell + limbal bloom + a ripple read from a 96-frame kick history at distance/speed (the Interference echo idea) + tunnel surge; clap = hue rotation of the whole palette about the grey axis, a fibre flick, a flare ring out and along the lids; hats = specular cross glint, fibre glitter, foreground glint sprites; bass/pad = pupil, glow, aura, fibre flow. Kick, clap and hats are transients against each band\'s own slow average, so the sidechained bass line and the pad swell without firing them.',
        'First render: backdrop nebula and sclera were bright purple even in the intro, crypts read as salmon blobs, the specular was a flat grey card. Backdrop cut to near-black with one haze octave, crypts now darken with a faint accent, specular a soft window with a wet falloff.',
        'Second pass: the kick echo in the aura made a solid ring washing the frame, and the clap flare along the lids had no vertical bound (beige pillars). Echo now rides the rays; lid flare confined to the lid lines; hat glitter changed from lit cells (little rectangles) to points.',
        'Breakdown was static: sustained mids (pad) now speed the fibre flow, brighten the collarette, breathe the lid lines and the pupil.',
        'Iris tunnel (Droste) checked in its own render with Ember: the strongest image for the altered viewer; left as a performer switch, Starfall stays default because the stars make the kick surge legible.',
        'Performance: 1280×720 measured ~88 ms mean under SwiftShader on a machine shared with nine other renders; the shader now runs at 3/4 device resolution with high-quality upscaling (~69 ms on the same busy machine). Specular core shrunk after the 96 s run showed it reading as a small grey card in quiet sections.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {
      this.motes = null;
    },

    enter() {
      this.clock = 0;
      this.lastMs = null;
      this.env = { pad: 0, bassLvl: 0, bassSlow: 0, punch: 0, midSlow: 0, hiSlow: 0, hat: 0, energy: 0 };
      this.echo = new Float32Array(ECHO_LEN);
      this.clapAge = 10;
      this.lastClap = -10;
      this.hueTarget = 0;
      this.hue = 0;
      this.rotFlick = 0;
      this.rotFlickTarget = 0;
      this.rot = 0;
      this.travel = 0;
      this.zoom = 0;
      this.glints = [];
      this.initMotes();
    },

    initMotes() {
      const r = Math.random;
      this.motes = [];
      for (let i = 0; i < 34; i++) {
        this.motes.push({ a: r() * Math.PI * 2, d: r(), z: r(), k: r() < 0.3 ? 1 : 0, ph: r() * 10 });
      }
      if (!this.spr) {
        this.spr = [
          sprite(64, [[0, 'rgba(255,236,200,0.9)'], [0.35, 'rgba(255,220,170,0.35)'], [1, 'rgba(255,200,150,0)']]),
          sprite(64, [[0, 'rgba(190,240,255,0.9)'], [0.35, 'rgba(150,210,255,0.3)'], [1, 'rgba(120,180,255,0)']]),
        ];
        this.glintSpr = glintSprite(64);
      }
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      const u = {};
      for (const n of ['res', 'unitPx', 'center', 'R', 'rp', 't', 'rot', 'twist', 'echo', 'clapAge', 'hueM',
        'cInner', 'cMid', 'cOuter', 'cAccent', 'energy', 'bass', 'pad', 'punch', 'hat', 'travel', 'zoomPh',
        'mode', 'aura', 'lid', 'tunOff']) u[n] = gl.getUniformLocation(prog, n);
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    // Band envelopes. Kick, clap and hats are transients (a band jumping
    // above its own slow average), so a sustained bass line or pad swells
    // the eye without firing the percussive reactions.
    listen(sig, dt, react) {
      const e = this.env;
      const bass = (sig[0] + sig[1]) / 200;
      const mid = (sig[3] + sig[4] + sig[5]) / 300;
      const hi = (sig[6] + sig[7] + sig[8]) / 300;
      const kickT = clamp01((bass - e.bassSlow) * 2.2);
      const clapT = mid - e.midSlow;
      const hatT = clamp01((hi - e.hiSlow) * 3.5);
      e.bassSlow = ease(e.bassSlow, bass, 2.5, dt);
      e.midSlow = ease(e.midSlow, mid, 3, dt);
      e.hiSlow = ease(e.hiSlow, hi, 4, dt);
      e.punch = Math.max(e.punch * Math.exp(-dt * 6.5), kickT);
      e.hat = Math.max(e.hat * Math.exp(-dt * 10), hatT);
      e.bassLvl = ease(e.bassLvl, bass, 3, dt);
      e.pad = ease(e.pad, clamp01(((sig[2] + sig[3] + sig[4]) / 300 - 0.12) * 3), 1.5, dt);
      const loud = clamp01(bass * 1.3 + hi * 0.6);
      e.energy = ease(e.energy, loud, loud > e.energy ? 1.2 : 0.45, dt);

      this.clapAge += dt;
      const now = this.clock;
      if (clapT > 0.22 && now - this.lastClap > 0.2) {
        this.lastClap = now;
        this.clapAge = 0;
        this.clapCount = (this.clapCount || 0) + 1;
        this.hueTarget += this.clapTurn * 1.3 * (this.clapCount % 2 ? 1 : 0.6);
        this.rotFlickTarget += 1.4 * react;
      }
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const react = params.react;
      this.clapTurn = params.clapTurn;
      this.clock += dt;
      this.listen(signals, dt, react);
      const e = this.env;
      const punch = clamp01(e.punch * react);
      const hat = clamp01(e.hat * react);
      const energy = e.energy;
      const drift = params.drift;
      this.T = (this.T || 0) + dt * drift;
      const T = this.T;

      this.echo.copyWithin(1, 0, ECHO_LEN - 1);
      this.echo[0] = Math.pow(punch, 2.5);

      // Colour: a slow wander within the harmony plus the clap turns.
      this.hue = ease(this.hue, this.hueTarget, 12, dt);
      const hueA = this.hue + 0.5 * Math.sin(T * 0.05) + 0.25 * Math.sin(T * 0.013 + 1);

      this.rotFlick = ease(this.rotFlick, this.rotFlickTarget, 7, dt);
      this.rot = (this.rot + dt * (drift * 0.35 + 0.6 * e.pad)) % 64;
      const rot = (this.rot + this.rotFlick) % 64;

      this.travel += dt * (0.35 * drift + 0.8 * e.bassLvl + 5 * punch);
      this.zoom += dt * (0.05 * drift + 0.15 * e.bassLvl + 0.9 * punch);

      const S = Math.min(ctx.width, ctx.height);
      const Rbase = S * 0.42;
      const R = Rbase * (1 + 0.045 * punch + 0.03 * e.bassLvl * react);
      const pupilF = 0.2 + 0.1 * Math.sin(T * 0.11) * 0.3 + 0.16 * e.bassLvl * react + 0.1 * energy + 0.12 * punch
        + 0.06 * e.pad * Math.sin(T * 0.9);
      const rp = R * Math.min(0.62, pupilF);
      const gaze = [18 * Math.sin(T * 0.07 + 0.4) + 8 * Math.sin(T * 0.19), 12 * Math.sin(T * 0.053 + 2)];
      const twist = (params.swirl * 2 - 0.4) * (0.6 + 0.4 * Math.sin(T * 0.031));

      // The shader runs at 3/4 of device resolution and is scaled up with
      // smoothing: the image is all soft light and fibres, so the loss is
      // hard to see, and it nearly halves the fragment cost (1280×720 was
      // ~90 ms a frame under SwiftShader at full resolution on a busy machine).
      const w = Math.round(p.width * p.pixelDensity() * RENDER_SCALE);
      const h = Math.round(p.height * p.pixelDensity() * RENDER_SCALE);
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Iris needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl, u = this.u;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const unitPx = Math.min(w, h) / 600;
      const pal = PALETTES[(params.palette | 0) % PALETTES.length].c;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, unitPx);
      gl.uniform2f(u.center, gaze[0], gaze[1]);
      gl.uniform1f(u.R, R);
      gl.uniform1f(u.rp, rp);
      gl.uniform1f(u.t, T);
      gl.uniform1f(u.rot, rot);
      gl.uniform1f(u.twist, twist);
      gl.uniform1fv(u.echo, this.echo);
      gl.uniform1f(u.clapAge, this.clapAge);
      gl.uniformMatrix3fv(u.hueM, false, hueMatrix(hueA));
      gl.uniform3fv(u.cInner, pal[0]);
      gl.uniform3fv(u.cMid, pal[1]);
      gl.uniform3fv(u.cOuter, pal[2]);
      gl.uniform3fv(u.cAccent, pal[3]);
      gl.uniform1f(u.energy, energy);
      gl.uniform1f(u.bass, e.bassLvl);
      gl.uniform1f(u.pad, e.pad);
      gl.uniform1f(u.punch, punch);
      gl.uniform1f(u.hat, hat);
      gl.uniform1f(u.travel, this.travel % 1000);
      gl.uniform1f(u.zoomPh, this.zoom % 1);
      gl.uniform1f(u.mode, params.world | 0);
      gl.uniform1f(u.aura, params.aura);
      gl.uniform2f(u.lid, Math.max(ctx.width * 0.5 * 0.97, R * 1.55), R * (1.12 + 0.05 * energy));
      gl.uniform2f(u.tunOff, -gaze[0] * 1.2, -gaze[1] * 1.2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const g2 = p.drawingContext;
      g2.imageSmoothingEnabled = true;
      g2.imageSmoothingQuality = 'high';
      g2.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);

      this.drawForeground(p, ctx, dt, punch, hat, energy, R, gaze);
    },

    // Foreground: soft motes drifting toward the viewer (kicks shove them
    // outward), and glints thrown by the hats.
    drawForeground(p, ctx, dt, punch, hat, energy, R, gaze) {
      const g = p.drawingContext;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const cx = ctx.width / 2 + gaze[0], cy = ctx.height / 2 - gaze[1];
      const maxD = Math.hypot(ctx.width, ctx.height) * 0.6;
      for (const m of this.motes) {
        m.z += dt * (0.025 + 0.05 * energy + 0.5 * punch);
        if (m.z > 1) { m.z -= 1; m.a = Math.random() * Math.PI * 2; m.d = Math.random(); }
        const z = m.z;
        const dist = (0.15 + m.d * 0.85) * maxD * (0.25 + z * z * 1.1);
        const x = cx + Math.cos(m.a) * dist, y = cy + Math.sin(m.a) * dist;
        const size = 6 + z * z * 70;
        const tw = 0.6 + 0.4 * Math.sin(this.clock * 3 + m.ph * 7);
        const al = Math.min(1, z * 3) * (1 - z) * 4 * (0.1 + 0.25 * energy + 0.35 * hat * tw);
        g.globalAlpha = Math.max(0, Math.min(0.8, al));
        g.drawImage(this.spr[m.k], x - size / 2, y - size / 2, size, size);
      }
      // Hat glints: a few four-point stars across the eye, living ~0.3 s.
      if (hat > 0.35 && this.glints.length < 24) {
        const n = 1 + Math.floor(hat * 3);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, d = R * (0.3 + Math.random() * 1.1);
          this.glints.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, age: 0, s: 14 + Math.random() * 26 });
        }
      }
      this.glints = this.glints.filter((gl) => (gl.age += dt) < 0.35);
      for (const gl of this.glints) {
        const k = 1 - gl.age / 0.35;
        const s = gl.s * (0.6 + 0.4 * k);
        g.globalAlpha = k * k;
        g.drawImage(this.glintSpr, gl.x - s / 2, gl.y - s / 2, s, s);
      }
      g.restore();
    },
  });
})();
