// Paint Pour: riso inks poured on the beat into a tray of wet paint, as an
// acrylic "puddle pour": each pour lands inside the paint already there and
// pushes it outward, so the tray fills with rings of colour that get dragged,
// marbled and bent by every later pour.
//
// The medium is the point (harness/briefs/batch-08-libraries.md): this is a
// real viscous-fluid solve, 2D MLS-MPM (after three.js's official
// webgpu_compute_particles_fluid example and matsuoka-601/WebGPU-Ocean) on up
// to 196,608 particles, run every frame in WebGPU compute. Particles scatter
// their mass and momentum into a grid with integer atomics (WebGPU has no
// float atomics, so the values travel as fixed point), the grid is solved,
// and particles gather it back. Scatter writes and atomics are exactly what
// our WebGL texture ping-pong cannot do, and they are why the pours push and
// fold the old paint instead of just blending over it.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a pour: a cup of the next ink in the sequence lands at the spout
//           and spreads, pushing the rings around it outward (one spot)
//   clap    a drizzle: a thin line of ink laid across the paint near the
//           spout, which the next pours bend into marbling
//   hats    the wet gloss glints
//   bass    a thin continuous stream at the spout between the pours
//   drop    with Follow the track: runnier paint, bigger pours, more spouts,
//           and the tray tilts so the whole surface slides toward one edge
//
// Rendering: every particle is splatted into a half-resolution float target
// as a soft disc carrying one ink's weight in one channel (four inks, four
// channels), then one full-screen pass picks the dominant ink per pixel with
// a sharpened soft-max (crisp cell edges, antialiased), reads the total
// weight as paint thickness for the normals, and lights it as wet gloss over
// a matte grey tray with the paint's shadow on it.
(function () {
  'use strict';

  const KIT_URL = new URL('../gpu-kit.js', document.currentScript.src).href;
  let kit = null;
  const loadKit = () => (window.__vizGpuKit = window.__vizGpuKit || import(KIT_URL)).then((m) => (kit = m));

  const TAU = Math.PI * 2;

  // Riso inks (Risograph drum colours, sRGB), four per set; the fourth is
  // the white that makes the rings read, as in a real puddle pour.
  const INKS = [
    { name: 'Pink, blue, yellow', colors: ['#FF48B0', '#0078BF', '#FFE800', '#F4EFE4'] },
    { name: 'Orange, teal, burgundy', colors: ['#FF6C2F', '#00838A', '#914E72', '#F2ECDF'] },
    { name: 'Aqua, federal blue, sunflower', colors: ['#5EC8E5', '#3D5588', '#FFB511', '#F5F0E6'] },
    { name: 'Green, medium blue, bright red', colors: ['#00A95C', '#3255A4', '#F15060', '#F3EEE2'] },
    { name: 'Black, fluorescent pink, white', colors: ['#2B2A2E', '#FF48B0', '#88898A', '#F4F0E8'] },
  ];
  // The pour order: colours with white between them.
  const SEQ = [0, 3, 1, 3, 2, 3, 1, 0, 3, 2];

  const PRESETS = {
    calm: { body: 0.7, pour: 0.8, tilt: 0, spouts: 1, gloss: 0.5, push: 1 },
    drop: { body: 0.3, pour: 1.5, tilt: 0.55, spouts: 3, gloss: 0.8, push: 1.2 },
  };
  const DRIVE = ['body', 'pour', 'tilt', 'spouts', 'gloss'];

  const SPEC = { ground: '#d6d2ca', drive: DRIVE, drop: PRESETS.drop, build };

  function build(env) {
    const { THREE, TSL, renderer, aspect } = env;
    const {
      Fn, If, Return, instancedArray, instanceIndex, uniform, float, int, vec2, vec3, vec4, ivec2,
      atomicAdd, atomicStore, atomicLoad, atomicSub, atomicMax, max, pow, clamp, mix, smoothstep,
      hash, texture, uv, dot, normalize, exp, sqrt, sin, cos, floor, fract, step,
    } = TSL;

    // ---------------------------------------------------------- the domain
    // Grid units: one cell is 1; positions run 0..GX, 0..GY, y up.
    // The tray runs MG cells past every edge of the frame, so paint that
    // a tilt drains away leaves bare board off screen, not in view.
    const VY = 150, VX = Math.round(VY * aspect), MG = 12;
    const GY = VY + 2 * MG;
    const GX = VX + 2 * MG;
    const CELLS = GX * GY;
    const RHO0 = 4;                  // particles per cell at rest
    const MAX = 4 * 65536;
    const FIX = 1e5;                 // fixed point for the integer atomics
    const N0 = Math.min(Math.round(CELLS * RHO0 * 0.98), MAX - 30000);

    // Initial tray: already a finished pour, so frame 1 looks right. Rings
    // around a few earlier pour points, later pours on top of earlier ones.
    const pos = new Float32Array(MAX * 4);
    const ink = new Float32Array(MAX);
    const free = new Int32Array(MAX);
    const olds = [];
    for (let i = 0; i < 6; i++) olds.push([GX * (0.1 + 0.8 * Math.random()), GY * (0.1 + 0.8 * Math.random()), GY * (0.3 + 0.35 * Math.random()), Math.floor(Math.random() * 10), 3 + 7 * Math.random(), Math.random() * TAU]);
    // A soft domain warp, so the old rings have been pushed about already.
    const wq = [0, 1, 2, 3].map(() => [Math.random() * TAU, 0.03 + 0.05 * Math.random(), 0.03 + 0.05 * Math.random()]);
    const warp = (x, y) => {
      let dx = 0, dy = 0;
      for (const [ph, fx, fy] of wq) { dx += 4 * Math.sin(y * fy + ph); dy += 4 * Math.sin(x * fx + ph * 1.3); }
      return [x + dx, y + dy];
    };
    const per = Math.ceil(Math.sqrt(N0 / CELLS));
    let n = 0;
    for (let cy = 0; cy < GY && n < N0; cy++) {
      for (let cx = 0; cx < GX && n < N0; cx++) {
        for (let k = 0; k < per * per && n < N0; k++) {
          const x = cx + ((k % per) + Math.random()) / per;
          const y = cy + (Math.floor(k / per) + Math.random()) / per;
          if (x < 2 || y < 2 || x > GX - 2 || y > GY - 2) continue;
          let inkI = 3;
          const [wx, wy] = warp(x, y);
          for (const o of olds) {
            const d = Math.hypot(wx - o[0], (wy - o[1]) * 1.1) * (1 + 0.12 * Math.sin(Math.atan2(wy - o[1], wx - o[0]) * 3 + o[5]));
            if (d < o[2]) inkI = SEQ[(Math.floor(d / o[4]) + o[3]) % SEQ.length];
          }
          pos[n * 4] = x; pos[n * 4 + 1] = y;
          ink[n] = inkI + Math.random() * 0.98;
          n++;
        }
      }
    }
    const alive = n;
    for (let i = alive; i < MAX; i++) { pos[i * 4] = -1e4; pos[i * 4 + 1] = -1e4; }
    for (let k = 0; k < MAX - alive; k++) free[k] = alive + k;

    const P = instancedArray(pos, 'vec4');                 // x, y, vx, vy
    const Cb = instancedArray(MAX, 'vec4');                // APIC affine matrix, row-major
    const INK = instancedArray(ink, 'float');              // ink index + shade in the fraction
    const FREE = instancedArray(free, 'int');              // stack of dead particle ids
    const FREEN = instancedArray(new Int32Array([MAX - alive]), 'int').toAtomic();
    const gMx = instancedArray(CELLS, 'int').toAtomic();
    const gMy = instancedArray(CELLS, 'int').toAtomic();
    const gM = instancedArray(CELLS, 'int').toAtomic();
    const gV = instancedArray(CELLS, 'vec4');              // vx, vy, mass

    const uDt = uniform(1 / 120);
    const uStiff = uniform(30);
    const uVisc = uniform(0.8);
    const uDrag = uniform(3);
    const uGrav = uniform(new THREE.Vector2(0, 0));

    const enc = (f) => int(f.mul(FIX));
    const dec = (i) => float(i).div(FIX);
    const cellOf = (cx, cy) => cy.mul(GX).add(cx);

    // Quadratic B-spline weights, 3 per axis, as in the three.js example.
    const weights = (gp) => {
      const d = fract(gp).sub(0.5);
      return [
        float(0.5).mul(float(0.5).sub(d)).mul(float(0.5).sub(d)),
        float(0.75).sub(d.mul(d)),
        float(0.5).mul(float(0.5).add(d)).mul(float(0.5).add(d)),
      ];
    };

    const clearGrid = Fn(() => {
      atomicStore(gMx.element(instanceIndex), int(0));
      atomicStore(gMy.element(instanceIndex), int(0));
      atomicStore(gM.element(instanceIndex), int(0));
    })().compute(CELLS);

    const p2g1 = Fn(() => {
      const d = P.element(instanceIndex).toVar();
      If(d.x.lessThan(0), () => { Return(); });
      const gp = d.xy;
      const c = Cb.element(instanceIndex).toVar();
      const ci = ivec2(floor(gp)).sub(1).toVar();
      const w = weights(gp);
      for (let gx = 0; gx < 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
          const wt = w[gx].x.mul(w[gy].y);
          const cx = ci.x.add(gx), cy = ci.y.add(gy);
          const dist = vec2(float(cx).add(0.5), float(cy).add(0.5)).sub(gp);
          const q = vec2(c.x.mul(dist.x).add(c.y.mul(dist.y)), c.z.mul(dist.x).add(c.w.mul(dist.y)));
          const mv = d.zw.add(q).mul(wt);
          const idx = cellOf(cx, cy);
          atomicAdd(gMx.element(idx), enc(mv.x));
          atomicAdd(gMy.element(idx), enc(mv.y));
          atomicAdd(gM.element(idx), enc(wt));
        }
      }
    })().compute(MAX, [64]);

    const p2g2 = Fn(() => {
      const d = P.element(instanceIndex).toVar();
      If(d.x.lessThan(0), () => { Return(); });
      const gp = d.xy;
      const ci = ivec2(floor(gp)).sub(1).toVar();
      const w = weights(gp);
      const dens = float(0).toVar();
      for (let gx = 0; gx < 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
          const idx = cellOf(ci.x.add(gx), ci.y.add(gy));
          dens.addAssign(dec(atomicLoad(gM.element(idx))).mul(w[gx].x.mul(w[gy].y)));
        }
      }
      const vol = float(1).div(max(dens, 0.05));
      const pr = max(0.0, pow(dens.div(RHO0), 4.0).sub(1)).mul(uStiff);
      const c = Cb.element(instanceIndex).toVar();
      // stress = -p I + mu (C + C^T)
      const s00 = pr.negate().add(uVisc.mul(c.x).mul(2));
      const s01 = uVisc.mul(c.y.add(c.z));
      const s11 = pr.negate().add(uVisc.mul(c.w).mul(2));
      const k = vol.mul(-4).mul(uDt).toVar();
      for (let gx = 0; gx < 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
          const wt = w[gx].x.mul(w[gy].y);
          const cx = ci.x.add(gx), cy = ci.y.add(gy);
          const dist = vec2(float(cx).add(0.5), float(cy).add(0.5)).sub(gp);
          const kw = k.mul(wt);
          const idx = cellOf(cx, cy);
          atomicAdd(gMx.element(idx), enc(s00.mul(dist.x).add(s01.mul(dist.y)).mul(kw)));
          atomicAdd(gMy.element(idx), enc(s01.mul(dist.x).add(s11.mul(dist.y)).mul(kw)));
        }
      }
    })().compute(MAX, [64]);

    const updateGrid = Fn(() => {
      const m = dec(atomicLoad(gM.element(instanceIndex))).toVar();
      If(m.lessThanEqual(0.0001), () => {
        gV.element(instanceIndex).assign(vec4(0));
        Return();
      });
      const v = vec2(dec(atomicLoad(gMx.element(instanceIndex))), dec(atomicLoad(gMy.element(instanceIndex)))).div(m).toVar();
      // Tilt moves thick paint faster than thin (a film's flow goes as its
      // thickness squared), so a tilt stretches the cells instead of
      // sliding the whole layer like a slab.
      const hh = clamp(m.div(RHO0), 0.0, 2.5);
      v.addAssign(uGrav.mul(uDt).mul(hh.mul(hh)));
      // Bottom friction of paint on a board: what lets a pour settle.
      v.mulAssign(exp(uDrag.negate().mul(uDt)));
      gV.element(instanceIndex).assign(vec4(v, m, 0));
    })().compute(CELLS);

    const g2p = Fn(() => {
      const d = P.element(instanceIndex).toVar();
      If(d.x.lessThan(0), () => { Return(); });
      const gp = d.xy;
      const ci = ivec2(floor(gp)).sub(1).toVar();
      const w = weights(gp);
      const v = vec2(0).toVar();
      const B = vec4(0).toVar();
      for (let gx = 0; gx < 3; gx++) {
        for (let gy = 0; gy < 3; gy++) {
          const wt = w[gx].x.mul(w[gy].y);
          const cx = ci.x.add(gx), cy = ci.y.add(gy);
          const dist = vec2(float(cx).add(0.5), float(cy).add(0.5)).sub(gp);
          const wv = gV.element(cellOf(cx, cy)).xy.mul(wt).toVar();
          v.addAssign(wv);
          B.addAssign(vec4(wv.x.mul(dist.x), wv.x.mul(dist.y), wv.y.mul(dist.x), wv.y.mul(dist.y)));
        }
      }
      Cb.element(instanceIndex).assign(B.mul(4));
      const np = gp.add(v.mul(uDt)).toVar();
      // The tray's edges are open and lie outside the frame: paint that
      // runs off is recycled for the next pour through a stack of free ids.
      If(np.x.lessThan(1.0).or(np.y.lessThan(1.0)).or(np.x.greaterThan(GX - 1.0)).or(np.y.greaterThan(GY - 1.0)), () => {
        P.element(instanceIndex).assign(vec4(-1e4, -1e4, 0, 0));
        const slot = atomicAdd(FREEN.element(0), int(1)).toVar();
        FREE.element(slot).assign(int(instanceIndex));
        Return();
      });
      P.element(instanceIndex).assign(vec4(np, v));
    })().compute(MAX, [64]);

    // Spawning: take ids off the free stack. mode 0 is a disc (a pour),
    // mode 1 a thin line (a drizzle).
    const uSpC = uniform(new THREE.Vector2());
    const uSpR = uniform(10);
    const uSpDir = uniform(new THREE.Vector2(1, 0));
    const uSpMode = uniform(0);
    const uSpInk = uniform(0);
    const uSpSeed = uniform(0);
    const spawn = Fn(() => {
      const j = atomicSub(FREEN.element(0), int(1)).sub(1).toVar();
      If(j.lessThan(0), () => { Return(); });
      const id = FREE.element(j).toVar();
      const fi = float(instanceIndex).add(uSpSeed);
      const r1 = hash(fi), r2 = hash(fi.add(71.3)), r3 = hash(fi.add(19.7));
      const a = r1.mul(TAU);
      const disc = uSpC.add(vec2(cos(a), sin(a)).mul(sqrt(r2).mul(uSpR)));
      const perp = TSL.normalize(vec2(uSpDir.y.negate(), uSpDir.x));
      const line = uSpC.add(uSpDir.mul(r1.mul(2).sub(1))).add(perp.mul(r2.sub(0.5).mul(uSpR)));
      const p = mix(disc, line, uSpMode);
      const pc = clamp(p, vec2(1.5), vec2(GX - 1.5, GY - 1.5));
      P.element(id).assign(vec4(pc, 0, 0));
      Cb.element(id).assign(vec4(0));
      INK.element(id).assign(uSpInk.add(r3.mul(0.98)));
    })().compute(1, [64]);
    const fixFree = Fn(() => { atomicMax(FREEN.element(0), int(0)); })().compute(1);



    // -------------------------------------------------------- the splat
    const RS = 0.36;
    let rw = Math.max(2, Math.round(env.w * RS)), rh = Math.max(2, Math.round(env.h * RS));
    const rt = new THREE.RenderTarget(rw, rh, { type: THREE.HalfFloatType, depthBuffer: false });
    const splatScene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(MG, GX - MG, GY - MG, MG, -1, 1);
    const SPR = 4.0;          // sprite diameter in cells
    const splatMat = new THREE.SpriteNodeMaterial();
    const pa = P.toAttribute();
    const ia = INK.toAttribute();
    splatMat.positionNode = vec3(pa.x, pa.y, 0);
    splatMat.scaleNode = float(SPR);
    splatMat.fragmentNode = Fn(() => {
      const q = uv().sub(0.5).mul(2);
      const w = exp(dot(q, q).mul(-3.2));
      const k = floor(ia);
      const e1 = step(0.5, k), e2 = step(1.5, k), e3 = step(2.5, k);
      return vec4(float(1).sub(e1), e1.sub(e2), e2.sub(e3), e3).mul(w);
    })();
    splatMat.transparent = true;
    splatMat.depthTest = false;
    splatMat.depthWrite = false;
    splatMat.blending = THREE.CustomBlending;
    splatMat.blendEquation = THREE.AddEquation;
    splatMat.blendSrc = THREE.OneFactor;
    splatMat.blendDst = THREE.OneFactor;
    splatMat.blendSrcAlpha = THREE.OneFactor;
    splatMat.blendDstAlpha = THREE.OneFactor;
    splatMat.premultipliedAlpha = false;
    const sprites = new THREE.Sprite(splatMat);
    sprites.count = MAX;
    sprites.frustumCulled = false;
    splatScene.add(sprites);

    // Weight at rest density: RHO0 * the disc's integral (in cells^2).
    // exp(-3.2 r^2) over the sprite's radius SPR/2.
    const sigma2 = (SPR / 2) * (SPR / 2) / (2 * 3.2);
    const T0 = RHO0 * TAU * sigma2;

    // ------------------------------------------------------- the display
    const uInk = [0, 1, 2, 3].map(() => uniform(new THREE.Color()));
    const uTray = uniform(new THREE.Color('#d6d2ca'));
    const uTexel = uniform(new THREE.Vector2(1 / rw, 1 / rh));
    const uGloss = uniform(0.6);
    const uGlint = uniform(0);
    const uT0 = uniform(T0);
    const tex = (o) => texture(rt.texture, uv().add(o));
    const dispMat = new THREE.MeshBasicNodeMaterial();
    dispMat.colorNode = Fn(() => {
      const w = tex(vec2(0)).toVar();
      const T = w.x.add(w.y).add(w.z).add(w.w).toVar();
      // Sharpened soft-max over the four inks: crisp cell walls, antialiased.
      const wn = w.div(max(T, 1e-4));
      const wp = pow(wn, vec4(6)).toVar();
      const ws = max(wp.x.add(wp.y).add(wp.z).add(wp.w), 1e-6);
      const col = uInk[0].mul(wp.x).add(uInk[1].mul(wp.y)).add(uInk[2].mul(wp.z)).add(uInk[3].mul(wp.w)).div(ws).toVar();
      // Thickness -> height -> normal. Samples 1.5 texels out, so the
      // bilinear taps smooth away single particles.
      const o = uTexel.mul(2.5);
      const th = (dx, dy) => { const s = tex(vec2(o.x.mul(dx), o.y.mul(dy))); return s.x.add(s.y).add(s.z).add(s.w); };
      const hx = th(1, 0).sub(th(-1, 0));
      const hy = th(0, 1).sub(th(0, -1));
      const n = normalize(vec3(hx.negate(), hy.negate(), uT0.mul(1.5)));
      const L = normalize(vec3(-0.45, 0.55, 0.7));
      const diff = dot(n, L).mul(0.5).add(0.62);
      const H = normalize(L.add(vec3(0, 0, 1)));
      const shin = mix(24.0, 90.0, uGloss);
      const spec = pow(max(dot(n, H), 0), shin).mul(uGloss.mul(0.55).add(uGlint.mul(0.5)));
      const paint = col.mul(diff).add(spec);
      const cover = smoothstep(uT0.mul(0.18), uT0.mul(0.55), T);
      // The paint's shadow on the board, cast away from the light.
      const sh = th(3.2, -3.2).add(th(2.2, -2.2)).mul(0.5);
      const shadow = smoothstep(uT0.mul(0.15), uT0.mul(0.7), sh).mul(0.22);
      const tray = uTray.mul(float(1).sub(shadow));
      return mix(tray, paint, cover);
    })();
    const quad = new THREE.QuadMesh(dispMat);

    // ---------------------------------------------------------- the music
    let seqI = 0;
    let pours = [];              // { x, y, left, rate, ink, r }
    let spoutPhase = Math.random() * 100;
    let seed = 1;
    let tiltAng = Math.random() * TAU;
    let swayPh = 0;

    function emit(x, y, count, r, inkI, mode, dir) {
      if (count < 1) return;
      uSpC.value.set(x, y);
      uSpR.value = r;
      uSpMode.value = mode;
      uSpInk.value = inkI;
      if (dir) uSpDir.value.set(dir[0], dir[1]);
      uSpSeed.value = (seed = (seed * 16807) % 2147483647) % 100000;
      spawn.count = Math.round(count);
      renderer.compute([spawn, fixFree]);
    }

    function spoutAt(t, k, spouts) {
      // Spout k of n: the first wanders the middle; others sit round it.
      const cx = GX * (0.5 + 0.28 * Math.sin(t * 0.061 + spoutPhase) + 0.06 * Math.sin(t * 0.23));
      const cy = GY * (0.5 + 0.26 * Math.sin(t * 0.047 + spoutPhase * 1.7) + 0.05 * Math.cos(t * 0.19));
      if (k === 0) return [cx, cy];
      const a = t * 0.05 + (k * TAU) / Math.max(2, spouts);
      return [GX * 0.5 + (cx - GX * 0.5) * Math.cos(a) * -1 + GY * 0.3 * Math.cos(a + k), GY * 0.5 + (cy - GY * 0.5) * -0.8 + GY * 0.22 * Math.sin(a * 1.3 + k)];
    }

    return {
      frame(f) {
        const { dt, t, ears, P: Pm } = f;
        const push = Pm.push;
        const pal = INKS[Math.max(0, Math.min(INKS.length - 1, Math.round(Pm.inks)))].colors;
        for (let i = 0; i < 4; i++) uInk[i].value.set(pal[i]);
        const spouts = Math.max(1, Math.round(Pm.spouts));

        if (ears.kick) {
          const inkI = SEQ[seqI++ % SEQ.length];
          for (let k = 0; k < spouts; k++) {
            const [x, y] = spoutAt(t, k, spouts);
            const cnt = 2400 * Pm.pour * ears.kickAmp * Math.min(1.6, push) * (k ? 0.7 : 1);
            const r = Math.sqrt(cnt / (RHO0 * 1.4 * Math.PI)) * 0.55;
            pours.push({ x, y, left: cnt, rate: cnt / 7, ink: k ? SEQ[(seqI + 2 * k) % SEQ.length] : inkI, r });
          }
        }
        if (ears.snare && push > 0.05) {
          const [x, y] = spoutAt(t, 0, 1);
          const a = Math.random() * TAU;
          const len = GY * 0.22;
          emit(x + Math.cos(a + 1.6) * GY * 0.1, y + Math.sin(a + 1.6) * GY * 0.1, 1100 * Math.min(1.5, push), 1.4, SEQ[(seqI + 3) % SEQ.length] === 3 ? 1 : SEQ[(seqI + 3) % SEQ.length], 1, [Math.cos(a) * len, Math.sin(a) * len]);
        }
        // Pours land over a few frames: a cup tipping, not a stamp.
        for (const q of pours) {
          const c = Math.min(q.left, q.rate);
          emit(q.x, q.y, c, q.r, q.ink, 0);
          q.left -= c;
        }
        pours = pours.filter((q) => q.left >= 1);
        // A thin stream between pours on the bass.
        const stream = 55 * ears.bass * push * Pm.pour;
        if (stream >= 1) {
          const [x, y] = spoutAt(t, 0, 1);
          emit(x, y, stream, 2.2, SEQ[(seqI + SEQ.length - 1) % SEQ.length], 0);
        }

        // Paint body: honey to single cream.
        const body = Pm.body;
        uVisc.value = 0.15 + 2.2 * body;
        uDrag.value = 0.9 + 3.5 * body;
        uStiff.value = 26;
        // The tray is rocked, not tipped: a slow sway along an axis that
        // turns, so the paint stretches one way and comes back instead of
        // running off one edge and leaving the board bare.
        tiltAng += dt * 0.045;
        swayPh += dt * TAU / 11;
        const g = 26 * Pm.tilt * Math.sin(swayPh);
        uGrav.value.set(Math.cos(tiltAng) * g, Math.sin(tiltAng) * g);
        uGloss.value = Pm.gloss;
        uGlint.value = Math.min(1, ears.hatEnv) * push;

        const sub = 2;
        uDt.value = Math.min(dt, 1 / 30) / sub;
        for (let s = 0; s < sub; s++) renderer.compute([clearGrid, p2g1, p2g2, updateGrid, g2p]);

        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 0);
        renderer.render(splatScene, cam);
        renderer.setRenderTarget(null);
        quad.render(renderer);
      },
      resize(w, h) {
        rw = Math.max(2, Math.round(w * RS)); rh = Math.max(2, Math.round(h * RS));
        rt.setSize(rw, rh);
        uTexel.value.set(1 / rw, 1 / rh);
      },
      dispose() {
        rt.dispose(); splatMat.dispose(); dispMat.dispose();
        for (const b of [P, Cb, INK, FREE, FREEN, gMx, gMy, gM, gV]) if (b.value && b.value.dispose) b.value.dispose();
      },
    };
  }

  VIZ.register({
    id: 'gpu1',
    name: 'Paint Pour',
    order: 1116,
    params: [
      { key: 'pour', label: 'Pour size', type: 'range', min: 0, max: 2, default: 0.9, step: 0.01 },
      { key: 'body', label: 'Paint body: runny to honey', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'tilt', label: 'Tray tilt', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'spouts', label: 'Spouts', type: 'range', min: 1, max: 3, default: 1, step: 1 },
      { key: 'gloss', label: 'Wet gloss', type: 'range', min: 0, max: 1, default: 0.55, step: 0.01 },
      { key: 'inks', label: 'Inks', type: 'select', options: INKS.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    // Flat riso colour on a matte board: keep the lens soft and the grain,
    // drop the bloom that would haze the white ink.
    finish: { bloom: 0.15, halation: 0.3, motionBlur: 0.5 },

    gallery: {
      title: 'Paint Pour',
      technique: 'three.js 0.186.1 WebGPU compute (TSL): a 2D MLS-MPM viscous fluid on up to 262,144 particles, scattered to the grid with fixed-point integer atomics and gathered back every substep, with a GPU free-list recycling paint that runs off the tray; particles splatted as four-channel ink weights into a half-float target, then one pass for a sharpened soft-max ink choice, thickness normals, wet gloss and the paint\'s shadow on the board.',
      brief: 'An acrylic puddle pour seen from above, in riso inks with white between them. Every kick tips a cup of the next ink into the wet paint at the spout, and the new puddle pushes the old rings outward; claps lay a thin drizzle line that later pours bend into marbling; hats glint the gloss; the bass keeps a thin stream running. On the drop the paint runs thinner, three spouts pour at once and the tray tilts, so the whole surface slides and stretches toward one edge.',
      lineage: 'Fluid acrylic pour painting (the puddle and "dirty cup" pours); Risograph drum inks; three.js\'s webgpu_compute_particles_fluid example (MLS-MPM after Hu et al. 2018 and matsuoka-601\'s WebGPU-Ocean), taken from 3D to a 2D tray.',
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      const done = () => { if (hold) p._decrementPreload(); };
      loadKit().then((k) => k.warm(hold)).then(done, (e) => { console.error('gpu1: kit did not load', e); done(); });
    },
    enter() { if (kit) kit.enter(this); },
    leave() { if (kit) kit.leave(this); },
    draw(p, signals, params, ctx) {
      if (!kit) { loadKit(); p.background(SPEC.ground); return; }
      kit.draw(this, SPEC, p, signals, params, ctx);
    },
  });
})();
