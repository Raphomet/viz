// Planets — finishes ../../Planets.pde, which was abandoned half-built.
//
// The original was white line art on black: a ring for a sun and thirty
// planets on random ellipses (a, b in 0.25–1.45, random tilt `rot`, random
// direction) at distance (i + 1) × 10, one planet type actually drawn, and a
// to-do list at the top of the file. That list is the spec here: respond to
// music, all seven planet types, orbit trails alpha'd in, orbit size pulsing,
// a starfield, colour, and a prettier sun. The orrery geometry is kept, then
// seen at a tilt so bodies pass behind and in front of the sun.

(function () {
  const TWO_PI = Math.PI * 2;

  // Every planet is rolled up front, as in the original's init(), so raising
  // the count later reveals planets that were already decided.
  const MAX_PLANETS = 30;
  // The sky is a disc big enough to cover the corners of a 3.5:1 stage while
  // it slowly turns, so any aspect ratio is filled.
  const MAX_STARS = 5000;
  const STAR_FIELD_R = 1150;
  const STAR_BUCKETS = 10;
  // Segments for a trail that runs the whole way round an orbit.
  const TRAIL_STEPS = 90;
  const ORBIT_STEPS = 72;
  const CORONA_STEPS = 144;

  const SIMPLE = 0, ONE_MOON = 1, TWO_MOONS = 2, MOON_WITH_MOON = 3,
    RINGED = 4, BINARY = 5, TRINARY = 6;
  const TYPE_WEIGHTS = [3, 3, 2, 2, 2, 2, 2];

  const shared = window.VIZ_PALETTES || [];
  const PALETTES = [{ name: 'Line art', colors: [] }]
    .concat(shared.map((pal) => ({ name: pal.name, colors: pal.colors.slice() })));

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function luminance(c) {
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  }
  function css(c) {
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }
  function mix(c, d, t) {
    return [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t];
  }

  // Several of the shared palettes carry near-black swatches that were a
  // background colour in Text and Jags; against this black sky they would be
  // invisible planets, so dark swatches are lifted toward white.
  function buildScheme(index) {
    if (index <= 0 || !PALETTES[index]) {
      return {
        lineArt: true,
        body: ['#fff', '#fff', '#fff', '#fff', '#fff'],
        moon: ['rgb(128,128,128)', 'rgb(128,128,128)', 'rgb(128,128,128)', 'rgb(128,128,128)', 'rgb(128,128,128)'],
        ring: ['rgb(210,210,210)', 'rgb(210,210,210)', 'rgb(210,210,210)', 'rgb(210,210,210)', 'rgb(210,210,210)'],
        sun: '#fff',
        sunRgb: [255, 255, 255],
        star: '#fff',
      };
    }
    const cols = PALETTES[index].colors.map(hexToRgb).map((c) => {
      const l = luminance(c);
      return l < 0.3 ? mix(c, [255, 255, 255], (0.3 - l) / 0.3 * 0.55 + 0.15) : c;
    });
    let sun = cols[0];
    cols.forEach((c) => { if (luminance(c) > luminance(sun)) sun = c; });
    return {
      lineArt: false,
      body: cols.map(css),
      moon: cols.map((c, i) => css(mix(cols[(i + 2) % 5], [255, 255, 255], 0.25))),
      ring: cols.map((c, i) => css(cols[(i + 1) % 5])),
      sun: css(mix(sun, [255, 255, 255], 0.15)),
      sunRgb: mix(sun, [255, 255, 255], 0.15),
      star: css(mix(sun, [255, 255, 255], 0.8)),
    };
  }

  function pickType(p) {
    let total = 0;
    for (const w of TYPE_WEIGHTS) total += w;
    let r = p.random(total);
    for (let i = 0; i < TYPE_WEIGHTS.length; i++) {
      r -= TYPE_WEIGHTS[i];
      if (r < 0) return i;
    }
    return SIMPLE;
  }

  // The original's moons shared the planet's 0.25–1.45 ellipse range, which
  // at the low end puts a moon inside its own planet; 0.6 keeps it outside.
  function makeMoon(p, hasMoon, reach) {
    return {
      a: p.random(0.85) + 0.6,
      b: p.random(0.85) + 0.6,
      radius: p.random(4) + 2,
      dir: p.random() < 0.5 ? 1 : -1,
      speed: p.random(1.8, 3.6),
      phase: p.random(TWO_PI),
      reach: reach,
      moon: hasMoon ? makeMoon(p, false, 1) : null,
    };
  }

  function makePlanet(p, i) {
    const pl = {
      a: p.random(1.2) + 0.25,
      b: p.random(1.2) + 0.25,
      radius: p.random(10) + 8,
      rot: p.random(1) * TWO_PI,
      dir: p.random() < 0.5 ? 1 : -1,
      type: pickType(p),
      phase: p.random(TWO_PI),
      speedJitter: p.random(0.85, 1.15),
      colour: (i + Math.floor(p.random(5))) % 5,
      band: i % 9,
      moons: [],
      ring: null,
      parts: null,
    };
    switch (pl.type) {
      case ONE_MOON:
        pl.moons.push(makeMoon(p, false, 1));
        break;
      case TWO_MOONS:
        pl.moons.push(makeMoon(p, false, 1));
        pl.moons.push(makeMoon(p, false, 1.7));
        break;
      case MOON_WITH_MOON:
        pl.moons.push(makeMoon(p, true, 1.3));
        pl.moons[0].radius += 2;
        break;
      case RINGED:
        pl.radius = p.random(6) + 9;
        pl.ring = {
          angle: p.random(-0.45, 0.45),
          squash: p.random(0.2, 0.38),
          inner: p.random(1.35, 1.6),
          outer: p.random(1.9, 2.4),
        };
        break;
      case BINARY: {
        const r1 = pl.radius * p.random(0.55, 0.75);
        pl.parts = { radii: [r1, r1 * p.random(0.45, 0.85)], spin: p.random(1.4, 2.6) * pl.dir, phase: p.random(TWO_PI) };
        break;
      }
      case TRINARY: {
        const r = pl.radius * 0.45;
        pl.parts = { radii: [r * p.random(0.8, 1.15), r * p.random(0.8, 1.15), r * p.random(0.8, 1.15)],
          spin: p.random(1.2, 2.2) * pl.dir, phase: p.random(TWO_PI) };
        break;
      }
    }
    return pl;
  }

  // Scratch storage reused every frame so the draw loop allocates nothing.
  const bucketIdx = [];
  for (let i = 0; i < STAR_BUCKETS; i++) bucketIdx.push(new Int32Array(MAX_STARS));
  const bucketLen = new Int32Array(STAR_BUCKETS);

  VIZ.register({
    id: 'planets',
    name: 'Planets',
    order: 7,

    params: [
      { key: 'count', label: 'Planets', type: 'range', min: 3, max: MAX_PLANETS, default: 12, step: 1 },
      { key: 'tilt', label: 'Tilt', type: 'range', min: 0, max: 88, default: 62, step: 1 },
      { key: 'zoom', label: 'Zoom', type: 'range', min: 0.4, max: 2.5, default: 1 },
      // 1 is the original's 8–18 bodies; they were drawn for 10-unit orbit
      // spacing and crowd each other at that size.
      { key: 'planetSize', label: 'Planet size', type: 'range', min: 0.2, max: 1.5, default: 0.7 },
      { key: 'pulse', label: 'Orbit pulse', type: 'range', min: 0, max: 1, default: 0.3 },
      { key: 'speed', label: 'Orbit speed', type: 'range', min: 0, max: 4, default: 1 },
      { key: 'trail', label: 'Trail length', type: 'range', min: 0, max: 1, default: 0.3 },
      { key: 'orbitLines', label: 'Orbit lines', type: 'range', min: 0, max: 1, default: 0.25 },
      { key: 'shading', label: 'Shading', type: 'range', min: 0, max: 1, default: 0.6 },
      { key: 'sunSize', label: 'Sun size', type: 'range', min: 4, max: 40, default: 12 },
      { key: 'sunSensitivity', label: 'Sun sensitivity', type: 'range', min: 0, max: 2, default: 1 },
      { key: 'sunBand', label: 'Sun follows band', type: 'band', default: 0 },
      { key: 'corona', label: 'Corona', type: 'range', min: 0, max: 2, default: 1 },
      { key: 'stars', label: 'Star density', type: 'range', min: 0, max: 1, default: 0.5 },
      { key: 'twinkle', label: 'Twinkle', type: 'range', min: 0, max: 2, default: 1 },
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
        palettes: PALETTES, default: 0 },
    ],

    actions: [
      { id: 'newSystem', label: 'New system', run() { this.rollSystem(); } },
    ],

    p: null,
    planets: null,
    phases: null,
    stars: null,
    env: null,
    lastMillis: 0,
    time: 0,
    schemeIndex: -1,
    scheme: null,

    rollSystem() {
      const p = this.p;
      if (!p) return;
      this.planets = [];
      this.phases = new Float64Array(MAX_PLANETS);
      for (let i = 0; i < MAX_PLANETS; i++) {
        const pl = makePlanet(p, i);
        this.planets.push(pl);
        this.phases[i] = pl.phase;
      }
      // "New system" should always show off the menagerie: the first seven
      // planets cover all seven types, in shuffled order.
      const types = [0, 1, 2, 3, 4, 5, 6];
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(p.random(i + 1));
        const t = types[i]; types[i] = types[j]; types[j] = t;
      }
      for (let i = 0; i < 7; i++) {
        let pl;
        do { pl = makePlanet(p, i); } while (pl.type !== types[i]);
        this.planets[i] = pl;
        this.phases[i] = pl.phase;
      }
    },

    rollStars() {
      const p = this.p;
      const s = {
        x: new Float32Array(MAX_STARS), y: new Float32Array(MAX_STARS),
        size: new Float32Array(MAX_STARS), base: new Float32Array(MAX_STARS),
        band: new Uint8Array(MAX_STARS), sens: new Float32Array(MAX_STARS),
        phase: new Float32Array(MAX_STARS), rate: new Float32Array(MAX_STARS),
      };
      for (let i = 0; i < MAX_STARS; i++) {
        const r = STAR_FIELD_R * Math.sqrt(p.random());
        const a = p.random(TWO_PI);
        s.x[i] = Math.cos(a) * r;
        s.y[i] = Math.sin(a) * r;
        const m = p.random();
        s.size[i] = 0.5 + m * m * 1.4;
        s.base[i] = 0.15 + p.random(0.55) * (0.5 + m);
        s.band[i] = 5 + Math.floor(p.random(4));
        const q = p.random();
        s.sens[i] = q * q;
        s.phase[i] = p.random(TWO_PI);
        s.rate[i] = p.random(0.4, 2.2);
      }
      this.stars = s;
    },

    setup(p) {
      this.p = p;
      this.env = new Float32Array(9);
      this.rollSystem();
      this.rollStars();
    },

    enter(p) {
      if (!this.p) this.setup(p);
      this.lastMillis = p.millis();
    },

    draw(p, signals, params, ctx) {
      if (!this.planets) this.setup(p);
      const g = p.drawingContext;
      const W = ctx.width, H = ctx.height;
      const cx = W / 2, cy = H / 2;

      const now = p.millis();
      const dt = Math.min(0.1, Math.max(0, (now - this.lastMillis) / 1000));
      this.lastMillis = now;
      this.time += dt;
      const t = this.time;

      // Envelopes: quick to rise, slow to fall, so orbits breathe with the
      // music instead of jittering on every analysis frame.
      const env = this.env;
      const up = 1 - Math.exp(-dt * 28), down = 1 - Math.exp(-dt * 5);
      for (let k = 0; k < 9; k++) {
        const s = signals[k];
        env[k] += (s - env[k]) * (s > env[k] ? up : down);
      }

      const pi = Math.round(params.colorPalette);
      if (pi !== this.schemeIndex) {
        this.schemeIndex = pi;
        this.scheme = buildScheme(pi);
      }
      const sch = this.scheme;

      p.colorMode(p.RGB, 255);
      p.background(0);
      p.ellipseMode(p.RADIUS);
      p.strokeCap(p.ROUND);
      g.globalAlpha = 1;
      g.lineJoin = 'round';

      const tiltRad = params.tilt * Math.PI / 180;
      const sq = Math.cos(tiltRad);
      const persp = 0.35 * Math.sin(tiltRad);
      const count = Math.min(MAX_PLANETS, Math.round(params.count));
      const zoom = params.zoom;
      const ps = params.planetSize;
      // The original spaced 30 orbits 10 apart from the sun's centre; here
      // they start clear of the corona and the spacing scales with the count
      // so the system fills the stage at any size.
      const inner = 42 * zoom;
      const spacing = 255 * zoom / (count + 1);

      // ---- starfield -------------------------------------------------------
      const nStars = Math.round(params.stars * MAX_STARS);
      if (nStars > 0) {
        const st = this.stars;
        const skyA = t * 0.006;
        const ca = Math.cos(skyA), sa = Math.sin(skyA);
        const tw = params.twinkle;
        bucketLen.fill(0);
        for (let i = 0; i < nStars; i++) {
          const x = cx + st.x[i] * ca - st.y[i] * sa;
          const y = cy + st.x[i] * sa + st.y[i] * ca;
          if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue;
          let b = st.base[i] * (0.7 + 0.3 * Math.sin(t * st.rate[i] + st.phase[i]));
          b += tw * st.sens[i] * env[st.band[i]] / 100 * (0.55 + 0.45 * Math.sin(t * 9 * st.rate[i] + st.phase[i] * 3));
          if (b <= 0.02) continue;
          let k = Math.floor(b * STAR_BUCKETS);
          if (k >= STAR_BUCKETS) k = STAR_BUCKETS - 1;
          bucketIdx[k][bucketLen[k]++] = i;
        }
        g.fillStyle = sch.star;
        for (let k = 0; k < STAR_BUCKETS; k++) {
          const n = bucketLen[k];
          if (!n) continue;
          const idx = bucketIdx[k];
          g.globalAlpha = (k + 1) / STAR_BUCKETS;
          g.beginPath();
          for (let j = 0; j < n; j++) {
            const i = idx[j];
            const x = cx + st.x[i] * ca - st.y[i] * sa;
            const y = cy + st.x[i] * sa + st.y[i] * ca;
            const s = st.size[i] * (k >= STAR_BUCKETS - 2 ? 1.3 : 1);
            g.rect(x - s / 2, y - s / 2, s, s);
          }
          g.fill();
        }
        g.globalAlpha = 1;
      }

      // ---- sun glow --------------------------------------------------------
      const sunEnv = env[Math.round(params.sunBand) % 9] / 100;
      const sunR = params.sunSize * zoom * (1 + params.sunSensitivity * 0.6 * sunEnv);
      {
        const glowR = sunR * 7 + 30 * zoom;
        const c = sch.sunRgb;
        const grad = g.createRadialGradient(cx, cy, sunR * 0.5, cx, cy, glowR);
        const a0 = (sch.lineArt ? 0.1 : 0.16) * (0.6 + 0.8 * sunEnv * params.sunSensitivity);
        grad.addColorStop(0, 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.min(0.5, a0) + ')');
        grad.addColorStop(0.35, 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.min(0.5, a0) * 0.3 + ')');
        grad.addColorStop(1, 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, cy, glowR, 0, TWO_PI);
        g.fill();
      }

      // ---- orbit state -----------------------------------------------------
      const planets = this.planets;
      const phases = this.phases;
      const speed = params.speed;
      const pulse = params.pulse;
      const sys = this.sysScratch || (this.sysScratch = []);
      sys.length = 0;
      for (let i = 0; i < count; i++) {
        const pl = planets[i];
        const e = env[pl.band] / 100;
        // Kepler-ish: inner planets hurry, outer ones drift, softened so the
        // thirtieth planet still visibly moves. The planet's own band pushes
        // it along a little as well as swelling its orbit.
        const omega = 1.1 * Math.pow((i + 3) / 4, -1.2) * pl.speedJitter * (1 + 0.6 * e);
        phases[i] += dt * speed * omega;
        const d = (inner + spacing * (i + 1)) * (1 + pulse * e);
        pl._d = d;
        pl._e = e;
        const ph = phases[i];
        pl._ph = ph;
        const cr = Math.cos(pl.rot), sr = Math.sin(pl.rot);
        const ox = pl.a * Math.cos(ph) * pl.dir * d, oy = pl.b * Math.sin(ph) * d;
        const px = ox * cr - oy * sr, py = ox * sr + oy * cr;
        pl._x = cx + px;
        pl._y = cy + py * sq;
        pl._depth = py;
        pl._k = Math.max(0.55, 1 + persp * py / 300);
        sys.push(pl);
      }

      // ---- orbit lines and trails -------------------------------------------
      const lineAlpha = params.orbitLines * 0.45;
      const trailFrac = params.trail;
      g.lineCap = 'butt';
      for (let n = 0; n < sys.length; n++) {
        const pl = sys[n];
        const d = pl._d;
        const cr = Math.cos(pl.rot), sr = Math.sin(pl.rot);
        const A = pl.a * pl.dir * d, B = pl.b * d;
        const colour = sch.body[pl.colour];
        g.strokeStyle = colour;

        if (lineAlpha > 0.001) {
          g.globalAlpha = lineAlpha * (sch.lineArt ? 0.6 : 0.8);
          g.lineWidth = 0.6;
          g.beginPath();
          for (let j = 0; j <= ORBIT_STEPS; j++) {
            const ph = j / ORBIT_STEPS * TWO_PI;
            const ox = A * Math.cos(ph), oy = B * Math.sin(ph);
            const x = cx + ox * cr - oy * sr, y = cy + (ox * sr + oy * cr) * sq;
            if (j) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.stroke();
        }

        if (trailFrac > 0.001) {
          const steps = Math.max(3, Math.ceil(trailFrac * TRAIL_STEPS));
          const dph = trailFrac * TWO_PI / steps;
          const head = pl._ph;
          const wHead = Math.min(5, Math.max(1.2, pl.radius * ps * 0.7 * pl._k));
          let ox = A * Math.cos(head), oy = B * Math.sin(head);
          let x0 = cx + ox * cr - oy * sr, y0 = cy + (ox * sr + oy * cr) * sq;
          for (let j = 1; j <= steps; j++) {
            const ph = head - j * dph;
            ox = A * Math.cos(ph); oy = B * Math.sin(ph);
            const x1 = cx + ox * cr - oy * sr, y1 = cy + (ox * sr + oy * cr) * sq;
            const f = 1 - (j - 0.5) / steps;
            g.globalAlpha = f * f * 0.75;
            g.lineWidth = 0.5 + (wHead - 0.5) * f * f;
            g.beginPath();
            g.moveTo(x0, y0);
            g.lineTo(x1, y1);
            g.stroke();
            x0 = x1; y0 = y1;
          }
        }
      }
      g.globalAlpha = 1;

      // ---- bodies, sun among them by depth ----------------------------------
      // Far side of the plane is up the screen; drawing far to near lets the
      // sun eclipse planets passing behind it and planets transit in front.
      sys.sort((u, v) => u._depth - v._depth);
      const shade = params.shading;
      let sunDrawn = false;
      for (let n = 0; n < sys.length; n++) {
        const pl = sys[n];
        if (!sunDrawn && (params.tilt < 1 || pl._depth >= 0)) {
          this.drawSun(g, cx, cy, sunR, env, params, sch, t, zoom);
          sunDrawn = true;
        }
        this.drawSystem(g, pl, cx, cy, sq, ps * pl._k, shade, sch, t, speed);
      }
      if (!sunDrawn) this.drawSun(g, cx, cy, sunR, env, params, sch, t, zoom);

      g.globalAlpha = 1;
    },

    drawSun(g, cx, cy, R, env, params, sch, t, zoom) {
      const amt = params.corona;
      // The corona reads the spectrum round the circle: bass at the crown,
      // treble at the foot, mirrored left and right so it stays symmetric.
      const spin = t * 0.05;
      const base = R + 7 * zoom;
      const reach = 34 * zoom * amt;
      if (amt > 0.001) {
        const pts = this.coronaPts || (this.coronaPts = new Float32Array(CORONA_STEPS * 2));
        for (let j = 0; j < CORONA_STEPS; j++) {
          const u = j / CORONA_STEPS * 2;           // 0..2 round the circle
          const v = (u <= 1 ? u : 2 - u) * 8;       // folded onto bands 0..8
          const k = Math.min(7, Math.floor(v));
          const f = v - k;
          const s = f * f * (3 - 2 * f);
          const level = (env[k] + (env[k + 1] - env[k]) * s) / 100;
          const r = base + reach * level * (0.85 + 0.15 * Math.sin(t * 3 + j * 0.9));
          const ang = -Math.PI / 2 + u * Math.PI + spin;
          pts[j * 2] = cx + Math.cos(ang) * r;
          pts[j * 2 + 1] = cy + Math.sin(ang) * r;
        }
        g.strokeStyle = sch.sun;
        g.lineCap = 'round';
        // Fine rays from the rim out to the outline.
        g.globalAlpha = 0.22;
        g.lineWidth = 0.6;
        g.beginPath();
        for (let j = 0; j < CORONA_STEPS; j += 4) {
          const ang = -Math.PI / 2 + j / CORONA_STEPS * TWO_PI + spin;
          g.moveTo(cx + Math.cos(ang) * (R + 3 * zoom), cy + Math.sin(ang) * (R + 3 * zoom));
          g.lineTo(pts[j * 2], pts[j * 2 + 1]);
        }
        g.stroke();
        // The outline itself.
        g.globalAlpha = 0.85;
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(pts[0], pts[1]);
        for (let j = 1; j < CORONA_STEPS; j++) g.lineTo(pts[j * 2], pts[j * 2 + 1]);
        g.closePath();
        g.stroke();
      }
      // The original sun: a ring, radius 10, stroke 8. Filled black inside so
      // it eclipses whatever passes behind it.
      g.globalAlpha = 1;
      g.fillStyle = '#000';
      g.beginPath();
      g.arc(cx, cy, R, 0, TWO_PI);
      g.fill();
      // A dim core keeps the ring reading as a star rather than an eye.
      g.globalAlpha = 0.22;
      g.fillStyle = sch.sun;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = sch.sun;
      g.lineWidth = Math.max(2, R * 0.55);
      g.beginPath();
      g.arc(cx, cy, R, 0, TWO_PI);
      g.stroke();
    },

    drawSystem(g, pl, cx, cy, sq, scale, shade, sch, t, speed) {
      const x = pl._x, y = pl._y;
      const e = pl._e;
      const swell = 1 + 0.35 * e;
      const R = pl.radius * scale * swell;
      const body = sch.body[pl.colour];

      // Light comes from the sun; the shadow falls on the far side.
      let lx = x - cx, ly = y - cy;
      const ll = Math.sqrt(lx * lx + ly * ly) || 1;
      lx /= ll; ly /= ll;

      const ball = (bx, by, br, colour) => {
        g.globalAlpha = 1;
        g.fillStyle = colour;
        g.beginPath();
        g.arc(bx, by, br, 0, TWO_PI);
        g.fill();
        if (shade > 0.001 && br > 1.2) {
          g.save();
          g.clip();
          g.globalAlpha = shade * 0.8;
          g.fillStyle = '#000';
          g.beginPath();
          g.arc(bx + lx * br * 1.1, by + ly * br * 1.1, br * 1.05, 0, TWO_PI);
          g.fill();
          g.restore();
        }
      };

      const tt = t * speed;

      if (pl.type === BINARY || pl.type === TRINARY) {
        // Bodies circling a shared barycentre, heavier ones nearer the middle.
        const radii = pl.parts.radii;
        const m = radii.length;
        const rs = radii.map((r) => r * scale * swell);
        const ang0 = pl.parts.phase + pl.parts.spin * tt;
        const bodies = this.partScratch || (this.partScratch = [{}, {}, {}]);
        if (m === 2) {
          const m1 = rs[0] * rs[0] * rs[0], m2 = rs[1] * rs[1] * rs[1];
          const sep = (rs[0] + rs[1]) * (1.35 + 0.5 * e) + 3 * scale;
          const d1 = sep * m2 / (m1 + m2), d2 = sep * m1 / (m1 + m2);
          const c = Math.cos(ang0), s = Math.sin(ang0);
          bodies[0].x = x + c * d1; bodies[0].y = y + s * d1 * sq; bodies[0].z = s; bodies[0].r = rs[0];
          bodies[1].x = x - c * d2; bodies[1].y = y - s * d2 * sq; bodies[1].z = -s; bodies[1].r = rs[1];
        } else {
          const dist = Math.max(rs[0], rs[1], rs[2]) * (1.75 + 0.6 * e) + 2 * scale;
          for (let j = 0; j < 3; j++) {
            const a = ang0 + j * TWO_PI / 3;
            const c = Math.cos(a), s = Math.sin(a);
            bodies[j].x = x + c * dist; bodies[j].y = y + s * dist * sq; bodies[j].z = s; bodies[j].r = rs[j];
          }
        }
        // A faint shared orbit so the pair reads as one system.
        g.globalAlpha = 0.22;
        g.strokeStyle = sch.lineArt ? 'rgb(128,128,128)' : sch.moon[pl.colour];
        g.lineWidth = 0.7;
        g.beginPath();
        const orbitR = Math.hypot(bodies[0].x - x, (bodies[0].y - y) / (sq || 1));
        g.ellipse(x, y, orbitR, Math.max(0.01, orbitR * sq), 0, 0, TWO_PI);
        g.stroke();
        const order = m === 2 ? (bodies[0].z < bodies[1].z ? [0, 1] : [1, 0]) : [0, 1, 2].sort((u, v) => bodies[u].z - bodies[v].z);
        for (const j of order) {
          ball(bodies[j].x, bodies[j].y, bodies[j].r, sch.body[(pl.colour + j) % 5]);
        }
        return;
      }

      // Moons: in the planet's own plane, those on the far side are drawn
      // before the planet and those on the near side after.
      const moonPos = this.moonScratch || (this.moonScratch = [{}, {}]);
      const nm = pl.moons.length;
      for (let j = 0; j < nm; j++) {
        const mo = pl.moons[j];
        const ph = mo.phase + mo.speed * tt;
        const reach = (pl.radius * swell + 20) * mo.reach * scale;
        const c = Math.cos(ph), s = Math.sin(ph);
        moonPos[j].x = x + mo.a * c * mo.dir * reach;
        moonPos[j].y = y + mo.b * s * reach * sq;
        moonPos[j].z = s;
        moonPos[j].ph = ph;
      }
      const drawMoon = (j) => {
        const mo = pl.moons[j];
        const mp = moonPos[j];
        const mr = mo.radius * scale * (1 + 0.25 * e);
        g.globalAlpha = 1;
        g.strokeStyle = sch.moon[pl.colour];
        g.lineWidth = Math.max(1, 2 * scale);
        g.beginPath();
        g.arc(mp.x, mp.y, mr, 0, TWO_PI);
        g.stroke();
        if (mo.moon) {
          // The original's "TODO: draw submoon".
          const sub = mo.moon;
          const sph = sub.phase + sub.speed * 1.6 * tt;
          const sreach = (mo.radius + 9) * scale;
          const sx = mp.x + sub.a * Math.cos(sph) * sub.dir * sreach;
          const sy = mp.y + sub.b * Math.sin(sph) * sreach * sq;
          g.globalAlpha = 0.9;
          g.fillStyle = sch.moon[pl.colour];
          g.beginPath();
          g.arc(sx, sy, Math.max(0.8, sub.radius * 0.4 * scale), 0, TWO_PI);
          g.fill();
          g.globalAlpha = 1;
        }
      };
      for (let j = 0; j < nm; j++) if (moonPos[j].z < 0) drawMoon(j);

      if (pl.ring) {
        const rg = pl.ring;
        const rsq = rg.squash * (0.35 + 0.65 * sq) + 0.04;
        g.strokeStyle = sch.ring[pl.colour];
        const ringSwell = 1 + 0.25 * e;
        // Back half of the rings, behind the planet.
        g.globalAlpha = 0.75;
        for (const f of [rg.inner, (rg.inner + rg.outer) / 2, rg.outer]) {
          const rr = R * f * ringSwell;
          g.lineWidth = f === rg.outer ? 1.2 : 0.8;
          g.beginPath();
          g.ellipse(x, y, rr, rr * rsq, rg.angle, Math.PI, TWO_PI);
          g.stroke();
        }
        ball(x, y, R, body);
        g.globalAlpha = 0.9;
        g.strokeStyle = sch.ring[pl.colour];
        for (const f of [rg.inner, (rg.inner + rg.outer) / 2, rg.outer]) {
          const rr = R * f * ringSwell;
          g.lineWidth = f === rg.outer ? 1.2 : 0.8;
          g.beginPath();
          g.ellipse(x, y, rr, rr * rsq, rg.angle, 0, Math.PI);
          g.stroke();
        }
      } else {
        ball(x, y, R, body);
      }

      for (let j = 0; j < nm; j++) if (moonPos[j].z >= 0) drawMoon(j);
    },
  });
})();
