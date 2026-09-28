// Aurora, re-inked — Attractor's silk hung as curtains over Aurora's lake.
//
// Batch 06 idea 12 offered two re-inkings of Aurora: the strange attractor's
// filaments hung as curtains (the Psychonaut's "Strange Aurora"), or the whole
// scene set in glyphs (the Floor's "ASCII Aurora"). This is the first. Glyphs
// on black are what Terminal already does, and the panel's own lesson was that
// type engages the mind someone high came to rest; the silk answers the two
// complaints about Aurora instead: its green wall ("every drop the same") and
// its two-state longevity. An attractor never repeats a drape.
//
// How it is made:
// - Two attractor layers are iterated on the CPU (Attractor's Clifford / de
//   Jong maps, sine table, walkers, Lyapunov guard) and splatted into
//   exposures that cover the sky band. The front layer is the main curtain;
//   the rear layer, larger and higher, is the drop's second, warmer silk.
// - Each exposure is then smeared upward per column (an exponential tail),
//   so every filament hangs rays above itself the way a real aurora's lower
//   edge does. The ray strength is striated per column by slow noise, so the
//   tails read as rays rather than as haze.
// - Colour comes from light age, as in Attractor: a slow and a fast exposure,
//   whose ratio says whether light is new or dying. The front silk is two inks
//   (a cool dying colour and a pale steady one) and a Colour control lets the
//   calm state sit close to silver; the drop adds the rear silk in one warm
//   ink, and each drop deals the next ink (rose, amber, copper) and a new form
//   so the fortieth minute is not the fourth.
// - A WebGL2 shader composes sky, stars, three parallax ranges, the silk
//   (read along rays converging on the magnetic zenith), and the lake, which
//   re-evaluates the sky at the rippled mirror point.
// - No halo and no bloom: the silk is the material. Tone-mapping is 1 - e^-x,
//   and the kick's hot light is champagne, never pure white.

