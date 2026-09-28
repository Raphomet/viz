// Op Art: a Vasarely / Riley exhibition poster whose checkerboard bulges.
//
// A printed sheet: a full-bleed field of black and white checks inside a white
// border, with a wider foot carrying the captions. The field is Vasarely's
// Vega: a checkerboard whose cells swell into spheres where the surface seems
// to push toward you. The headline is not printed on top of the field but cut
// into it: inside the letters the checks give way to Riley's stripes, so the
// words exist only as a change of texture in the one sheet, and when
// a sphere rolls under them the letters swell with the checks.
//
// Music, each in its own place:
//   kick   a small sphere inflates at one spot in the field and relaxes, its
//          light squares printed in the accent ink (the only colour allowed)
//   snare  a different event: one letter of the headline lights in the accent,
//          the next letter on the next clap, marching along the words
//   bass   the big sphere's size and depth breathe with the bass line
//   hats   single squares scattered over the field flick to the accent
//   drop   the grid turns 45 degrees into diamonds, two more spheres rise and
//          orbit, Riley's wave shears the rows, the big sphere floods with a
//          gradient of the accent, and a new headline is cut; the breakdown
//          turns the grid square again and drains the colour to black on white
//   always the sheet of checks drifts under the spheres like cloth over
//          marbles, faster with the energy of the track
//
// WebGL2 for the field (checks are box-filtered analytically over each pixel's
// footprint, so every edge is crisp and fine checks fade to grey instead of
// aliasing); the headline mask is Canvas 2D text uploaded as a texture; the
// captions are Canvas 2D on top. Flat inks and a static paper grain; no glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => u * u * (3 - 2 * u);

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2  res;        // device pixels
uniform float unitPx;     // device pixels per virtual unit
uniform vec4  field;      // x0, y0, x1, y1 in units
uniform vec4  sph[4];     // centre x, y, radius, depth
uniform float tint[4];    // accent printed on each sphere's light squares
uniform float cell;       // check size, units
uniform vec2  scroll;     // drift of the sheet, cells
uniform float ang;        // grid rotation
uniform vec3  wave;       // amplitude (units), wavelength (units), phase
uniform sampler2D maskA, maskB;
uniform float maskMix;    // 0 = A only, 1 = B only
uniform vec3  paper, ink, accent;
uniform float hat, hatSeed;
uniform vec4  lit;        // letter id and accent: the clap's letter, and the one it left
uniform float curSlot;    // which mask holds the current headline (letter ids)
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

