// Magnetosphere — charged particles in the field of a few wandering poles.
//
// Every particle carries a charge, positive (cool) or negative (warm). Each
// pole both pulls (a softened 1/r² gravity) and carries a magnetic field
// normal to the screen whose sign alternates pole to pole. The Lorentz force
// q·v×B bends a particle's path without changing its speed, so opposite
// charges curl in opposite directions around the same pole, and a particle
// passing between two poles of opposite polarity switches its rotation: the
// two hues separate into interleaved rosettes and figure-eights. Nothing is
// keyframed; the look is whatever those three rules draw over time.
//
// Rendering is WebGL2: each particle is a line segment from last frame's
// position to this one, added into a half-float buffer that fades a little
// every frame (so paths accumulate into luminous tone), then a quarter-res
// blur for bloom and a soft tonemap so dense cores go white-hot instead of
// clipping to a flat colour.
//
// Music changes the physics, never a size: a kick (a sharp rise in the bass)
// throws the cloud outward from its nearest pole and it settles back through
// its orbits; a clap flips every pole's polarity, easing through zero so the
// whole swarm stalls, straightens and re-curls the other way; overall
// loudness sets the cruising speed, so the breakdown slows to a drift.
(function () {
  const VERT_QUAD = `#version 300 es
in vec2 pos;
out vec2 uv;
void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }`;

  // Particle segments: position in virtual stage units, plus a colour.
  const VERT_LINE = `#version 300 es
in vec2 pos;
in vec3 col;
uniform vec2 stage;
out vec3 vcol;
void main() {
  vcol = col;
  vec2 c = pos / stage * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;
  const FRAG_LINE = `#version 300 es
precision mediump float;
in vec3 vcol;
out vec4 o;
void main() { o = vec4(vcol, 1.0); }`;

  // Used with a constant-alpha blend to multiply the buffer by the fade.
  const FRAG_FLAT = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(0.0); }`;

  // 4 bilinear taps = a 4×4 box, enough to downsample by four without aliasing.
  const FRAG_DOWN = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D src;
uniform vec2 texel;
out vec4 o;
void main() {
  vec3 c = texture(src, uv + texel * vec2(-1.0, -1.0)).rgb
         + texture(src, uv + texel * vec2( 1.0, -1.0)).rgb
         + texture(src, uv + texel * vec2(-1.0,  1.0)).rgb
         + texture(src, uv + texel * vec2( 1.0,  1.0)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;

  const FRAG_BLUR = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D src;
uniform vec2 dir;
out vec4 o;
void main() {
  // 9-tap Gaussian via 5 bilinear fetches.
  vec3 c = texture(src, uv).rgb * 0.227;
  c += (texture(src, uv + dir * 1.385).rgb + texture(src, uv - dir * 1.385).rgb) * 0.316;
  c += (texture(src, uv + dir * 3.231).rgb + texture(src, uv - dir * 3.231).rgb) * 0.070;
  o = vec4(c, 1.0);
}`;

  const FRAG_COMP = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D scene;
uniform sampler2D bloom;
uniform float glow;
uniform float exposure;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture(scene, uv).rgb + texture(bloom, uv).rgb * glow;
  // Exponential tonemap: dense cores approach white, never clip to a flat.
  c = 1.0 - exp(-c * exposure);
  // A little luminance bleeds toward white where both hues overlap.
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  c = mix(c, vec3(l), 0.25 * l * l);
  // Dither away the 8-bit banding in the long dark halo.
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;

  // One cool and one warm hue per palette; colour means charge.
  const PALETTES = [
    { name: 'Ice / Ember', cool: [0.30, 0.62, 1.00], warm: [1.00, 0.50, 0.16] },
    { name: 'Teal / Rose', cool: [0.15, 0.85, 0.80], warm: [1.00, 0.32, 0.45] },
    { name: 'Violet / Gold', cool: [0.52, 0.40, 1.00], warm: [1.00, 0.72, 0.22] },
  ];

  const MAX_PARTICLES = 40000;
  const MAX_POLES = 6;
  const CLUMP = 64;          // particles per coherent clump

  VIZ.register({
    id: 'magnetosphere',
    name: 'Magnetosphere',
    order: 105,
    gallery: {
      title: 'Magnetosphere',
      technique: 'CPU Lorentz-force particle sim (gravity + perpendicular magnetic force + speed thermostat), drawn as additive line segments into a fading half-float WebGL2 buffer with quarter-res bloom and an exponential tonemap',
      brief: 'Two species of charged light, cool and warm, orbiting a few wandering poles whose magnetic polarity alternates. Opposite charges curl opposite ways, so the hues braid into rosettes and figure-eights. Kicks throw the cloud outward and it settles back through its orbits; claps flip every pole, so the swarm stalls and re-curls the other way; loudness sets the cruising speed, so the breakdown drifts.',
      lineage: [
        'Brief 05: particles, perpendicular forces, additive bloom, in the spirit of Hodgin.',
        'Chose charge as the colour: two species that the same field bends opposite ways, so the palette is the physics.',
        'A uniform random cloud read as fog; particles now travel in clumps of 64 on nearly one trajectory, which the chaotic field stretches into ribbons.',
        'Kicks at full strength blew the cloud into the walls; gravity made strong enough that orbits, not the wall, keep it on stage.',
        'A field peaking at each pole trapped particles into white-hot knots; it now peaks in a ring and is zero at the pole, and clumps renew by fading out and re-forming in orbit around a pole rather than on existing light.',
        'Poles on independent paths drifted into one knot; they now share a slow rotation with individual wobble.',
        'Claps first flipped the field permanently, which left it near zero through the drop; now a clap is a brief reversal that kinks every path into a cusp.',
        'Critic round 1 (3/3/2/3/3): the drop was a scatter of straight dashes because kicks landed faster than orbits could re-form. Kick force now defaults to 0.35 and each impulse is divided by (1 + recent kick rate), so a lone kick throws the cloud but four-on-the-floor only pulses it; the clap reversal is shorter (0.15 s).',
        'Loudness now also tightens the field and lifts the light, so the drop is the most wound-up and brightest section; 30k particles at lower per-segment light, with exposure and glow raised, for a luminous cloud rather than sparse hair.',
        'Rendered the extremes: field 0 with one pole is a two-armed galaxy that burned a white disc at the pole, hence a small repulsive core; field 3 with six poles is a dense wool of coils. Kept field 1 and three poles as defaults.',
        'Even fans of headings spread into moiré sheets in the drop; offsets are now random and four times narrower, so clumps stay threads for longer.',
      ],
    },

    params: [
      { key: 'field', label: 'Magnetic field', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'poles', label: 'Poles', type: 'range', min: 1, max: MAX_POLES, default: 3, step: 1 },
      { key: 'trail', label: 'Trail length', type: 'range', min: 0, max: 1, default: 0.9, step: 0.01 },
      { key: 'kick', label: 'Kick force', type: 'range', min: 0, max: 3, default: 0.35, step: 0.01 },
      { key: 'count', label: 'Particles', type: 'range', min: 2000, max: MAX_PARTICLES, default: 30000, step: 1000 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'palette', label: 'Palette', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'kickBand', label: 'Kick band', type: 'band', default: 0 },
    ],

    actions: [
      { id: 'reseed', label: 'Re-seed', run() { this.needsSeed = true; } },
    ],

    setup(p, ctx) {
      this.px = new Float32Array(MAX_PARTICLES);
      this.py = new Float32Array(MAX_PARTICLES);
      this.vx = new Float32Array(MAX_PARTICLES);
      this.vy = new Float32Array(MAX_PARTICLES);
      this.q = new Float32Array(MAX_PARTICLES);    // charge, ±1
      this.sp = new Float32Array(MAX_PARTICLES);   // per-particle cruising-speed factor
      this.verts = new Float32Array(MAX_PARTICLES * 2 * 5);
      this.poleX = new Float32Array(MAX_POLES);
      this.poleY = new Float32Array(MAX_POLES);
      const nc = Math.ceil(MAX_PARTICLES / CLUMP);
      this.cAge = new Float32Array(nc);
      this.cLife = new Float32Array(nc);
    },

    enter(p, ctx) {
      this.needsSeed = true;
    },

    seed(p, ctx) {
      const w = ctx.width, h = ctx.height;
      this.t = 0;               // simulation time, slows in quiet passages
      this.hand = 1;            // eased polarity, -1..1
      this.flip = 0;            // clap envelope, 0..1
      this.kickRate = 0;        // decaying sum of recent kicks
      this.energy = 0;
      this.prev = new Float32Array(9);
      this.phase = Math.random() * 100;
      const nc = this.cAge.length;
      for (let c = 0; c < nc; c++) {
        // Start from a scatter of fresh clumps on tangential paths, with ages
        // staggered so they do not all renew in the same second.
        const a = Math.random() * Math.PI * 2;
        const r = (0.15 + 0.85 * Math.sqrt(Math.random())) * Math.min(w, h) * 0.42;
        const x = w / 2 + Math.cos(a) * r * (w / h), y = h / 2 + Math.sin(a) * r;
        const s = 90;
        this.spawnClump(c, x, y, -Math.sin(a) * s, Math.cos(a) * s, 0.6 + Math.random() * 0.8);
        this.cAge[c] = Math.random() * this.cLife[c] * 0.5;
      }
      this.clearBuffer = true;
      this.needsSeed = false;
    },

    // A clump is CLUMP particles on almost the same trajectory. The field is
    // chaotic, so the tiny spread grows: a clump starts as a thin comet and is
    // stretched and folded into a ribbon. That stretching is where the
    // filaments come from; a uniform random cloud just reads as fog.
    spawnClump(c, x, y, ux, uy, spf) {
      const q = Math.random() < 0.5 ? 1 : -1;
      const i0 = c * CLUMP;
      const i1 = Math.min(MAX_PARTICLES, i0 + CLUMP);
      for (let i = i0; i < i1; i++) {
        // Random rather than evenly spaced offsets: an even fan spread into a
        // sheet of parallel 1-px lines that moiréd into a visible mesh.
        const j = Math.random() - 0.5;
        const rot = j * 0.012;                      // a very small fan of headings
        const cs = Math.cos(rot), sn = Math.sin(rot);
        this.px[i] = x; this.py[i] = y;
        this.vx[i] = ux * cs - uy * sn;
        this.vy[i] = ux * sn + uy * cs;
        this.q[i] = q;
        this.sp[i] = spf * (1 + j * 0.015);
      }
      this.cAge[c] = 0;
      this.cLife[c] = 10 + Math.random() * 12;
    },

    // Renewal without a pop: a clump that has lived out its life has already
    // faded to nothing; it re-forms somewhere on stage, orbiting its nearest
    // pole, and fades up as it peels apart. Re-forming at random places rather
    // than on existing particles matters: the latter fed back into itself and
    // the whole cloud collapsed onto the poles within 15 s.
    renewClumps(dt, n, np, ctx) {
      const nc = Math.ceil(n / CLUMP);
      const w = ctx.width, h = ctx.height;
      for (let c = 0; c < nc; c++) {
        this.cAge[c] += dt;
        if (this.cAge[c] < this.cLife[c]) continue;
        // Born in orbit around a pole, so light gathers into a halo around
        // each one with the transfer strands between them left sparse: a
        // composition, not an even carpet of loops.
        const k = Math.floor(Math.random() * np);
        const a = Math.random() * Math.PI * 2, r = 50 + 170 * Math.random();
        const x = this.poleX[k] + Math.cos(a) * r, y = this.poleY[k] + Math.sin(a) * r;
        const dir = Math.random() < 0.5 ? 1 : -1, s = 110;
        this.spawnClump(c, x, y, -Math.sin(a) * s * dir, Math.cos(a) * s * dir, 0.6 + Math.random() * 0.8);
      }
    },

    // 0 → 1 → 0 over a clump's life (2.5 s fade in, 2.5 s fade out).
    clumpLight(c) {
      const a = this.cAge[c], l = this.cLife[c];
      return Math.min(1, a / 2.5, (l - a) / 2.5);
    },

    // Poles wander on slow incommensurate sines inside the stage, so their
    // paths never repeat and they reach the corners of any aspect ratio.
    placePoles(n, ctx) {
      const w = ctx.width, h = ctx.height, T = this.t * 0.11 + this.phase;
      // A shared slow rotation keeps the poles spread around the stage (with
      // independent speeds they drifted into one knot); each wobbles on its
      // own incommensurate sines so the figure never repeats.
      const rx = n === 1 ? 0.10 : 0.30, ry = n === 1 ? 0.10 : 0.28;
      for (let k = 0; k < n; k++) {
        const f = 1 + k * 0.37;
        const ang = (k / n) * Math.PI * 2 + T * 0.35 + 0.35 * Math.sin(T * 0.61 * f + k * 2.3);
        const rad = 1 + 0.22 * Math.sin(T * 0.83 * f + k * 1.7);
        this.poleX[k] = w * (0.5 + rx * rad * Math.cos(ang));
        this.poleY[k] = h * (0.5 + ry * rad * Math.sin(ang));
      }
    },

    simulate(signals, params, ctx, n) {
      const dt0 = 1 / 60;
      const w = ctx.width, h = ctx.height;

      // --- music → physics
      const kb = params.kickBand | 0;
      const rise = signals[kb] - this.prev[kb];
      const kickRaw = Math.max(0, rise - 12) / 88;
      // Scale each impulse by how busy the kicks have been: a lone kick after
      // a quiet stretch throws the cloud hard, but four-on-the-floor only
      // pulses it. At full strength every 0.48 s the orbits never had time to
      // re-form, and the drop — which should be the most structured section —
      // was a tangle of straight dashes.
      const kick = kickRaw * params.kick / (1 + this.kickRate);
      this.kickRate = this.kickRate * Math.exp(-dt0 / 1.0) + kickRaw;
      // A clap briefly reverses the field: an envelope that jumps and decays
      // over ~0.15 s. Every path kinks into a cusp and then resumes its curl.
      // (A permanent flip per clap, tried first, left the field hovering
      // near zero through the drop and straightened everything into fog.)
      const clapRise = signals[4] - this.prev[4];
      if (clapRise > 25) this.flip = Math.min(1, this.flip + clapRise / 60);
      this.flip *= Math.exp(-dt0 / 0.15);
      this.prev.set(signals);
      let mean = 0;
      for (let b = 0; b < 9; b++) mean += signals[b];
      mean /= 900;
      // Slow follower: the cruising speed breathes with sections, not beats.
      this.energy += (mean - this.energy) * 0.02;
      const e = Math.min(1, this.energy * 2.2);
      const timeScale = 0.55 + 0.75 * e;
      // Eased through zero, so a flip reads as a stall and a turn, not a pop.
      this.hand += ((1 - 2 * Math.min(1, this.flip * 1.4)) - this.hand) * 0.3;

      const dt = dt0 * timeScale;
      this.t += dt;
      const np = Math.round(params.poles);
      this.placePoles(np, ctx);
      this.renewClumps(dt, n, np, ctx);

      // Pull, shared among poles: a circular orbit at cruising speed sits about
      // 180 units out, so the cloud stays on stage by gravity, not by the wall.
      const G = 4.8e6 / np;
      // Loud sections tighten the coils, so the drop is the most wound-up,
      // not the most scattered.
      const B = 2.5 * params.field * this.hand * (0.85 + 0.4 * e);
      const vTarget = 125;
      const soft2 = 50 * 50;
      const bx = w * 0.5, by = h * 0.5;
      const ex = 1 / (w * 0.5), ey = 1 / (h * 0.5);
      const px = this.px, py = this.py, vx = this.vx, vy = this.vy, q = this.q, sp = this.sp;
      const PX = this.poleX, PY = this.poleY;

      for (let i = 0; i < n; i++) {
        let x = px[i], y = py[i], ux = vx[i], uy = vy[i];
        let ax = 0, ay = 0, bz = 0;
        let nearD = 1e12, nx = 0, ny = 0;
        for (let k = 0; k < np; k++) {
          const dx = PX[k] - x, dy = PY[k] - y;
          const r2 = dx * dx + dy * dy;
          const inv = 1 / (r2 + soft2);
          const g = G * inv * Math.sqrt(inv);
          ax += dx * g; ay += dy * g;
          // A small repulsive core keeps an eye open at each pole: with the
          // field off, or one pole, orbits fell straight in and burned a flat
          // white disc there.
          if (r2 < 2025) {
            const r = Math.sqrt(r2) + 1e-3, push = (45 - r) * 60 / r;
            ax -= dx * push; ay -= dy * push;
          }
          // Field peaks in a ring 80 units out and falls off as 1/r, so it
          // reaches between poles. Zero at the pole itself: a field that
          // peaked there trapped particles in tight gyres that burned white.
          // Alternating polarity makes between-pole paths switch curl.
          bz += ((k & 1) ? -1 : 1) * 160 * Math.sqrt(r2) / (r2 + 6400);
          if (r2 < nearD) { nearD = r2; nx = dx; ny = dy; }
        }
        // Lorentz: a = q v × (B ẑ) = qB (vy, -vx). Perpendicular, so no work.
        const qb = q[i] * B * bz;
        ax += qb * uy; ay -= qb * ux;

        // Kick: a velocity step outward from the nearest pole, strongest near it.
        if (kick > 0) {
          const d = Math.sqrt(nearD) + 1;
          const imp = kick * 140 * (0.4 + 0.6 * 60 / (d + 60)) / d;
          ux -= nx * imp; uy -= ny * imp;
        }

        // Soft elliptical wall at the stage edge: escapees are reeled back
        // in along a curve, never respawned.
        const ox = (x - bx) * ex, oy = (y - by) * ey;
        const o2 = ox * ox + oy * oy;
        if (o2 > 1.15) {
          const pull = (o2 - 1.15) * 1500;
          ax -= ox * pull * w * 0.5 * ey; ay -= oy * pull;
        }

        ux += ax * dt; uy += ay * dt;
        // Thermostat: speed relaxes toward this particle's cruising speed, so
        // kicks decay and orbits neither collapse into a pole nor boil off.
        const s = Math.sqrt(ux * ux + uy * uy) + 1e-3;
        const target = vTarget * sp[i];
        const f = 1 + (target / s - 1) * Math.min(1, 2.2 * dt);
        ux *= f; uy *= f;
        vx[i] = ux; vy[i] = uy;
        px[i] = x + ux * dt; py[i] = y + uy * dt;
      }
      return { timeScale, e };
    },

    initGL() {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) { this.glFailed = true; return; }
      this.floatOK = !!gl.getExtension('EXT_color_buffer_float');
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const program = (vs, fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'pos');
        gl.bindAttribLocation(pr, 1, 'col');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const u = {};
        const nu = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < nu; i++) {
          const name = gl.getActiveUniform(pr, i).name;
          u[name] = gl.getUniformLocation(pr, name);
        }
        return { pr, u };
      };
      this.pLine = program(VERT_LINE, FRAG_LINE);
      this.pFlat = program(VERT_QUAD, FRAG_FLAT);
      this.pDown = program(VERT_QUAD, FRAG_DOWN);
      this.pBlur = program(VERT_QUAD, FRAG_BLUR);
      this.pComp = program(VERT_QUAD, FRAG_COMP);

      this.quadVao = gl.createVertexArray();
      gl.bindVertexArray(this.quadVao);
      const qb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, qb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.lineVao = gl.createVertexArray();
      gl.bindVertexArray(this.lineVao);
      this.lineBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.verts.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 8);
      gl.bindVertexArray(null);

      this.gl = gl;
      this.glCanvas = c;
    },

    makeTarget(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (this.floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h };
    },

    resize(w, h) {
      const gl = this.gl;
      for (const t of [this.scene, this.bA, this.bB]) {
        if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
      }
      this.glCanvas.width = w; this.glCanvas.height = h;
      this.scene = this.makeTarget(w, h);
      const bw = Math.max(1, Math.round(w / 4)), bh = Math.max(1, Math.round(h / 4));
      this.bA = this.makeTarget(bw, bh);
      this.bB = this.makeTarget(bw, bh);
    },

    quad(prog, target, tex) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : this.glCanvas.width, target ? target.h : this.glCanvas.height);
      gl.useProgram(prog.pr);
      if (tex) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (prog.u.src) gl.uniform1i(prog.u.src, 0);
      }
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (!this.px) this.setup(p, ctx);
      if (this.needsSeed || this.stageW !== ctx.width || this.stageH !== ctx.height) {
        this.stageW = ctx.width; this.stageH = ctx.height;
        this.seed(p, ctx);
      }

      if (!this.gl && !this.glFailed) this.initGL();
      if (!this.gl) {
        p.background(0);
        p.noStroke();
        p.fill(255, 90, 60);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(24);
        p.text('Magnetosphere needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }
      const gl = this.gl;
      const W = Math.round(p.width * p.pixelDensity());
      const H = Math.round(p.height * p.pixelDensity());
      if (this.glCanvas.width !== W || this.glCanvas.height !== H || !this.scene) this.resize(W, H);

      const n = Math.min(MAX_PARTICLES, Math.round(params.count));
      // Store the previous positions before stepping: each segment is one frame of path.
      const vtx = this.verts;
      const pal = PALETTES[params.palette | 0] || PALETTES[0];
      // Per-segment light scales against count so the default tone holds when
      // the performer changes the number of particles.
      const lum = 0.019 * Math.sqrt(30000 / n);
      for (let i = 0; i < n; i++) {
        const o = i * 10;
        vtx[o] = this.px[i]; vtx[o + 1] = this.py[i];
      }
      const sim = this.simulate(signals, params, ctx, n);
      // The section's loudness (slow) lifts the light a little: the drop burns hotter.
      const heat = 0.85 + 0.45 * sim.e;
      for (let i = 0; i < n; i++) {
        const o = i * 10;
        const c = this.q[i] > 0 ? pal.cool : pal.warm;
        // Slower particles draw shorter segments; brighten them a touch so
        // the tight inner orbits are not starved of light.
        const l = lum * (1.4 - 0.4 * this.sp[i]) * this.clumpLight((i / CLUMP) | 0) * heat;
        const r = c[0] * l, g = c[1] * l, b = c[2] * l;
        vtx[o + 2] = r; vtx[o + 3] = g; vtx[o + 4] = b;
        vtx[o + 5] = this.px[i]; vtx[o + 6] = this.py[i];
        vtx[o + 7] = r; vtx[o + 8] = g; vtx[o + 9] = b;
      }

      // 1. Fade the accumulation buffer (dst *= fade) — or clear it on a fresh start.
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
      gl.viewport(0, 0, W, H);
      if (this.clearBuffer) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.clearBuffer = false;
      }
      // Trail 0..1 maps to a per-frame keep factor of 0.85..0.985: from comet
      // streaks to whole orbits drawn out in light.
      const keep = 0.85 + 0.135 * Math.pow(params.trail, 0.6);
      gl.enable(gl.BLEND);
      gl.blendColor(0, 0, 0, keep);
      gl.blendFunc(gl.ZERO, gl.CONSTANT_ALPHA);
      this.quad(this.pFlat, this.scene, null);

      // 2. Additive segments.
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.pLine.pr);
      gl.uniform2f(this.pLine.u.stage, ctx.width, ctx.height);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vtx, 0, n * 10);
      gl.drawArrays(gl.LINES, 0, n * 2);
      gl.disable(gl.BLEND);

      // 3. Bloom: downsample, then separable blur at quarter resolution.
      gl.useProgram(this.pDown.pr);
      gl.uniform2f(this.pDown.u.texel, 1 / W, 1 / H);
      this.quad(this.pDown, this.bA, this.scene.tex);
      gl.useProgram(this.pBlur.pr);
      gl.uniform2f(this.pBlur.u.dir, 1 / this.bA.w, 0);
      this.quad(this.pBlur, this.bB, this.bA.tex);
      gl.useProgram(this.pBlur.pr);
      gl.uniform2f(this.pBlur.u.dir, 0, 1 / this.bA.h);
      this.quad(this.pBlur, this.bA, this.bB.tex);

      // 4. Composite and tonemap to the visible canvas.
      gl.useProgram(this.pComp.pr);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.bA.tex);
      gl.uniform1i(this.pComp.u.scene, 0);
      gl.uniform1i(this.pComp.u.bloom, 1);
      gl.uniform1f(this.pComp.u.glow, 2.6 * params.glow);
      gl.uniform1f(this.pComp.u.exposure, 1.9);
      this.quad(this.pComp, null, this.scene.tex);
      // Unbind the bloom so next frame can render into it without a feedback-loop error.
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);

      const dc = p.drawingContext;
      dc.save();
      dc.globalCompositeOperation = 'source-over';
      dc.globalAlpha = 1;
      dc.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
      dc.restore();
    },
  });
})();
