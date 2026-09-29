// Sand Picture: the moving sand-art frame from a 1970s desk, a glass pane
// of coloured sand in clear liquid. Sand drains through gaps in a divider and
// piles into strata like mountain ranges; turn the frame over and a new
// landscape builds from the old one.
//
// The medium (harness/briefs/batch-08-libraries.md): well over a hundred
// thousand separate grains, each colliding with its neighbours every frame.
// That is a neighbour search no fragment shader can do: every substep the
// grains are scattered into a uniform hash grid with atomic counters (four
// slots a cell), then each grain reads the 3x3 cells around it and resolves
// its overlaps and friction (position-based dynamics, Jacobi,
// double-buffered). The piles, the slopes and the slow curtains through the
// liquid all come out of that, not out of a drawing.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    an air bubble rises from the bottom at one spot and bores up
//           through the piled sand, throwing a plume of grains aside
//   clap    one gap in the divider opens wide for a moment: a curtain of sand
//   hats    mica in the sand glints
//   bass    the gaps widen, so more sand runs
//   drop    with Follow the track: the frame is turned over (the view turns
//           with it, then settles), bubbles come in pairs and the gaps open
//
// Rendering: each grain is a sprite shaded as a small rough bead in its own
// sand colour; the liquid behind is a soft gradient that follows gravity;
// bubbles are drawn as clear lenses. The view rotates with the frame.
(function () {
  'use strict';

  const KIT_URL = new URL('../gpu-kit.js', document.currentScript.src).href;
  let kit = null;
  const loadKit = () => (window.__vizGpuKit = window.__vizGpuKit || import(KIT_URL)).then((m) => (kit = m));

  const TAU = Math.PI * 2;

  // Five sands and the liquid (top, bottom), sRGB.
  const SANDS = [
    { name: 'Desert dusk', sand: ['#1E1B20', '#F0EAE0', '#C2613A', '#D8B57C', '#3A6E87'], liquid: ['#B9D0DA', '#E8E1D3'] },
    { name: 'Ink and bone', sand: ['#141417', '#EEEAE2', '#6F6A66', '#B9B2A8', '#2B3A55'], liquid: ['#D9D6CF', '#F2EFE8'] },
    { name: 'Coral reef', sand: ['#1F2A44', '#F4EFE6', '#E86A55', '#F2B94B', '#2E8C8A'], liquid: ['#A9D8D6', '#EAF1EA'] },
    { name: 'Plum and ochre', sand: ['#2A1F2D', '#EFE6D8', '#7D3F63', '#D39A3C', '#5E7F5A'], liquid: ['#D8C9D2', '#F1EAE0'] },
  ];

  const PRESETS = {
    calm: { flow: 0.35, bubbles: 0.8, friction: 0.7, glint: 0.5, turn: 0, push: 1 },
    drop: { flow: 0.8, bubbles: 1.6, friction: 0.55, glint: 0.9, turn: 1, push: 1.2 },
  };
  const DRIVE = ['flow', 'bubbles', 'friction', 'glint', 'turn'];

  const SPEC = { ground: '#2a2724', drive: DRIVE, drop: PRESETS.drop, build };

  function build(env) {
    const { THREE, TSL, renderer, aspect } = env;
    const {
      Fn, If, Loop, instancedArray, instanceIndex, uniform, uniformArray, float, int, vec2, vec3,
      atomicAdd, atomicStore, atomicLoad, max, min, clamp, mix, smoothstep, hash, uv, dot, exp,
      sqrt, floor, length, abs, sign, step,
    } = TSL;

    // ---------------------------------------------------------- the frame
    // Units: one grain diameter. The frame is W x H; the divider sits across
    // the middle, 2*DIV_T thick, with HOLES gaps.
    const W = 640;
    const H = Math.round(W / aspect);
    const R = 0.5;                 // grain radius
    const GW = W, GH = H;          // hash grid, cell = one diameter
    const CELLS = GW * GH;
    const CAP = 4;
    const DIV_Y = H / 2, DIV_T = 1.6;
    const HOLES = 5;
    const NB = 4;                  // bubbles in flight at most

    // Initial sand: a finished landscape below the divider and a banded
    // reservoir above it, so frame 1 is already a picture.
    const ph = [0, 1, 2, 3, 4].map(() => [Math.random() * TAU, 0.004 + Math.random() * 0.02, 0.2 + Math.random() * 0.8]);
    const noise1 = (x, k) => { let s = 0; for (const [p, f, a] of ph) s += a * Math.sin(x * f * (1 + k * 0.37) + p + k * 1.7); return s; };
    const grains = [];
    const nCols = 5;
    const layers = 6;
    for (let y = R + 0.1; y < DIV_Y - DIV_T - R; y += 0.87) {
      const row = Math.round(y / 0.87);
      for (let x = R + 0.6 + (row % 2) * 0.5; x < W - R - 0.5; x += 1.0) {
        let top = 0, c = -1;
        for (let k = 0; k < layers; k++) {
          top += ((DIV_Y * 0.55) / layers) * (1 + (0.55 * noise1(x, k)) / 2.2);
          if (y < top) { c = (k * 3 + 1) % nCols; break; }
        }
        if (c >= 0) grains.push([x, y, c]);
      }
    }
    const bandTop = DIV_Y + DIV_T + (H - DIV_Y) * 0.6;
    const bands = [];
    let yb = DIV_Y + DIV_T + R;
    while (yb < bandTop) { const th = 4 + Math.random() * 16; bands.push([yb, yb + th, Math.floor(Math.random() * nCols)]); yb += th; }
    for (let y = DIV_Y + DIV_T + R + 0.05; y < bandTop; y += 0.87) {
      const row = Math.round(y / 0.87);
      for (let x = R + 0.6 + (row % 2) * 0.5; x < W - R - 0.5; x += 1.0) {
        const wob = 3 * Math.sin(x * 0.02 + y * 0.05);
        const b = bands.find((bb) => y + wob < bb[1]) || bands[bands.length - 1];
        grains.push([x, y, b[2]]);
      }
    }
    const N = grains.length;
    const xA = new Float32Array(N * 2), col = new Float32Array(N);
    grains.forEach((g, i) => { xA[i * 2] = g[0] + (Math.random() - 0.5) * 0.05; xA[i * 2 + 1] = g[1]; col[i] = g[2] + Math.random() * 0.98; });

    const X = instancedArray(xA, 'vec2');           // position at the start of the substep
    const V = instancedArray(N, 'vec2');
    const XP = instancedArray(xA.slice(), 'vec2');  // predicted / iterate A
    const XQ = instancedArray(xA.slice(), 'vec2');  // iterate B
    const COL = instancedArray(col, 'float');
    const NCON = instancedArray(N, 'float');        // contact weight in the last iteration
    const CNT = instancedArray(CELLS, 'int').toAtomic();
    const SLOT = instancedArray(CELLS * CAP, 'int');

    const uDt = uniform(1 / 120);
    const uG = uniform(new THREE.Vector2(0, -220));  // gravity in frame coordinates
    const uDrag = uniform(3.4);
    const uMu = uniform(0.6);
    const uUpS = uniform(new THREE.Vector2(0, 1));   // against gravity, for the solver
    const uHoleW = uniformArray(new Array(HOLES).fill(0), 'float');
    const uHoleX = uniformArray(new Array(HOLES).fill(0).map((_, i) => W * (i + 0.5) / HOLES), 'float');
    const uBub = uniformArray(new Array(NB).fill(0).map(() => new THREE.Vector4(-100, -100, 0, 0)), 'vec4');  // x, y, radius, alive

    const cellIdx = (p) => {
      const c = clamp(floor(p), vec2(0), vec2(GW - 1, GH - 1));
      return int(c.y).mul(GW).add(int(c.x));
    };
    // 1 inside any open gap of the divider at x, else 0.
    const gapOpen = (x) => {
      const open = float(0).toVar();
      for (let h = 0; h < HOLES; h++) open.assign(max(open, float(1).sub(step(0, abs(x.sub(uHoleX.element(h))).sub(uHoleW.element(h).mul(0.5))))));
      return open;
    };

    const predict = Fn(() => {
      const v = V.element(instanceIndex).toVar();
      v.addAssign(uG.mul(uDt));
      // Settling through liquid: strong drag, so sand falls in slow curtains.
      v.mulAssign(exp(uDrag.negate().mul(uDt)));
      XP.element(instanceIndex).assign(X.element(instanceIndex).add(v.mul(uDt)));
    })().compute(N, [64]);

    const clearCnt = Fn(() => { atomicStore(CNT.element(instanceIndex), int(0)); })().compute(CELLS, [64]);

    const insert = Fn(() => {
      const c = cellIdx(XP.element(instanceIndex)).toVar();
      const k = atomicAdd(CNT.element(c), int(1)).toVar();
      If(k.lessThan(CAP), () => { SLOT.element(c.mul(CAP).add(k)).assign(int(instanceIndex)); });
    })().compute(N, [64]);

    const makeSolve = (src, dst) => Fn(() => {
      const i = instanceIndex;
      const p = src.element(i).toVar();
      const disp = p.sub(X.element(i)).toVar();
      const corr = vec2(0).toVar();
      const nC = float(0).toVar();
      const c = clamp(floor(p), vec2(0), vec2(GW - 1, GH - 1)).toVar();
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = int(c.x).add(ox), cy = int(c.y).add(oy);
          If(cx.greaterThanEqual(0).and(cx.lessThan(GW)).and(cy.greaterThanEqual(0)).and(cy.lessThan(GH)), () => {
            const ci = cy.mul(GW).add(cx).toVar();
            const n = min(atomicLoad(CNT.element(ci)), int(CAP)).toVar();
            Loop(n, ({ i: s }) => {
              const j = SLOT.element(ci.mul(CAP).add(s)).toVar();
              If(j.notEqual(int(i)), () => {
                const q = src.element(j).toVar();
                const d = p.sub(q).toVar();
                const dist2 = dot(d, d).toVar();
                If(dist2.lessThan(1.0).and(dist2.greaterThan(1e-8)), () => {
                  const dist = sqrt(dist2);
                  const nrm = d.div(dist).toVar();
                  const pen = float(1.0).sub(dist).toVar();
                  // Shock propagation (Macklin et al. 2014): the lower grain
                  // of a pair counts as heavier, so the upper one takes the
                  // correction and a deep pile holds its shape instead of
                  // sinking into itself between iterations.
                  const share = clamp(dot(d, uUpS).mul(1.6).add(0.5), 0.12, 0.88);
                  corr.addAssign(nrm.mul(pen.mul(share)));
                  // Friction: cancel the relative sliding this substep, in
                  // proportion to how hard the two grains press.
                  const rel = disp.sub(q.sub(X.element(j)));
                  const tan = rel.sub(nrm.mul(dot(rel, nrm)));
                  corr.subAssign(tan.mul(uMu.mul(min(1.0, pen.mul(6.0))).mul(share)));
                  nC.addAssign(share);
                });
              });
            });
          });
        }
      }
      // Averaged over the contacts by their shares: plain Jacobi sums, or
      // any over-relaxation, overshoot and the sand boils off like a gas.
      const np = p.add(corr.div(max(nC, 1.0))).toVar();
      // Bubbles: clear lenses that shove grains out of their way.
      for (let b = 0; b < NB; b++) {
        const B = uBub.element(b);
        const d = np.sub(B.xy).toVar();
        const L = length(d).toVar();
        const rr = B.z.add(R);
        If(B.w.greaterThan(0.5).and(L.lessThan(rr)).and(L.greaterThan(1e-4)), () => {
          np.assign(B.xy.add(d.div(L).mul(rr)));
        });
      }
      // The frame's walls and the divider (except in its gaps).
      np.assign(clamp(np, vec2(R), vec2(W - R, H - R)));
      const dy = np.y.sub(DIV_Y).toVar();
      If(abs(dy).lessThan(DIV_T + R).and(gapOpen(np.x).lessThan(0.5)), () => {
        np.y.assign(float(DIV_Y).add(sign(dy.add(1e-4)).mul(DIV_T + R)));
      });
      dst.element(i).assign(np);
      NCON.element(i).assign(nC);
    })().compute(N, [64]);

    const solveA = makeSolve(XP, XQ);
    const solveB = makeSolve(XQ, XP);

    const finalize = Fn(() => {
      const xn = XP.element(instanceIndex);
      const v = xn.sub(X.element(instanceIndex)).div(uDt).toVar();
      // A grain held in the pile keeps almost none of the velocity its
      // corrections gave it: without this the pile heats up, grain by grain,
      // until it boils off like a gas.
      v.mulAssign(mix(1.0, 0.25, smoothstep(0.6, 1.6, NCON.element(instanceIndex))));
      // No grain outruns the solver.
      v.mulAssign(min(1.0, float(160).div(max(length(v), 1e-4))));
      V.element(instanceIndex).assign(v);
      X.element(instanceIndex).assign(xn);
    })().compute(N, [64]);

    // -------------------------------------------------------- rendering
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
    const pivot = new THREE.Group();      // the frame, turned during a flip
    scene.add(pivot);
    const inner = new THREE.Group();      // frame units, origin at the corner
    inner.position.set(-W / 2, -H / 2, 0);
    pivot.add(inner);

    const uSand = [0, 1, 2, 3, 4].map(() => uniform(new THREE.Color()));
    const uLiqTop = uniform(new THREE.Color());
    const uLiqBot = uniform(new THREE.Color());
    const uUp = uniform(new THREE.Vector2(0, 1));    // gravity's up, in frame coordinates
    const uGlint = uniform(0);
    const uGlintSeed = uniform(0);

    // Liquid backdrop, darker at the glass edge; the gradient follows
    // gravity, so after a turn it is the right way up again.
    const bgMat = new THREE.MeshBasicNodeMaterial();
    bgMat.colorNode = Fn(() => {
      const q = uv();
      const h = dot(q.sub(0.5), uUp).mul(1.1).add(0.5);
      const c = mix(uLiqBot, uLiqTop, smoothstep(0.0, 1.0, h));
      const e = min(min(q.x, float(1).sub(q.x)).mul(aspect), min(q.y, float(1).sub(q.y)));
      return c.mul(mix(0.82, 1.0, smoothstep(0.0, 0.035, e)));
    })();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat);
    bg.position.set(W / 2, H / 2, -1);
    inner.add(bg);

    // The divider: a dark strip with its gaps cut out.
    const divMat = new THREE.MeshBasicNodeMaterial();
    divMat.colorNode = vec3(0.09, 0.075, 0.07);
    divMat.opacityNode = Fn(() => float(1).sub(gapOpen(uv().x.mul(W))))();
    divMat.transparent = true;
    const div = new THREE.Mesh(new THREE.PlaneGeometry(W, DIV_T * 2), divMat);
    div.position.set(W / 2, DIV_Y, 0.5);
    inner.add(div);

    const grainMat = new THREE.SpriteNodeMaterial();
    const xa = X.toAttribute();
    const ca = COL.toAttribute();
    grainMat.positionNode = vec3(xa.x, xa.y, 0);
    grainMat.scaleNode = float(1.22);
    grainMat.colorNode = Fn(() => {
      const k = floor(ca);
      const f = ca.sub(k);
      const base = vec3(uSand[0]).toVar();
      for (let s = 1; s < 5; s++) base.assign(mix(base, uSand[s], step(s - 0.5, k)));
      const q = uv().sub(0.5).mul(2);
      const r2 = dot(q, q);
      // A rough bead lit from the top left, with grain-to-grain tone jitter.
      const lit = float(1.0).add(dot(q, vec2(-0.35, 0.45)).mul(0.22)).sub(r2.mul(0.18));
      const tone = f.sub(0.5).mul(0.16).add(1.0);
      const mica = step(0.94, f).mul(uGlint).mul(step(0.5, hash(float(instanceIndex).add(uGlintSeed)))).mul(smoothstep(0.7, 0.0, r2));
      return base.mul(lit).mul(tone).add(vec3(mica.mul(1.6)));
    })();
    grainMat.opacityNode = Fn(() => {
      const q = uv().sub(0.5).mul(2);
      return smoothstep(1.0, 0.72, dot(q, q));
    })();
    grainMat.transparent = true;
    grainMat.depthWrite = false;
    const grainsMesh = new THREE.Sprite(grainMat);
    grainsMesh.count = N;
    grainsMesh.frustumCulled = false;
    grainsMesh.position.z = 0.2;
    inner.add(grainsMesh);

    // Bubbles: clear lenses with a rim and a highlight.
    const bubMat = new THREE.SpriteNodeMaterial();
    bubMat.positionNode = Fn(() => { const B = uBub.element(instanceIndex); return vec3(B.x, B.y, 0); })();
    bubMat.scaleNode = Fn(() => { const B = uBub.element(instanceIndex); return B.z.mul(2.1).mul(B.w); })();
    bubMat.colorNode = vec3(1.0, 1.0, 0.98);
    bubMat.opacityNode = Fn(() => {
      const q = uv().sub(0.5).mul(2);
      const r = length(q);
      const rim = smoothstep(0.8, 0.95, r).mul(smoothstep(1.0, 0.95, r));
      const hl = smoothstep(0.35, 0.0, length(q.sub(vec2(-0.35, 0.38))));
      return rim.mul(0.65).add(hl.mul(0.8)).add(smoothstep(1.0, 0.9, r).mul(0.1));
    })();
    bubMat.transparent = true;
    bubMat.depthWrite = false;
    const bubbles = new THREE.Sprite(bubMat);
    bubbles.count = NB;
    bubbles.frustumCulled = false;
    bubbles.position.z = 0.4;
    inner.add(bubbles);

    // ---------------------------------------------------------- the music
    const holes = new Array(HOLES).fill(0).map(() => ({ burst: 0, base: 0.6 + Math.random() * 0.8 }));
    const bubs = new Array(NB).fill(0).map(() => ({ x: -100, y: -100, r: 0, v: 0, alive: 0 }));
    let bubNext = 0, holeNext = 0;
    let flipAngle = 0, flipTarget = 0;
    let wasDrop = false;
    let sinceFlip = 0;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) % 100000) / 100000;

    return {
      frame(f) {
        const { dt, ears, P: Pm } = f;
        const push = Pm.push;
        const pal = SANDS[Math.max(0, Math.min(SANDS.length - 1, Math.round(Pm.sands)))];
        for (let i = 0; i < 5; i++) uSand[i].value.set(pal.sand[i]);
        uLiqTop.value.set(pal.liquid[0]);
        uLiqBot.value.set(pal.liquid[1]);

        // Turning the frame over: on the drop, and by itself every so often
        // once the top has had time to run out.
        sinceFlip += dt;
        const dropStart = ears.dropOn && !wasDrop;
        wasDrop = ears.dropOn;
        if ((dropStart && Pm.turn > 0.5 && sinceFlip > 8) || sinceFlip > 75) { flipTarget += Math.PI; sinceFlip = 0; }
        flipAngle += (flipTarget - flipAngle) * (1 - Math.exp(-dt * 1.9));
        if (Math.abs(flipTarget - flipAngle) < 1e-3) flipAngle = flipTarget;
        // Gravity in frame coordinates turns against the frame.
        const gA = -Math.PI / 2 - flipAngle;
        uG.value.set(Math.cos(gA) * 230, Math.sin(gA) * 230);
        uUp.value.set(-Math.cos(gA), -Math.sin(gA));
        uUpS.value.copy(uUp.value);
        // Keep the turning rectangle inside the stage.
        const c = Math.abs(Math.cos(flipAngle)), s = Math.abs(Math.sin(flipAngle));
        const zoom = Math.max((W * c + H * s) / W, (W * s + H * c) / H);
        pivot.rotation.z = flipAngle;
        pivot.scale.setScalar(1 / zoom);

        // Gaps in the divider: bass widens them, a clap bursts one open.
        if (ears.snare && push > 0.05) { holes[holeNext % HOLES].burst = 1; holeNext += 2; }
        const flow = Pm.flow;
        for (let h = 0; h < HOLES; h++) {
          const hl = holes[h];
          hl.burst *= Math.exp(-dt / 0.35);
          uHoleW.array[h] = (flow > 0.02 ? 1.2 + 3.2 * flow * hl.base + 2.2 * ears.bass * push * flow : 0) + 11 * hl.burst * Math.min(1.5, push);
        }

        // Bubbles: a kick sends one (two on the drop) up from the bottom of
        // whichever way is down now; they burst against the divider.
        const up = uUp.value;
        if (ears.kick && Pm.bubbles > 0.05) {
          const count = Pm.bubbles > 1.2 ? 2 : 1;
          for (let k = 0; k < count; k++) {
            const b = bubs[bubNext++ % NB];
            b.r = (4 + 3 * ears.kickAmp) * Math.min(1.4, 0.6 + 0.4 * Pm.bubbles) * Math.min(1.4, push);
            b.x = W * (0.1 + 0.8 * rnd());
            b.y = up.y > 0 ? b.r + 1 : H - b.r - 1;
            b.v = 0;
            b.alive = 1;
          }
        }
        for (let k = 0; k < NB; k++) {
          const b = bubs[k];
          if (b.alive) {
            b.v = Math.min(95, b.v + 260 * dt);
            b.y += (up.y > 0 ? 1 : -1) * b.v * dt;
            b.x += Math.sin(b.y * 0.12 + k) * 0.25;
            if (up.y > 0 ? b.y > DIV_Y - DIV_T - b.r : b.y < DIV_Y + DIV_T + b.r) b.alive = 0;
          }
          uBub.array[k].set(b.x, b.y, b.r, b.alive);
        }

        uMu.value = 0.25 + 0.75 * Pm.friction;
        uGlint.value = Math.min(1.2, ears.hatEnv * Pm.glint * 1.6);
        uGlintSeed.value = Math.floor(rnd() * 10007);

        const sub = 2;
        uDt.value = Math.min(dt, 1 / 30) / sub;
        for (let st = 0; st < sub; st++) {
          renderer.compute([predict, clearCnt, insert, solveA, solveB, solveA, solveB, solveA, solveB, finalize]);
        }

        renderer.setRenderTarget(null);
        renderer.setClearColor(0x2a2724, 1);
        renderer.render(scene, cam);
      },
      dispose() {
        for (const m of [bgMat, divMat, grainMat, bubMat]) m.dispose();
        for (const b of [X, V, XP, XQ, COL, CNT, SLOT]) if (b.value && b.value.dispose) b.value.dispose();
      },
    };
  }

  VIZ.register({
    id: 'gpu2',
    name: 'Sand Picture',
    order: 1117,
    params: [
      { key: 'flow', label: 'Sand running through', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'bubbles', label: 'Bubbles on the kick', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'friction', label: 'Grip: slides to dunes', type: 'range', min: 0, max: 1, default: 0.7, step: 0.01 },
      { key: 'glint', label: 'Mica glint', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'turn', label: 'Turn over on the drop', type: 'range', min: 0, max: 1, default: 1, step: 1 },
      { key: 'sands', label: 'Sands', type: 'select', options: SANDS.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.2, halation: 0.4 },

    gallery: {
      title: 'Sand Picture',
      technique: 'three.js 0.186.1 WebGPU compute (TSL): over a hundred thousand grains of sand as position-based dynamics, each substep scattered into a uniform hash grid with atomic counters and resolved against the 3x3 neighbouring cells (overlap and friction, double-buffered Jacobi with over-relaxation) under liquid drag, gravity that turns with the frame, a divider with gaps and moving bubble obstacles; grains drawn as shaded sprites straight from the storage buffer.',
      brief: 'The moving sand picture from a 1970s desk: coloured sand in clear liquid between two panes, draining through gaps in a divider and piling into strata that read as mountain ranges at dusk. Every kick sends an air bubble up from the bottom that bores through the piles and throws a plume of sand aside; claps burst one gap open for a curtain of sand; hats glint the mica; the bass widens the gaps. On the drop the frame turns over, the old landscape becomes the new sand supply, and bubbles come in pairs.',
      lineage: 'Moving sand art frames, the 1970s desk toys; granular position-based dynamics after Macklin et al.\'s unified particle physics (2014); GPU uniform-grid neighbour search after Green\'s CUDA particles (2008).',
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      const done = () => { if (hold) p._decrementPreload(); };
      loadKit().then((k) => k.warm(hold)).then(done, (e) => { console.error('gpu2: kit did not load', e); done(); });
    },
    enter() { if (kit) kit.enter(this); },
    leave() { if (kit) kit.leave(this); },
    draw(p, signals, params, ctx) {
      if (!kit) { loadKit(); p.background(SPEC.ground); return; }
      kit.draw(this, SPEC, p, signals, params, ctx);
    },
  });
})();