(function () {
  const TAU = Math.PI * 2;
  const HZ = -95;          // horizon, virtual units from centre, y up
  const BAND0 = HZ + 4;    // bottom of the silk exposure, virtual
  const BAND1 = 318;       // top of it (just past the stage top)
  const XSPAN = 1.32;      // the exposure's width, as a multiple of the stage's
  const RES = 0.65;        // GL layer resolution, as in Aurora
  const CRES = 0.5;        // silk exposure resolution, relative to device px
  const TEX_STEP = 1.5;    // terrain texture: virtual units per texel
  const LAKE_PAR = 0.04;

  // ------------------------------------------------------------ attractor
  // Sine table with linear interpolation (a nearest-entry table quantises the
  // map into short cycles: see attractor.js).
  const SIN_N = 4096, SIN_MASK = SIN_N - 1, SIN_SCALE = SIN_N / TAU, QUARTER = SIN_N / 4;
  const SIN = new Float32Array(SIN_N + 1);
  for (let i = 0; i <= SIN_N; i++) SIN[i] = Math.sin(i / SIN_SCALE);
  function lsin(f) {
    const fl = Math.floor(f);
    const i = fl & SIN_MASK;
    return SIN[i] + (SIN[i + 1] - SIN[i]) * (f - fl);
  }
  // Attractor's vetted, filament-rich forms.
  const FORMS = [
    [[-1.4, 1.6, 1.0, 0.7], [1.7, 1.7, 0.06, 1.2], [-1.7, 1.8, -1.9, -0.4]],
    [[1.4, -2.3, 2.4, -2.1], [2.01, -2.53, 1.61, -0.33], [-2.7, -0.09, -0.86, -2.2],
     [-2.0, -2.0, -1.2, 2.0], [0.97, -1.899, 1.381, -1.506], [-0.827, -1.637, 1.659, -0.943]],
  ];
  const AMP = [[0.16, 0.16, 0.22, 0.22], [0.12, 0.12, 0.14, 0.14]];
  const WALKERS = 768;
  const BURN_IN = 24;
  const FAST_DECAY = 0.86;
  const JOURNEY_S = 40;
  const FADE_S = 6;

  // Inks, sRGB: the front silk's dying and steady light, the fresh edge, the
  // sky ground, and the three warm inks the drops deal in turn to the rear.
  const INKS = [
    { name: 'Champagne & ice', old: '#33557f', mid: '#e6c796', hot: '#fff3dc',
      rear: ['#c0566e', '#d98a3a', '#b8664a'] },
    { name: 'Pewter & sage', old: '#3a5560', mid: '#b9ccb4', hot: '#f1f6ee',
      rear: ['#9a5c86', '#c9a14a', '#6f8fbf'] },
    { name: 'Silver gelatin', old: '#4a5262', mid: '#cfccc4', hot: '#fffdf8',
      rear: ['#a8764e', '#8e6a8a', '#b89a6a'] },
  ];
  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };
  const LINKS = INKS.map((k) => ({ old: lin(k.old), mid: lin(k.mid), hot: lin(k.hot), rear: k.rear.map(lin) }));

  const PRESETS = {
    calm: { colour: 0.3, rear: 0, morph: 0.6, rays: 0.8, travel: 0.4, height: 0.9 },
    drop: { colour: 1, rear: 1, morph: 1.6, rays: 1.25, travel: 1.8, height: 1.15 },
    // The front silk alone, in silver, very tall: the quietest state.
    veil: { inks: 2, colour: 0, rear: 0, morph: 0.35, rays: 1.5, travel: 0.2, height: 1.4 },
    // Both silks and full colour, but slow: a drop that floats.
    cathedral: { colour: 1, rear: 1, morph: 0.5, rays: 1.5, travel: 0.6, height: 1.35 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['colour', 'rear', 'morph', 'rays', 'travel', 'height'];

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (t) => t * t * (3 - 2 * t);
  const h11 = (n) => { const x = Math.sin(n * 127.1 + 17.3) * 43758.5453; return x - Math.floor(x); };
  const n1 = (x) => {
    const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f);
    const a = h11(i); return a + (h11(i + 1) - a) * f;
  };
  const fbm1 = (x) => (0.5 * n1(x) + 0.25 * n1(x * 2.03 + 1.7) + 0.125 * n1(x * 4.01 + 3.1) + 0.0625 * n1(x * 8.1 + 5.3)) / 0.9375;
  const ridge = (x) => { const a = 1 - Math.abs(2 * n1(x) - 1); return a * a; };

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D silkT;  // R front tone, G front freshness, B rear tone, A kick light
uniform sampler2D terr;   // R treeline, G mid ridge, B far ridge, A snow
uniform vec4 band;        // x0, y0, 1/width, 1/height (virtual)
uniform vec2 terrX;       // x of texel 0, 1 / span
uniform vec2 res;
uniform float unitPx, tw, lakeX, starAng, hz, halfW;
uniform float hat, hatSeed, starK, waterK, colour;
uniform vec3 cOld, cMid, cHot, cRear, aLight;
uniform vec4 rip[4];      // lake X, lake Z, age, amp
uniform vec4 met[3];      // x, y, angle, age
uniform float metA[3];
out vec4 outColor;

uvec2 hu(vec2 p) {
  uvec2 v = uvec2(ivec2(floor(p)) + 32768) * uvec2(1664525u, 1013904223u);
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}
float h21(vec2 p) { return float(hu(p).x) * (1.0 / 4294967296.0); }
vec2  h22(vec2 p) { return vec2(hu(p)) * (1.0 / 4294967296.0); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}

vec3 silk(vec2 q) {
  // Rays converge on a zenith high above the frame, as in Aurora, so the
  // curtains lean in toward the top and the sky has depth.
  float k = (1300.0 - (hz + 150.0)) / (1300.0 - q.y);
  vec2 uv = vec2((q.x * k - band.x) * band.z, (q.y - band.y) * band.w);
  if (uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
  vec4 c = texture(silkT, uv);
  float f = c.y;
  vec3 ca = f < 0.5 ? mix(cOld, cMid, smoothstep(0.0, 1.0, f * 2.0))
                    : mix(cMid, cHot, smoothstep(0.0, 1.0, f * 2.0 - 1.0));
  float lum = dot(ca, vec3(0.3, 0.55, 0.15));
  ca = mix(vec3(lum) * vec3(0.92, 0.96, 1.04), ca, colour);
  // Fade the silk out at the very top so the exposure has no edge.
  float top = 1.0 - smoothstep(0.86, 1.0, uv.y);
  return (ca * c.x + cRear * c.z + cHot * min(c.w, 1.2) * 2.2) * top;
}

vec3 stars(vec2 q, float alt) {
  vec2 pole = vec2(-halfW * 0.7, 430.0);
  vec2 v = q - pole;
  float c = cos(starAng), s = sin(starAng);
  vec2 r = vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  vec3 acc = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    float cs = l == 0 ? 30.0 : 13.0;
    vec2 gr = r / cs;
    vec2 id = floor(gr) + float(l) * 91.0;
    float h = h21(id);
    if (h < (l == 0 ? 0.72 : 0.9)) continue;
    vec2 sp = 0.15 + 0.7 * h22(id + 5.0);
    float dpx = length(fract(gr) - sp) * cs * unitPx;
    float mag = pow(fract(h * 13.7), l == 0 ? 4.0 : 9.0);
    float twk = 0.7 + 0.3 * sin(tw * (1.5 + 3.0 * h) + h * 60.0);
    float glint = step(0.72, h21(id + vec2(hatSeed * 17.0, hatSeed * 5.0))) * hat;
    float b = (0.04 + 0.9 * mag) * twk + glint * (0.6 + 1.4 * mag);
    float sz = 0.6 + 0.6 * mag + glint * 0.6;
    vec3 tint = mix(vec3(0.75, 0.84, 1.0), vec3(1.0, 0.9, 0.76), fract(h * 71.3));
    acc += tint * exp(-dpx * dpx / (sz * sz)) * b;
  }
  return acc * starK * smoothstep(0.0, 80.0, alt);
}

vec3 meteors(vec2 q) {
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    if (metA[j] <= 0.0) continue;
    vec4 M = met[j];
    vec2 dir = vec2(cos(M.z), sin(M.z));
    float age = M.w;
    vec2 head = M.xy + dir * 650.0 * age;
    float L = min(650.0 * age, 190.0);
    vec2 v = q - head;
    float along = -dot(v, dir);
    if (along < -10.0 || along > L + 10.0) continue;
    float perp = abs(v.x * dir.y - v.y * dir.x) * unitPx;
    float t = clamp(1.0 - along / L, 0.0, 1.0);
    float line = exp(-perp * perp / 1.2);
    float fade = smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.35, 0.75, age));
    float hd = length(v) * unitPx;
    acc += (cHot * line * t * t * 1.4 + cHot * exp(-hd * hd / 8.0) * 2.0) * fade * metA[j];
  }
  return acc;
}

