// Planets V2 — a slow flight through a hand-printed orrery.
//
// V1 finished the 2016 sketch as a white orrery on black, seen from far off;
// the panel called it tasteful, tiny and monochrome. V2 moves the camera
// inside the outer orbits, so near planets swing past the lens large and far
// ones recede, and prints every body in flat inks with a hard two-tone
// terminator facing the sun: colour as print, shadow as shape, no glow.
// The purist's Sand Traveler idea is its own scene (web/scenes/sandtraveler.js),
// so this one answers "tiny" and "clockwork" by bringing the bodies close
// rather than taking them away. See harness/v2/planets.md.
//
// The spec is still Raph's to-do list in ../../../Planets.pde: respond to
// music, all seven planet types, orbit trails alpha'd in, orbit size pulsing
// with the music, a starfield, colour, a prettier sun.
//
// Music: kick = a ripple leaves the sun across the orbital plane, and each
// orbit it crosses swells and lights (cause and effect travelling through the
// system, never the whole frame at once); clap = a comet crosses the inner
// system, tail streaming away from the sun; hats = the asteroid belt glints
// and the star chart twinkles; bass = the sun and planets swell and the
// orbits hurry. The drop is a dive: faster, eccentric orbits (comets flung
// out, the director's favourite V1 moment), longer trails, the camera lower
// and closer, circling faster. All of those are params.

