// Night Train — a steam train crossing a sleeping country at night, in
// 16-bit pixel art seen through a CRT.
//
// The camera rides alongside the train, so the train holds still and the
// world streams past it in parallax: stars and moon, streaky moonlit cloud,
// a far ridge with village lights, mist, a middle range of hills with pines,
// farmhouses and whole towns, trackside signals and station lamps, the
// embankment (or a truss bridge over a river that mirrors the sky), and
// telegraph poles whipping past in front with their wires rising and falling.
// The music sets the train's speed, eased so it surges and glides but never
// jerks.
//
// Craft notes:
// - Everything is drawn in JS into a 32-bit buffer at 180 lines (width follows
//   the aspect), with Bayer-dithered gradients, dithered transparency for smoke
//   and mist, and additive light quantised to four dithered steps, so glows
//   stay pixel art. Layer offsets snap to whole pixels, as a 16-bit scroller's
//   would.
// - One WebGL2 pass is the CRT: gentle barrel curvature, scanlines whose beam
//   widens on bright rows, sharp-bilinear columns, bloom from the texture's own
//   mip chain (so it costs two texture reads), a faint aperture mask on large
//   screens, and a vignette.
// - The kick is the engine's chuff. Each one blows a smoke puff out of the
//   chimney lit white-orange from the firebox, flares the cab window and blinks
//   one carriage window; the puffs then drift back over the carriages, so the
//   plume is a readable record of the beat. That keeps the kick in the top
//   right of the train rather than the whole frame.

