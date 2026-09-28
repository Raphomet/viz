// Mandala — a kaleidoscope with video feedback.
//
// Two WebGL2 passes over a pair of ping-pong framebuffers:
//
// 1. Feedback (at a fraction of the stage resolution). Every frame is the last
//    frame sampled slightly zoomed in, rotated and gently melted, darkened and
//    tinted, with a fresh "source" painted on top. The source is drawn in
//    kaleidoscope-folded coordinates (N mirrored wedges), so each frame's paint
//    is a mandala and the feedback turns the stack of past frames into a
//    tunnel of mandalas flying out toward the viewer.
// 2. Display (full resolution). The feedback buffer plus a cheap bloom (two
//    samples from its mip chain), a centre bloom, a snare shockwave, hat
//    sparkles in the same folded space, tonemap and saturation.
//
// Why feedback is not re-folded each frame: folding the old frame would
// rewrite the whole tunnel the moment the segment count changes (a hard cut).
// Unfolded, old echoes keep the symmetry they were born with, so a change of
// segment count arrives from the centre and flows outward like everything else.
//
// The music lives in different places so each hit reads as its own event:
//   kick  → the tunnel lurches forward (a zoom impulse in the feedback), the
//           whole image punches in scale, a fresh bright mandala is stamped
//           into the centre (so every beat becomes a ring you watch fly out),
//           and the centre blooms.
//   snare → the palette flips to its complement, a star-shaped shockwave races
//           out, and the tunnel is given a twist of spin.
//   bass  → saturation and the size of the source petals swell.
//   hats  → sparkles glint on a folded grid, so they are mirrored too.
//   drop  → more segments, faster spin and zoom, brighter source, more bloom.

(function () {
  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const COMMON = `
const float TAU = 6.2831853;
vec2 fold(vec2 p, float n, float rot) {
  float r = length(p);
  float a = atan(p.y, p.x) + rot;
  float s = TAU / n;
  a = mod(a, s);
  a = abs(a - 0.5 * s);
  return r * vec2(cos(a), sin(a));
}
vec2 rot2(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

  const FEEDBACK = `#version 300 es
precision highp float;
uniform sampler2D prev;
uniform vec2  res;        // feedback buffer, pixels
uniform float unitPx;     // feedback pixels per virtual unit
uniform float zoom;       // > 1: content moves outward this frame
uniform float spin;       // radians this frame
uniform float twist;      // radius-dependent extra spin (spiral)
uniform float melt;       // symmetric radial wobble
uniform float time;
uniform float nseg;
uniform float srcRot;
uniform float decay;
uniform vec3  tint;
uniform vec4  blob[5];    // folded centre xy, ring radius, width
uniform vec3  colA[5];
uniform vec3  colB[5];
uniform float flipMix;
uniform float gain;       // source brightness (kick stamps here)
uniform vec4  thread;     // offset, amplitude, frequency, phase
uniform float fallback;   // 1 when the buffer is 8-bit: subtract a floor so trails reach black
out vec4 outColor;
${COMMON}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  float r = length(p);

  // Where this pixel was last frame. Twist turns the tunnel into a spiral;
  // melt is a function of r and cos(N a) only, so it keeps the symmetry.
  float a = atan(p.y, p.x);
  float ang = spin + twist * sin(r * 0.009 - time * 0.35);
  vec2 q = rot2(p, -ang) / zoom;
  q *= 1.0 - melt * 0.012 * sin(r * 0.025 - time * 0.9 + 1.7 * cos(nseg * (a + srcRot)));
  vec2 uv = q * unitPx / res + 0.5;
  vec3 old = texture(prev, uv).rgb;
  old = old * decay * tint;
  if (fallback > 0.5) old = max(old - 1.5 / 255.0, 0.0);

  // The source: ring petals and one sinuous thread, all in the folded wedge.
  vec2 k = fold(p, nseg, srcRot);
  vec3 src = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec4 b = blob[i];
    float d = length(k - b.xy);
    float e = (d - b.z) / b.w;
    float ring = exp(-e * e);
    float fill = 0.07 * exp(-d * d / (b.z * b.z));
    src += mix(colA[i], colB[i], flipMix) * (ring + fill);
  }
  float y = thread.x + thread.y * sin(k.x * thread.z + thread.w);
  float ty = (k.y - y) / 2.2;
  float th = exp(-ty * ty) * smoothstep(15.0, 70.0, k.x) * (1.0 - smoothstep(260.0, 460.0, k.x));
  src += mix(colA[4], colB[4], flipMix) * th * 0.7;

  outColor = vec4(old + src * gain, 1.0);
}`;

  const DISPLAY = `#version 300 es