vec3 scene(vec2 q) {
  float alt = q.y - hz;
  vec4 Tr = texture(terr, vec2((q.x - terrX.x) * terrX.y, 0.5));
  float px = 1.0 / unitPx;
  float tree = 1.0 - smoothstep(Tr.x - px, Tr.x + px, alt);
  vec3 ink = vec3(0.0003, 0.0004, 0.0007);
  if (tree > 0.999) return ink;
  vec3 col;
  if (alt < Tr.y) {
    col = vec3(0.0005, 0.0008, 0.0013) + aLight * (0.002 + 0.035 * exp(-(Tr.y - alt) / 2.0));
  } else if (alt < Tr.z) {
    float snow = smoothstep(Tr.z - 50.0, Tr.z - 6.0, alt) * Tr.w;
    col = vec3(0.0012, 0.0019, 0.0036) + aLight * (0.002 + 0.04 * snow + 0.06 * exp(-(Tr.z - alt) / 2.0));
  } else {
    col = mix(vec3(0.007, 0.012, 0.024), vec3(0.0008, 0.0012, 0.004), smoothstep(0.0, 320.0, alt));
    col += aLight * 0.05 * exp(-alt / 90.0);
    col += stars(q, alt);
    col += meteors(q);
    col += silk(q);
  }
  return mix(col, ink, tree);
}