(function () {
  // 196 lines: the sky and the train fit in the top 160, and the rows below the
  // rail give the embankment and the river under the bridge room to read.
  const H = 196;
  const RAIL = 160;    // rail top row
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hu = (n) => {
    n |= 0;
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  };
  const h2 = (a, b) => hu(Math.imul(a | 0, 0x27d4eb2d) + Math.imul(b | 0, 0x165667b1) + 0x3c6ef372);
  const n1 = (x) => {
    const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f);
    const a = hu(i); return a + (hu(i + 1) - a) * f;
  };
  const fbm = (x) => (0.5 * n1(x) + 0.25 * n1(x * 2.1 + 17) + 0.125 * n1(x * 4.3 + 31)) / 0.875;
  const ridge = (x) => { const a = 1 - Math.abs(2 * n1(x) - 1); return a * a; };
  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const pk = (c) => (255 << 24) | (Math.max(0, Math.min(255, c[2])) << 16) | (Math.max(0, Math.min(255, c[1])) << 8) | Math.max(0, Math.min(255, c[0]));

  // Sky stops (top → horizon), far ridge, its moonlit rim, middle hills,
  // near ground, mist. Each mood is a night, not a set of random colours.
  const MOODS = [
    { name: 'Indigo', sky: ['#05061a', '#10154a', '#232a78', '#4a4598', '#9a6ab0'], far: '#2b2d68', rim: '#6a68b0', mid: '#14163a', near: '#0a0b20', mist: '#6a64b0' },
    { name: 'Violet', sky: ['#0d0418', '#2a0f46', '#4e1a6e', '#8a2c84', '#e0609a'], far: '#3c1c5c', rim: '#9a5ab0', mid: '#1e0c34', near: '#10061e', mist: '#b05aa0' },
    { name: 'Emerald', sky: ['#020c14', '#06283a', '#0c4658', '#17706e', '#6ac8a0'], far: '#0e3c4a', rim: '#4a9a98', mid: '#07202a', near: '#041218', mist: '#4aa092' },
    { name: 'Ember', sky: ['#0e0610', '#2c0c28', '#5a1838', '#a03a42', '#f4a060'], far: '#4a1c34', rim: '#b0606a', mid: '#240c1c', near: '#140610', mist: '#c07060' },
  ].map((m) => ({ sky: m.sky.map(hex), far: hex(m.far), rim: hex(m.rim), mid: hex(m.mid), near: hex(m.near), mist: hex(m.mist) }));
  const SKY_Y = [0, 28, 58, 88, 114];

  const C = {
    moon: hex('#f4ecd0'), moonShade: hex('#c2b8a2'), moonCrater: hex('#a8a090'), moonGlow: hex('#8a86b8'),
    amber: hex('#ffb850'), amberHot: hex('#ffe6a8'), warm: hex('#ff9a40'), white: hex('#fff6e0'),
    fire: hex('#ff8a30'), fireHot: hex('#ffe0a0'),
    body: hex('#3a1a2c'), bodyDark: hex('#220e1c'), stripe: hex('#b08040'), roof: hex('#171022'), rimT: hex('#9a8ab8'),
    iron: hex('#141420'), ironRim: hex('#5a5a80'), brass: hex('#d8a040'), wheel: hex('#0c0c14'), rod: hex('#b8c0d8'),
    loco: hex('#1c3a36'), locoRim: hex('#78b8a4'), locoDark: hex('#0e1e1e'), red: hex('#a0242a'),
    steel: hex('#8a90b0'), steelDark: hex('#2a2a3c'), ballast: hex('#2a2632'), ballast2: hex('#3a3444'),
    girder: hex('#262646'), girderRim: hex('#9090c8'), stone: hex('#262436'),
    pole: hex('#05050c'), poleRim: hex('#34345a'), wire: hex('#07070f'),
    smokeLight: hex('#8a86aa'), smokeDark: hex('#3a3654'), person: hex('#3a1c1c'),
    signalR: hex('#ff4040'), signalG: hex('#50ff90'), sodium: hex('#ffa040'),
  };
  const FW = ['#ff5ab4', '#5af0ff', '#ffd25a', '#8aff7a', '#b47aff', '#ff7a4a'].map(hex);
  const PARTY = ['#ff5ab4', '#5ae0ff', '#b47aff', '#8aff9a'].map(hex);

  // Render state, shared by the drawing helpers below.
  let W = 320, buf = null;

  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
  const putD = (x, y, c, a) => { if (x >= 0 && y >= 0 && x < W && y < H && a > B4[((y & 3) << 2) | (x & 3)]) buf[y * W + x] = c; };
  const rect = (x, y, w, h, c) => {
    const x0 = Math.max(0, x), x1 = Math.min(W, x + w), y0 = Math.max(0, y), y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++) buf.fill(c, yy * W + x0, yy * W + x1);
  };
  // Additive light in four dithered steps, so glows keep the pixel look.
  const glow = (x, y, c, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0.02) return;
    const q = Math.min(a, 1.5) * 4; let l = Math.floor(q);
    if (q - l > B4[((y & 3) << 2) | (x & 3)]) l++;
    if (!l) return;
    const k = l / 4, i = y * W + x, v = buf[i];
    const r = Math.min(255, (v & 255) + c[0] * k), g = Math.min(255, ((v >> 8) & 255) + c[1] * k), b = Math.min(255, ((v >> 16) & 255) + c[2] * k);
    buf[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  };
  const halo = (cx, cy, rad, c, a) => {
    const R = Math.ceil(rad);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.sqrt(x * x + y * y) / rad;
      if (d < 1) glow(cx + x, cy + y, c, a * (1 - d) * (1 - d));
    }
  };
  const line = (x0, y0, x1, y1, c) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 400; n++) {
      put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  };
  const disc = (cx, cy, r, c) => {
    const R = Math.ceil(r);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= r * r + 0.5) put(cx + x, cy + y, c);
  };

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform sampler2D img;
uniform vec2 lo;
uniform vec2 res;
uniform float crt;
out vec4 o;
vec3 tx(int x, int y) {
  return texelFetch(img, ivec2(clamp(x, 0, int(lo.x) - 1), clamp(y, 0, int(lo.y) - 1)), 0).rgb;
}
vec3 rowAt(float px, int y) {
  float ix = floor(px - 0.5);
  float fx = smoothstep(0.25, 0.75, px - 0.5 - ix);
  return mix(tx(int(ix), y), tx(int(ix) + 1, y), fx);
}
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  uv.y = 1.0 - uv.y;
  vec2 c = uv * 2.0 - 1.0;
  float k = 0.05 * crt;
  c *= 1.0 + k * vec2(c.y * c.y, c.x * c.x);
  c /= 1.0 + k * 0.35;
  uv = c * 0.5 + 0.5;
  vec2 edge = smoothstep(vec2(-0.001), vec2(0.006), uv) * smoothstep(vec2(-0.001), vec2(0.006), 1.0 - uv);
  vec2 p = uv * lo;
  // Sharp pixels when the CRT is off.
  vec3 flat_ = rowAt(p.x, int(floor(p.y)));
  // Scanlines: two rows, each a beam that widens on bright pixels.
  float py = p.y - 0.5;
  float iy = floor(py), fy = py - iy;
  vec3 r0 = rowAt(p.x, int(iy)), r1 = rowAt(p.x, int(iy) + 1);
  float l0 = dot(r0, vec3(0.3, 0.5, 0.2)), l1 = dot(r1, vec3(0.3, 0.5, 0.2));
  float s0 = mix(0.26, 0.46, l0), s1 = mix(0.26, 0.46, l1);
  vec3 scan = r0 * exp(-fy * fy / (2.0 * s0 * s0)) + r1 * exp(-(1.0 - fy) * (1.0 - fy) / (2.0 * s1 * s1));
  scan *= 1.28;
  vec3 col = mix(flat_, scan, crt);
  vec3 bl = textureLod(img, uv, 2.0).rgb * 0.55 + textureLod(img, uv, 3.6).rgb * 0.45;
  col += bl * bl * (0.35 + 0.45 * crt) + bl * 0.06;
  float fm = mod(gl_FragCoord.x, 3.0);
  vec3 mask = fm < 1.0 ? vec3(1.06, 0.95, 0.95) : fm < 2.0 ? vec3(0.95, 1.06, 0.95) : vec3(0.95, 0.95, 1.06);
  col *= mix(vec3(1.0), mask, crt * smoothstep(600.0, 1000.0, res.y));
  col *= 1.0 - 0.22 * crt * dot(c, c) * 0.5;
  o = vec4(col * edge.x * edge.y, 1.0);
}`;

  VIZ.register({
    id: 'nighttrain',
    name: 'Night Train',
    order: 301,

    params: [
      { key: 'sky', label: 'Night', type: 'select', options: ['Wandering', 'Indigo', 'Violet', 'Emerald', 'Ember'], default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Train speed', type: 'range', min: 0.2, max: 2.5, default: 1, step: 0.01 },
      { key: 'smoke', label: 'Steam', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'fireworks', label: 'Fireworks', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'crt', label: 'CRT', type: 'range', min: 0, max: 1, default: 0.85, step: 0.01 },
    ],

    actions: [],

    gallery: {
      title: 'Night Train',
      technique: 'JS pixel renderer into a 180-line 32-bit buffer (Bayer-dithered gradients, dithered smoke transparency, four-step additive light), eight parallax layers with whole-pixel scrolling, uploaded as a texture to one WebGL2 CRT pass (curvature, brightness-dependent scanline beam, sharp-bilinear columns, mip-chain bloom, aperture mask, vignette); music detected as onsets against slow baselines',
      brief: 'A steam train crossing a sleeping country at night, in 16-bit pixel art on a CRT. The camera rides alongside, so the world streams past in parallax: stars, moon and moonlit cloud, a far ridge with village lights, mist, hills with pines, farms and towns, trackside signals and station lamps, the embankment or a truss bridge over a river that mirrors the sky, and telegraph poles whipping by in front with their wires rising and falling. The music sets the speed. Each kick is the engine\'s chuff: a puff of smoke blown out of the chimney lit white-orange by the firebox, a flare in the cab window and one carriage window blinking, and the puffs drift back over the train so the plume records the beat. Each snare or clap throws a spray of sparks off the wheels onto the rail. Hats set stars glinting. Bass lifts the speed and the steam. The drop switches on a town\'s worth of lights across the hills, fires fireworks over the horizon, turns a few windows into party colours and warms the horizon; the breakdown glides to a slow roll under the moon.',
      lineage: [
        'Brief 01 (batch 03): Night Train, pixel art and a CRT. Built with Aurora and Flyover\'s Night drive in mind: several planes of light on black, travel you can feel, and Raph\'s batch 02 note that the kick must be seen but confined.',
        'Decision: the camera rides alongside the train rather than looking out of its window, so the train is a held subject and the whole world streams past it in eight parallax planes. The kick became the engine\'s chuff (a fire-lit puff out of the chimney) because a steam train already speaks in beats, and the puffs drifting back record the rhythm across the frame without lighting it.',
        'v1: 180 lines, pixel renderer in JS plus a WebGL2 CRT pass. Jolt: calm, kickArea 0.11 but ratio 1.13 (the kick barely beat the scrolling). The locomotive read as a dark box, the steam as stippled grey balls, the window light on the bank as a striped rug.',
        'v2: loco rebuilt larger with a green body, brass bands, red spoked drivers turning with distance and a working coupling rod; steam blended in dithered steps instead of stippled; the fire lights the plume nearest the chimney on every chuff; bigger fireworks and snare sparks off three wheels; a bridge section guaranteed every third chunk.',
        'v3: 196 lines so the rows under the rail have room: the bridge now crosses a river that mirrors the far sky, with a flickering moon path. A flame tongue out of the stack on each kick. Jolt: calm, kickArea 0.16, ratio 1.14; the heat map\'s brightest block is the chimney.',
      ],
    },

    gl: null,
    glCanvas: null,
    glFailed: false,

    setup() {},

    enter() {
      this.lastMs = null;
      this.t = 0;
      this.camX = 0;
      this.speed = 40;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, kAvg: 0, drop: 0, b4: 0, b8: 0, prevK: 0, prevS: 0, prevH: 0 };
      this.since = { kick: 9, snare: 9, hat: 9, wisp: 0 };
      this.hatSeed = 0;
      this.puffs = [];
      this.sparks = [];
      this.rockets = [];
      this.fw = [];
      this.fwTimer = 0.5;
      this.fire = 0;         // firebox flare
      this.blink = { k: 0, i: 0, a: 0 };
      this.railFlash = [];
      this.stars = [];
      const r = Math.random;
      for (let i = 0; i < 900; i++) {
        this.stars.push({ x: r() * 2048, y: r() * 108, m: Math.pow(r(), 3), tint: r(), ph: r() * 6.28, f: 0.8 + r() * 2.5, id: i });
      }
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      try {
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
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.useProgram(prog);
        this.u = {};
        for (const n of ['img', 'lo', 'res', 'crt']) this.u[n] = gl.getUniformLocation(prog, n);
        this.tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(this.u.img, 0);
        this.gl = gl; this.glCanvas = c;
      } catch (err) {
        console.warn('Night Train: CRT pass unavailable', err);
        this.glFailed = true;
      }
    },

    // Onsets against slow baselines, as in Aurora: a pad or riser lifting a
    // whole band is not a hit, only a jump is.
    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.onKick(kRaw * Math.min(1.4, push));
      }
      e.prevK = kRaw;
      e.kick = Math.max(kRaw, e.kick * Math.exp(-dt / 0.13));
      e.kAvg = ease(e.kAvg, e.kick, 1.2, dt);
      e.drop = ease(e.drop, clamp01((e.kAvg - 0.06) / 0.2), e.kAvg > e.drop ? 1.2 : 0.6, dt);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        this.onSnare((0.6 + 0.4 * sRaw) * Math.min(1.4, push));
      }
      e.prevS = sRaw;
      e.snare = Math.max(sRaw, e.snare * Math.exp(-dt / 0.16));

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 1) % 997;
      }
      e.prevH = hRaw;
      e.hat = Math.max(hRaw * push, e.hat * Math.exp(-dt / 0.12));

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
    },

    onKick(amp) {
      const L = this.layout, r = Math.random;
      if (!L) return;
      // A chuff: a hot puff blown hard out of the chimney.
      this.puffs.push({
        x: L.chimX + 2.5, y: L.chimTop - 3, vx: -this.speed * 0.1, vy: -42 * (0.6 + 0.4 * amp),
        r: 7, grow: 16, age: 0, life: 3.6, heat: Math.min(1.3, amp * 1.15), a: 0.95, seed: (r() * 1e6) | 0,
      });
      this.fire = Math.max(this.fire, Math.min(1.3, amp));
      const nCar = L.cars.length;
      if (nCar) this.blink = { k: (r() * nCar) | 0, i: (r() * 8) | 0, a: Math.min(1.2, amp) };
    },

    onSnare(amp) {
      const L = this.layout, r = Math.random;
      if (!L || !L.wheels.length) return;
      for (let s = 0; s < 3; s++) {
        const wx = L.wheels[(r() * L.wheels.length) | 0];
        this.railFlash.push({ x: wx, a: amp });
        const n = 26 + ((r() * 14) | 0);
        for (let i = 0; i < n; i++) {
          this.sparks.push({
            x: wx + r() * 2 - 1, y: RAIL - 0.5, vx: -(40 + r() * 200) * (0.6 + 0.4 * amp) + r() * 40,
            vy: -(20 + r() * 95) * amp, age: 0, life: 0.3 + r() * 0.45,
          });
        }
      }
      if (this.sparks.length > 220) this.sparks.splice(0, this.sparks.length - 220);
    },

    mood(params) {
      const sel = params.sky | 0;
      if (sel > 0) return MOODS[(sel - 1) % MOODS.length];
      // Wandering: each night holds ~40 s, crossfading over ~10 s.
      const T = this.t / 40, i = Math.floor(T), f = smooth(0.75, 1, T - i);
      const a = MOODS[i % MOODS.length], b = MOODS[(i + 1) % MOODS.length];
      if (f <= 0) return a;
      const m = {};
      for (const k of Object.keys(a)) m[k] = k === 'sky' ? a.sky.map((c, j) => mixc(c, b.sky[j], f)) : mixc(a[k], b[k], f);
      return m;
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.t === undefined) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;

      W = Math.max(120, Math.round(H * ctx.width / ctx.height));
      if (!this.buf || this.buf.length !== W * H) {
        this.buf = new Uint32Array(W * H);
        this.u8 = new Uint8Array(this.buf.buffer);
      }
      buf = this.buf;
      this.makeLayout();
      this.listen(signals, dt, push);
      const e = this.env;
      this.t += dt;

      // Travel: the music sets the speed, eased over ~1.5 s, so the drop
      // surges and the breakdown glides.
      const cruise = params.speed * (28 + 60 * e.bass * Math.min(push, 1.5) + 110 * e.drop);
      this.speed = ease(this.speed, cruise, 0.6, dt);
      this.camX += dt * this.speed;

      this.step(dt, params);
      const M = this.mood(params);
      this.render(M, params);
      this.present(p, ctx, params);
    },

    makeLayout() {
      if (this.layout && this.layout.W === W) return;
      const front = Math.round(W * 0.87);
      const loco = front - 78;
      const cars = [];
      for (let x = loco - 80; x > -80; x -= 80) cars.push(x);
      const wheels = [loco + 44, loco + 57, loco + 70, loco + 5, loco + 15];
      for (const x of cars) wheels.push(x + 8, x + 16, x + 60, x + 68);
      this.layout = { W, front, loco, cars, wheels: wheels.filter((x) => x > 2 && x < W - 2), chimX: loco + 68, chimTop: 122 };
    },

    step(dt, params) {
      const e = this.env, L = this.layout, r = Math.random;
      // Continuous steam between chuffs, thicker with the bass.
      this.since.wisp += dt;
      const wispK = params.smoke * (0.25 + 0.75 * e.bass);
      if (this.since.wisp > 0.07 && wispK > 0.05) {
        this.since.wisp = 0;
        this.puffs.push({ x: L.chimX + 2.5, y: L.chimTop - 1, vx: -this.speed * 0.2, vy: -18 - r() * 10, r: 2.2, grow: 7,
          age: 0, life: 2.2, heat: 0.08, a: 0.35 * Math.min(1.6, wispK), seed: (r() * 1e6) | 0 });
      }
      const drag = this.speed;
      for (const P of this.puffs) {
        P.age += dt;
        // The steam stops in the air as the train runs on, so it slides back
        // at ground speed and rises more slowly.
        P.vx = ease(P.vx, -drag * 0.92, 1.6, dt);
        P.vy = ease(P.vy, -5, 1.4, dt);
        P.x += P.vx * dt; P.y += P.vy * dt;
        P.r += P.grow * dt / (1 + P.age * 0.8);
      }
      this.puffs = this.puffs.filter((P) => P.age < P.life && P.x + P.r > -8);
      if (this.puffs.length > 70) this.puffs.splice(0, this.puffs.length - 70);

      for (const S of this.sparks) {
        S.age += dt;
        S.px = S.x; S.py = S.y;
        S.vy += 320 * dt;
        S.x += S.vx * dt; S.y += S.vy * dt;
        if (S.y > RAIL + 1 && S.vy > 0) { S.y = RAIL + 1; S.vy *= -0.35; S.vx *= 0.7; }
      }
      this.sparks = this.sparks.filter((S) => S.age < S.life);
      for (const F of this.railFlash) F.a *= Math.exp(-dt / 0.12);
      this.railFlash = this.railFlash.filter((F) => F.a > 0.03);
      this.fire *= Math.exp(-dt / 0.14);
      this.blink.a *= Math.exp(-dt / 0.16);

      // Fireworks: a drop-only layer, launched on their own clock.
      const farOff = this.camX * 0.08;
      this.fwTimer -= dt * e.drop * params.fireworks * 1.5;
      if (this.fwTimer <= 0 && e.drop > 0.3 && params.fireworks > 0) {
        this.fwTimer = 0.6 + r() * 0.7;
        const tx = W * (0.08 + r() * 0.84);
        this.rockets.push({ wx: tx + farOff, y: 112, vy: -(95 + r() * 40), ty: 22 + r() * 45, col: FW[(r() * FW.length) | 0],
          col2: FW[(r() * FW.length) | 0], age: 0 });
      }
      for (const R of this.rockets) {
        R.age += dt;
        R.y += R.vy * dt;
        if (R.y <= R.ty && !R.done) {
          R.done = true;
          const n = 56 + ((r() * 30) | 0), sp = 30 + r() * 22;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + r() * 0.2, v = sp * (i % 3 ? 0.8 + 0.3 * r() : 0.25 + 0.5 * r());
            this.fw.push({ wx: R.wx, y: R.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 1.3 + r() * 0.8,
              col: r() < 0.7 ? R.col : R.col2, seed: r() });
          }
        }
      }
      this.rockets = this.rockets.filter((R) => !R.done);
      for (const F of this.fw) {
        F.age += dt;
        F.vx *= Math.exp(-dt * 1.4); F.vy *= Math.exp(-dt * 1.4);
        F.vy += 14 * dt;
        F.wx += F.vx * dt; F.y += F.vy * dt;
      }
      this.fw = this.fw.filter((F) => F.age < F.life);
      if (this.fw.length > 500) this.fw.splice(0, this.fw.length - 500);
    },

    render(M, params) {
      const e = this.env, t = this.t, camX = this.camX, L = this.layout;
      const drop = e.drop, bass = e.bass;

      // ---- Sky: dithered bands between the mood's stops; the drop warms the
      // horizon toward the fireworks' pink.
      const pinkH = hex('#ff5a9a'), pinkL = hex('#8a2a90');
      const stops = M.sky.slice();
      stops[4] = mixc(stops[4], pinkH, 0.35 * drop);
      stops[3] = mixc(stops[3], pinkL, 0.25 * drop);
      const LV = 5;
      for (let y = 0; y < H; y++) {
        let s = 0;
        while (s < 3 && y >= SKY_Y[s + 1]) s++;
        const y0 = SKY_Y[s], y1 = SKY_Y[s + 1];
        const tt = Math.min(1, (y - y0) / (y1 - y0)) * LV;
        const lv = Math.min(LV, Math.floor(tt)), fr = tt - lv;
        const c0 = pk(mixc(stops[s], stops[s + 1], lv / LV)), c1 = pk(mixc(stops[s], stops[s + 1], Math.min(LV, lv + 1) / LV));
        const row = y * W, br = (y & 3) << 2;
        for (let x = 0; x < W; x++) buf[row + x] = fr > B4[br | (x & 3)] ? c1 : c0;
      }

      // ---- Moon and its halo.
      const mx = Math.round(W * 0.7), my = 30, mr = 10;
      const moonGlow = mixc(C.moonGlow, M.rim, 0.4);
      for (let y = my - 34; y <= my + 34; y++) for (let x = mx - 34; x <= mx + 34; x++) {
        const d = Math.hypot(x - mx, y - my);
        if (d > mr && d < 34) glow(x, y, moonGlow, (0.55 + 0.25 * bass) * Math.pow(1 - (d - mr) / 24, 2) * (d < 34 ? 1 : 0));
      }
      for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) {
        const d2 = x * x + y * y;
        if (d2 > mr * mr + 2) continue;
        const sh = (x * 0.6 + y * 0.5) / mr;
        let c = sh > 0.35 && B4[(((my + y) & 3) << 2) | ((mx + x) & 3)] < (sh - 0.35) * 2 ? C.moonShade : C.moon;
        const cr = [[-3, -2, 2.2], [3, 3, 1.6], [-1, 5, 1.2], [4, -4, 1.3], [-5, 3, 1]];
        for (const q of cr) if ((x - q[0]) ** 2 + (y - q[1]) ** 2 <= q[2] * q[2]) c = C.moonCrater;
        put(mx + x, my + y, pk(c));
      }

      // ---- Stars. Hats re-deal which ones glint.
      const sOff = camX * 0.02;
      for (const S of this.stars) {
        let x = S.x - sOff; x -= Math.floor(x / 2048) * 2048;
        if (x >= W) continue;
        const xi = x | 0, yi = S.y | 0;
        if ((xi - mx) ** 2 + (yi - my) ** 2 < (mr + 6) ** 2) continue;
        const vis = smooth(112, 70, yi);
        const glint = S.m > 0.02 && h2(S.id, this.hatSeed) < 0.16 ? e.hat : 0;
        const b = (0.18 + 1.6 * S.m) * (0.65 + 0.35 * Math.sin(t * S.f + S.ph)) * vis + glint * 1.3 * vis;
        const tint = S.tint < 0.6 ? [200, 215, 255] : S.tint < 0.85 ? [255, 235, 200] : [255, 190, 230];
        glow(xi, yi, tint, b);
        if (b > 0.7) { const a = (b - 0.6) * 0.6; glow(xi - 1, yi, tint, a); glow(xi + 1, yi, tint, a); glow(xi, yi - 1, tint, a); glow(xi, yi + 1, tint, a); }
        if (b > 1.3) { const a = (b - 1.2) * 0.4; glow(xi - 2, yi, tint, a); glow(xi + 2, yi, tint, a); glow(xi, yi - 2, tint, a); glow(xi, yi + 2, tint, a); }
      }

      // ---- Streaky cloud, dark with moonlit edges, in two bands.
      const cOff = Math.floor(camX * 0.035 + t * 1.2);
      const cloudLit = mixc(M.rim, [255, 150, 200], 0.3 * drop);
      for (let y = 14; y < 96; y++) {
        const band = Math.exp(-((y - 44) ** 2) / 70) * 0.9 + Math.exp(-((y - 80) ** 2) / 40);
        if (band < 0.05) continue;
        const row = y * W, br = (y & 3) << 2;
        for (let x = 0; x < W; x++) {
          const wx = x + cOff;
          const dens = band * (fbm(wx * 0.009 + y * 0.075) * 1.2 - 0.45 + 0.25 * n1(wx * 0.003 - y * 0.05));
          if (dens <= 0.08) continue;
          const up = band * (fbm(wx * 0.009 + (y - 1) * 0.075) * 1.2 - 0.45 + 0.25 * n1(wx * 0.003 - (y - 1) * 0.05));
          if (up < 0.08) glow(x, y, cloudLit, 0.35);
          else if (dens > 0.14 + B4[br | (x & 3)] * 0.2) {
            const v = buf[row + x];
            buf[row + x] = pk([(v & 255) * 0.72 + M.near[0] * 0.2, ((v >> 8) & 255) * 0.72 + M.near[1] * 0.2, ((v >> 16) & 255) * 0.75 + M.near[2] * 0.2]);
          }
        }
      }

      // ---- Fireworks, behind the far ridge so they burst over it.
      const farOff = camX * 0.08;
      for (const R of this.rockets) {
        const x = Math.round(R.wx - farOff);
        glow(x, Math.round(R.y), C.fireHot, 1);
        for (let k = 1; k < 5; k++) glow(x, Math.round(R.y) + k * 2, C.warm, 0.5 - k * 0.1);
      }
      for (const F of this.fw) {
        const lf = F.age / F.life;
        let a = (1 - lf) * (1 - lf) * 1.8;
        if (lf > 0.6 && h2(F.seed * 1e6, (t * 20) | 0) < 0.4) a *= 0.2;
        const x = Math.round(F.wx - farOff), y = Math.round(F.y);
        const c = lf < 0.12 ? C.white : F.col;
        glow(x, y, c, a);
        glow(Math.round(x - F.vx * 0.05), Math.round(y - F.vy * 0.05), F.col, a * 0.5);
        glow(Math.round(x - F.vx * 0.1), Math.round(y - F.vy * 0.1), F.col, a * 0.25);
        if (lf < 0.25) halo(x, y, 4, F.col, 0.3 * (1 - lf * 4));
      }

      // ---- Far ridge, with village lights; the drop lights a whole town.
      const fo = Math.floor(camX * 0.08);
      const farC = pk(mixc(M.far, M.sky[3], 0.15)), rimC = pk(M.rim);
      const yF = new Int16Array(W);
      for (let x = 0; x < W; x++) {
        const wx = x + fo;
        const top = Math.round(110 - 22 * (0.6 * ridge(wx * 0.011 + 3) + 0.4 * fbm(wx * 0.03)) - 6 * n1(wx * 0.004));
        yF[x] = top;
        put(x, top, rimC);
        for (let y = top + 1; y < 132; y++) buf[y * W + x] = farC;
      }
      for (let c = Math.floor(fo / 2) - 1; c <= Math.floor((fo + W) / 2) + 1; c++) {
        const wx = c * 2, x = wx - fo;
        if (x < 0 || x >= W) continue;
        const town = smooth(0.45, 0.7, n1(wx * 0.006 + 40));
        const th = h2(c, 7);
        const dens = 0.03 + town * (0.08 + 0.5 * drop);
        if (th < dens) {
          const y = yF[x] + 2 + Math.floor(h2(c, 9) * (4 + 10 * town));
          const q = h2(c, 11);
          const col = drop > 0.3 && q < 0.25 * drop ? PARTY[(c & 3)] : q < 0.8 ? C.amber : C.white;
          const on = 1 - smooth(dens - 0.06, dens, th) * 0.8;
          glow(x, y, col, (0.7 + 0.3 * Math.sin(t * 2 + c)) * on);
        }
      }

      // ---- Mist between the far ridge and the hills.
      const mo = camX * 0.15 + t * 3;
      for (let y = 104; y < 128; y++) {
        const k = 1 - Math.abs(y - 116) / 12;
        for (let x = 0; x < W; x++) {
          const a = k * (0.15 + 0.35 * n1((x + mo) * 0.03 + y * 0.4)) * (0.8 + 0.3 * bass);
          glow(x, y, M.mist, a * 0.5);
        }
      }

      // ---- Middle hills: pines, round trees, farms, and towns.
      const mo2 = Math.floor(camX * 0.3);
      const midC = pk(M.mid), midRim = pk(mixc(M.mid, M.rim, 0.45)), treeC = pk(mixc(M.mid, M.near, 0.6));
      const yM = (wx) => Math.round(130 - 14 * fbm(wx * 0.007 + 5) - 4 * n1(wx * 0.05));
      for (let x = 0; x < W; x++) {
        const top = yM(x + mo2);
        put(x, top, midRim);
        for (let y = top + 1; y < H; y++) buf[y * W + x] = midC;
      }
      const CELL = 9;
      for (let c = Math.floor(mo2 / CELL) - 3; c <= Math.floor((mo2 + W) / CELL) + 3; c++) {
        const cx = c * CELL + Math.floor(hu(c * 5 + 2) * 4);
        const x = cx - mo2;
        if (x < -30 || x > W + 30) continue;
        const g = yM(cx);
        const town = n1(cx * 0.0035 + 9);
        const r = hu(c * 3 + 1);
        if (town > 0.6) {
          // A town: close-packed buildings, window grids that fill with the drop.
          const bw = 6 + Math.floor(r * 5), bh = 7 + Math.floor(hu(c * 11) * (10 + 12 * (town - 0.6)));
          const bc = pk(mixc(M.mid, M.far, 0.25 + 0.2 * hu(c * 13)));
          rect(x, g - bh + 3, bw, bh, bc);
          put(x, g - bh + 3, midRim);
          for (let yy = g - bh + 5; yy < g + 1; yy += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 2) {
            const th = h2(c * 31 + xx - x, yy);
            if (th < 0.22 + 0.55 * drop) {
              const q = h2(c * 7 + xx, yy * 3);
              glow(xx, yy, drop > 0.4 && q < 0.2 * drop ? PARTY[(c + yy) & 3] : q < 0.85 ? C.amber : C.white, 0.9);
            }
          }
          if (hu(c * 17) < 0.07) {  // a spire
            for (let k = 0; k < 12; k++) rect(x + 2 - Math.floor(k / 5), g - bh + 3 - 12 + k, 1 + 2 * Math.floor(k / 5), 1, bc);
            put(x + 2, g - bh - 10, midRim);
          }
        } else if (r < 0.34) {
          const th = 5 + Math.floor(hu(c * 7) * 7);
          for (let k = 0; k < th; k++) { const w = Math.floor(k * 0.45); rect(x - w, g - th + k, 1 + 2 * w, 1, treeC); }
        } else if (r < 0.5) {
          const rr = 2.5 + hu(c * 9) * 1.5;
          disc(x, g - Math.round(rr) - 1, rr, treeC);
          put(x, g, treeC);
        } else if (r < 0.57) {
          // A farmhouse with one warm window.
          const bc = pk(mixc(M.mid, M.far, 0.3));
          rect(x, g - 5, 9, 6, bc);
          for (let k = 0; k < 3; k++) rect(x - 1 + k, g - 6 - k, 11 - 2 * k, 1, treeC);
          if (hu(c * 23) < 0.75) { glow(x + 2, g - 3, C.amber, 1); glow(x + 3, g - 3, C.amber, 1); halo(x + 3, g - 3, 4, C.amber, 0.25); }
        }
      }

      // ---- Trackside, behind the train: signals, and now and then a station
      // of sodium lamps.
      const to = Math.floor(camX * 0.72);
      for (let c = Math.floor(to / 36) - 1; c <= Math.floor((to + W) / 36) + 1; c++) {
        const x = c * 36 - to;
        const station = n1(c * 0.08 + 3) > 0.66;
        if (station) {
          rect(x, 118, 1, 42, pk(M.near));
          rect(x - 2, 117, 5, 1, pk(M.near));
          glow(x, 118, C.sodium, 1.2);
          halo(x, 119, 11, C.sodium, 0.45);
        } else if (hu(c * 13 + 5) < 0.12) {
          rect(x, 122, 1, 38, pk(M.near));
          rect(x - 1, 118, 3, 5, pk(C.iron));
          const green = drop > 0.3 || hu(c * 3) < 0.5;
          glow(x, 120, green ? C.signalG : C.signalR, 1.3);
          halo(x, 120, 6, green ? C.signalG : C.signalR, 0.4);
        }
      }

      // ---- Ground: embankment, or a truss bridge over a river.
      const go = Math.floor(camX);
      const nearC = pk(M.near), grass2 = pk(mixc(M.near, M.mid, 0.6));
      const bal = pk(C.ballast), bal2 = pk(C.ballast2), gird = pk(C.girder), girdRim = pk(C.girderRim), stone = pk(C.stone);
      const reflTint = mixc(M.sky[2], [0, 0, 0], 0.2);
      for (let x = 0; x < W; x++) {
        const wx = x + go;
        const ch = Math.floor(wx / 700), loc = wx - ch * 700;
        const isBr = (ch % 3 === 1) || (ch > 0 && hu(ch * 7 + 3) < 0.2);
        const bridge = isBr && loc > 90 && loc < 610;
        if (!bridge) {
          const edge = Math.min(Math.abs(loc - 90), Math.abs(loc - 610));
          for (let y = RAIL + 2; y < H; y++) {
            let c;
            if (y < RAIL + 5) c = h2(wx, y) < 0.35 ? bal2 : bal;
            else if (y < RAIL + 6 + ((wx >> 3) & 1)) c = grass2;
            else c = h2(wx >> 1, y >> 1) < 0.18 + 0.1 * Math.sin(y * 0.7) ? grass2 : nearC;
            buf[y * W + x] = c;
          }
          if (edge < 30 && isBr) {
            // Abutment stones where the bridge meets the bank.
            for (let y = RAIL + 5; y < H; y++) if ((y + (wx >> 2)) % 5) buf[y * W + x] = stone;
          }
        } else {
          // Water, mirroring the sky and far hills, shivering with depth.
          for (let y = 169; y < H; y++) {
            const d = y - 168;
            const sh = Math.round(Math.sin(y * 1.3 + t * 2.4 + wx * 0.015) * (1 + d * 0.18));
            const sy = Math.max(0, 112 - d * 3.8 | 0), sx = Math.min(W - 1, Math.max(0, x + sh));
            const v = buf[sy * W + sx];
            const k = 0.78 - d * 0.012;
            buf[y * W + x] = pk([(v & 255) * k + reflTint[0] * 0.15, ((v >> 8) & 255) * k + reflTint[1] * 0.15, ((v >> 16) & 255) * k + reflTint[2] * 0.2]);
            // The moon's glitter path, flickering on the ripples.
            if (Math.abs(x - mx) < 2 + d * 0.35 && h2(wx * 3 + ((t * 7) | 0) * 101, y) < 0.3) glow(x, y, C.moon, 0.6);
          }
          // Deck, truss and piers.
          rect(x, RAIL + 2, 1, 2, gird);
          put(x, RAIL + 2, girdRim);
          const pn = ((loc % 16) + 16) % 16;
          const dir = Math.floor(loc / 16) & 1;
          for (let y = RAIL + 4; y <= RAIL + 10; y++) {
            const k = (y - RAIL - 4) / 6 * 15;
            if (pn === 0 || y === RAIL + 10 || Math.abs((dir ? 15 - pn : pn) - k) < 1.2) put(x, y, y === RAIL + 10 ? girdRim : gird);
          }
          if (((loc - 90) % 130) < 7) for (let y = RAIL + 11; y < H; y++) buf[y * W + x] = (y + (wx >> 1)) % 4 ? stone : gird;
        }
      }
      // Rails and sleepers, lit ahead by the headlamp.
      const steel = pk(C.steel), steelD = pk(C.steelDark);
      for (let x = 0; x < W; x++) {
        const wx = x + go;
        buf[RAIL * W + x] = steel;
        buf[(RAIL + 1) * W + x] = (wx & 3) === 0 ? pk(C.iron) : steelD;
        if (x > L.front) {
          const k = 1 - (x - L.front) / Math.max(20, W - L.front);
          glow(x, RAIL, C.white, 0.7 * k);
          glow(x, RAIL + 2, C.amberHot, 0.35 * k);
          glow(x, RAIL + 3, C.amberHot, 0.2 * k);
        }
      }
      for (const F of this.railFlash) {
        for (let k = -10; k <= 10; k++) glow(Math.round(F.x + k), RAIL, C.fireHot, F.a * (1 - Math.abs(k) / 11) * 1.2);
        halo(Math.round(F.x), RAIL, 7, C.fire, F.a * 0.6);
      }

      this.drawTrain(M, params);
      this.drawSmoke(params);

      // Sparks: white at birth, cooling through yellow to red.
      for (const S of this.sparks) {
        const lf = S.age / S.life;
        const c = lf < 0.2 ? C.white : lf < 0.5 ? C.fireHot : lf < 0.8 ? C.fire : [220, 60, 40];
        const x = Math.round(S.x), y = Math.round(S.y);
        glow(x, y, c, 1.4 * (1 - lf * 0.6));
        glow(Math.round(S.px), Math.round(S.py), c, 0.7 * (1 - lf));
        if (lf < 0.3) halo(x, y, 2, C.fire, 0.3);
      }

      // ---- Telegraph poles and wires, whipping past in front.
      const po = camX * 1.6, SP = 250;
      const poleC = pk(C.pole), poleRim = pk(C.poleRim), wireC = pk(C.wire);
      const poles = [];
      for (let c = Math.floor(po / SP) - 1; c <= Math.floor((po + W) / SP) + 2; c++) poles.push(Math.round(c * SP + hu(c) * 30 - po));
      for (let i = 0; i + 1 < poles.length; i++) {
        const a = poles[i] + 1, b = poles[i + 1] + 1;
        for (let x = Math.max(0, a); x < Math.min(W, b); x++) {
          const u = (x - a) / (b - a), sag = 4 * u * (1 - u);
          put(x, Math.round(34 + 12 * sag), wireC);
          put(x, Math.round(38 + 13 * sag), wireC);
        }
      }
      for (const x of poles) {
        if (x < -8 || x > W + 8) continue;
        rect(x, 30, 3, H - 30, poleC);
        rect(x + 3, 30, 1, H - 30, poleRim);
        rect(x - 6, 33, 15, 2, poleC);
        put(x - 5, 32, poleRim); put(x + 7, 32, poleRim);
      }
    },

    drawTrain(M, params) {
      const L = this.layout, e = this.env, t = this.t, drop = e.drop;
      const body = pk(C.body), bodyD = pk(C.bodyDark), roof = pk(C.roof), rim = pk(C.rimT), stripe = pk(C.stripe);
      const wheel = pk(C.wheel), person = pk(C.person), ironRim = pk(C.ironRim);
      const warmK = 0.8 + 0.3 * e.bass;
      L.cars.forEach((x0, k) => {
        if (x0 > W || x0 + 78 < 0) return;
        // Roof, rounded, with the moon catching its crest.
        rect(x0 + 4, 130, 68, 1, rim);
        rect(x0 + 2, 131, 72, 1, roof);
        rect(x0 + 1, 132, 74, 2, roof);
        rect(x0, 134, 76, 20, body);
        rect(x0, 134, 76, 1, pk(mixc(C.body, C.rimT, 0.35)));
        rect(x0, 148, 76, 1, stripe);
        rect(x0, 152, 76, 3, bodyD);
        rect(x0 - 4, 137, 4, 14, bodyD);
        // End doors.
        rect(x0 + 2, 137, 4, 11, bodyD); rect(x0 + 70, 137, 4, 11, bodyD);
        for (let i = 0; i < 8; i++) {
          const wx = x0 + 9 + i * 8;
          const party = drop > 0.35 && h2(k * 8 + i, 5) < 0.3 * drop;
          const bl = this.blink.k === k && this.blink.i === i ? this.blink.a : 0;
          let c1 = party ? PARTY[(k + i + Math.floor(t * 1.5)) & 3] : C.amber;
          let c0 = party ? mixc(c1, [255, 255, 255], 0.4) : C.amberHot;
          c0 = mixc(c0, C.white, clamp01(bl)); c1 = mixc(c1, C.white, clamp01(bl * 0.8));
          const P0 = pk(c1.map((v) => v * warmK)), P1 = pk(c0.map((v) => v * Math.min(1.1, warmK)));
          rect(wx, 138, 5, 7, P0);
          rect(wx + 1, 139, 3, 4, P1);
          if (h2(k * 8 + i, 1) < 0.4) { rect(wx + 2, 141, 2, 2, person); rect(wx + 1, 143, 4, 2, person); }
          // Window light thrown onto the ballast and bank below.
          const la = (0.22 + 0.15 * e.bass) + bl * 0.9;
          for (let y = RAIL + 3; y < RAIL + 13; y++) {
            const sx = wx - 3 + Math.floor((y - RAIL - 3) * 0.7);
            for (let xx = 0; xx < 6; xx++) glow(sx + xx, y, C.amber, la * (1 - (y - RAIL - 3) / 11));
          }
          if (bl > 0.05) halo(wx + 2, 141, 9, C.white, bl * 0.7);
        }
        for (const wx of [x0 + 8, x0 + 16, x0 + 60, x0 + 68]) { disc(wx, 157, 3, wheel); put(wx, 157, ironRim); }
        rect(x0 + 5, 155, 14, 1, wheel); rect(x0 + 57, 155, 14, 1, wheel);
      });

      // Locomotive, facing right: tender, cab, boiler, smokebox, chimney.
      const x0 = L.loco, iron = pk(C.loco), brass = pk(C.brass), dark = pk(C.locoDark), red = pk(C.red);
      const lrim = pk(C.locoRim), tend = pk(C.iron);
      rect(x0, 140, 20, 15, iron); rect(x0, 139, 20, 1, lrim); rect(x0, 147, 20, 1, brass);
      for (let k = 0; k < 4; k++) rect(x0 + 2 + k, 138 - k, 16 - 2 * k, 1, pk([22, 20, 28]));
      rect(x0 + 20, 143, 3, 8, dark);
      rect(x0 + 22, 128, 16, 27, iron); rect(x0 + 20, 127, 20, 1, lrim); rect(x0 + 21, 126, 18, 1, dark); rect(x0 + 22, 147, 16, 1, brass);
      const fire = this.fire, fireC = mixc(C.fire, C.fireHot, clamp01(fire));
      rect(x0 + 26, 132, 8, 7, pk(fireC.map((v) => v * (0.5 + 0.5 * clamp01(fire + 0.15)))));
      rect(x0 + 29, 132, 1, 7, iron);
      halo(x0 + 30, 135, 8 + 10 * fire, C.fire, 0.15 + fire * 0.8);
      // The firebox lights the ground under the cab on every chuff.
      for (let y = RAIL + 2; y < H; y++) for (let x = x0 + 14; x < x0 + 46; x++) {
        const d = Math.hypot((x - x0 - 30) / 16, (y - RAIL - 2) / 10);
        if (d < 1) glow(x, y, C.fire, (0.12 + fire * 0.9) * (1 - d));
      }
      rect(x0 + 38, 136, 30, 15, iron);
      rect(x0 + 39, 135, 28, 1, lrim);
      rect(x0 + 38, 136, 30, 2, pk(mixc(C.loco, C.locoRim, 0.45)));
      for (const bx of [x0 + 45, x0 + 57]) rect(bx, 136, 1, 15, brass);
      rect(x0 + 50, 131, 6, 4, brass); rect(x0 + 51, 130, 4, 1, pk([255, 220, 150]));
      rect(x0 + 42, 132, 3, 3, iron); rect(x0 + 42, 131, 3, 1, lrim);
      rect(x0 + 66, 133, 8, 18, pk([16, 16, 26])); rect(x0 + 66, 132, 8, 1, ironRim); rect(x0 + 73, 134, 1, 16, ironRim);
      rect(L.chimX, L.chimTop + 1, 5, 132 - L.chimTop, tend); rect(L.chimX + 4, L.chimTop + 2, 1, 130 - L.chimTop, ironRim); rect(L.chimX - 1, L.chimTop, 7, 2, brass);
      if (fire > 0.05) {
        for (let k = 0; k < 5; k++) { glow(L.chimX + k, L.chimTop, C.fireHot, fire * 1.3); glow(L.chimX + k, L.chimTop - 1, C.fire, fire); }
        // A tongue of flame and sparks out of the stack, gone in ~0.3 s.
        const tl = Math.round(9 * fire);
        for (let k = 1; k <= tl; k++) for (let j = 1; j < 4; j++) glow(L.chimX + j, L.chimTop - 1 - k, k < tl * 0.5 ? C.fireHot : C.fire, fire * 1.4 * (1 - k / (tl + 1)));
      }
      rect(x0 + 36, 151, 40, 1, lrim);
      rect(x0 + 62, 150, 10, 5, iron); rect(x0 + 62, 150, 10, 1, lrim);
      rect(x0 + 74, 150, 3, 3, red);
      // Cowcatcher.
      for (let k = 0; k < 6; k++) line(x0 + 74, 152 + k, x0 + 76 + k, 159, dark);
      // Drivers, turning with the distance travelled, and the rods.
      const ang = this.camX / 6;
      const pins = [];
      for (const wx of [x0 + 44, x0 + 57]) {
        disc(wx, 154, 6, red); disc(wx, 154, 1, pk([40, 10, 12]));
        for (let a = 0; a < 4; a++) {
          const aa = ang + a * Math.PI / 4;
          line(wx - 4.5 * Math.cos(aa), 154 - 4.5 * Math.sin(aa), wx + 4.5 * Math.cos(aa), 154 + 4.5 * Math.sin(aa), pk([60, 14, 18]));
        }
        for (let a = 0; a < 24; a++) { const aa = a / 24 * Math.PI * 2; put(Math.round(wx + 6 * Math.cos(aa)), Math.round(154 + 6 * Math.sin(aa)), a < 12 ? ironRim : wheel); }
        pins.push([wx + 3.5 * Math.cos(ang), 154 + 3.5 * Math.sin(ang)]);
      }
      disc(x0 + 70, 157, 3, red); put(x0 + 70, 157, ironRim);
      disc(x0 + 5, 157, 3, wheel); disc(x0 + 15, 157, 3, wheel);
      const rod = pk(C.rod);
      line(pins[0][0], pins[0][1], pins[1][0], pins[1][1], rod);
      line(pins[0][0], pins[0][1] + 1, pins[1][0], pins[1][1] + 1, rod);
      line(pins[1][0], pins[1][1], x0 + 64, 152, rod);
      // Headlamp and its beam down the line.
      rect(x0 + 74, 138, 2, 3, iron);
      glow(x0 + 76, 139, C.white, 1.5); glow(x0 + 76, 140, C.white, 1.5);
      halo(x0 + 76, 139, 5, C.amberHot, 0.5);
      for (let x = x0 + 77; x < W; x++) {
        const d = x - x0 - 77, half = 1 + d * 0.2;
        for (let y = Math.floor(139.5 - half); y <= Math.min(RAIL, Math.ceil(139.5 + half)); y++) {
          const a = 0.3 * Math.exp(-d / 50) * (1 - Math.abs(y - 139.5) / (half + 1));
          glow(x, y, C.amberHot, a);
        }
      }
    },

    drawSmoke(params) {
      const k = Math.min(1.4, params.smoke);
      if (k <= 0) return;
      const light = C.smokeLight, dark = C.smokeDark, L = this.layout, fire = this.fire;
      for (const P of this.puffs) {
        const lf = P.age / P.life;
        const A = Math.min(1, P.a * k) * Math.pow(1 - lf, 1.1);
        const heat = P.heat * Math.exp(-P.age / 0.18);
        // The fire lights its own steam: every chuff also warms the plume
        // close to the chimney, and the glow fades with age.
        const near = Math.exp(-Math.hypot(P.x - L.chimX, P.y - L.chimTop) / 28);
        const warmth = P.heat * Math.exp(-P.age / 0.9) * 0.5 + fire * near * 0.8;
        const R = P.r;
        const lumps = [[0, 0, 1], [(hu(P.seed) - 0.5) * 0.9, (hu(P.seed + 1) - 0.6) * 0.6, 0.72], [(hu(P.seed + 2) - 0.5) * 1.1, (hu(P.seed + 3) - 0.2) * 0.5, 0.62]];
        const x0 = Math.floor(P.x - R * 1.6), x1 = Math.ceil(P.x + R * 1.6), y0 = Math.floor(P.y - R * 1.4), y1 = Math.ceil(P.y + R * 1.3);
        for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
          let d = 9, ddx = 0, ddy = 0;
          for (const q of lumps) {
            const cx = P.x + q[0] * R, cy = P.y + q[1] * R, rr = R * q[2];
            const dd = Math.hypot(x - cx, y - cy) / rr;
            if (dd < d) { d = dd; ddx = (x - cx) / rr; ddy = (y - cy) / rr; }
          }
          if (d >= 1) continue;
          const a = A * (d < 0.55 ? 1 : 1 - (d - 0.55) / 0.45);
          const sh = clamp01(0.55 - ddx * 0.35 - ddy * 0.6);
          let c = mixc(dark, light, sh);
          c = mixc(c, C.fire, clamp01(warmth * (0.35 + ddy * 0.65)));
          c = mixc(c, C.fireHot, clamp01(heat * (1.15 - d)));
          // Translucency in four dithered steps: blends with what is behind
          // rather than stippling, so old steam thins instead of turning to dots.
          const q4 = a * 4; let l = Math.floor(q4);
          if (q4 - l > B4[((y & 3) << 2) | (x & 3)]) l++;
          if (!l) continue;
          const kk = l / 4, i = y * W + x, v = buf[i];
          buf[i] = pk([(v & 255) * (1 - kk) + c[0] * kk, ((v >> 8) & 255) * (1 - kk) + c[1] * kk, ((v >> 16) & 255) * (1 - kk) + c[2] * kk]);
          if (heat > 0.1) glow(x, y, C.fire, heat * 0.5 * (1 - d));
        }
        if (heat > 0.12) halo(Math.round(P.x), Math.round(P.y), R * 2.5 + 8, C.fire, heat * 0.5);
      }
    },

    present(p, ctx, params) {
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        if (!this.lowCanvas) { this.lowCanvas = document.createElement('canvas'); }
        if (this.lowCanvas.width !== W || this.lowCanvas.height !== H) { this.lowCanvas.width = W; this.lowCanvas.height = H; }
        const lc = this.lowCanvas.getContext('2d');
        lc.putImageData(new ImageData(new Uint8ClampedArray(this.buf.buffer), W, H), 0, 0);
        const dc = p.drawingContext;
        dc.imageSmoothingEnabled = false;
        dc.drawImage(this.lowCanvas, 0, 0, ctx.width, ctx.height);
        dc.imageSmoothingEnabled = true;
        return;
      }
      const gl = this.gl;
      const w = Math.round(p.width * p.pixelDensity()), h = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.u8);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.viewport(0, 0, w, h);
      gl.uniform2f(this.u.lo, W, H);
      gl.uniform2f(this.u.res, w, h);
      gl.uniform1f(this.u.crt, params.crt);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