// Box-filtered checkerboard: 1 on the dark squares. p is in cells. The
// footprint comes from the warped coordinates' own derivatives, so squares
// magnified by a sphere stay sharp and squares crushed at its rim fade to the
// grey the eye would average them to.
vec2 checkerParts(vec2 p) {
  vec2 w = fwidth(p) + 1e-4;
  vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
  float fade = smoothstep(0.35, 0.7, max(w.x, w.y));
  // x: the checkerboard; y: Riley stripes along the rows, for the letters.
  return mix(vec2(0.5 - 0.5 * i.x * i.y, 0.5 - 0.5 * i.y), vec2(0.5), fade);
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 pos = fc / unitPx;

  // Spheres: pull the sample point toward each centre, strongest at the
  // centre and easing to nothing at the rim with zero slope, so the sheet has
  // no crease where a bulge begins.
  vec2 q = pos;
  float tA = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 d = pos - sph[i].xy;
    float R = sph[i].z;
    float qq = dot(d, d) / (R * R);
    if (qq < 1.0) {
      float s = (1.0 - qq) * (1.0 - qq);
      q -= d * sph[i].w * s;
      tA = max(tA, tint[i] * s);
    }
  }

  // The headline mask is warped by the spheres too, so letters swell as a
  // sphere passes under them.
  vec2 muv = q * unitPx / res;
  vec4 tA4 = texture(maskA, muv), tB4 = texture(maskB, muv);
  float m = mix(tA4.r, tB4.r, maskMix);
  // Letter ids ride in green as a fraction of red, so edge filtering keeps them.
  vec4 cur = curSlot < 0.5 ? tA4 : tB4;
  float lid = cur.r > 0.02 ? floor(cur.g / cur.r * 15.0 + 0.5) : -1.0;
  float litA = (abs(lid - lit.x) < 0.5 ? lit.y : 0.0) + (abs(lid - lit.z) < 0.5 ? lit.w : 0.0);

  // Riley's wave: rows shear sideways in a slow travelling sine.
  q.x += wave.x * sin(6.2831853 * q.y / wave.y + wave.z);
  q.y += 0.35 * wave.x * sin(6.2831853 * q.x / (wave.y * 1.7) - wave.z * 0.6);

  vec2 fcen = 0.5 * (field.xy + field.zw);
  float ca = cos(ang), sa = sin(ang);
  vec2 r = q - fcen;
  vec2 g = vec2(ca * r.x + sa * r.y, -sa * r.x + ca * r.y) / cell + scroll;

  // Inverting the checks inside the letters (the obvious op trick) left the
  // words unreadable once the grid warped; stripes against checks keep them.
  // The stripes stay level when the grid turns to diamonds, so the drop
  // sharpens the words instead of dissolving them.
  vec2 cp = checkerParts(g);
  // Twice the frequency of the checks, so no letter edge can hide along a row.
  float st = checkerParts(vec2(0.0, 2.0 * (q.y / cell + scroll.y))).y;
  float c = mix(cp.x, st, m);

  // Accent on the light squares only: sphere tint, a few hat sparks, and the
  // clap's letter.
  float a = tA;
  vec2 id = floor(g);
  float h = hash(id + hatSeed);
  a = max(a, hat * step(h, 0.022) * (1.0 - m));
  a = max(a, litA * cur.r);
  vec3 light = mix(paper, accent, clamp(a, 0.0, 1.0));
  vec3 col = mix(light, ink, c);

  // Field edge, antialiased against the white border.
  vec2 e = min(pos - field.xy, field.zw - pos) * unitPx;
  float inside = clamp(min(e.x, e.y) + 0.5, 0.0, 1.0);
  col = mix(paper, col, inside);

  // Static paper grain: fibres in the stock, a little ink starvation.
  float n = hash(floor(fc)) * 0.6 + hash(floor(fc * 0.25)) * 0.4;
  col *= 1.0 - 0.045 * n;
  col += (1.0 - c * inside) * 0.0 + c * inside * 0.035 * n;
  outColor = vec4(col, 1.0);
}`;

  const INKS = [
    { name: 'Red', paper: '#F1EDE3', ink: '#141414', accent: '#D8321E', grey: '#8C877D' },
    { name: 'Cobalt', paper: '#F1EDE3', ink: '#141414', accent: '#1E47B8', grey: '#8C877D' },
    { name: 'Black & white', paper: '#F3F1EC', ink: '#121212', accent: '#9A968E', grey: '#8C877D' },
    { name: 'Night', paper: '#111113', ink: '#ECE7DC', accent: '#E0402A', grey: '#77736C' },
  ];
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

  const HEADS = [
    ['SEE THE', 'SOUND'],
    ['RETINA', 'DANCE'],
    ['KINETIC', 'NIGHT'],
    ['THE EYE', 'HEARS'],
    ['VIBRATE', 'UNTIL 6'],
  ];
  const HEAD_FONT = '"Archivo Black", "Arial Black", sans-serif';
  const CAP_FONT = '"Josefin Sans", "Futura", sans-serif';
  const MONO_FONT = '"Space Mono", "Courier New", monospace';

  // Kick spheres land at one of these spots (fractions of the field), never
  // twice running and never under the big sphere.
  const SPOTS = [[0.14, 0.24], [0.84, 0.2], [0.9, 0.74], [0.12, 0.78], [0.5, 0.16], [0.55, 0.86], [0.32, 0.5], [0.7, 0.48]];

  VIZ.register({
    id: 'opart',
    name: 'Op Art',
    order: 505,

    params: [
      { key: 'reaction', label: 'Kick strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'bulge', label: 'Bulge depth', type: 'range', min: 0, max: 1.5, default: 1, step: 0.01 },
      { key: 'cell', label: 'Check size', type: 'range', min: 12, max: 60, default: 24, step: 0.5 },
      { key: 'flow', label: 'Drift speed', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'wave', label: 'Riley wave', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'grid', label: 'Grid', type: 'select', options: ['Drop turns to diamonds', 'Always square', 'Always diamonds'], default: 0 },
      { key: 'ink', label: 'Ink', type: 'select', options: INKS.map((i) => i.name), default: 0 },
      { key: 'words', label: 'Headline (blank cycles)', type: 'text', default: '' },
    ],

    actions: [
      { id: 'nexthead', label: 'Next headline', run() { this.wantHead = true; } },
    ],

    gallery: {
      title: 'Op Art',
      technique: 'WebGL2 fragment shader: an analytically box-filtered checkerboard sampled through a sum of smooth sphere warps, a travelling sine shear and a rotation; the headline is Canvas 2D text uploaded as a mask texture that turns the checks to stripes and is warped by the same spheres; captions in Canvas 2D; onset detection against the previous frame',
      brief: 'A 1960s op-art exhibition poster alive. Inside a white border a field of black and white checks swells into Vasarely spheres, and the headline is cut into the field as Riley stripes through the checkerboard, so the letters swell when a sphere rolls under them. The sheet drifts slowly under the spheres like cloth over marbles. Each kick inflates a small sphere somewhere in the field, printed in the single accent ink; each clap lights one letter of the headline in the accent, the next letter on the next clap; hats flick single squares; the bass breathes the big sphere. The drop turns the grid into diamonds, raises two more orbiting spheres, sets Riley\'s wave through the rows, floods the big sphere with a gradient of red and cuts a new headline. The breakdown squares the grid and drains it back to black on white.',
      lineage: [
        'Victor Vasarely\'s Vega series (1957-) and his checkerboard spheres, Bridget Riley\'s wave paintings (Current, Fall), and the type-as-pattern exhibition posters around The Responsive Eye (1965). Batch 05 brief entry "05 · Op art". Kept apart from Interference (line-family moiré) by being a single checkerboard sheet with bulges and type, and by printing on paper, not light.',
        'Built as one fragment shader: the sample point is pulled toward each sphere centre by d·k·(1-r²/R²)², which magnifies the middle and meets the flat sheet with zero slope, so there is no crease; monotonic for k < 1. The checker is iq\'s box-filtered form using the warped coordinate\'s own fwidth, faded to grey past half a square per pixel.',
        'Process: the first render cut the headline as an inversion of the checks, the textbook op move, and the words vanished the moment the grid warped or turned to diamonds; letters became Riley stripes (level even when the grid turns, twice the check frequency so no edge hides along a row), which read in every section. The clap first tinted every letter at once, a third of the frame on each clap, so it now lights one letter and marches along the words, holding in the drop. Jolt at 640x360 went from jarring (area 0.50, ratio 1.45) to calm (area 0.14, ratio 1.8): the heat map showed the whole checkerboard as the culprit, since a high-contrast check edge moving one pixel reads as change, so the sheet\'s drift, the wave and the orbits were slowed several times over and the 45° turn became a fixed 1.4 s tween instead of an exponential that crept for bars. The kick sphere and the lit letter are now the only hot spots. A 96 s run holds: each drop cuts a new headline and the breakdowns drain back to black on white.',
      ].join(' '),
    },

    setup(p, ctx) { this.init(); },
    enter(p, ctx) { if (!this.prev) this.init(); },

    init() {
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.lastKick = -10; this.lastSnare = -10; this.lastHat = -10;
      this.kickCount = 0; this.hatCount = 0; this.snareCount = 0;
      this.low = 0; this.drop = false; this.dropAmt = 0; this.gridAmt = 0;
      this.bassEnv = 0; this.bassSlow = 0; this.energy = 0; this.hatEnv = 0;
      this.scrollX = 0; this.scrollY = 0; this.wavePh = 0; this.wander = 0; this.orbit = 0;
      this.kickSpot = 0; this.kickT = -10;
      this.headIdx = 0; this.headMix = 1; this.headT = -10;
      this.maskKey = ['', '']; this.maskSlot = 0;
      this.wantHead = false;
      this.litIdx = -5; this.prevLitIdx = -5; this.nLetters = 1;
    },

    analyse(s, t, dt) {
      const b0 = s[0], b1 = s[1], b4 = s[4], b8 = s[8];
      let kick = false, snare = false, hat = false;
      if (b0 > 30 && b0 - this.prev[0] > 12 && t - this.lastKick > 0.22) { kick = true; this.lastKick = t; this.kickCount++; }
      if (b4 > 40 && b4 - this.prev[4] > 16 && t - this.lastSnare > 0.11) { snare = true; this.lastSnare = t; this.snareCount++; }
      if (b8 > 30 && b8 - this.prev[8] > 12 && t - this.lastHat > 0.06) { hat = true; this.lastHat = t; this.hatCount++; }
      this.prev.set(s);
      const k = (tau) => 1 - Math.exp(-dt / tau);
      this.low += (b1 - this.low) * k(0.5);
      const bass = Math.max(b1, s[2] * 0.8) / 100;
      // Slow on purpose: the drop's bass is sidechained to the kick, and a
      // fast follower would make the big sphere pump on every beat.
      this.bassSlow += (bass - this.bassSlow) * k(0.45);
      this.energy += (clamp(this.low / 40, 0, 1) - this.energy) * k(1.2);
      return { kick, snare, hat };
    },

    // ---- GL ---------------------------------------------------------------

    gl0() {
      if (this.glTried) return this.gl;
      this.glTried = true;
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
      if (!gl) return null;
      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('opart shader: ' + gl.getShaderInfoLog(sh));
        return sh;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.bindAttribLocation(prog, 0, 'pos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('opart link: ' + gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const U = {};
      for (const n of ['res', 'unitPx', 'field', 'sph', 'tint', 'cell', 'scroll', 'ang', 'wave', 'maskA', 'maskB', 'maskMix', 'paper', 'ink', 'accent', 'lit', 'curSlot', 'hat', 'hatSeed']) {
        U[n] = gl.getUniformLocation(prog, n);
      }
      const tex = [0, 1].map(() => {
        const tx = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        return tx;
      });
      this.glCanvas = cv; this.gl = gl; this.prog = prog; this.U = U; this.vao = vao; this.tex = tex;
      this.maskCanvas = document.createElement('canvas');
      return gl;
    },

    // Render the headline, white on black, into mask slot i at device size.
    cutMask(slot, lines, w, h, unitPx, field) {
      const mc = this.maskCanvas;
      if (mc.width !== w || mc.height !== h) { mc.width = w; mc.height = h; }
      const g = mc.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.setTransform(unitPx, 0, 0, unitPx, 0, 0);
      const [x0, y0, x1, y1] = field;
      const fw = x1 - x0, fh = y1 - y0;
      const pad = Math.min(fw, fh) * 0.07;
      // Size to the longer line, then to the height of two lines.
      g.font = `400 100px ${HEAD_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = '-3px';
      const wid = Math.max(...lines.map((l) => g.measureText(l).width), 1);
      let size = 100 * (fw - 2 * pad) * 0.9 / wid;
      size = Math.min(size, (fh - 2 * pad) * 0.85 / 1.78);
      g.font = `400 ${size.toFixed(2)}px ${HEAD_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${(-size * 0.02).toFixed(2)}px`;
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      const cap = size * 0.72;
      const gap = size * 0.2;
      const block = 2 * cap + gap;
      const top = y0 + (fh - block) / 2;
      // Each letter is drawn alone so its id (1-15) can ride in green.
      let id = 0;
      const setLine = (line, x, y) => {
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch !== ' ') {
            id = id % 15 + 1;
            g.fillStyle = `rgb(255, ${id * 17}, 0)`;
            g.fillText(ch, x + g.measureText(line.slice(0, i)).width, y);
          }
        }
      };
      setLine(lines[0], x0 + pad, top + cap);
      const l2 = lines[1] || '';
      setLine(l2, x1 - pad - g.measureText(l2).width, top + 2 * cap + gap);
      this.nLetters = Math.max(1, id);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex[slot]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mc);
    },

    headLines(params) {
      const w = String(params.words || '').trim().toUpperCase();
      if (w) {
        const parts = w.split(/\s*\/\s*|\s{2,}/);
        if (parts.length >= 2) return [parts[0], parts.slice(1).join(' ')];
        const sp = w.lastIndexOf(' ');
        return sp > 0 ? [w.slice(0, sp), w.slice(sp + 1)] : [w, ''];
      }
      return HEADS[this.headIdx % HEADS.length];
    },

    // ---- frame ------------------------------------------------------------

    draw(p, signals, params, ctx) {
      if (!this.prev) this.init();
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const W = ctx.width, H = ctx.height;
      const S = Math.min(W, H);
      const inkSet = INKS[clamp(Math.round(params.ink), 0, INKS.length - 1)];
      const k = (tau) => 1 - Math.exp(-dt / tau);

      // ---- music
      const ev = this.analyse(signals, t, dt);
      if (!this.drop && this.low > 30) { this.drop = true; this.headIdx++; this.headT = t; }
      else if (this.drop && this.low < 16) { this.drop = false; }
      if (this.wantHead) { this.wantHead = false; this.headIdx++; this.headT = t; }
      this.dropAmt += ((this.drop ? 1 : 0) - this.dropAmt) * k(this.drop ? 0.7 : 2.4);
      const gridMode = Math.round(params.grid);
      const gridWant = gridMode === 1 ? 0 : gridMode === 2 ? 1 : (this.drop ? 1 : 0);
      // A fixed-length turn (1.4 s in, 3 s back) rather than an exponential
      // approach, whose long tail kept the whole grid creeping for bars.
      const turnRate = dt / (gridWant > this.gridAmt ? 1.4 : 3.0);
      this.gridAmt = gridWant > this.gridAmt ? Math.min(gridWant, this.gridAmt + turnRate) : Math.max(gridWant, this.gridAmt - turnRate);
      if (ev.kick) {
        this.kickT = t;
        this.kickSpot = this.pickSpot();
      }
      if (ev.hat) { this.hatEnv = 1; this.hatSeed = (this.hatCount * 7.31) % 97; }
      this.hatEnv *= Math.exp(-dt / 0.12);
      const sinceSnare = t - this.lastSnare;
      // The clap lights one letter of the headline, marching along the words;
      // in the drop the letter stays lit until the next clap takes over.
      if (ev.snare) {
        this.prevLitIdx = this.litIdx; this.prevLitFrom = this.litLevel || 0; this.prevLitT = t;
        const n = Math.max(1, this.nLetters || 1);
        this.litIdx = 1 + (this.snareCount - 1) % n;
      }
      const hold = 0.6 * this.dropAmt;
      const litAmt = sinceSnare < 0.03 ? smooth(sinceSnare / 0.03) : hold + (1 - hold) * Math.exp(-(sinceSnare - 0.03) / 0.3);
      this.litLevel = sinceSnare > 5 ? 0 : litAmt;
      const prevAmt = (this.prevLitFrom || 0) * Math.max(0, 1 - (t - (this.prevLitT || 0)) / 0.15);

      // ---- motion
      const flow = params.flow;
      // Slow on purpose: a high-contrast checkerboard moving more than a few
      // pixels a frame reads as shimmer, and hides the kick in its own motion.
      const speed = flow * (0.06 + 0.1 * this.energy + 0.06 * this.dropAmt);
      this.scrollX += dt * speed * 0.8;
      this.scrollY += dt * speed * 0.35;
      this.wavePh += dt * (0.1 + 0.15 * this.energy) * (0.3 + flow);
      this.wander += dt * (0.03 + 0.03 * this.energy) * (0.3 + flow);
      this.orbit += dt * (0.025 + 0.02 * this.energy) * (0.3 + flow);

      // ---- layout: a printed sheet, border all round, a deeper foot for captions
      const m = S * 0.045;
      const foot = S * 0.1;
      const field = [m, m, W - m, H - m - foot];
      const fw = field[2] - field[0], fh = field[3] - field[1];
      const fcx = (field[0] + field[2]) / 2, fcy = (field[1] + field[3]) / 2;

      // ---- spheres
      const bulge = params.bulge;
      const sph = new Float32Array(16);
      const tint = new Float32Array(4);
      // The big one wanders a slow Lissajous over the field.
      const bx = fcx + fw * 0.26 * Math.sin(this.wander * 1.0 + 0.6);
      const by = fcy + fh * 0.2 * Math.sin(this.wander * 1.37 + 2.1);
      const bR = S * (0.34 + 0.05 * this.bassSlow + 0.04 * this.dropAmt);
      sph.set([bx, by, bR, clamp(bulge * (0.4 + 0.12 * this.bassSlow + 0.04 * this.dropAmt), 0, 0.9)], 0);
      tint[0] = 0.92 * this.dropAmt;
      // Two more rise in the drop and orbit the centre in counter-phase.
      for (let i = 0; i < 2; i++) {
        const a = this.orbit * (i ? -1 : 1) + i * Math.PI;
        const x = fcx + Math.cos(a) * fw * 0.36;
        const y = fcy + Math.sin(a * 0.8 + i) * fh * 0.3;
        sph.set([x, y, S * 0.2, clamp(bulge * 0.5 * smooth(clamp(this.dropAmt, 0, 1)), 0, 0.9)], 4 + i * 4);
        tint[1 + i] = 0;
      }
      // The kick's sphere.
      const kt = t - this.kickT;
      const kEnv = kt < 0 ? 0 : kt < 0.07 ? smooth(kt / 0.07) : Math.exp(-(kt - 0.07) / 0.3);
      const sp = SPOTS[this.kickSpot];
      const kx = field[0] + fw * sp[0], ky = field[1] + fh * sp[1];
      const react = params.reaction;
      sph.set([kx, ky, S * (0.13 + 0.04 * Math.min(react, 1.5)), clamp(0.62 * react * kEnv, 0, 0.9)], 12);
      tint[3] = clamp(0.95 * kEnv * Math.min(react, 1), 0, 1);
      this.bigSphere = [bx, by, bR]; this.fieldRect = field;

      // ---- GL render
      const pd = p.pixelDensity();
      const w = Math.round(p.width * pd), h = Math.round(p.height * pd);
      const unitPx = w / W;
      const gl = this.gl0();
      if (!gl) {
        p.background(inkSet.paper);
        this.drawCaptions(p, W, H, field, m, foot, inkSet, t);
        return;
      }
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) { this.glCanvas.width = w; this.glCanvas.height = h; }

      // Headline masks: slot maskSlot holds the current one; the other fades out.
      const lines = this.headLines(params);
      const fontOk = !window.VIZ_FONTS || VIZ_FONTS.has('Archivo Black');
      const key = lines.join('/') + '|' + w + 'x' + h + '|' + fontOk;
      if (key !== this.maskKey[this.maskSlot]) {
        const prevText = this.maskKey[this.maskSlot].split('|')[0];
        if (prevText && prevText !== lines.join('/')) {
          // New words: cut them into the other slot and cross-fade.
          this.maskSlot = 1 - this.maskSlot; this.headT = t;
        } else if (!prevText) this.headT = -10;
        this.cutMask(this.maskSlot, lines, w, h, unitPx, field);
        this.maskKey[this.maskSlot] = key;
      }
      // The new headline resolves in over a second, as if the ink were drying in.
      const hm = smooth(clamp((t - this.headT) / 1.1, 0, 1));
      const mixToCurrent = this.maskSlot === 1 ? hm : 1 - hm;

      const U = this.U;
      gl.viewport(0, 0, w, h);
      gl.useProgram(this.prog);
      gl.bindVertexArray(this.vao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
      gl.uniform1i(U.maskA, 0); gl.uniform1i(U.maskB, 1);
      gl.uniform1f(U.maskMix, mixToCurrent);
      gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.unitPx, unitPx);
      gl.uniform4f(U.field, field[0], field[1], field[2], field[3]);
      gl.uniform4fv(U.sph, sph);
      gl.uniform1fv(U.tint, tint);
      gl.uniform1f(U.cell, params.cell);
      gl.uniform2f(U.scroll, this.scrollX, this.scrollY);
      gl.uniform1f(U.ang, smooth(smooth(clamp(this.gridAmt, 0, 1))) * Math.PI / 4);
      const wa = params.wave * (2 + 8 * this.dropAmt + 2 * this.energy);
      gl.uniform3f(U.wave, wa, S * 0.55, this.wavePh);
      gl.uniform3fv(U.paper, hex(inkSet.paper));
      gl.uniform3fv(U.ink, hex(inkSet.ink));
      gl.uniform3fv(U.accent, hex(inkSet.accent));
      gl.uniform4f(U.lit, this.litIdx, clamp(litAmt, 0, 1), this.prevLitIdx, clamp(prevAmt, 0, 1));
      gl.uniform1f(U.curSlot, this.maskSlot);
      gl.uniform1f(U.hat, this.hatEnv * clamp(0.35 + this.energy, 0, 1));
      gl.uniform1f(U.hatSeed, this.hatSeed || 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(this.glCanvas, 0, 0, W, H);
      g.restore();
      this.drawCaptions(p, W, H, field, m, foot, inkSet, t);
    },

    pickSpot() {
      const f = this.fieldRect, b = this.bigSphere;
      if (!f || !b) return (this.kickSpot + 3) % SPOTS.length;
      const fw = f[2] - f[0], fh = f[3] - f[1];
      let best = this.kickSpot, bestScore = -1e9;
      for (let i = 0; i < SPOTS.length; i++) {
        if (i === this.kickSpot) continue;
        const x = f[0] + fw * SPOTS[i][0], y = f[1] + fh * SPOTS[i][1];
        const d = Math.hypot(x - b[0], y - b[1]) / b[2];
        // Far enough from the big sphere, then vary by a hash of the count.
        const hsh = Math.sin((this.kickCount + 1) * 12.9898 + i * 78.233) * 43758.5453;
        const score = Math.min(d, 1.3) + (hsh - Math.floor(hsh)) * 0.6;
        if (score > bestScore) { bestScore = score; best = i; }
      }
      return best;
    },

    drawCaptions(p, W, H, field, m, foot, inkSet, t) {
      const g = p.drawingContext;
      g.save();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = inkSet.ink;
      g.textBaseline = 'alphabetic';
      const S = Math.min(W, H);
      const y = field[3] + foot * 0.62;
      const big = S * 0.034, small = S * 0.019;
      g.textAlign = 'left';
      g.font = `700 ${big.toFixed(1)}px ${CAP_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${(big * 0.18).toFixed(1)}px`;
      g.fillText('OPTICAL NIGHT', field[0], y);
      const wTitle = g.measureText('OPTICAL NIGHT').width;
      g.font = `400 ${small.toFixed(1)}px ${CAP_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = `${(small * 0.14).toFixed(1)}px`;
      const narrow = W < H * 1.2;
      if (!narrow) g.fillText('VIBRATING SURFACES  ·  LOW FREQUENCIES  ·  NO FIXED POINT', field[0] + wTitle + big * 1.2, y);
      g.textAlign = 'right';
      g.font = `400 ${(small * 1.15).toFixed(1)}px ${MONO_FONT}`;
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.fillText('22.00 — FIRST LIGHT', field[2], y);
      // Printer's registration marks in the corners of the border.
      g.strokeStyle = inkSet.ink;
      g.lineWidth = Math.max(0.6, S * 0.0016);
      const rm = m * 0.28;
      const marks = [[m * 0.5, m * 0.5], [W - m * 0.5, m * 0.5], [m * 0.5, H - m * 0.5], [W - m * 0.5, H - m * 0.5]];
      for (const [x, yy] of marks) {
        g.beginPath();
        g.moveTo(x - rm, yy); g.lineTo(x + rm, yy);
        g.moveTo(x, yy - rm); g.lineTo(x, yy + rm);
        g.stroke();
        g.beginPath(); g.arc(x, yy, rm * 0.55, 0, Math.PI * 2); g.stroke();
      }
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.restore();
    },
  });
})();