void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  vec3 col;
  if (q.y >= hz) {
    col = scene(q);
  } else {
    float d = hz - q.y;
    float Z = 900.0 / (d + 2.0);
    float X = q.x * Z / 300.0 + lakeX;
    float amb = n2(vec2(X * 0.06, Z * 0.4 - tw * 0.3)) - 0.5;
    float wave = 0.0, crest = 0.0;
    for (int j = 0; j < 4; j++) {
      vec4 R = rip[j];
      if (R.w <= 0.0) continue;
      vec2 dv = vec2(X - R.x, (Z - R.y) * 2.0);
      float front = length(dv) - R.z * 16.0;
      float env = exp(-front * front / 6.0) * exp(-R.z * 1.1) * R.w;
      float s = sin(front * 2.6);
      wave += s * env;
      crest += max(s, 0.0) * env;
    }
    float persp = 1.0 + d * 0.04;
    float disp = (amb * 0.8 * waterK + wave * 0.45) * persp;
    vec3 refl = scene(vec2(q.x + disp * 1.5, hz + d + disp * 2.5));
    float fres = mix(0.6, 0.22, smoothstep(0.0, 190.0, d));
    col = refl * fres * vec3(0.84, 0.92, 1.0);
    col += aLight * crest * 0.08;
    vec2 gc = vec2(X * 0.4, Z * 1.3);
    vec2 gid = floor(gc);
    float gp = step(0.87, h21(gid + vec2(hatSeed * 7.0, hatSeed * 3.0)));
    vec2 gpos = 0.2 + 0.6 * h22(gid + 4.0);
    float gdx = length((fract(gc) - gpos) * vec2(1.0, 2.5)) * 9.0;
    col += aLight * 1.4 * gp * hat * exp(-gdx * gdx) * smoothstep(6.0, 50.0, d);
    float mist = (0.5 + 0.5 * sin(X * 0.03 + tw * 0.12 + 2.0 * sin(Z * 0.05 - tw * 0.07))) * exp(-d / 30.0);
    col += aLight * mist * 0.05;
  }
  col += aLight * 0.01 * exp(-abs(q.y - hz) / 8.0);
  col = 1.0 - exp(-col * 1.15);
  outColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

  // ------------------------------------------------------------ layers
  // A layer is one silk: its forms (two during a crossfade), exposures, view
  // box and auto-exposure. `place` is where its form sits in the exposure, as
  // fractions: x0, x1, y0, y1 (y from the bottom).
  function makeLayer(place, family) {
    return { place, family, forms: [], phase: Math.random() * 100, bassPhase: 0, bassDir: 1,
      journey: 0, view: null, level: 0, frames: 0,
      walkPhases: Array.from({ length: 8 }, () => Math.random() * TAU) };
  }
  const WALK_F = [0.19, 0.23, 0.29, 0.17, 0.13, 0.11, 0.21, 0.15];

  function makeForm(fam, avoid) {
    const list = FORMS[fam];
    let k = Math.floor(Math.random() * list.length);
    if (k === avoid) k = (k + 1) % list.length;
    const f = { fam, preset: k, base: list[k].slice(), fade: 0, weight: 0, guard: 0, stuck: 0,
      co: [0, 0, 0, 0], wx: new Float32Array(WALKERS), wy: new Float32Array(WALKERS), burn: new Uint8Array(WALKERS) };
    for (let i = 0; i < WALKERS; i++) respawn(f, i);
    return f;
  }
  function respawn(f, i) {
    f.wx[i] = Math.random() * 2 - 1;
    f.wy[i] = Math.random() * 2 - 1;
    f.burn[i] = BURN_IN;
  }
  function pickForm(L, fam) {
    if (fam === undefined) fam = L.family;
    const cur = L.forms[0];
    const next = makeForm(fam, cur && cur.fam === fam ? cur.preset : -1);
    if (L.forms.length > 1) L.forms[1] = next; else L.forms.push(next);
    L.journey = 0;
  }

  const D0 = 1e-7;
  function lyapunov(f, A, B, C, D, dj, steps) {
    let sum = 0;
    for (let j = 0; j < 3; j++) {
      let x = f.wx[j * 97], y = f.wy[j * 97];
      let u = x + D0, v = y;
      for (let n = 0; n < steps; n++) {
        let nx, ny, nu, nv;
        if (dj) {
          nx = lsin(A * y) - lsin(B * x + QUARTER); ny = lsin(C * x) - lsin(D * y + QUARTER);
          nu = lsin(A * v) - lsin(B * u + QUARTER); nv = lsin(C * u) - lsin(D * v + QUARTER);
        } else {
          nx = lsin(A * y) + C * lsin(A * x + QUARTER); ny = lsin(B * x) + D * lsin(B * y + QUARTER);
          nu = lsin(A * v) + C * lsin(A * u + QUARTER); nv = lsin(B * u) + D * lsin(B * v + QUARTER);
        }
        const dx = nu - nx, dy = nv - ny;
        const d = Math.sqrt(dx * dx + dy * dy) || D0 * 1e-6;
        sum += Math.log(d / D0);
        x = nx; y = ny;
        u = x + dx * D0 / d; v = y + dy * D0 / d;
      }
    }
    return sum / (3 * steps);
  }

  // The hot loop: iterate one form and splat bilinearly into the slow and
  // fast exposures; kick light (hotCol per column) goes into `hot`.
  function splat(f, steps, fr) {
    const { slow, fast, hot, hotCol, W, H, sx, sy, ox, oy, shear, wFast, gainW } = fr;
    const co = f.co, dj = f.fam === 1;
    const A = co[0] * SIN_SCALE, B = co[1] * SIN_SCALE;
    const C = dj ? co[2] * SIN_SCALE : co[2], D = dj ? co[3] * SIN_SCALE : co[3];
    const wx = f.wx, wy = f.wy, burn = f.burn;
    const lw = (1 - 0.95 * f.guard) * gainW, sample = f.guard < 0.5;
    const Wm = W - 1, Hm = H - 1;
    let mnx = fr.mnx, mxx = fr.mxx, mny = fr.mny, mxy = fr.mxy, lvlSum = 0, lvlN = 0;
    for (let k = 0; k < WALKERS; k++) {
      let x = wx[k] + (Math.random() - 0.5) * 2e-5, y = wy[k] + (Math.random() - 0.5) * 2e-5, b = burn[k];
      for (let n = 0; n < steps; n++) {
        let nx, ny;
        if (dj) {
          nx = lsin(A * y) - lsin(B * x + QUARTER);
          ny = lsin(C * x) - lsin(D * y + QUARTER);
        } else {
          nx = lsin(A * y) + C * lsin(A * x + QUARTER);
          ny = lsin(B * x) + D * lsin(B * y + QUARTER);
        }
        x = nx; y = ny;
        if (b > 0) { b--; continue; }
        if (x < mnx) mnx = x; if (x > mxx) mxx = x;
        if (y < mny) mny = y; if (y > mxy) mxy = y;
        const fy = y * sy + oy;
        const fx = x * sx + ox + shear * (fy - oy);
        if (fx < 0 || fy < 0 || fx >= Wm || fy >= Hm) continue;
        const ix = fx | 0, iy = fy | 0;
        const ax = fx - ix, ay = fy - iy;
        const i0 = iy * W + ix;
        const bx = ax * lw, cx = lw - bx;
        const w00 = cx * (1 - ay), w10 = bx * (1 - ay), w01 = cx * ay, w11 = bx * ay;
        slow[i0] += w00; slow[i0 + 1] += w10; slow[i0 + W] += w01; slow[i0 + W + 1] += w11;
        if (fast) {
          fast[i0] += w00 * wFast; fast[i0 + 1] += w10 * wFast; fast[i0 + W] += w01 * wFast; fast[i0 + W + 1] += w11 * wFast;
        }
        if (hot) { const hc = hotCol[ix]; if (hc > 0.01) hot[i0] += hc * lw; }
        if (sample && (n & 7) === 4) { lvlSum += slow[i0]; lvlN++; }
      }
      if (!(x > -8 && x < 8 && y > -8 && y < 8)) respawn(f, k);
      else { wx[k] = x; wy[k] = y; burn[k] = b; }
    }
    fr.mnx = mnx; fr.mxx = mxx; fr.mny = mny; fr.mxy = mxy;
    fr.lvlSum += lvlSum; fr.lvlN += lvlN;
    return lyapunov(f, A, B, C, D, dj, Math.min(steps, 90));
  }

  VIZ.register({
    id: 'aurorareinked',
    name: 'Aurora, re-inked',
    order: 812,

    params: [
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((k) => k.name), default: 0 },
      { key: 'colour', label: 'Colour', type: 'range', min: 0, max: 1, default: PRESETS.calm.colour, step: 0.01 },
      { key: 'rear', label: 'Second silk', type: 'range', min: 0, max: 1, default: PRESETS.calm.rear, step: 0.01 },
      { key: 'morph', label: 'Morph speed', type: 'range', min: 0, max: 3, default: PRESETS.calm.morph, step: 0.01 },
      { key: 'rays', label: 'Rays', type: 'range', min: 0, max: 2, default: PRESETS.calm.rays, step: 0.01 },
      { key: 'height', label: 'Curtain height', type: 'range', min: 0.5, max: 1.6, default: PRESETS.calm.height, step: 0.01 },
      { key: 'travel', label: 'Travel', type: 'range', min: 0, max: 3, default: PRESETS.calm.travel, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'water', label: 'Water', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    actions: [
      { id: 'newform', label: 'New form', run() { if (this.layers) pickForm(this.layers[0]); } },
    ],

    gallery: {
      title: 'Aurora, re-inked',
      technique: 'Two Clifford / de Jong attractors iterated on the CPU (~150k points a frame) into slow and fast Float32 exposures of the sky band, smeared upward per column into rays striated by noise, packed into an RGBA16F texture; a WebGL2 shader composes sky, stars, parallax ranges and the silk along rays converging on the zenith, and a lake that re-evaluates the sky at the rippled mirror point',
      brief: 'Strange-attractor silk hung as aurora curtains over a still mountain lake, travelling slowly along the shore. The filaments are the curtains\' lower edges, and each hangs rays above itself; the silk never repeats a drape, because the coefficients wander and the bass sweeps them. Two inks, not a spectrum: pale champagne light over dying ice-blue, near silver when calm. Each kick runs a champagne edge outward along the silk from one place and throws a ring across the lake; each snare or clap draws one shooting star; hats glint stars and scatter sparks on the water. The drop warms the front silk, hangs a second, larger silk behind it in one warm ink (rose, then amber, then copper on successive drops, each with a new form), folds faster and travels faster; the breakdown thins back to a silver veil.',
      lineage: [
        'Batch 06, idea 12 (Psychonaut, Floor): Aurora crossed with Attractor, or with Terminal. Took the Psychonaut\'s Strange Aurora (attractor silk as curtains, champagne and blue, a second warmer attractor on the drop) over the Floor\'s ASCII Aurora: glyphs on black are Terminal\'s look already, and the panel held that type engages the mind the viewer came to rest.',
        'Aurora (web/scenes/aurora.js): the lake re-evaluating the sky at the rippled mirror point, parallax ranges and pine treeline, rays converging on the zenith, kick fronts racing along the curtain and rings on the water, snare meteors, hat glints; the judges\' "every drop the same green wall" and the clipped white kick spot are what this answers.',
        'Attractor (web/scenes/attractor.js): the maps, sine table, walker nudge, Lyapunov guard, crossfaded forms, bass integrated into a sweep phase, and colour from light age.',
        'New here: the upward per-column smear that turns filaments into curtains with rays; no halo or bloom; per-drop warm ink and form for the rear silk, per the Floor\'s and Psychonaut\'s transplant of per-drop palette rotation.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.tw = 0;
      this.camX = 0;
      this.speed = 6;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0,
        low: 0, dropOn: false, auto: 0, mid: 0, high: 0, energy: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.hatSeed = 0;
      this.pulses = [];
      this.meteors = [];
      this.dropCount = 0;
      this.rearInk = 0;
      this.rearInkPrev = 0;
      this.rearInkMix = 1;
      this.layers = [
        makeLayer({ x0: 0.17, x1: 0.83, y0: 0.17, y1: 0.7 }, 0),
        makeLayer({ x0: 0.02, x1: 0.98, y0: 0.3, y1: 0.8 }, 1),
      ];
      this.W = 0; this.H = 0;
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
      for (const n of ['silkT', 'terr', 'band', 'terrX', 'res', 'unitPx', 'tw', 'lakeX', 'starAng', 'hz', 'halfW',
        'hat', 'hatSeed', 'starK', 'waterK', 'colour', 'cOld', 'cMid', 'cHot', 'cRear', 'aLight', 'rip', 'met', 'metA']) {
        u[n] = gl.getUniformLocation(prog, n);
      }
      const mkTex = (unit) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      this.silkTex = mkTex(0);
      this.terrTex = mkTex(1);
      gl.uniform1i(u.silkT, 0);
      gl.uniform1i(u.terr, 1);
      this.silkTexW = 0; this.silkTexH = 0; this.terrTexW = 0;
      this.gl = gl; this.glCanvas = c; this.u = u;
    },

    allocate(W, H) {
      this.W = W; this.H = H;
      const n = W * H;
      this.slowA = new Float32Array(n); this.fastA = new Float32Array(n);
      this.slowB = new Float32Array(n); this.hot = new Float32Array(n);
      this.pack = new Float32Array(n * 4);
      this.hotCol = new Float32Array(W);
      this.rayCol = new Float32Array(W);
      for (const L of this.layers) { L.view = null; }
    },

    // Onsets against slow baselines, as in Aurora: a pad or riser lifting a
    // band is not a hit; only a jump is.
    listen(s, dt, push, halfW) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        const r = Math.random;
        this.pulses.unshift({ x: (r() * 1.3 - 0.65) * halfW, age: 0, amp: kRaw,
          lx: (r() * 2 - 1) * 22 + this.camX * LAKE_PAR, lz: 7 + r() * 10 });
        this.pulses.length = Math.min(this.pulses.length, 4);
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        const r = Math.random;
        const leftward = r() < 0.5;
        this.meteors.unshift({
          x: (leftward ? 0.1 + r() * 0.8 : -0.9 + r() * 0.8) * halfW,
          y: 170 + r() * 110,
          ang: leftward ? Math.PI + 0.3 + r() * 0.35 : -0.3 - r() * 0.35,
          age: 0, amp: (0.6 + 0.4 * sRaw) * Math.min(1, push),
        });
        this.meteors.length = Math.min(this.meteors.length, 3);
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw, e.hat * Math.exp(-dt / 0.1));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.mid = ease(e.mid, (s[2] + s[3] + s[4]) / 300, 1.5, dt);
      e.high = ease(e.high, (s[6] + s[7] + s[8]) / 300, 3, dt);
      let tot = 0;
      for (let i = 0; i < 9; i++) tot += s[i];
      e.energy = ease(e.energy, tot / 900, 0.8, dt);
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it (as in Moiré Weave).
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) {
        e.dropOn = true;
        this.dropCount++;
        // Each drop deals the rear silk its next warm ink and a new form.
        if (this.dropCount > 1) {
          this.rearInkPrev = this.rearInk;
          this.rearInk = (this.rearInk + 1) % 3;
          this.rearInkMix = 0;
          pickForm(this.layers[1]);
        }
      } else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    // Advance one layer's walk and splat it. Returns nothing; updates L.
    runLayer(L, P, params, dt, fr, steps) {
      const e = this.env;
      if (L.forms.length === 0) {
        const f0 = makeForm(L.family, -1);
        f0.fade = 1;
        L.forms.push(f0);
      }
      L.journey += dt * P.morph;
      if (L.journey > JOURNEY_S && L.forms.length === 1) pickForm(L);
      if (L.forms.length > 1) {
        const inc = L.forms[1];
        inc.fade = Math.min(1, inc.fade + dt / FADE_S);
        if (inc.fade >= 1) L.forms.shift();
      }
      if (L.forms.length > 1) {
        const w = smooth(L.forms[1].fade);
        L.forms[0].weight = 1 - w; L.forms[1].weight = w;
      } else L.forms[0].weight = 1;

      // Bass is integrated into a sweep phase (Attractor's fix for a frozen
      // drop), and the walk's clock runs with the music's energy.
      const push = params.push;
      L.bassPhase += dt * push * e.bass * 1.3 * L.bassDir * (0.5 + 0.5 * P.morph);
      const walkRate = P.morph * (0.25 + 1.6 * e.energy + 1.0 * e.bass);
      L.phase += dt * walkRate;
      const bp = L.bassPhase, ph = L.phase;
      const sweepC = push * 0.2 * Math.sin(bp), sweepD = push * 0.14 * (Math.sin(bp * 0.71 + 1.3) - Math.sin(1.3));
      for (const f of L.forms) {
        const amp = AMP[f.fam];
        f.extra = (f.extra || 0) + dt * walkRate * 6 * f.guard;
        const q = ph + f.extra;
        for (let i = 0; i < 4; i++) {
          f.co[i] = f.base[i] + amp[i] * (0.65 * Math.sin(q * WALK_F[i] + L.walkPhases[i]) + 0.35 * Math.sin(q * WALK_F[i + 4] * 1.7 + L.walkPhases[i + 4]));
        }
        f.co[2] += sweepC; f.co[3] += sweepD;
        f.co[0] += push * 0.06 * e.mid;
      }

      // View: map the eased bounds into this layer's place in the exposure.
      if (!L.view) L.view = { x0: -2.2, x1: 2.2, y0: -2.2, y1: 2.2, fresh: true };
      const v = L.view, pl = L.place, W = this.W, H = this.H;
      const cx = (pl.x0 + pl.x1) / 2, hx = (pl.x1 - pl.x0) / 2;
      const y0 = pl.y0 * H, y1 = pl.y0 * H + (pl.y1 - pl.y0) * H * P.height;
      fr.sx = (2 * hx * W) / (v.x1 - v.x0);
      fr.sy = (y1 - y0) / (v.y1 - v.y0);
      fr.ox = cx * W - (v.x0 + v.x1) / 2 * fr.sx;
      fr.oy = (y0 + y1) / 2 - (v.y0 + v.y1) / 2 * fr.sy;
      // A slow sway: the curtain leans one way and back, as silk in a draught.
      fr.shear = 0.35 * Math.sin(this.tw * 0.05 + L.family * 2.1);
      fr.mnx = 1e9; fr.mxx = -1e9; fr.mny = 1e9; fr.mxy = -1e9; fr.lvlSum = 0; fr.lvlN = 0;

      for (const f of L.forms) {
        const st = Math.round(steps * f.weight);
        if (st < 1) continue;
        const lyap = splat(f, st, fr);
        f.lyap = f.lyap === undefined ? lyap : f.lyap + (lyap - f.lyap) * 0.1;
        const collapsed = f.lyap < 0.04 || lyap < 0 ? 1 : 0;
        if (collapsed && !f.wasCollapsed && f === L.forms[L.forms.length - 1]) L.bassDir = -L.bassDir;
        f.wasCollapsed = collapsed;
        f.guard += (collapsed - f.guard) * (collapsed ? 0.25 : 0.02);
        f.stuck = Math.max(0, f.stuck + dt * (collapsed ? 1 : -0.25));
      }
      if (L.forms.length === 1 && L.forms[0].stuck > 3) pickForm(L);

      if (fr.mxx > fr.mnx && fr.mxy > fr.mny) {
        const ccx = (fr.mnx + fr.mxx) / 2, ccy = (fr.mny + fr.mxy) / 2;
        const hw = Math.max((fr.mxx - fr.mnx) / 2 * 1.02, 1.2), hh = Math.max((fr.mxy - fr.mny) / 2 * 1.02, 1.2);
        const k = v.fresh ? 1 : 0.015;
        v.x0 += (ccx - hw - v.x0) * k; v.x1 += (ccx + hw - v.x1) * k;
        v.y0 += (ccy - hh - v.y0) * k; v.y1 += (ccy + hh - v.y1) * k;
        v.fresh = false;
      }
      if (fr.lvlN > 0) {
        const lv = fr.lvlSum / fr.lvlN;
        L.frames++;
        const eased = L.level + (lv - L.level) * 0.03;
        L.level = L.level === 0 ? lv : L.frames < 120 ? eased : Math.min(L.level * 1.015, eased);
      }
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.layers) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const halfW = ctx.width / 2;
      this.listen(signals, dt, push, halfW);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.45, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      this.rearInkMix = Math.min(1, this.rearInkMix + dt / 3);

      for (const Q of this.pulses) Q.age += dt;
      this.pulses = this.pulses.filter((Q) => Q.age < 2.5);
      for (const M of this.meteors) M.age += dt;
      this.meteors = this.meteors.filter((M) => M.age < 0.8);
      this.tw += dt;
      const cruise = P.travel * (8 + 30 * e.bass * push);
      this.speed = ease(this.speed, cruise, 0.7, dt);
      this.camX += dt * this.speed;

      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke(); p.fill(236);
        p.textAlign(p.CENTER, p.CENTER); p.textSize(20);
        p.text('Aurora, re-inked needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }

      // --- the silk exposures
      const pd = p.pixelDensity();
      const unitDev = Math.min(p.width, p.height) * pd / 600;
      const W = Math.max(64, Math.round(ctx.width * XSPAN * unitDev * CRES));
      const H = Math.max(32, Math.round((BAND1 - BAND0) * unitDev * CRES));
      if (W !== this.W || H !== this.H) this.allocate(W, H);
      const bandX0 = -halfW * XSPAN, bandW = 2 * halfW * XSPAN;

      // Kick light per column: a front racing outward both ways from each
      // origin along the silk, and a small bloom at the origin itself.
      const hotCol = this.hotCol;
      hotCol.fill(0);
      for (const Q of this.pulses) {
        const a = Q.amp * push;
        const life = Math.exp(-Q.age * 1.6);
        const bloom = Math.exp(-Q.age / 0.14);
        const front = Q.age * 380;
        for (let i = 0; i < W; i++) {
          const x = bandX0 + (i + 0.5) / W * bandW;
          const dx = Math.abs(x - Q.x);
          const f = dx - front;
          hotCol[i] += a * (Math.exp(-f * f / 500) * life + 1.2 * Math.exp(-dx * dx / 1200) * bloom);
        }
      }

      const fr = { slow: this.slowA, fast: this.fastA, hot: this.hot, hotCol, W, H,
        wFast: 1 + 1.6 * e.high, gainW: 1 };
      this.runLayer(this.layers[0], P, params, dt, fr, 120);
      const rearOn = P.rear > 0.01;
      if (rearOn) {
        const frB = { slow: this.slowB, fast: null, hot: null, hotCol, W, H, wFast: 1, gainW: 1 };
        this.runLayer(this.layers[1], P, params, dt, frB, Math.round(40 + 50 * P.rear));
      }

      // --- decay, smear upward into rays, tone, pack. Row 0 is the bottom.
      const slowDecay = Math.exp(-1 / (60 * 1.5));
      const steady = (1 - slowDecay) / (1 - FAST_DECAY);
      const LA = this.layers[0], LB = this.layers[1];
      const gainA = 6 / Math.max(1e-3, LA.level);
      const gainB = 6 / Math.max(1e-3, LB.level || 1);
      const prior = 0.4 / gainA;
      const logNorm = 1 / Math.log(1 + 48);
      // Ray tails: longer with the Rays control and the bass; striated per
      // column by two slow noises that drift with the silk.
      const kRay = Math.exp(-1 / (H * (0.07 + 0.1 * P.rays) * (0.8 + 0.4 * e.bass * push)));
      const rayCol = this.rayCol;
      const T = this.tw * (0.3 + 0.5 * P.morph);
      for (let i = 0; i < W; i++) {
        const r1 = n1(i * 0.09 + T * 0.4), r2 = n1(i * 0.23 - T * 0.7 + 30);
        rayCol[i] = P.rays * (0.08 + 1.8 * Math.pow(0.55 * r1 + 0.45 * r2, 3.5));
      }
      const rearK = P.rear;
      const sA = this.slowA, fA = this.fastA, sB = this.slowB, ht = this.hot, pk = this.pack;
      const rayNorm = 1 - kRay;
      const kHot = 0.8;
      for (let x = 0; x < W; x++) {
        let ra = 0, rf = 0, rb = 0, rh = 0;
        const rc = rayCol[x] * 2.2;
        for (let y = 0, i = x; y < H; y++, i += W) {
          const a = sA[i], f = fA[i], b = sB[i], h = ht[i];
          sA[i] = a * slowDecay; fA[i] = f * FAST_DECAY; sB[i] = b * slowDecay; ht[i] = h * 0.8;
          ra = ra * kRay + a * rayNorm;
          rf = rf * kRay + f * rayNorm;
          rb = rb * kRay + b * rayNorm;
          rh = rh * kHot + h * (1 - kHot);
          const as = a + rc * ra, fs = f + rc * rf;
          let fresh = (fs + steady * prior) / (as + prior) / steady * 0.5;
          if (fresh > 1) fresh = 1;
          const o = i * 4;
          // Squared tone: the faint haze between filaments falls to near
          // black, so the silk reads as threads with dark between them.
          const tA = Math.log(1 + as * gainA) * logNorm;
          pk[o] = tA * tA * 1.1;
          pk[o + 1] = fresh;
          let tB = rearOn ? Math.log(1 + (b + rc * 0.8 * rb) * gainB) * logNorm : 0;
          pk[o + 2] = tB * tB * 0.55 * rearK;
          pk[o + 3] = Math.log(1 + (h + 2 * rh) * gainA * 2.5) * logNorm;
        }
      }
      if (!rearOn) sB.fill(0);

      // --- terrain columns
      const margin = 0.3 * halfW + 45;
      const tx0 = -halfW - margin;
      const TN = Math.ceil((2 * (halfW + margin)) / TEX_STEP);
      if (!this.terr || this.terr.length !== TN * 4) this.terr = new Float32Array(TN * 4);
      const TD = this.terr, camX = this.camX, cw = 6.5;
      for (let k = 0; k < TN; k++) {
        const x = tx0 + k * TEX_STEP;
        const xt = x + camX;
        const bank = 3 + 4 * n1(xt * 0.02);
        const id = Math.floor(xt / cw);
        let top = bank;
        for (let c = id - 1; c <= id + 1; c++) {
          const hh = h11(c * 1.31 + 2);
          const grove = Math.max(0, Math.min(1, (n1(c * 0.07 + 5) - 0.25) / 0.35));
          const th = (6 + 22 * hh * hh) * smooth(grove);
          if (th < 2) continue;
          const pcx = (c + 0.2 + 0.6 * h11(c * 7.7)) * cw;
          const dx = Math.abs(xt - pcx);
          let t = th - dx * th / (cw * 0.5);
          t -= 1.6 * ((th - t) / 4 % 1);
          if (t > 0) top = Math.max(top, bank + t);
        }
        const sm = (x + camX * 0.45) * 0.0065 + 23;
        const mid = 12 + 44 * (0.6 * fbm1(sm) + 0.4 * ridge(sm * 1.7 + 9)) * (0.55 + 0.45 * n1(sm * 0.31));
        const sf = (x + camX * 0.2) * 0.0042 + 11;
        const far = 34 + 64 * (0.55 * ridge(sf) + 0.3 * ridge(sf * 2.1 + 4) + 0.15 * n1(sf * 6));
        TD[k * 4] = top; TD[k * 4 + 1] = mid; TD[k * 4 + 2] = far;
        TD[k * 4 + 3] = 0.4 + 0.6 * n1((x + camX * 0.2) * 0.08);
      }

      // --- GL
      const gl = this.gl, u = this.u;
      const w = Math.round(p.width * pd * RES), h = Math.round(p.height * pd * RES);
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.silkTex);
      if (this.silkTexW !== W || this.silkTexH !== H) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.FLOAT, pk);
        this.silkTexW = W; this.silkTexH = H;
      } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, pk);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.terrTex);
      if (this.terrTexW !== TN) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, TN, 1, 0, gl.RGBA, gl.FLOAT, TD);
        this.terrTexW = TN;
      } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TN, 1, gl.RGBA, gl.FLOAT, TD);

      const ink = LINKS[Math.min(LINKS.length - 1, params.inks | 0)];
      const col = clamp01(P.colour);
      // Colour also warms the steady light: calm is pale and cool, the drop
      // is champagne.
      const mid = ink.mid.map((c, i) => {
        const g = 0.3 * ink.mid[0] + 0.55 * ink.mid[1] + 0.15 * ink.mid[2];
        return (g + (c - g) * col) * 1.0;
      });
      const rm = smooth(this.rearInkMix);
      const cRear = ink.rear[this.rearInk].map((c, i) => c * rm + ink.rear[this.rearInkPrev][i] * (1 - rm));
      // Ambient silk light on land and water: the silk's steady colour,
      // warmed by the rear ink when it hangs.
      const lk = 0.45 + 0.4 * e.bass * push;
      const aLight = mid.map((c, i) => (c * 0.8 + cRear[i] * 0.5 * rearK) * lk * 0.5);

      gl.viewport(0, 0, w, h);
      gl.uniform4f(u.band, bandX0, BAND0, 1 / bandW, 1 / (BAND1 - BAND0));
      gl.uniform2f(u.terrX, tx0, 1 / (TN * TEX_STEP));
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.unitPx, Math.min(w, h) / 600);
      gl.uniform1f(u.tw, this.tw % 3000);
      gl.uniform1f(u.lakeX, this.camX * LAKE_PAR);
      gl.uniform1f(u.starAng, (this.tw * 0.006) % TAU);
      gl.uniform1f(u.hz, HZ);
      gl.uniform1f(u.halfW, halfW);
      gl.uniform1f(u.hat, e.hat * push);
      gl.uniform1f(u.hatSeed, this.hatSeed);
      gl.uniform1f(u.starK, 1);
      gl.uniform1f(u.waterK, params.water);
      gl.uniform1f(u.colour, col);
      gl.uniform3fv(u.cOld, ink.old);
      gl.uniform3fv(u.cMid, mid);
      gl.uniform3fv(u.cHot, ink.hot);
      gl.uniform3fv(u.cRear, cRear);
      gl.uniform3fv(u.aLight, aLight);
      const rip = new Float32Array(16);
      this.pulses.forEach((Q, i) => rip.set([Q.lx, Q.lz, Q.age, Q.amp * push * params.water], i * 4));
      gl.uniform4fv(u.rip, rip);
      const met = new Float32Array(12), metA = new Float32Array(3);
      this.meteors.forEach((M, i) => { met.set([M.x, M.y, M.ang, M.age], i * 4); metA[i] = M.amp; });
      gl.uniform4fv(u.met, met);
      gl.uniform1fv(u.metA, metA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