precision highp float;
uniform sampler2D fb;
uniform sampler2D glowNear; // fb downsampled 4x
uniform sampler2D glowFar;  // and 16x
uniform vec2  res;        // output pixels
uniform float unitPx;     // output pixels per virtual unit
uniform vec2  stage;      // virtual stage size
uniform float punch;      // display scale punch (kick)
uniform float kick;
uniform float glow;       // centre bloom base (pad/bass)
uniform vec3  coreCol;
uniform float bloom;
uniform float hat;
uniform float time;
uniform float nseg;
uniform float srcRot;
uniform vec3  shock;      // radius, intensity, width
uniform vec3  shockCol;
uniform float sat;
uniform float exposure;
out vec4 outColor;
${COMMON}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / unitPx;
  vec2 ps = p / punch;
  vec2 uv = ps / stage + 0.5;
  vec3 col = texture(fb, uv).rgb;
  vec3 bl = texture(glowNear, uv).rgb * 0.55 + texture(glowFar, uv).rgb * 0.7;
  col += bl * bloom;

  float r = length(ps);
  float a = atan(ps.y, ps.x) + srcRot;
  // Centre bloom: a hot core that flares on the kick.
  float R = 40.0 + 55.0 * kick;
  col += coreCol * (glow + 1.15 * kick) * exp(-r * r / (R * R));

  // Snare shockwave: a star with one point per segment, racing outward.
  if (shock.y > 0.002) {
  float rs = shock.x * (1.0 + 0.1 * cos(nseg * a));
  float ds = (r - rs) / shock.z;
  col += shockCol * shock.y * (exp(-ds * ds) + 0.35 * exp(-abs(ds) * 0.25) * step(r, rs));
  }

  // Hat sparkles on a folded grid: mirrored like the rest, crisp at full res.
  // Skipped entirely between hats: the fold and hashes are the display
  // pass's biggest cost after the texture reads.
  if (hat > 0.02) {
  vec2 k = fold(ps, nseg, srcRot * 0.5);
  float cell = 16.0;
  vec2 c = floor(k / cell);
  float h = hash(c);
  vec2 sp = (c + 0.2 + 0.6 * vec2(hash(c + 3.1), hash(c + 7.7))) * cell;
  vec2 dv = k - sp;
  float tw = 0.5 + 0.5 * sin(time * (9.0 + 8.0 * h) + h * 40.0);
  float on = smoothstep(0.72, 0.9, h) * hat * tw * smoothstep(25.0, 90.0, r);
  float star = exp(-dot(dv, dv) / 0.9) + 0.4 * exp(-abs(dv.x) * 1.4 - abs(dv.y) * 0.25) + 0.4 * exp(-abs(dv.y) * 1.4 - abs(dv.x) * 0.25);
  col += vec3(1.0, 0.95, 0.9) * star * on * 2.2;
  }

  col = 1.0 - exp(-col * exposure);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, sat), 0.0);
  float v = length(p) / (0.5 * length(stage));
  col *= 1.0 - 0.45 * smoothstep(0.45, 1.15, v);
  outColor = vec4(col, 1.0);
}`;

  // A 4x box downsample: four bilinear taps, each averaging a 2x2 block, cover
  // the destination pixel's 4x4 footprint exactly. Two of these make the
  // bloom; generating a full mip chain every frame cost more than both
  // feedback passes together under SwiftShader.
  const DOWN = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform vec2 srcRes;
uniform vec2 dstRes;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / dstRes;
  vec2 t = 1.0 / srcRes;
  outColor = 0.25 * (texture(src, uv + vec2(-t.x, -t.y)) + texture(src, uv + vec2(t.x, -t.y))
                   + texture(src, uv + vec2(-t.x, t.y)) + texture(src, uv + vec2(t.x, t.y)));
}`;

  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // Each palette is a fresh set (A), its snare complement (B), the tint the
  // echoes drift toward as they age, and the centre bloom colour. Fresh paint
  // is warm and the tunnel's depths go cool, so depth reads as colour.
  const PALETTES = [
    { name: 'Ember & ultraviolet',
      A: ['#ff5a1f', '#ffb238', '#ff2e6e', '#ffd9a0', '#ff7a3d'],
      B: ['#18dcff', '#2effb4', '#1a8cff', '#d0fbff', '#40ffe0'],
      tint: [0.93, 0.9, 1.0], core: '#ffe2b0' },
    { name: 'Lotus',
      A: ['#ff5fa2', '#ffc46b', '#e0409a', '#fff0d0', '#ff8fb8'],
      B: ['#10d6b0', '#7dffd8', '#12a8ff', '#e0fff6', '#3cf0d0'],
      tint: [0.97, 0.88, 0.97], core: '#fff0e0' },
    { name: 'Acid garden',
      A: ['#b6ff2e', '#28ffd0', '#fff23a', '#e8ffd0', '#5cff7a'],
      B: ['#ff2ec4', '#ff7a1f', '#a02eff', '#ffd0f4', '#ff4f8b'],
      tint: [0.88, 0.97, 0.95], core: '#f4ffe0' },
    { name: 'Deep sea',
      A: ['#1fa8ff', '#39ffe0', '#5b6bff', '#d0f6ff', '#2ee6ff'],
      B: ['#ffab1f', '#ff5a3d', '#ffe07a', '#fff0d0', '#ff8a2e'],
      tint: [0.86, 0.93, 1.0], core: '#d8f4ff' },
  ].map((pl) => ({ name: pl.name, A: pl.A.map(hex), B: pl.B.map(hex), tint: pl.tint, core: hex(pl.core) }));

  const FB_SCALE = 0.5;      // feedback resolution relative to the canvas

  function ease(cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  VIZ.register({
    id: 'mandala',
    name: 'Mandala',
    order: 206,

    params: [
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'segments', label: 'Segments', type: 'range', min: 3, max: 16, default: 6, step: 1 },
      { key: 'trails', label: 'Trails', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'melt', label: 'Melt', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'punch', label: 'Music punch', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
    ],

    actions: [
      { id: 'flip', label: 'Swap home palette', run() { this.flip = 1 - (this.flip || 0); } },
    ],

    gallery: {
      title: 'Mandala',
      technique: 'WebGL2 ping-pong video feedback (half-float, half resolution) with a kaleidoscope-folded procedural source, then a full-resolution display pass with mip-chain bloom, a centre bloom, a snare shockwave and folded hat sparkles',
      brief: 'A tunnel of mandalas. Ring-petals and a sinuous thread, mirrored into N wedges, are painted into a feedback loop that zooms, spins, twists and melts, so every frame\'s mandala flies outward and ages from warm to cool. Each kick lurches the tunnel forward, stamps a bright new mandala into the centre and flares the core; each snare flashes the palette to its complement (it relaxes home within the beat), fires a star-shaped shockwave and wrenches the spin; bass swells saturation and petal size; hats glint mirrored sparkles. The drop adds four segments and speeds everything; the breakdown slows into long dreamy trails.',
      lineage: [
        'Brief 06 (batch 02): kaleidoscope + video feedback; kick zooms the tunnel, snare flips palette, bass saturates, drop adds segments.',
        'Chose not to re-fold the feedback each frame: old echoes keep the symmetry they were born with, so a segment change flows out from the centre instead of cutting.',
        'Source is ring-petals rather than filled blobs: rings stack into a tunnel of outlines with depth, filled blobs smeared into a wash in the trails.',
        'Kick is three reactions at once (feedback zoom impulse, display scale punch, stamped source + core bloom) so one beat reads as one forward lurch of the tunnel.',
        'Snare was first a palette toggle: visible, but the build roll left the parity to chance and a whole breakdown sat in the cyan flash colours. Now a flash to the complement that relaxes home over ~0.5 s, so every clap sends a band of the other colour flying out the tunnel.',
        'Perf: a per-frame generateMipmap for the bloom cost more than both passes together under SwiftShader; replaced with two 4x box downsamples (160x90, 40x23). Sparkle and shockwave code is skipped by uniform branch when silent.',
        'Half-float buffers so long trails fade smoothly to black; an 8-bit fallback subtracts a floor so pixels do not stick.',
      ],
    },

    gl: null,
    glFailed: false,

    enter() {
      this.lastMs = null;
      this.clock = 0;
      this.env = { kick: 0, snare: 0, hat: 0, bass: 0, pad: 0, drop: 0, kickAvg: 0 };
      this.spinAng = 0;
      this.spinVel = 0;
      this.srcRot = 0;
      this.flip = this.flip || 0;   // the performer's home palette survives a switch away
      this.flipMix = 0;
      this.flash = 0;
      this.snareArmed = true;
      this.snareCool = 0;
      this.shockAge = 10;
      this.segBoost = 0;
      this.fresh = true;
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: false });
      if (!gl) { this.glFailed = true; return; }
      const floatOK = !!gl.getExtension('EXT_color_buffer_float');
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const link = (fs) => {
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(prog, 0, 'pos');
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        const u = {};
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
          u[name] = gl.getUniformLocation(prog, name);
        }
        return { prog, u };
      };
      this.fbProg = link(FEEDBACK);
      this.dpProg = link(DISPLAY);
      this.dnProg = link(DOWN);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.gl = gl;
      this.glCanvas = c;
      this.floatOK = floatOK;
      this.targets = null;
    },

    makeTargets(fw, fh) {
      const gl = this.gl;
      if (this.targets) for (const t of this.targets) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
      const mk = (useFloat, tw = fw, th = fh) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texStorage2D(gl.TEXTURE_2D, 1, useFloat ? gl.RGBA16F : gl.RGBA8, tw, th);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return { tex, fbo, ok };
      };
      let a = mk(this.floatOK), b = mk(this.floatOK);
      if (!a.ok || !b.ok) { this.floatOK = false; a = mk(false); b = mk(false); }
      const nw = Math.max(1, Math.round(fw / 4)), nh = Math.max(1, Math.round(fh / 4));
      const gw = Math.max(1, Math.round(nw / 4)), gh = Math.max(1, Math.round(nh / 4));
      if (this.glows) for (const t of this.glows) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
      this.glows = [Object.assign(mk(this.floatOK, nw, nh), { w: nw, h: nh }),
        Object.assign(mk(this.floatOK, gw, gh), { w: gw, h: gh })];
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.targets = [a, b];
      this.fw = fw; this.fh = fh;
    },

    // Band envelopes, 0-1. Kick, snare and hats are peak-held transients with
    // fast release; bass, pad and the drop level are slow swells.
    listen(s, dt) {
      const e = this.env;
      const kickRaw = clamp01((s[0] - 50) / 45);
      const snareRaw = clamp01((s[5] - 38) / 42);
      const hatRaw = clamp01((s[8] - 12) / 80);
      e.kick = Math.max(kickRaw, e.kick * Math.exp(-dt * 9));
      e.snare = Math.max(snareRaw, e.snare * Math.exp(-dt * 10));
      e.hat = Math.max(hatRaw, e.hat * Math.exp(-dt * 14));
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 140), 3, dt);
      e.pad = ease(e.pad, clamp01((s[2] + s[3] + s[4]) / 150), 1.2, dt);
      e.kickAvg = ease(e.kickAvg, kickRaw, 2.5, dt);
      const dropT = clamp01(e.kickAvg * 4);
      e.drop = ease(e.drop, dropT, dropT > e.drop ? 2 : 0.5, dt);
      return snareRaw;
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.enter();
      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke();
        p.fill(236);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(20);
        p.text('Mandala needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }

      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const snareRaw = this.listen(signals, dt);
      const e = this.env;
      const P = params.punch;
      const pal = PALETTES[Math.min(PALETTES.length - 1, Math.max(0, params.palette | 0))];

      // Snare: flip the palette, fire a shockwave, wrench the spin. Rearms
      // only once the snare has fallen away and a short cooldown has passed,
      // so a build-up roll flips a few times a second at most, never strobes.
      this.snareCool -= dt;
      if (snareRaw > 0.5 && this.snareArmed && this.snareCool <= 0) {
        this.snareArmed = false;
        this.snareCool = 0.4;
        if (P > 0.01) {
          this.flash = 1;
          this.shockAge = 0;
          this.spinVel += 1.4 * P * (this.spinDir || 1);
        }
      }
      if (snareRaw < 0.25) this.snareArmed = true;
      // The snare is a flash to the complement that relaxes home over about
      // half a second. A toggle left the palette wherever the build's roll
      // happened to end, so a whole breakdown could sit in the flash colours.
      this.flash *= Math.exp(-dt * 2.0);
      const flipTarget = this.flip ? 1 - this.flash : this.flash;
      this.flipMix = ease(this.flipMix, flipTarget, 12, dt);
      this.shockAge += dt;

      // Motion clock runs faster in the drop.
      this.clock += dt * (0.7 + 0.9 * e.drop);
      const T = this.clock;

      // Segments: the drop adds four, with hysteresis so it switches once.
      if (e.drop > 0.6) this.segBoost = 4;
      else if (e.drop < 0.3) this.segBoost = 0;
      const nseg = Math.round(params.segments) + this.segBoost;

      // Spin changes direction every minute or so, so it never settles into
      // one endless rotation; the snare's impulse follows the current way.
      this.spinDir = Math.sin(T * 0.045 + 0.6) >= 0 ? 1 : -1;
      const spinBase = params.spin * (0.12 + 0.55 * e.drop) * Math.sin(T * 0.045 + 0.6);
      this.spinVel *= Math.exp(-dt * 5);
      const spinThis = (spinBase + this.spinVel) * dt;
      this.srcRot -= params.spin * (0.08 + 0.25 * e.drop) * dt;

      // Zoom: a steady fall into the tunnel, and a lurch on every kick.
      const zoomRate = 0.35 + 0.45 * e.drop + 0.15 * e.pad + 3.2 * P * e.kick * e.kick;
      const zoom = Math.exp(zoomRate * dt);

      // Trails: longer in quiet passages, so the breakdown exhales into slow echoes.
      const trail = params.trails;
      const decay = Math.min(0.985, 0.86 + 0.09 * trail + 0.035 * (1 - e.drop));

      // Source petals, placed in the folded wedge (angle 0..pi/N).
      const half = Math.PI / nseg;
      const blob = new Float32Array(20);
      const swell = 1 + 0.9 * e.bass;
      const BL = [
        [30, 70, 0.21, 0.0, 0.33, 1.1, 10],
        [90, 140, 0.13, 2.1, 0.27, 0.4, 22],
        [170, 220, 0.09, 4.2, 0.19, 2.9, 34],
        [60, 260, 0.07, 1.3, 0.23, 5.1, 16],
        [240, 380, 0.05, 3.3, 0.15, 3.7, 44],
      ];
      for (let i = 0; i < 5; i++) {
        const [r0, r1, w1, ph1, w2, ph2, size] = BL[i];
        const r = r0 + (r1 - r0) * (0.5 + 0.5 * Math.sin(T * w1 * 2 + ph1));
        const a = half * (0.5 + 0.5 * Math.sin(T * w2 * 2 + ph2));
        const sz = size * (0.7 + 0.5 * (0.5 + 0.5 * Math.sin(T * 0.31 + i * 1.7))) * swell;
        blob[i * 4] = r * Math.cos(a);
        blob[i * 4 + 1] = r * Math.sin(a);
        blob[i * 4 + 2] = sz;
        blob[i * 4 + 3] = 2.2 + 0.25 * sz / 10;
      }

      // Kick stamps a bright copy of the source; drop brightens the base.
      const gain = (0.045 + 0.02 * e.drop + 0.03 * e.pad) * (1 + 5 * P * e.kick * e.kick);

      // ---- render
      const gl = this.gl;
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      const fw = Math.max(2, Math.round(w * FB_SCALE)), fh = Math.max(2, Math.round(h * FB_SCALE));
      if (!this.targets || this.fw !== fw || this.fh !== fh) this.makeTargets(fw, fh);
      const [src, dst] = this.targets;

      // Feedback pass: src → dst.
      const F = this.fbProg;
      gl.useProgram(F.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, fw, fh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(F.u.prev, 0);
      gl.uniform2f(F.u.res, fw, fh);
      gl.uniform1f(F.u.unitPx, Math.min(fw, fh) / 600);
      gl.uniform1f(F.u.zoom, zoom);
      gl.uniform1f(F.u.spin, spinThis);
      gl.uniform1f(F.u.twist, params.melt * (0.004 + 0.006 * e.drop));
      gl.uniform1f(F.u.melt, params.melt);
      gl.uniform1f(F.u.time, T);
      gl.uniform1f(F.u.nseg, nseg);
      gl.uniform1f(F.u.srcRot, this.srcRot);
      gl.uniform1f(F.u.decay, decay);
      gl.uniform3fv(F.u.tint, pal.tint);
      gl.uniform4fv(F.u.blob, blob);
      gl.uniform3fv(F.u.colA, pal.A.flat());
      gl.uniform3fv(F.u.colB, pal.B.flat());
      gl.uniform1f(F.u.flipMix, this.flipMix);
      gl.uniform1f(F.u.gain, gain);
      gl.uniform4f(F.u.thread, 6 + 8 * Math.sin(T * 0.23), 5 + 4 * Math.sin(T * 0.17), 0.035 + 0.01 * Math.sin(T * 0.11), -T * 2.2);
      gl.uniform1f(F.u.fallback, this.floatOK ? 0 : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Bloom chain: dst → 4x → 16x.
      const N = this.dnProg;
      gl.useProgram(N.prog);
      gl.uniform1i(N.u.src, 0);
      let from = dst.tex, fromW = fw, fromH = fh;
      for (const g of this.glows) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, g.fbo);
        gl.viewport(0, 0, g.w, g.h);
        gl.bindTexture(gl.TEXTURE_2D, from);
        gl.uniform2f(N.u.srcRes, fromW, fromH);
        gl.uniform2f(N.u.dstRes, g.w, g.h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        from = g.tex; fromW = g.w; fromH = g.h;
      }

      // Display pass: dst → canvas.
      const D = this.dpProg;
      gl.useProgram(D.prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dst.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.glows[0].tex);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.glows[1].tex);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(D.u.fb, 0);
      gl.uniform1i(D.u.glowNear, 1);
      gl.uniform1i(D.u.glowFar, 2);
      gl.uniform2f(D.u.res, w, h);
      gl.uniform1f(D.u.unitPx, Math.min(w, h) / 600);
      gl.uniform2f(D.u.stage, ctx.width, ctx.height);
      gl.uniform1f(D.u.punch, 1 + 0.07 * P * e.kick);
      gl.uniform1f(D.u.kick, P * e.kick);
      gl.uniform1f(D.u.glow, 0.12 + 0.3 * e.pad + 0.2 * e.bass);
      gl.uniform3fv(D.u.coreCol, pal.core);
      gl.uniform1f(D.u.bloom, 0.25 + 0.15 * e.drop + 0.45 * P * e.kick);
      gl.uniform1f(D.u.hat, P * e.hat);
      gl.uniform1f(D.u.time, ms / 1000);
      gl.uniform1f(D.u.nseg, nseg);
      gl.uniform1f(D.u.srcRot, this.srcRot);
      const age = this.shockAge;
      gl.uniform3f(D.u.shock, 20 + age * 900, age < 1.2 ? 1.1 * P * Math.exp(-age * 3.2) : 0, 5 + age * 30);
      const sc = this.flip ? pal.A[3] : pal.B[3];
      gl.uniform3fv(D.u.shockCol, sc);
      gl.uniform1f(D.u.sat, 0.85 + 0.6 * e.bass + 0.2 * e.drop);
      gl.uniform1f(D.u.exposure, 1.0 + 0.1 * e.drop);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      this.targets = [dst, src];
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
