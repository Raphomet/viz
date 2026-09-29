// Stained Slide: a living tissue section under the microscope, in
// haematoxylin and eosin. Cells, membranes and nuclei assemble themselves,
// chase, divide and dissolve, drifting across the field on a slow current.
//
// The medium (harness/briefs/batch-08-libraries.md): Particle Life at a
// scale only compute reaches, 98,304 particles of up to eight species, each
// feeling every neighbour within one interaction radius through a
// species-by-species attraction matrix. Every frame the particles are
// scattered into a wrapped uniform grid with atomic counters, then each one
// walks the 3x3 cells around it (a couple of hundred candidates) and sums the
// forces. The tissue is emergent: nothing draws a cell.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a pulse from the pipette: a ring pushed outward at one spot in
//           the field, which the tissue then closes over
//   clap    one species changes its rules (its row of the matrix is re-dealt
//           and blended in), so part of the tissue starts behaving anew
//   hats    the granules shiver
//   bass    the whole culture is livelier (force scale)
//   drop    with Follow the track: two more species wake up (saffron and a
//           deep magenta, the "S" of an HES stain), the current quickens
//
// Rendering: each particle is splatted as optical density (Beer-Lambert
// absorbance of its stain) into a half-resolution float target; one pass
// turns that into transmitted light through the slide, with a faint darker
// rim where density changes fast, as membranes read under a microscope.
(function () {
  'use strict';

  const KIT_URL = new URL('../gpu-kit.js', document.currentScript.src).href;
  let kit = null;
  const loadKit = () => (window.__vizGpuKit = window.__vizGpuKit || import(KIT_URL)).then((m) => (kit = m));

  const S = 8;   // species

  // Stains: the colour each species transmits at full density, its sprite
  // size (interaction radii) and its density. Species 6 and 7 wake on the drop.
  const STAINS = [
    { name: 'H&E (and saffron)', paper: '#F6F0F1', colors: ['#3E2F7E', '#E58AB2', '#C9467F', '#4A2A6A', '#F3B7CC', '#6C5AA8', '#D9A035', '#8E2A6A'] },
    { name: 'Masson trichrome', paper: '#F4F1EC', colors: ['#2A1E2E', '#D8484E', '#2F6DB5', '#3A2A3E', '#8DB6DE', '#B8323C', '#E0B040', '#1F4F8F'] },
    { name: 'Giemsa', paper: '#F3F0F4', colors: ['#3C2F8C', '#D98CB8', '#7B5CC0', '#2E2270', '#E9C1DA', '#5A7BD0', '#C77FB0', '#433A9A'] },
  ];
  const SIZE = [0.34, 1.2, 0.6, 0.26, 1.1, 0.45, 0.7, 0.4];
  const OD = [0.6, 0.85, 0.7, 0.5, 0.6, 0.45, 0.7, 0.6];

  const PRESETS = {
    calm: { activity: 0.55, current: 0.3, species: 6, mutate: 0.6, push: 1 },
    drop: { activity: 0.85, current: 0.7, species: 8, mutate: 1, push: 1.2 },
  };
  const DRIVE = ['activity', 'current', 'species', 'mutate'];

  const SPEC = { ground: '#f6f0f1', drive: DRIVE, drop: PRESETS.drop, build };

  function build(env) {
    const { THREE, TSL, renderer, aspect } = env;
    const {
      Fn, If, Loop, instancedArray, instanceIndex, uniform, uniformArray, float, int, vec2, vec3, vec4,
      atomicAdd, atomicStore, atomicLoad, max, min, clamp, mix, smoothstep, hash, uv, dot, exp, sqrt,
      floor, abs, length, texture, sin, cos, step, round,
    } = TSL;

    // ---------------------------------------------------------- the field
    // Units: one interaction radius. The field wraps (a torus), so the
    // current can carry tissue across the frame for ever.
    const GW = 72;
    const GH = Math.round(GW / aspect);
    const CELLS = GW * GH;
    const CAP = 128;
    const N = 98304;
    const BETA = 0.3;

    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    const pos = new Float32Array(N * 2), spc = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 2] = rnd() * GW; pos[i * 2 + 1] = rnd() * GH;
      spc[i] = i % S;
    }
    const X = instancedArray(pos, 'vec2');
    const V = instancedArray(N, 'vec2');
    const SP = instancedArray(spc, 'float');
    const CNT = instancedArray(CELLS, 'int').toAtomic();
    const SLOT = instancedArray(CELLS * CAP, 'int');

    // The rules: attraction of species a toward b, and how awake each is.
    const mat = new Array(S * S).fill(0).map(() => rnd() * 2 - 1);
    const target = mat.slice();
    const uM = uniformArray(mat.slice(), 'float');
    const uAct = uniformArray(new Array(S).fill(1), 'float');
    const uDt = uniform(1 / 60);
    const uForce = uniform(30);
    const uFric = uniform(0.04);           // velocity half-life, s
    const uFlow = uniform(new THREE.Vector2(0, 0));
    const uPulse = uniform(new THREE.Vector4(0, 0, 0, 12));   // x, y, strength, radius
    const uJit = uniform(0);
    const uSeed = uniform(0);

    const wrapD = (d) => d.sub(round(d.div(vec2(GW, GH))).mul(vec2(GW, GH)));

    const clearCnt = Fn(() => { atomicStore(CNT.element(instanceIndex), int(0)); })().compute(CELLS, [64]);
    const insert = Fn(() => {
      const p = X.element(instanceIndex);
      const c = clamp(floor(p), vec2(0), vec2(GW - 1, GH - 1));
      const ci = int(c.y).mul(GW).add(int(c.x)).toVar();
      const k = atomicAdd(CNT.element(ci), int(1)).toVar();
      If(k.lessThan(CAP), () => { SLOT.element(ci.mul(CAP).add(k)).assign(int(instanceIndex)); });
    })().compute(N, [64]);

    const step_ = Fn(() => {
      const i = instanceIndex;
      const p = X.element(i).toVar();
      const si = int(SP.element(i)).toVar();
      const actI = uAct.element(si);
      const F = vec2(0).toVar();
      const cx0 = int(floor(p.x)), cy0 = int(floor(p.y));
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = cx0.add(ox).add(GW).mod(GW);
          const cy = cy0.add(oy).add(GH).mod(GH);
          const ci = cy.mul(GW).add(cx).toVar();
          const n = min(atomicLoad(CNT.element(ci)), int(CAP)).toVar();
          Loop(n, ({ i: s }) => {
            const j = SLOT.element(ci.mul(CAP).add(s)).toVar();
            If(j.notEqual(int(i)), () => {
              const d = wrapD(X.element(j).sub(p)).toVar();
              const r = length(d).toVar();
              If(r.lessThan(1.0).and(r.greaterThan(1e-4)), () => {
                const sj = int(SP.element(j));
                const actJ = uAct.element(sj);
                const a = uM.element(si.mul(S).add(sj)).mul(actJ);
                // The Particle Life kernel: hard repulsion inside BETA, then
                // a tent of attraction (or repulsion) set by the matrix.
                // The core is several times stiffer than the canonical kernel, so a
                // clump cannot fall into itself past what the grid can hold.
                const rep = r.div(BETA).sub(1.0).mul(3.5);
                const att = a.mul(float(1).sub(abs(r.mul(2).sub(1 + BETA)).div(1 - BETA)));
                const f = r.lessThan(BETA).select(rep, att);
                F.addAssign(d.div(r).mul(f).mul(max(actJ, 0.25)));
              });
            });
          });
        }
      }
      const v = V.element(i).toVar();
      v.mulAssign(exp(float(-0.6931).mul(uDt).div(uFric)));
      v.addAssign(F.mul(uForce).mul(uDt).mul(actI.mul(0.85).add(0.15)));
      // The pipette pulse: an outward push in a ring around one spot.
      const dp = wrapD(p.sub(uPulse.xy)).toVar();
      const rp = length(dp);
      v.addAssign(dp.div(max(rp, 0.3)).mul(uPulse.z).mul(exp(rp.div(uPulse.w).pow(2).negate())));
      // Granules shiver on the hats.
      const jit = si.equal(3).select(uJit, uJit.mul(0.15));
      const h1 = hash(float(i).add(uSeed)), h2 = hash(float(i).add(uSeed).add(3.7));
      v.addAssign(vec2(h1.sub(0.5), h2.sub(0.5)).mul(jit));
      V.element(i).assign(v);
      const np = p.add(v.add(uFlow).mul(uDt));
      X.element(i).assign(np.sub(floor(np.div(vec2(GW, GH))).mul(vec2(GW, GH))));
    })().compute(N, [64]);

    // -------------------------------------------------------- rendering
    const RS = 0.5;
    let rw = Math.max(2, Math.round(env.w * RS)), rh = Math.max(2, Math.round(env.h * RS));
    const rt = new THREE.RenderTarget(rw, rh, { type: THREE.HalfFloatType, depthBuffer: false });
    const splatScene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(0, GW, GH, 0, -1, 1);
    const uAbs = uniformArray(new Array(S).fill(0).map(() => new THREE.Vector3()), 'vec3');
    const uSize = uniformArray(SIZE.slice(), 'float');
    const uOD = uniformArray(OD.slice(), 'float');
    const splatMat = new THREE.SpriteNodeMaterial();
    const xa = X.toAttribute();
    const sa = SP.toAttribute();
    splatMat.positionNode = vec3(xa.x, xa.y, 0);
    splatMat.scaleNode = Fn(() => uSize.element(int(sa)).mul(uAct.element(int(sa)).mul(0.6).add(0.4)))();
    splatMat.fragmentNode = Fn(() => {
      const q = uv().sub(0.5).mul(2);
      const w = exp(dot(q, q).mul(-3.5)).mul(smoothstep(1.0, 0.8, dot(q, q)));
      const k = int(sa);
      return vec4(uAbs.element(k).mul(uOD.element(k)).mul(uAct.element(k)).mul(w), 0);
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
    sprites.count = N;
    sprites.frustumCulled = false;
    splatScene.add(sprites);

    const uPaper = uniform(new THREE.Color());
    const uTexel = uniform(new THREE.Vector2(1 / rw, 1 / rh));
    const tex = (o) => texture(rt.texture, uv().add(o)).xyz;
    const dispMat = new THREE.MeshBasicNodeMaterial();
    dispMat.colorNode = Fn(() => {
      // Dense clumps saturate toward the stain's own colour instead of going
      // black: the absorbance vector is compressed as a whole, keeping hue.
      const comp = (od) => {
        const m = max(max(od.x, od.y), max(od.z, 1e-4));
        return od.mul(float(2.1).mul(float(1).sub(exp(m.div(-2.1)))).div(m));
      };
      const odc = comp(tex(vec2(0))).toVar();
      // Membranes: density that changes fast reads as a darker rim.
      const o = uTexel.mul(1.5);
      const gx = comp(tex(vec2(o.x, 0))).sub(comp(tex(vec2(o.x.negate(), 0))));
      const gy = comp(tex(vec2(0, o.y))).sub(comp(tex(vec2(0, o.y.negate()))));
      const edge = sqrt(dot(gx, gx).add(dot(gy, gy)));
      const lit = uPaper.mul(exp(odc.negate().sub(vec3(edge.mul(0.4)))));
      // The microscope's field: brightest in the middle.
      const c = uv().sub(0.5).mul(vec2(aspect, 1));
      return lit.mul(float(1).sub(dot(c, c).mul(0.1)));
    })();
    const quad = new THREE.QuadMesh(dispMat);

    // ---------------------------------------------------------- the music
    let pulseStr = 0, pulseX = GW / 2, pulseY = GH / 2, pulseR = 8;
    let flowAng = rnd() * Math.PI * 2;
    let mutating = -1;
    const act = new Array(S).fill(1);
    let snaresSeen = 0;

    return {
      frame(f) {
        const { dt, t, ears, P: Pm } = f;
        const push = Pm.push;
        const st = STAINS[Math.max(0, Math.min(STAINS.length - 1, Math.round(Pm.stain)))];
        const c = new THREE.Color();
        for (let k = 0; k < S; k++) {
          c.set(st.colors[k]);
          uAbs.array[k].set(-Math.log(Math.max(0.02, c.r)), -Math.log(Math.max(0.02, c.g)), -Math.log(Math.max(0.02, c.b)));
        }
        uPaper.value.set(st.paper);

        // Which species are awake: the first `species` of them, fading.
        const nAwake = Math.max(3, Math.min(S, Pm.species));
        for (let k = 0; k < S; k++) {
          const want = k < Math.floor(nAwake) ? 1 : k < nAwake ? nAwake - Math.floor(nAwake) : 0;
          act[k] += (want - act[k]) * (1 - Math.exp(-dt * 0.8));
          uAct.array[k] = act[k];
        }

        // Clap: re-deal one species' rules; blend them in over a second.
        if (ears.snare && Pm.mutate > 0.02 && push > 0.05) {
          const k = snaresSeen++ % Math.floor(nAwake);
          for (let b = 0; b < S; b++) target[k * S + b] = mat[k * S + b] * (1 - Pm.mutate) + (rnd() * 2 - 1) * Pm.mutate;
          mutating = k;
        }
        for (let q = 0; q < S * S; q++) {
          mat[q] += (target[q] - mat[q]) * (1 - Math.exp(-dt * 2.5));
          uM.array[q] = mat[q];
        }

        // Kick: the pipette pulses at a spot that wanders the field.
        if (ears.kick) {
          pulseStr = 18 * ears.kickAmp * Math.min(1.6, push);
          // A new spot each beat, well away from the last, so each ring has
          // time to close instead of the pulses boring one lasting hole.
          pulseX = (pulseX + GW * (0.3 + 0.4 * rnd())) % GW;
          pulseY = GH * (0.2 + 0.6 * rnd());
          pulseR = 2.4 + 1.0 * ears.kickAmp;
        }
        pulseStr *= Math.exp(-dt / 0.1);
        uPulse.value.set(pulseX, pulseY, pulseStr, pulseR);

        uForce.value = (4 + 16 * Pm.activity) * (0.75 + 0.6 * ears.bass * push);
        flowAng += dt * 0.02;
        const fl = 0.9 * Pm.current;
        uFlow.value.set(Math.cos(flowAng) * fl, Math.sin(flowAng) * fl * 0.6);
        uJit.value = 30 * Math.min(1.2, ears.hatEnv) * push;
        uSeed.value = Math.floor(rnd() * 100000);
        uDt.value = Math.min(dt, 1 / 30);

        renderer.compute([clearCnt, insert, step_]);

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
        for (const b of [X, V, SP, CNT, SLOT]) if (b.value && b.value.dispose) b.value.dispose();
      },
    };
  }

  VIZ.register({
    id: 'gpu3',
    name: 'Stained Slide',
    order: 1118,
    params: [
      { key: 'activity', label: 'Life', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'current', label: 'Current across the slide', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'species', label: 'Species awake', type: 'range', min: 3, max: 8, default: 6, step: 1 },
      { key: 'mutate', label: 'Rule change on the clap', type: 'range', min: 0, max: 1, default: 0.7, step: 0.01 },
      { key: 'stain', label: 'Stain', type: 'select', options: STAINS.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.1, halation: 0.25, grain: 0.6 },

    gallery: {
      title: 'Stained Slide',
      technique: 'three.js 0.186.1 WebGPU compute (TSL): Particle Life with 98,304 particles of eight species on a wrapped field, scattered each frame into a uniform grid with atomic counters and summed over every neighbour within the interaction radius through an 8x8 attraction matrix; splatted as Beer-Lambert optical density into a half-float target and shown as light through a stained slide.',
      brief: 'A living tissue section in haematoxylin and eosin: cells, membranes and nuclei that assemble themselves, chase, divide and drift across the field on a slow current. Every kick is a pulse from a pipette that clears a ring at one spot for the tissue to close over; every clap re-deals one species\' rules so part of the tissue starts behaving anew; hats make the granules shiver; the bass makes the culture livelier. On the drop two more species wake, saffron and deep magenta, and the current quickens.',
      lineage: 'Particle Life (Jeffrey Ventrella\'s Clusters, Tom Mohr\'s particle-life); histology\'s H&E and HES stains; GPU uniform-grid neighbour search after Green (2008).',
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      const done = () => { if (hold) p._decrementPreload(); };
      loadKit().then((k) => k.warm(hold)).then(done, (e) => { console.error('gpu3: kit did not load', e); done(); });
    },
    enter() { if (kit) kit.enter(this); },
    leave() { if (kit) kit.leave(this); },
    draw(p, signals, params, ctx) {
      if (!kit) { loadKit(); p.background(SPEC.ground); return; }
      kit.draw(this, SPEC, p, signals, params, ctx);
    },
  });
})();
