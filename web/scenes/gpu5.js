// Washing Line: printed cotton sheets on a pulley line between two
// buildings, billowing in a warm wind against the sky. The line runs slowly,
// so the sheets travel across the frame and round again.
//
// The medium (harness/briefs/batch-08-libraries.md): cloth as tens of
// thousands of Verlet particles held together by structural, shear and
// bending constraints, solved in parallel on the GPU many times a frame
// (Jacobi relaxation, ping-ponged buffers), with long-range tethers to the
// pegs so the cotton does not stretch like rubber, and wind that pushes on
// each facet by its normal. What a CPU would do for one small flag, compute
// does for a whole line of full-size sheets.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a gust runs along the line from one side: the sheets it reaches
//           belly out one after another
//   clap    one sheet is snapped, as if tugged by its corner: a wave runs
//           down it
//   hats    the hems flutter
//   bass    the steady wind (every sheet leans and fills)
//   drop    with Follow the track: stronger, gustier wind, the line runs
//           faster, and the view comes in lower under the sheets
//
// Rendering: every sheet is a grid mesh whose vertices are read from the
// storage buffer, with normals from their neighbours; a physical material
// with sheen (cotton) in daylight from a low sun, under a sky gradient.
(function () {
  'use strict';

  const KIT_URL = new URL('../gpu-kit.js', document.currentScript.src).href;
  let kit = null;
  const loadKit = () => (window.__vizGpuKit = window.__vizGpuKit || import(KIT_URL)).then((m) => (kit = m));

  const TAU = Math.PI * 2;

  // Colourways: two inks and the cloth, plus the sky (top, horizon), sRGB.
  const WAYS = [
    { name: 'Indigo and madder', inks: ['#23407A', '#C4473A'], cloth: '#F4EFE6', sky: ['#8FB4D6', '#EFE3CF'] },
    { name: 'Riso pink and blue', inks: ['#FF48B0', '#0078BF'], cloth: '#F6F1E8', sky: ['#A7C4DA', '#F4E6D6'] },
    { name: 'Ochre and green', inks: ['#D39A2B', '#2E6B4F'], cloth: '#F2ECDF', sky: ['#9DB9C9', '#EEE2CB'] },
  ];

  const PRESETS = {
    calm: { wind: 0.35, gusts: 0.8, reel: 0.25, low: 0.2, flutter: 0.5, push: 1 },
    drop: { wind: 0.8, gusts: 1.5, reel: 0.7, low: 0.75, flutter: 1, push: 1.2 },
  };
  const DRIVE = ['wind', 'gusts', 'reel', 'low', 'flutter'];

  const SPEC = { ground: '#e9e2d6', drive: DRIVE, drop: PRESETS.drop, build };

  function build(env) {
    const { THREE, TSL, renderer, aspect } = env;
    const {
      Fn, If, Return, instancedArray, instanceIndex, vertexIndex, uniform, uniformArray, float, int, vec2, vec3, vec4,
      max, min, clamp, mix, smoothstep, hash, uv, dot, normalize, exp, sqrt, floor, fract, abs, length, cross,
      sin, cos, step, triNoise3D, transformNormalToView, screenUV,
    } = TSL;

    // ------------------------------------------------------------ the cloth
    // Two lines: five sheets on the near one, four on a far one behind it
    // running the other way, for parallax.
    const NEAR = 5, FAR = 4, SHEETS = NEAR + FAR;
    const FAR_Z = -16, FAR_Y = 2.2;
    const NX = 72, NY = 90;               // vertices per sheet
    const VPS = NX * NY;
    const NV = SHEETS * VPS;
    const SW = 9, SH = SW * (NY - 1) / (NX - 1);   // sheet size, metres-ish
    const S = SW / (NX - 1);             // rest spacing
    const GAP = 12.5;                    // sheet pitch along the line
    const LOOP = NEAR * GAP;             // each pulley's length
    const LINE_Y = 7.5;
    const PEG = 7;                       // a peg every PEG columns

    const p0 = new Float32Array(NV * 4);
    const sheetX = [], sheetZ = [], sheetDY = [], sheetDir = [];
    for (let s = 0; s < SHEETS; s++) {
      const far = s >= NEAR;
      sheetX.push(far ? (s - NEAR - (FAR - 1) / 2) * (LOOP / FAR) + 5 : (s - (NEAR - 1) / 2) * GAP);
      sheetZ.push(far ? FAR_Z : 0);
      sheetDY.push(far ? FAR_Y : 0);
      sheetDir.push(far ? -1 : 1);
      for (let y = 0; y < NY; y++) {
        for (let x = 0; x < NX; x++) {
          const i = s * VPS + y * NX + x;
          p0[i * 4] = sheetX[s] + (x / (NX - 1) - 0.5) * SW;
          p0[i * 4 + 1] = LINE_Y + sheetDY[s] - y * S;
          p0[i * 4 + 2] = sheetZ[s] + 0.02 * Math.sin(x * 0.7 + s);
        }
      }
    }
    const P = instancedArray(p0, 'vec4');
    const PR = instancedArray(p0.slice(), 'vec4');   // previous position (Verlet)
    const Q = instancedArray(p0.slice(), 'vec4');    // Jacobi scratch
    const NRM = instancedArray(NV, 'vec4');

    const uDt = uniform(1 / 120);
    const uSheetX = uniformArray(sheetX.slice(), 'float');
    const uSheetZ = uniformArray(sheetZ.slice(), 'float');
    const uSheetDY = uniformArray(sheetDY.slice(), 'float');
    const uSnap = uniformArray(new Array(SHEETS).fill(0), 'float');
    const uShift = uniformArray(new Array(SHEETS).fill(0), 'float');
    const uWind = uniform(new THREE.Vector3(0.6, 0, 3));
    const uTurb = uniform(0.5);
    const uGust = uniform(new THREE.Vector4(-100, 0, 0, 6));   // x, strength, _, width
    const uFlutter = uniform(0);
    const uTime = uniform(0);

    const idx = (s, x, y) => s.mul(VPS).add(y.mul(NX)).add(x);
    // (x*x, not pow: WGSL's pow is undefined for a negative base, and that
    // sent the left half of the line to NaN.)
    const lineY = (x) => { const u = x.div(LOOP * 0.5); return float(LINE_Y).sub(float(0.9).mul(float(1).sub(u.mul(u)))); };

    const decode = () => {
      const i = int(instanceIndex);
      const s = i.div(VPS), l = i.mod(VPS);
      return { i, s, x: l.mod(NX), y: l.div(NX) };
    };
    const pinned = (x, y) => y.equal(0).and(x.mod(PEG).equal(0).or(x.equal(NX - 1)));
    const pinPos = (s, x) => {
      const px = uSheetX.element(s).add(float(x).div(NX - 1).sub(0.5).mul(SW));
      return vec3(px, lineY(px).add(uSheetDY.element(s)).add(uSnap.element(s)), uSheetZ.element(s));
    };

    // Normals from the neighbours: used for wind now and shading later.
    const normals = Fn(() => {
      const { s, x, y } = decode();
      const xl = max(x.sub(1), 0), xr = min(x.add(1), NX - 1), yu = max(y.sub(1), 0), yd = min(y.add(1), NY - 1);
      const t = P.element(idx(s, xr, y)).xyz.sub(P.element(idx(s, xl, y)).xyz);
      const b = P.element(idx(s, x, yd)).xyz.sub(P.element(idx(s, x, yu)).xyz);
      NRM.element(instanceIndex).assign(vec4(normalize(cross(b, t)), 0));
    })().compute(NV, [64]);

    // Verlet step with gravity and wind on each facet.
    const integrate = Fn(() => {
      const { s, x, y } = decode();
      const p = P.element(instanceIndex).xyz.toVar();
      If(pinned(x, y), () => {
        const pp = pinPos(s, x);
        P.element(instanceIndex).assign(vec4(pp, 0));
        PR.element(instanceIndex).assign(vec4(pp, 0));
        Return();
      });
      const pr = PR.element(instanceIndex).xyz;
      const v = p.sub(pr).mul(0.992).toVar();
      const n = NRM.element(instanceIndex).xyz;
      // Wind: steady, turbulent, the kick's gust, and the hats' flutter
      // (strongest at the free hem).
      const turb = triNoise3D(p.mul(0.16).add(vec3(uTime.mul(0.35), 0, uTime.mul(0.2))), 0.4, uTime).sub(0.5).mul(2);
      const gd = p.x.sub(uGust.x).div(uGust.w);
      const gust = exp(gd.mul(gd).negate()).mul(uGust.y);
      const w = uWind.mul(float(1).add(turb.mul(uTurb)).add(gust)).add(vec3(0, 0, gust.mul(2.5))).toVar();
      const hem = float(y).div(NY - 1);
      const fl = hash(float(instanceIndex).add(floor(uTime.mul(30)))).sub(0.5).mul(uFlutter).mul(hem.mul(hem));
      const rel = w.sub(v.div(uDt));
      const f = n.mul(dot(n, rel)).mul(1.1).add(rel.mul(0.03)).add(n.mul(fl.mul(60)));
      const acc = vec3(0, -9.8, 0).add(f);
      PR.element(instanceIndex).assign(vec4(p, 0));
      P.element(instanceIndex).assign(vec4(p.add(v).add(acc.mul(uDt.mul(uDt))), 0));
    })().compute(NV, [64]);

    // One Jacobi pass over every constraint a vertex belongs to.
    const OFFS = [
      [1, 0, 1, 1], [-1, 0, 1, 1], [0, 1, 1, 1], [0, -1, 1, 1],
      [1, 1, Math.SQRT2, 0.7], [-1, 1, Math.SQRT2, 0.7], [1, -1, Math.SQRT2, 0.7], [-1, -1, Math.SQRT2, 0.7],
      [2, 0, 2, 0.25], [-2, 0, 2, 0.25], [0, 2, 2, 0.25], [0, -2, 2, 0.25],
    ];
    const makeRelax = (src, dst) => Fn(() => {
      const { s, x, y } = decode();
      const p = src.element(instanceIndex).xyz.toVar();
      If(pinned(x, y), () => { dst.element(instanceIndex).assign(vec4(p, 0)); Return(); });
      const corr = vec3(0).toVar();
      const wsum = float(0).toVar();
      for (const [ox, oy, L, k] of OFFS) {
        // Clamped index and a zero weight off the edge, rather than a branch.
        const jx = x.add(ox), jy = y.add(oy);
        const inside = float(jx.greaterThanEqual(0).and(jx.lessThan(NX)).and(jy.greaterThanEqual(0)).and(jy.lessThan(NY)));
        const q = src.element(idx(s, clamp(jx, 0, NX - 1), clamp(jy, 0, NY - 1))).xyz;
        const d = p.sub(q).toVar();
        const len = max(length(d), 1e-5);
        corr.addAssign(d.mul(float(L * S).sub(len).div(len)).mul(inside.mul(0.5 * k)));
        wsum.addAssign(inside.mul(k));
      }
      const np = p.add(corr.mul(1.6).div(max(wsum, 1.0))).toVar();
      // Tether to the peg above: cotton does not stretch, so no point may
      // be farther from the top of its column than the cloth allows.
      const top = pinPos(s, x.div(PEG).mul(PEG));
      const tv = np.sub(top).toVar();
      const maxL = float(y).mul(S).mul(1.03).add(abs(float(x.mod(PEG))).mul(S));
      const tl = length(tv);
      If(tl.greaterThan(maxL), () => { np.assign(top.add(tv.mul(maxL.div(tl)))); });
      dst.element(instanceIndex).assign(vec4(np, 0));
    })().compute(NV, [64]);
    const relaxA = makeRelax(P, Q);
    const relaxB = makeRelax(Q, P);

    // The pulley wraps a sheet that has run off one end round to the other.
    const shift = Fn(() => {
      const { s } = decode();
      const d = vec4(uShift.element(s), 0, 0, 0);
      P.element(instanceIndex).addAssign(d);
      PR.element(instanceIndex).addAssign(d);
    })().compute(NV, [64]);

    // ------------------------------------------------------------ the scene
    const scene = new THREE.Scene();
    const uSkyTop = uniform(new THREE.Color());
    const uSkyBot = uniform(new THREE.Color());
    scene.backgroundNode = mix(uSkyBot, uSkyTop, smoothstep(0.0, 1.0, screenUV.y.oneMinus()));
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 200);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    // A low raking sun from the left: every fold throws its own shade.
    sun.position.set(-14, 6, 3);
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xcfe0f0, 0x8a7a66, 1.5);
    scene.add(hemi);

    const uInk = [uniform(new THREE.Color()), uniform(new THREE.Color())];
    const uCloth = uniform(new THREE.Color());

    // Four prints, one per sheet in turn: shibori circles, stripes, a check
    // and a block-print leaf.
    const printOf = (k, q) => {
      const c = vec3(uCloth).toVar();
      if (k === 0) {
        const g = fract(q.mul(vec2(5, 6.2))).sub(0.5);
        const r = length(g);
        const ring = smoothstep(0.34, 0.3, r).mul(smoothstep(0.12, 0.16, r));
        const bleed = triNoise3D(vec3(q.mul(8), 0), 0, 0).mul(0.25);
        c.assign(mix(c, uInk[0], clamp(ring.add(bleed.mul(ring)), 0, 1)));
        c.assign(mix(c, uInk[0].mul(0.9), smoothstep(0.08, 0.05, r)));
      } else if (k === 1) {
        const st = fract(q.x.mul(4.5));
        c.assign(mix(c, uInk[1], step(0.5, st).mul(step(st, 0.8))));
        c.assign(mix(c, uInk[0], step(0.86, st)));
      } else if (k === 2) {
        const a = step(0.5, fract(q.x.mul(7))), b = step(0.5, fract(q.y.mul(8.5)));
        c.assign(mix(c, uInk[1], a.add(b).mul(0.35)));
        c.assign(mix(c, uInk[1].mul(0.85), a.mul(b).mul(0.6)));
      } else {
        const g = fract(q.mul(vec2(3, 3.6))).sub(0.5);
        const leaf = smoothstep(0.02, 0.0, abs(length(g.mul(vec2(1.8, 1))).sub(0.3)).sub(0.035));
        const vein = smoothstep(0.015, 0.0, abs(g.x)).mul(step(abs(g.y), 0.3));
        c.assign(mix(c, uInk[0], max(leaf, vein)));
        c.assign(mix(c, uInk[1], smoothstep(0.1, 0.07, length(g.sub(vec2(0.25, 0.3))))));
      }
      return c;
    };

    const meshes = [];
    for (let s = 0; s < SHEETS; s++) {
      const geo = new THREE.PlaneGeometry(SW, SH, NX - 1, NY - 1);
      const mat = new THREE.MeshPhysicalNodeMaterial({ side: THREE.DoubleSide, roughness: 0.85, sheen: 0.8, sheenRoughness: 0.6 });
      mat.sheenColor = new THREE.Color(0xffffff);
      const base = s * VPS;
      mat.positionNode = Fn(({ material }) => {
        const i = int(vertexIndex).add(base);
        const nv = transformNormalToView(NRM.element(i).xyz).toVarying();
        // Double-sided cloth: the back of a sheet is lit by its own side.
        material.normalNode = TSL.frontFacing.select(nv, nv.negate());
        return P.element(i).xyz;
      })();
      const k = s % 4;
      mat.colorNode = Fn(() => printOf(k, uv()))();
      // Thin cotton lets the sun through: the print glows where the sheet
      // faces away from the light, and a fold reads as a darker band.
      mat.emissiveNode = Fn(() => printOf(k, uv()).mul(0.22))();
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      scene.add(m);
      meshes.push({ geo, mat, m });
    }

    // The line and the pegs.
    const lineMat = new THREE.MeshStandardNodeMaterial({ color: 0x3a342e, roughness: 0.7 });
    const lineGeos = [[0, 0], [FAR_Y, FAR_Z]].map(([dy, z]) => {
      const pts = [];
      for (let k = 0; k <= 60; k++) { const x = -LOOP / 2 + (LOOP * k) / 60; const u = x / (LOOP / 2); pts.push(new THREE.Vector3(x, LINE_Y + dy - 0.9 * (1 - u * u) + 0.05, z)); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.035, 6, false);
      scene.add(new THREE.Mesh(g, lineMat));
      return g;
    });

    // ------------------------------------------------------------ warm-up
    const sx = sheetX.slice();
    const step1 = () => {
      renderer.compute([normals, integrate]);
      renderer.compute([relaxA, relaxB, relaxA, relaxB, relaxA, relaxB, relaxA, relaxB]);
    };
    for (let k = 0; k < 90; k++) { uTime.value = k / 120; step1(); }

    // ---------------------------------------------------------- the music
    let gustX = -100, gustS = 0, gustDir = 1;
    const snap = new Array(SHEETS).fill(0), snapV = new Array(SHEETS).fill(0);
    let snapNext = 0;
    let reelPos = 0;
    let camT = 0;

    return {
      frame(f) {
        const { dt, t, ears, P: Pm } = f;
        const push = Pm.push;
        const way = WAYS[Math.max(0, Math.min(WAYS.length - 1, Math.round(Pm.colors)))];
        uInk[0].value.set(way.inks[0]); uInk[1].value.set(way.inks[1]);
        uCloth.value.set(way.cloth);
        uSkyTop.value.set(way.sky[0]); uSkyBot.value.set(way.sky[1]);

        // The pulley.
        const dx = dt * (0.2 + 2.2 * Pm.reel);
        reelPos += dx;
        let wrapped = false;
        for (let s = 0; s < SHEETS; s++) {
          sx[s] += dx * sheetDir[s];
          uShift.array[s] = 0;
          if (sx[s] > LOOP / 2) { sx[s] -= LOOP; uShift.array[s] = -LOOP; wrapped = true; }
          if (sx[s] < -LOOP / 2) { sx[s] += LOOP; uShift.array[s] = LOOP; wrapped = true; }
          uSheetX.array[s] = sx[s];
        }
        if (wrapped) renderer.compute(shift);

        // Kick: a gust runs along the line.
        if (ears.kick && Pm.gusts > 0.02) {
          gustDir = Math.sin(t * 0.3) > 0 ? 1 : -1;
          gustX = -gustDir * 7;   // starts inside the view, so the kick lands at once
          gustS = 2.1 * Pm.gusts * ears.kickAmp * Math.min(1.6, push);
        }
        gustX += gustDir * dt * 24;
        gustS *= Math.exp(-dt / 0.9);
        uGust.value.set(gustX, gustS, 0, 4);
        // Clap: one sheet is snapped from its line.
        if (ears.snare && push > 0.05) {
          let best = 0, bd = 1e9;
          for (let s = 0; s < NEAR; s++) { const d = Math.abs(sx[s] - (snapNext % 2 ? 7 : -7)); if (d < bd) { bd = d; best = s; } }
          snapNext++;
          snapV[best] = 9 * Math.min(1.5, push);
        }
        for (let s = 0; s < SHEETS; s++) {
          snapV[s] += (-snap[s] * 300 - snapV[s] * 14) * dt;
          snap[s] += snapV[s] * dt;
          uSnap.array[s] = snap[s];
        }
        const wind = 3.5 + 9 * Pm.wind * (0.6 + 0.8 * ears.bass * push);
        uWind.value.set(wind * 0.45, 0.4, wind);
        uTurb.value = 0.5 + 0.9 * Pm.wind;
        uFlutter.value = Math.min(1.3, ears.hatEnv) * Pm.flutter * push;

        const sub = 2;
        uDt.value = Math.min(dt, 1 / 30) / sub;
        for (let k = 0; k < sub; k++) {
          uTime.value = t + (k * dt) / sub;
          step1();
        }
        renderer.compute(normals);

        // The view: below the line, looking up; lower on the drop.
        camT += dt;
        const lo = Pm.low;
        camera.position.set(Math.sin(camT * 0.05) * 3, 0.5 - 3.5 * lo, 23 - 6 * lo);
        camera.lookAt(0, 2.2 + 1.6 * lo, 0);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();

        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      },
      dispose() {
        for (const { geo, mat } of meshes) { geo.dispose(); mat.dispose(); }
        lineGeos.forEach((g) => g.dispose()); lineMat.dispose();
        for (const b of [P, PR, Q, NRM]) if (b.value && b.value.dispose) b.value.dispose();
      },
    };
  }

  VIZ.register({
    id: 'gpu5',
    name: 'Washing Line',
    order: 1120,
    params: [
      { key: 'wind', label: 'Wind', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'gusts', label: 'Gust on the kick', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'reel', label: 'Line running', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'low', label: 'View: level to under', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'flutter', label: 'Hem flutter on the hats', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'colors', label: 'Prints', type: 'select', options: WAYS.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.15, halation: 0.35 },

    gallery: {
      title: 'Washing Line',
      technique: 'three.js 0.186.1 WebGPU compute (TSL): nine full-size cotton sheets on two lines as 58,320 Verlet particles with structural, shear and bending constraints relaxed in parallel (ping-ponged Jacobi, eight passes a substep), long-range tethers to the pegs, and wind that pushes each facet along its normal; the sheets are grid meshes read straight from the storage buffer, lit with a sheen physical material under a sky gradient.',
      brief: 'Printed cotton sheets on a pulley line between two buildings, billowing in a warm wind against the sky: shibori circles, stripes, a check and a leaf print in two inks. The line runs slowly so the sheets travel across the frame and come round again. Every kick sends a gust along the line that bellies the sheets out one after another; claps snap one sheet from its line so a wave runs down it; hats flutter the hems; the bass fills every sheet. On the drop the wind turns gusty, the line runs faster and the view comes in lower, under the sheets.',
      lineage: 'Italian and Hong Kong washing lines strung between tenements; Japanese shibori and block prints; Verlet cloth after Jakobsen (2001), long-range attachments after Kim, Chentanez and Müller (2012), and three.js\'s webgpu_compute_cloth example.',
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      const done = () => { if (hold) p._decrementPreload(); };
      loadKit().then((k) => k.warm(hold)).then(done, (e) => { console.error('gpu5: kit did not load', e); done(); });
    },
    enter() { if (kit) kit.enter(this); },
    leave() { if (kit) kit.leave(this); },
    draw(p, signals, params, ctx) {
      if (!kit) { loadKit(); p.background(SPEC.ground); return; }
      kit.draw(this, SPEC, p, signals, params, ctx);
    },
  });
})();