(function () {
  const TWO_PI = Math.PI * 2;
  const NEAR = 24;          // world units in front of the lens; nearer is clipped
  const N_PLANETS = 9;
  const N_STARS = 520;
  const N_BELT = 1400;
  const ORBIT_STEPS = 96;
  const RIPPLE_STEPS = 120;

  const SIMPLE = 0, ONE_MOON = 1, TWO_MOONS = 2, MOON_WITH_MOON = 3,
    RINGED = 4, BINARY = 5, TRINARY = 6;
  // The 2016 sketch's seven types, placed so the giants sit outside and the
  // small rocky ones inside, and every type appears once.
  const TYPE_ORDER = [SIMPLE, ONE_MOON, SIMPLE, BINARY, TWO_MOONS, RINGED, MOON_WITH_MOON, TRINARY, RINGED];

  // Plates: a ground, a hairline ink for orbits, stars and dust, a shadow
  // ink that every body's dark side is mixed toward, five body inks, the sun
  // and an accent for the beat. Flat colour, TASTE's print route.
  const PLATES = [
    { name: 'Plate', ground: [238, 230, 212], line: [40, 50, 96], shadow: [34, 38, 70], sun: [226, 88, 38],
      inks: [[214, 72, 44], [222, 160, 58], [38, 126, 128], [222, 128, 138], [74, 108, 168]], accent: [214, 64, 38],
      lineAlpha: 0.32, shadowMix: 0.72, wash: 0.05, vignette: 0.16 },
    { name: 'Poster', ground: [20, 32, 64], line: [236, 226, 200], shadow: [9, 14, 32], sun: [246, 172, 64],
      inks: [[240, 204, 128], [228, 100, 70], [98, 178, 168], [236, 226, 200], [196, 122, 162]], accent: [248, 128, 72],
      lineAlpha: 0.3, shadowMix: 0.78, wash: 0.05, vignette: 0.45, dark: true },
    // The 2016 sketch's own look: white on black, with the warm sun the floor
    // judge asked for as the only colour.
    { name: 'Night', ground: [0, 0, 0], line: [235, 235, 235], shadow: [0, 0, 0], sun: [255, 150, 70],
      inks: [[255, 255, 255], [240, 240, 240], [255, 255, 255], [228, 228, 228], [250, 250, 250]], accent: [255, 140, 70],
      lineAlpha: 0.28, shadowMix: 0.92, wash: 0.04, vignette: 0.5, dark: true },
  ];

  // What the drop changes, and so what Follow the track eases toward.
  const CALM = { speed: 0.7, swing: 0.1, trails: 0.35, height: 21, distance: 690, drift: 1 };
  const DROP = { speed: 1.35, swing: 0.72, trails: 0.85, height: 11, distance: 590, drift: 1.8 };
  const LIFTED = Object.keys(CALM);

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const mix = (c, d, t) => [c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t, c[2] + (d[2] - c[2]) * t];
  const css = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : +a.toFixed(3)) + ')';

  function makeMoon(rand, orbitR, radius, sub) {
    return {
      r: orbitR, radius, ph: rand() * TWO_PI, w: (1.4 + rand() * 1.2) * (rand() < 0.5 ? 1 : -1),
      tilt: (rand() - 0.5) * 0.7, ink: Math.floor(rand() * 5),
      moon: sub ? makeMoon(rand, radius * 2.6 + 3, radius * 0.45, false) : null,
    };
  }

  function makeSystem(rand) {
    const planets = [];
    for (let i = 0; i < N_PLANETS; i++) {
      const type = TYPE_ORDER[i];
      const pl = {
        type,
        a: 78 + i * 54 + (rand() - 0.5) * 16,
        ecc0: rand() * 0.06,
        eccMax: 0.35 + rand() * 0.4,
        peri: rand() * TWO_PI,
        inc: (rand() - 0.5) * 0.12,
        E: rand() * TWO_PI,
        radius: type === RINGED ? 19 + rand() * 6 : 8 + rand() * 5 + i * 0.9,
        ink: (i * 2 + Math.floor(rand() * 2)) % 5,
        moons: [],
        ring: null,
        parts: null,
        strike: 0,
        dist: 0,
      };
      pl.rate = 0.95 * Math.pow(pl.a / 78, -1.1) * (0.92 + rand() * 0.16);
      const R = pl.radius;
      if (type === ONE_MOON) pl.moons.push(makeMoon(rand, R * 2.4 + 8, 2.4 + rand(), false));
      if (type === TWO_MOONS) {
        pl.moons.push(makeMoon(rand, R * 2.1 + 6, 2 + rand(), false));
        pl.moons.push(makeMoon(rand, R * 3.4 + 10, 2.6 + rand(), false));
      }
      if (type === MOON_WITH_MOON) pl.moons.push(makeMoon(rand, R * 3 + 12, 3.6 + rand(), true));
      if (type === RINGED) {
        pl.ring = { tilt: 0.35 + rand() * 0.5, spin: rand() * TWO_PI, inner: 1.45, outer: 2.3 + rand() * 0.3, ink: (pl.ink + 1) % 5 };
      }
      if (type === BINARY || type === TRINARY) {
        const m = type === BINARY ? 2 : 3;
        pl.parts = { n: m, sep: R * (type === BINARY ? 1.9 : 2.1), ph: rand() * TWO_PI, w: 1.2 + rand() * 0.8,
          radii: [], inks: [] };
        for (let j = 0; j < m; j++) {
          pl.parts.radii.push(R * (type === BINARY ? (j ? 0.55 : 0.8) : 0.55 + rand() * 0.12));
          pl.parts.inks.push((pl.ink + j * 2) % 5);
        }
      }
      planets.push(pl);
    }
    return planets;
  }

  function makeSky(rand) {
    const s = { x: new Float32Array(N_STARS), y: new Float32Array(N_STARS), z: new Float32Array(N_STARS),
      m: new Float32Array(N_STARS), ph: new Float32Array(N_STARS) };
    for (let i = 0; i < N_STARS; i++) {
      const u = rand() * 2 - 1, a = rand() * TWO_PI, r = Math.sqrt(1 - u * u);
      s.x[i] = r * Math.cos(a); s.y[i] = u; s.z[i] = r * Math.sin(a);
      const q = rand();
      s.m[i] = q * q * q;
      s.ph[i] = rand() * TWO_PI;
    }
    const b = { r: new Float32Array(N_BELT), a: new Float32Array(N_BELT), y: new Float32Array(N_BELT),
      w: new Float32Array(N_BELT), h: new Float32Array(N_BELT) };
    for (let i = 0; i < N_BELT; i++) {
      const u = rand() + rand() - 1;
      b.r[i] = 318 + u * 26;
      b.a[i] = rand() * TWO_PI;
      b.y[i] = (rand() + rand() - 1) * 5;
      b.w[i] = 0.2 * Math.pow(b.r[i] / 78, -1.1);
      b.h[i] = rand();
    }
    return { stars: s, belt: b };
  }

  VIZ.register({
    id: 'planetsv2',
    name: 'Planets',
    versionOf: 'planets',
    version: 'V2',
    order: 722,

    gallery: {
      title: 'Planets',
      technique: 'Canvas 2D: a perspective camera circling inside a Keplerian orrery; painter-sorted spheres printed in flat inks with a hard two-tone terminator computed from the sun direction (moon-phase construction from a half-disc and a half-ellipse); ring systems split into back and front halves; clipped orbit hairlines, tapered trails, a projected asteroid belt and a star chart fixed to the sky',
      brief: 'A slow flight through a hand-printed orrery. The camera circles inside the outer orbits, so flat-inked planets, moons and ringed giants swing past the lens large and recede small, each lit hard by a warm sun, over a star chart on cream paper. Kick: a ripple leaves the sun across the orbital plane, and each orbit it crosses swells and flashes its planet\'s rim. Clap: a comet crosses the inner system, tail streaming away from the sun. Hats: the asteroid belt glints and the stars twinkle. Bass swells the sun and hurries the orbits. The drop is a dive: the camera sinks toward the plane and moves in, the orbits fling out into comets on long ellipses, trails lengthen; the breakdown reels them back to near-circles.',
      lineage: 'V2 of Planets (planets, the 2016 originals), which ranked in the bottom 12 of 72 (mean 4.0). Acted on the unanimous "tiny" (the camera is now inside the system, so bodies fill the frame) and "monochrome" (flat print inks with hard sun-facing shadows, not a rainbow), the floor judge\'s warm sun as the light, and the purist\'s "a clockwork, not a system", reinterpreted as a kick ripple that travels out through the orbits and swells each one it crosses. Kept the director\'s favourite moment: comets flung out on the drop and reeled back in the breakdown. Rejected: V1\'s glow halo and corona (the glow-on-black house style), the Harmonograph (another scene), and the purist\'s Sand Traveler Orbits, which already has its own batch-06 scene. The thread to 2016 is Raph\'s to-do list in Planets.pde: respond to music, all seven planet types, orbit trails alpha\'d in, orbit size pulsing, a starfield, colour, a prettier sun (here a disc inside printed rings of spectrum ticks). See harness/v2/planets.md.',
    },

    params: [
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
      { key: 'plate', label: 'Plate', type: 'select', options: PLATES.map((p) => p.name), default: 0 },
      { key: 'speed', label: 'Orbit speed', type: 'range', min: 0, max: 3, default: CALM.speed },
      { key: 'swing', label: 'Orbit swing', type: 'range', min: 0, max: 1, default: CALM.swing },
      { key: 'trails', label: 'Trails', type: 'range', min: 0, max: 1, default: CALM.trails },
      { key: 'height', label: 'Camera height', type: 'range', min: 3, max: 80, default: CALM.height, step: 1 },
      { key: 'distance', label: 'Camera distance', type: 'range', min: 380, max: 1200, default: CALM.distance, step: 1 },
      { key: 'drift', label: 'Camera drift', type: 'range', min: 0, max: 3, default: CALM.drift },
      { key: 'beat', label: 'Beat strength', type: 'range', min: 0, max: 2, default: 1 },
    ],

    presets: {
      calm: Object.assign({ follow: 1, plate: 0, beat: 1 }, CALM),
      drop: Object.assign({ follow: 1, plate: 0, beat: 1.2 }, DROP),
      poster: { plate: 1, speed: 0.8, swing: 0.3, trails: 0.6, height: 34, distance: 820, drift: 1.2 },
      night: { plate: 2, speed: 0.6, swing: 0.15, trails: 0.5, height: 40, distance: 980, drift: 0.8 },
    },

    actions: [
      { id: 'newSystem', label: 'New system', run() { this.planets = makeSystem(Math.random); } },
    ],

    planets: null,
    sky: null,
    env: null,
    ripples: null,
    comets: null,
    lastMillis: 0,
    time: 0,
    yaw: 0,

    setup(p) {
      const rand = () => p.random();
      this.rand = rand;
      this.planets = makeSystem(rand);
      this.sky = makeSky(rand);
      this.env = { bass: 0, hat: 0, prevK: 0, prevS: 0, kAvg: 0, sAvg: 0, sinceK: 1, sinceS: 1,
        energy: 0, lift: 0, spec: new Float32Array(9) };
      this.ripples = [];
      this.comets = [];
      this.time = 0;
      this.yaw = 0.6;
    },

    enter(p) {
      if (!this.planets) this.setup(p);
      this.lastMillis = p.millis();
    },

    draw(p, signals, params, ctx) {
      if (!this.planets) this.setup(p);
      const W = ctx.width, H = ctx.height;
      const cx = W / 2, cy = H / 2;
      const g = p.drawingContext;
      const rand = this.rand;

      const now = p.millis();
      const dt = Math.min(0.1, Math.max(0, (now - this.lastMillis) / 1000));
      this.lastMillis = now;
      this.time += dt;
      const t = this.time;

      const plate = PLATES[Math.min(PLATES.length - 1, Math.max(0, Math.round(params.plate)))];

      // ---- listening -------------------------------------------------------
      const e = this.env;
      for (let k = 0; k < 9; k++) {
        const s = signals[k] / 100;
        e.spec[k] += (s - e.spec[k]) * (1 - Math.exp(-dt * (s > e.spec[k] ? 20 : 5)));
      }
      const kSig = Math.max(signals[0], signals[1]);
      const sSig = (signals[3] + signals[4] + signals[5]) / 3;
      const hSig = (signals[6] + signals[7] + signals[8]) / 300;
      const bassSig = (signals[0] + signals[1] + signals[2]) / 300;
      e.bass += (bassSig - e.bass) * (1 - Math.exp(-dt * (bassSig > e.bass ? 8 : 2.5)));
      e.hat += (hSig - e.hat) * (1 - Math.exp(-dt * (hSig > e.hat ? 30 : 8)));
      e.kAvg += (kSig - e.kAvg) * (1 - Math.exp(-dt * 1.5));
      e.sAvg += (sSig - e.sAvg) * (1 - Math.exp(-dt * 1.5));
      e.sinceK += dt; e.sinceS += dt;
      let kick = false, clap = false;
      // Onsets: a jump over the recent average, with a refractory time so a
      // decaying envelope never fires twice.
      if (kSig > 38 && kSig - e.prevK > 10 && kSig > e.kAvg + 8 && e.sinceK > 0.2) { kick = true; e.sinceK = 0; }
      if (sSig > 30 && sSig - e.prevS > 9 && sSig > e.sAvg + 7 && e.sinceS > 0.2) { clap = true; e.sinceS = 0; }
      e.prevK = kSig; e.prevS = sSig;

      // Follow the track: a slow energy follower on the kick bands moves the
      // look between calm and drop over bars, never on a beat. A param the
      // performer has already pushed past the drop value is left alone.
      const energyNow = (signals[0] + signals[1]) / 200;
      e.energy += (energyNow - e.energy) * (1 - Math.exp(-dt * (energyNow > e.energy ? 0.9 : 0.35)));
      const liftTarget = Math.round(params.follow) === 1 ? smooth(0.12, 0.42, e.energy) : 0;
      e.lift += (liftTarget - e.lift) * (1 - Math.exp(-dt * 1.1));
      const P = {};
      for (const k of LIFTED) {
        const dir = Math.sign(DROP[k] - CALM[k]);
        const v = params[k];
        P[k] = (DROP[k] - v) * dir > 0 ? v + e.lift * (DROP[k] - v) : v;
      }
      const beat = params.beat;

      // ---- camera ------------------------------------------------------------
      this.yaw += dt * 0.07 * P.drift * (1 + 0.5 * e.bass);
      const pitch = (P.height + 2.5 * Math.sin(t * 0.11)) * Math.PI / 180;
      const dist = P.distance;
      const camX = Math.sin(this.yaw) * dist * Math.cos(pitch);
      const camY = dist * Math.sin(pitch);
      const camZ = -Math.cos(this.yaw) * dist * Math.cos(pitch);
      // Look a little past the sun, so it sits just below the centre and the
      // far side of the system has room above it.
      let fx = -camX, fy = -camY - dist * 0.06, fz = -camZ;
      let fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      let rx = fz, rz = -fx; // right = forward x up(0,1,0), normalised
      fl = Math.hypot(rx, rz); rx /= fl; rz /= fl;
      const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx; // up = forward x right
      const f = 1.02 * Math.min(W, H);
      const out = { x: 0, y: 0, z: 0 };
      const project = (X, Y, Z) => {
        const dx = X - camX, dy = Y - camY, dz = Z - camZ;
        const z = dx * fx + dy * fy + dz * fz;
        out.z = z;
        if (z < NEAR) return false;
        out.x = cx + f * (dx * rx + dz * rz) / z;
        out.y = cy - f * (dx * ux + dy * uy + dz * uz) / z;
        return true;
      };
      const toCam = (X, Y, Z, o) => {
        const dx = X - camX, dy = Y - camY, dz = Z - camZ;
        o[0] = dx * rx + dz * rz; o[1] = dx * ux + dy * uy + dz * uz; o[2] = dx * fx + dy * fy + dz * fz;
      };

      // ---- orbits ------------------------------------------------------------
      const planets = this.planets;
      const swing = P.swing;
      for (let i = 0; i < planets.length; i++) {
        const pl = planets[i];
        pl.strike = Math.max(0, pl.strike - dt * 3);
        // The kick ripple's swell: "orbit size pulses with music".
        const swell = 1 + 0.05 * e.bass + 0.07 * pl.strike * beat;
        const a = pl.a * swell / (1 + 0.3 * swing * pl.eccMax);
        // Keep perihelion clear of the sun.
        const ecc = Math.min(pl.ecc0 + swing * pl.eccMax, 1 - 64 / a);
        pl._a = a; pl._ecc = ecc;
        pl.E += dt * P.speed * pl.rate * (1 + 0.45 * e.bass) / (1 - ecc * Math.cos(pl.E));
        this.orbitPoint(pl, pl.E, pl);
        pl.dist = Math.hypot(pl.X, pl.Z);
      }

      // ---- beat events -------------------------------------------------------
      if (kick && beat > 0) this.ripples.push({ r: 34, s: Math.min(1.5, beat * (0.5 + kSig / 100)) });
      if (clap && beat > 0 && this.comets.length < 2) {
        const ang = rand() * TWO_PI;
        const miss = 110 + rand() * 150;
        const nx = Math.cos(ang), nz = Math.sin(ang);
        this.comets.push({ age: 0, life: 1.9, px: -nz * miss, pz: nx * miss, dx: nx, dz: nz, y: (rand() - 0.5) * 60, s: beat });
      }
      for (let n = this.ripples.length - 1; n >= 0; n--) {
        const rp = this.ripples[n];
        const r0 = rp.r;
        rp.r += dt * 540 * (0.85 + 0.4 * e.bass);
        for (const pl of planets) if (r0 < pl.dist && rp.r >= pl.dist) pl.strike = Math.max(pl.strike, Math.min(1, rp.s));
        if (rp.r > 620) this.ripples.splice(n, 1);
      }

      // ---- paint: ground and sky ---------------------------------------------
      p.colorMode(p.RGB, 255);
      p.background(plate.ground[0], plate.ground[1], plate.ground[2]);
      g.save();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'round';
      g.lineJoin = 'round';

      // Stars are fixed to the sky: only the camera's rotation moves them.
      const st = this.sky.stars;
      g.fillStyle = css(plate.line);
      const hatTw = e.hat;
      for (let pass = 0; pass < 2; pass++) {
        g.globalAlpha = pass ? 0.9 : 0.45;
        g.beginPath();
        for (let i = 0; i < N_STARS; i++) {
          const bright = st.m[i] > 0.35;
          if (bright !== (pass === 1)) continue;
          const X = st.x[i], Y = st.y[i], Z = st.z[i];
          const z = X * fx + Y * fy + Z * fz;
          if (z < 0.05) continue;
          const sx = cx + f * (X * rx + Z * rz) / z, sy = cy - f * (X * ux + Y * uy + Z * uz) / z;
          if (sx < -4 || sy < -4 || sx > W + 4 || sy > H + 4) continue;
          const tw = 0.6 + 0.4 * Math.sin(t * 2.3 + st.ph[i]) + hatTw * 1.4 * Math.max(0, Math.sin(t * 17 + st.ph[i] * 5));
          const s = (0.7 + st.m[i] * 2.2) * Math.max(0.3, tw);
          if (bright) {
            // A printed star: a small cross, as on a chart.
            g.rect(sx - s * 1.6, sy - 0.35, s * 3.2, 0.7);
            g.rect(sx - 0.35, sy - s * 1.6, 0.7, s * 3.2);
          } else {
            g.rect(sx - s / 2, sy - s / 2, s, s);
          }
        }
        g.fill();
      }
      g.globalAlpha = 1;

      // The plane itself, as a faint wash inside the belt, so the orbits sit
      // on a surface you can feel tilt as the camera dives.
      {
        g.fillStyle = css(plate.line);
        g.globalAlpha = plate.wash;
        g.beginPath();
        let ok = true;
        for (let j = 0; j < 72 && ok; j++) {
          const a = j / 72 * TWO_PI;
          ok = project(Math.cos(a) * 300, 0, Math.sin(a) * 300);
          if (j) g.lineTo(out.x, out.y); else g.moveTo(out.x, out.y);
        }
        if (ok) g.fill();
        g.globalAlpha = 1;
      }

      // ---- orbit hairlines, ripples and the belt (all on the plane, behind the bodies)
      const lineCss = css(plate.line);
      const accentCss = css(plate.accent);
      const tmp = this.tmp || (this.tmp = {});
      for (const pl of planets) {
        const lit = pl.strike;
        g.strokeStyle = lit > 0.02 ? css(mix(plate.line, plate.accent, lit)) : lineCss;
        g.globalAlpha = plate.lineAlpha + 0.3 * lit;
        g.lineWidth = 0.8 + 0.8 * lit;
        g.beginPath();
        let pen = false;
        for (let j = 0; j <= ORBIT_STEPS; j++) {
          this.orbitPoint(pl, j / ORBIT_STEPS * TWO_PI, tmp);
          if (project(tmp.X, tmp.Y, tmp.Z)) {
            if (pen) g.lineTo(out.x, out.y); else g.moveTo(out.x, out.y);
            pen = true;
          } else pen = false;
        }
        g.stroke();
      }
      for (const rp of this.ripples) {
        const fade = 1 - rp.r / 620;
        g.strokeStyle = accentCss;
        g.globalAlpha = 0.7 * fade * fade * Math.min(1, rp.s);
        g.lineWidth = 1.3;
        g.beginPath();
        let pen = false;
        for (let j = 0; j <= RIPPLE_STEPS; j++) {
          const a = j / RIPPLE_STEPS * TWO_PI;
          if (project(Math.cos(a) * rp.r, 0, Math.sin(a) * rp.r)) {
            if (pen) g.lineTo(out.x, out.y); else g.moveTo(out.x, out.y);
            pen = true;
          } else pen = false;
        }
        g.stroke();
      }
      {
        // The belt: fine dust that glints with the hats.
        const b = this.sky.belt;
        const tick = Math.floor(t * 14);
        g.fillStyle = lineCss;
        g.globalAlpha = 0.55;
        g.beginPath();
        const glint = this.glint || (this.glint = []);
        glint.length = 0;
        for (let i = 0; i < N_BELT; i++) {
          const a = b.a[i] + t * b.w[i] * P.speed;
          if (!project(Math.cos(a) * b.r[i], b.y[i], Math.sin(a) * b.r[i])) continue;
          if (out.x < -3 || out.y < -3 || out.x > W + 3 || out.y > H + 3) continue;
          const s = Math.min(1.5, Math.max(0.55, 0.9 * f / out.z));
          const h = (b.h[i] * 977 + tick * 0.618) % 1;
          if (h < e.hat * 0.22) glint.push(out.x, out.y, s);
          else g.rect(out.x - s / 2, out.y - s / 2, s, s);
        }
        g.fill();
        if (glint.length) {
          g.fillStyle = accentCss;
          g.globalAlpha = 0.95;
          g.beginPath();
          for (let q = 0; q < glint.length; q += 3) {
            const s = glint[q + 2] * 1.5;
            g.rect(glint[q] - s * 1.4, glint[q + 1] - 0.4, s * 2.8, 0.8);
            g.rect(glint[q] - 0.4, glint[q + 1] - s * 1.4, 0.8, s * 2.8);
          }
          g.fill();
        }
      }

      // ---- trails: alpha'd in behind each planet ------------------------------
      if (P.trails > 0.01) {
        for (const pl of planets) {
          const steps = 26;
          const span = 0.25 + 1.6 * P.trails;
          // A slice of the orbit in mean motion, so a comet at perihelion
          // draws a long streak and at aphelion a short one.
          const dE = span * (1 - pl._ecc * Math.cos(pl.E)) * Math.min(1.4, 0.6 / Math.sqrt(pl.rate)) / steps;
          // A ribbon of quads that share edges, so the translucent trail has
          // no beads where round-capped segments would overlap.
          g.fillStyle = css(plate.inks[pl.ink]);
          const rb = this.ribbon || (this.ribbon = new Float32Array((steps + 1) * 3));
          let n = 0;
          for (let j = 0; j <= steps; j++) {
            this.orbitPoint(pl, pl.E - j * dE, tmp);
            if (!project(tmp.X, tmp.Y, tmp.Z)) break;
            rb[n * 3] = out.x; rb[n * 3 + 1] = out.y; rb[n * 3 + 2] = out.z; n++;
          }
          let lx0 = 0, ly0 = 0, rx0 = 0, ry0 = 0;
          for (let j = 0; j < n; j++) {
            const j0 = Math.max(0, j - 1), j1 = Math.min(n - 1, j + 1);
            let tx = rb[j1 * 3] - rb[j0 * 3], ty = rb[j1 * 3 + 1] - rb[j0 * 3 + 1];
            const tl = Math.hypot(tx, ty) || 1;
            const u = 1 - j / steps;
            const hw = 0.5 * Math.max(0.7, pl.radius * 1.1 * f / rb[j * 3 + 2] * u);
            const nx = -ty / tl * hw, ny = tx / tl * hw;
            const lx = rb[j * 3] + nx, ly = rb[j * 3 + 1] + ny, rx2 = rb[j * 3] - nx, ry2 = rb[j * 3 + 1] - ny;
            if (j > 0) {
              g.globalAlpha = 0.7 * u * u;
              g.beginPath();
              g.moveTo(lx0, ly0); g.lineTo(lx, ly); g.lineTo(rx2, ry2); g.lineTo(rx0, ry0);
              g.closePath();
              g.fill();
            }
            lx0 = lx; ly0 = ly; rx0 = rx2; ry0 = ry2;
          }
        }
        g.globalAlpha = 1;
      }

      // ---- comets (the clap) ---------------------------------------------------
      for (let n = this.comets.length - 1; n >= 0; n--) {
        const c = this.comets[n];
        c.age += dt;
        if (c.age > c.life) { this.comets.splice(n, 1); continue; }
        const s = (c.age / c.life - 0.5) * 900;
        const X = c.px + c.dx * s, Z = c.pz + c.dz * s, Y = c.y;
        if (!project(X, Y, Z)) continue;
        const hx = out.x, hy = out.y, hz = out.z;
        // A comet near the lens would sweep the frame as a bar; it thins away.
        const nearFade = smooth(160, 320, hz);
        if (nearFade <= 0) continue;
        // The tail points away from the sun, as a real one does.
        const d = Math.hypot(X, Z) || 1;
        const len = 240 * Math.min(1.4, 260 / d + 0.4);
        if (!project(X + X / d * len, Y + 10, Z + Z / d * len)) continue;
        const tx = out.x, ty = out.y;
        const hr = Math.min(4.5, Math.max(1.6, 6 * f / hz));
        const ax = tx - hx, ay = ty - hy, al = Math.hypot(ax, ay) || 1;
        const nx = -ay / al, ny = ax / al;
        const fadeIn = Math.min(1, c.age * 6) * Math.min(1, (c.life - c.age) * 3) * nearFade;
        g.globalAlpha = 0.8 * fadeIn;
        g.fillStyle = accentCss;
        g.beginPath();
        g.moveTo(hx + nx * hr, hy + ny * hr);
        g.quadraticCurveTo(hx + ax * 0.5 + nx * hr * 2.2, hy + ay * 0.5 + ny * hr * 1.3, tx, ty);
        g.quadraticCurveTo(hx + ax * 0.5 - nx * hr * 1.2, hy + ay * 0.5 - ny * hr * 0.7, hx - nx * hr, hy - ny * hr);
        g.closePath();
        g.fill();
        g.globalAlpha = fadeIn;
        g.fillStyle = css(plate.ground);
        g.beginPath(); g.arc(hx, hy, hr * 0.9, 0, TWO_PI); g.fill();
        g.fillStyle = accentCss;
        g.beginPath(); g.arc(hx, hy, hr * 0.6, 0, TWO_PI); g.fill();
      }
      g.globalAlpha = 1;

      // ---- bodies, far to near -------------------------------------------------
      const list = this.list || (this.list = []);
      list.length = 0;
      // The sun is a body in the sort, so planets pass behind and in front.
      if (project(0, 0, 0)) list.push({ z: out.z, kind: 0, x: out.x, y: out.y });
      for (const pl of planets) {
        if (!project(pl.X, pl.Y, pl.Z)) continue;
        list.push({ z: out.z, kind: 1, pl, x: out.x, y: out.y });
      }
      list.sort((u, v) => v.z - u.z);
      for (const it of list) {
        if (it.kind === 0) this.drawSun(g, it, f, e, plate, t);
        else this.drawPlanet(g, it, f, plate, project, toCam, out, t, P, e, beat, W, H);
      }

      // ---- paper: fibre and a soft vignette, over everything, as print -------
      const fib = this.fibre(g, plate);
      g.globalCompositeOperation = plate.dark ? 'screen' : 'multiply';
      g.globalAlpha = plate.dark ? 0.35 : 0.5;
      g.fillStyle = fib;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.4, cx, cy, Math.hypot(W, H) * 0.56);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(' + plate.shadow.join(',') + ',' + plate.vignette + ')');
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
      g.restore();
    },

    // A small tile of paper fibre (speckle and short strands), made once per
    // plate and tiled as a pattern: one fill a frame at any size.
    fibre(g, plate) {
      if (this.fibreFor === plate && this.fibrePat) return this.fibrePat;
      const size = 256;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const tg = c.getContext('2d');
      const dark = !!plate.dark;
      tg.fillStyle = dark ? '#000' : '#fff';
      tg.fillRect(0, 0, size, size);
      let seed = 7;
      const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 3000; i++) {
        const v = dark ? Math.floor(r() * 36) : 205 + Math.floor(r() * 50);
        tg.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        tg.fillRect(r() * size, r() * size, 1, 1);
      }
      tg.lineWidth = 0.6;
      for (let i = 0; i < 80; i++) {
        const v = dark ? Math.floor(r() * 44) : 190 + Math.floor(r() * 40);
        tg.strokeStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        const x = r() * size, y = r() * size, a = r() * TWO_PI, l = 4 + r() * 14;
        tg.beginPath();
        tg.moveTo(x, y);
        tg.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        tg.stroke();
      }
      this.fibrePat = g.createPattern(c, 'repeat');
      this.fibreFor = plate;
      return this.fibrePat;
    },

    // Position on a planet's orbit at eccentric anomaly E (sun at a focus).
    orbitPoint(pl, E, o) {
      const a = pl._a, ecc = pl._ecc;
      const b = a * Math.sqrt(1 - ecc * ecc);
      const ox = a * (Math.cos(E) - ecc), oz = b * Math.sin(E);
      const c = Math.cos(pl.peri), s = Math.sin(pl.peri);
      const px = ox * c - oz * s, pz = ox * s + oz * c;
      o.X = px;
      o.Y = pz * Math.sin(pl.inc);
      o.Z = pz * Math.cos(pl.inc);
      return o;
    },

    drawSun(g, it, f, e, plate, t) {
      const R = 40 * f / it.z * (1 + 0.14 * e.bass);
      const x = it.x, y = it.y;
      // Printed rays outside a ring: the spectrum read round the sun (V1's
      // corona idea), bass at the crown and treble at the foot, as ink ticks.
      const r1 = R * 1.28, r2 = R * 1.34;
      g.strokeStyle = css(plate.sun);
      g.lineWidth = Math.max(0.8, R * 0.05);
      g.globalAlpha = 0.9;
      g.beginPath();
      const n = 64;
      for (let j = 0; j < n; j++) {
        const u = j / n * 2;
        const v = (u <= 1 ? u : 2 - u) * 8;
        const k = Math.min(7, Math.floor(v));
        const lvl = e.spec[k] + (e.spec[k + 1] - e.spec[k]) * (v - k);
        const a = -Math.PI / 2 + u * Math.PI + t * 0.03;
        const len = R * (0.12 + 0.75 * lvl) * (j % 2 ? 0.6 : 1);
        g.moveTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
        g.lineTo(x + Math.cos(a) * (r2 + len), y + Math.sin(a) * (r2 + len));
      }
      g.stroke();
      g.globalAlpha = 1;
      g.lineWidth = Math.max(0.8, R * 0.06);
      g.beginPath(); g.arc(x, y, r1, 0, TWO_PI); g.stroke();
      g.fillStyle = css(plate.sun);
      g.beginPath(); g.arc(x, y, R, 0, TWO_PI); g.fill();
      // The 2016 sun was a ring: an inner ring of ground colour keeps it.
      g.strokeStyle = css(plate.ground);
      g.globalAlpha = 0.55;
      g.lineWidth = Math.max(0.8, R * 0.08);
      g.beginPath(); g.arc(x, y, R * 0.62, 0, TWO_PI); g.stroke();
      g.globalAlpha = 1;
    },

    // A sphere printed in flat ink: a dark disc, then a mid-tone and a lit
    // tone bounded by terminators facing the sun (the moon-phase construction:
    // half a disc joined to half an ellipse).
    sphere(g, x, y, R, wx, wy, wz, ink, plate, toCam, rim) {
      if (R < 0.3) return;
      const cam = this.camTmp || (this.camTmp = [0, 0, 0]);
      const sunC = this.sunTmp || (this.sunTmp = [0, 0, 0]);
      toCam(wx, wy, wz, cam);
      toCam(0, 0, 0, sunC);
      let lx = sunC[0] - cam[0], ly = sunC[1] - cam[1], lz = sunC[2] - cam[2];
      const ll = Math.hypot(lx, ly, lz) || 1;
      lx /= ll; ly /= ll; lz /= ll;
      const vl = Math.hypot(cam[0], cam[1], cam[2]) || 1;
      // cos of the phase angle: light direction against the direction back to the lens.
      const cosPh = -(lx * cam[0] + ly * cam[1] + lz * cam[2]) / vl;
      const rot = Math.atan2(-ly, lx);
      const dark = mix(ink, plate.shadow, plate.shadowMix);
      const mid = mix(ink, plate.shadow, plate.shadowMix * 0.45);
      g.fillStyle = css(dark);
      g.beginPath(); g.arc(x, y, R, 0, TWO_PI); g.fill();
      const lit = (c) => {
        const k = Math.max(-1, Math.min(1, c));
        const rxE = Math.max(0.001, R * Math.abs(k));
        g.beginPath();
        g.ellipse(x, y, R, R, rot, -Math.PI / 2, Math.PI / 2, false);
        if (k >= 0) g.ellipse(x, y, rxE, R, rot, Math.PI / 2, Math.PI * 1.5, false);
        else g.ellipse(x, y, rxE, R, rot, Math.PI / 2, -Math.PI / 2, true);
        g.closePath();
        g.fill();
      };
      g.fillStyle = css(mid);
      lit(Math.min(1, cosPh + 0.38));
      g.fillStyle = css(ink);
      lit(cosPh);
      if (rim > 0.02) {
        g.strokeStyle = css(plate.accent, Math.min(1, rim));
        g.lineWidth = Math.max(1, R * 0.14);
        const rr = R + g.lineWidth * 0.8;
        g.beginPath();
        g.ellipse(x, y, rr, rr, rot, -Math.PI * 0.6, Math.PI * 0.6);
        g.stroke();
      }
    },

    drawPlanet(g, it, f, plate, project, toCam, out, t, P, e, beat, W, H) {
      const pl = it.pl;
      const z = it.z;
      const R = pl.radius * f / z * (1 + 0.1 * e.bass);
      // Off-stage by more than the widest ring or moon orbit: skip.
      const reach = R * 5 + 10;
      if (it.x < -reach || it.y < -reach || it.x > W + reach || it.y > H + reach) return;
      const ink = plate.inks[pl.ink];
      const rim = pl.strike * Math.min(1, beat);

      // Moons and parts, split round the planet by depth.
      const sats = [];
      const tt = t * (0.5 + 0.5 * P.speed);
      if (pl.parts) {
        const pa = pl.parts;
        const a0 = pa.ph + tt * pa.w;
        for (let j = 0; j < pa.n; j++) {
          const a = a0 + j * TWO_PI / pa.n;
          const sep = pa.sep * (1 + 0.25 * e.bass);
          const X = pl.X + Math.cos(a) * sep, Z = pl.Z + Math.sin(a) * sep, Y = pl.Y + Math.sin(a) * sep * 0.15;
          if (!project(X, Y, Z)) continue;
          sats.push({ x: out.x, y: out.y, z: out.z, R: pa.radii[j] * f / out.z, wx: X, wy: Y, wz: Z, ink: plate.inks[pa.inks[j]], moon: null, rim });
        }
      }
      for (const mo of pl.moons) {
        const a = mo.ph + tt * mo.w;
        const c = Math.cos(a) * mo.r, s = Math.sin(a) * mo.r;
        const X = pl.X + c, Y = pl.Y + s * Math.sin(mo.tilt), Z = pl.Z + s * Math.cos(mo.tilt);
        if (!project(X, Y, Z)) continue;
        sats.push({ x: out.x, y: out.y, z: out.z, R: mo.radius * f / out.z, wx: X, wy: Y, wz: Z, ink: plate.inks[mo.ink], moon: mo, rim: 0 });
      }
      const drawSat = (s) => {
        this.sphere(g, s.x, s.y, s.R, s.wx, s.wy, s.wz, s.ink, plate, toCam, s.rim);
        if (s.moon && s.moon.moon) {
          // The 2016 sketch's "TODO: draw submoon".
          const sm = s.moon.moon;
          const a = sm.ph + tt * sm.w * 1.6;
          const X = s.wx + Math.cos(a) * sm.r, Z = s.wz + Math.sin(a) * sm.r, Y = s.wy;
          if (project(X, Y, Z)) this.sphere(g, out.x, out.y, sm.radius * f / out.z, X, Y, Z, plate.inks[sm.ink], plate, toCam, 0);
        }
      };

      // The moons' orbits, printed faintly so each little system reads.
      if (pl.moons.length) {
        g.strokeStyle = css(plate.line);
        g.globalAlpha = plate.lineAlpha * 0.8;
        g.lineWidth = 0.6;
        for (const mo of pl.moons) {
          g.beginPath();
          let pen = false;
          for (let j = 0; j <= 48; j++) {
            const a = j / 48 * TWO_PI;
            const c = Math.cos(a) * mo.r, s = Math.sin(a) * mo.r;
            if (project(pl.X + c, pl.Y + s * Math.sin(mo.tilt), pl.Z + s * Math.cos(mo.tilt))) {
              if (pen) g.lineTo(out.x, out.y); else g.moveTo(out.x, out.y);
              pen = true;
            } else pen = false;
          }
          g.stroke();
        }
        g.globalAlpha = 1;
      }

      for (const s of sats) if (s.z > z) drawSat(s);

      let front = null;
      if (pl.ring) {
        // Ring points in the planet's own tilted plane, split into the half
        // behind the planet and the half in front of it.
        const rg = pl.ring;
        const ct = Math.cos(rg.tilt), stl = Math.sin(rg.tilt);
        const cs = Math.cos(rg.spin), ss = Math.sin(rg.spin);
        const bands = [rg.inner, (rg.inner * 0.4 + rg.outer * 0.6), rg.outer];
        const ringInk = css(plate.inks[rg.ink]);
        const segs = [[], []];
        for (let bi = 0; bi < bands.length; bi++) {
          const rr = pl.radius * bands[bi];
          let px0 = 0, py0 = 0, pz0 = 0, ok0 = false;
          for (let j = 0; j <= 64; j++) {
            const a = j / 64 * TWO_PI;
            const lx = Math.cos(a) * rr, lz0 = Math.sin(a) * rr;
            const ly = lz0 * stl, lz = lz0 * ct;
            const X = pl.X + lx * cs - lz * ss, Z = pl.Z + lx * ss + lz * cs, Y = pl.Y + ly;
            const ok = project(X, Y, Z);
            if (ok && ok0) segs[(out.z + pz0) / 2 > z ? 0 : 1].push(bi, px0, py0, out.x, out.y, out.z);
            px0 = out.x; py0 = out.y; pz0 = out.z; ok0 = ok;
          }
        }
        const drawSegs = (arr) => {
          for (let q = 0; q < arr.length; q += 6) {
            const bi = arr[q];
            g.lineWidth = Math.max(0.6, (bi === 1 ? 3.2 : 1.1) * f / arr[q + 5]);
            g.globalAlpha = bi === 1 ? 0.85 : 0.95;
            g.beginPath(); g.moveTo(arr[q + 1], arr[q + 2]); g.lineTo(arr[q + 3], arr[q + 4]); g.stroke();
          }
          g.globalAlpha = 1;
        };
        g.strokeStyle = ringInk;
        g.lineCap = 'butt';
        drawSegs(segs[0]);
        front = () => { g.strokeStyle = ringInk; g.lineCap = 'butt'; drawSegs(segs[1]); g.lineCap = 'round'; };
        g.lineCap = 'round';
      }

      if (!pl.parts) this.sphere(g, it.x, it.y, R, pl.X, pl.Y, pl.Z, ink, plate, toCam, rim);
      if (front) front();
      for (const s of sats) if (s.z <= z) drawSat(s);
    },
  });
})();
