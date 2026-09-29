// Watershed: a mountain range being carved by rain, seen from the air as a
// printed relief map comes alive. Every beat's storm lights up the drainage
// network where it falls; over minutes the rivers cut their valleys deeper
// and the ridges sharpen.
//
// The medium (harness/briefs/batch-08-libraries.md): hydraulic erosion by
// tens of thousands of raindrops a frame, each one a GPU thread that runs
// its whole life in one dispatch (up to 40 steps downhill, picking up and
// dropping sediment) and writes its erosion, deposition and water straight
// into the shared heightmap with integer atomics. Scatter writes from
// thousands of independent walkers into one grid are exactly what compute
// adds; a fragment shader can only gather.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a storm cell bursts over one part of the range: that watershed's
//           streams light up blue, and fade as the water drains
//   clap    a ring runs out from the storm across the map, bolding the
//           contour lines it passes
//   hats    sun glints on the water
//   bass    the steady rain over the whole range (every stream swells)
//   drop    with Follow the track: heavier storms, two at once, the flight
//           comes lower and faster, the rivers cut faster
//
// Rendering: after the rain, one pass writes height, slope normal and water
// into a half-float storage texture; a 512x512 grid mesh reads it for its
// height, and its material draws a Swiss-style relief map in daylight:
// hypsometric tints, hillshade from the north-west, engraved contours, the
// sea, and rivers from the water flux.
(function () {
  'use strict';

  const KIT_URL = new URL('../gpu-kit.js', document.currentScript.src).href;
  let kit = null;
  const loadKit = () => (window.__vizGpuKit = window.__vizGpuKit || import(KIT_URL)).then((m) => (kit = m));

  const TAU = Math.PI * 2;

  // Tints from sea level to the peaks, the sea, the rivers and the sky (sRGB).
  const MAPS = [
    { name: 'Swiss relief', tints: ['#9DB08A', '#C9C29A', '#D8C3A0', '#BDB0A2', '#F3F0EA'], sea: '#7FA7BC', river: '#2F6F9E', sky: ['#C9D6DC', '#EDE8DE'] },
    { name: 'Autumn survey', tints: ['#A7A96C', '#D3B06E', '#C98A5A', '#9E8373', '#EFE7DC'], sea: '#6E95A6', river: '#23577D', sky: ['#D8D2C6', '#F1E9DC'] },
    { name: 'Blueprint', tints: ['#DDE6EE', '#CFDCE8', '#BFD0E0', '#AFC3D8', '#F5F8FB'], sea: '#9FB8CF', river: '#1E4E86', sky: ['#E3EAF1', '#F4F6F8'] },
  ];

  const PRESETS = {
    calm: { rain: 0.35, storm: 0.8, carve: 0.4, fly: 0.3, relief: 0.6, push: 1 },
    drop: { rain: 0.8, storm: 1.6, carve: 0.9, fly: 0.8, relief: 0.75, push: 1.2 },
  };
  const DRIVE = ['rain', 'storm', 'carve', 'fly', 'relief'];

  const SPEC = { ground: '#d9dcd8', drive: DRIVE, drop: PRESETS.drop, build };

  function build(env) {
    const { THREE, TSL, renderer, aspect } = env;
    const {
      Fn, If, Loop, Break, instancedArray, instanceIndex, uniform, float, int, uint, vec2, vec3, vec4, uvec2,
      atomicAdd, atomicStore, atomicLoad, max, min, clamp, mix, smoothstep, hash, uv, dot, normalize, exp,
      sqrt, floor, fract, abs, length, texture, textureStore, sin, cos, pow, step, positionLocal, positionWorld,
      cameraPosition,
    } = TSL;

    // ------------------------------------------------------------ the land
    const G = 512;                 // cells a side
    const CELLS = G * G;
    const FIX = 1e4;               // fixed point for the height atomics
    const HMAX = 60;               // tallest peak, in cells
    const SEA = 0.16 * HMAX;

    // Initial range: ridged fBm with a coast, generated once here.
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const lat = new Float32Array(257 * 257).map(() => rnd());
    const vnoise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const h = (i, j) => lat[(((j % 256) + 256) % 256) * 257 + (((i % 256) + 256) % 256)];
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
    };
    const h0 = new Float32Array(CELLS);
    const hi = new Int32Array(CELLS);
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const u = x / G, v = y / G;
        let f = 0, a = 0.5, fr = 3, w = 0;
        for (let o = 0; o < 6; o++) {
          const r = 1 - Math.abs(vnoise(u * fr + o * 17.3, v * fr + o * 5.1) * 2 - 1);
          f += a * r * r; w += a; a *= 0.5; fr *= 2.03;
        }
        f /= w;
        // A range down the middle.
        const ridge = Math.exp(-Math.pow((u - 0.5 + 0.12 * Math.sin(v * 5.5)) / 0.34, 2));
        // An island: every edge falls to the sea, so the flight never sees
        // the end of the world, only coast.
        const coast = Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 5.5);
        const h = HMAX * (0.08 + 0.92 * f * (0.35 + 0.65 * ridge)) * (0.25 + 0.75 * coast);
        h0[y * G + x] = h;
        hi[y * G + x] = Math.round(h * FIX);
      }
    }

    const HT = instancedArray(hi, 'int').toAtomic();      // live height, fixed point
    const H0 = instancedArray(h0, 'float');                // the range's "memory" (uplift target)
    const HN = instancedArray(CELLS, 'float');             // scratch for the relaxation pass
    const WAT = instancedArray(CELLS, 'int').toAtomic();   // water through each cell this frame
    const FLX = instancedArray(CELLS, 'float');            // smoothed water flux, for the rivers

    const tex = new THREE.StorageTexture(G, G);
    tex.type = THREE.HalfFloatType;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;

    const uSeed = uniform(0);
    const uStorm = uniform(new THREE.Vector4(0, 0, 40, 0));   // x, y, radius, droplets in it
    const uStorm2 = uniform(new THREE.Vector4(0, 0, 40, 0));
    const uErode = uniform(0.02);
    const uRelax = uniform(0.002);

    const hAt = (ix, iy) => float(atomicLoad(HT.element(clamp(iy, 0, G - 1).mul(G).add(clamp(ix, 0, G - 1))))).div(FIX);
    const addAt = (ix, iy, amt) => {
      atomicAdd(HT.element(clamp(iy, 0, G - 1).mul(G).add(clamp(ix, 0, G - 1))), int(amt.mul(FIX)));
    };

    // One raindrop per thread, its whole life in one invocation (after
    // Hans Theobald Beyer's and Sebastian Lague's droplet erosion).
    const rain = Fn(() => {
      const fi = float(instanceIndex).add(uSeed);
      const r1 = hash(fi), r2 = hash(fi.add(1.37)), r3 = hash(fi.add(2.71));
      const inS1 = float(instanceIndex).lessThan(uStorm.w);
      const inS2 = float(instanceIndex).lessThan(uStorm.w.add(uStorm2.w)).and(inS1.not());
      const a = r1.mul(TAU), rr = sqrt(r2);
      const pos = vec2(r1, r2).mul(G - 2).add(1).toVar();
      If(inS1, () => { pos.assign(uStorm.xy.add(vec2(cos(a), sin(a)).mul(rr.mul(uStorm.z)))); });
      If(inS2, () => { pos.assign(uStorm2.xy.add(vec2(cos(a), sin(a)).mul(rr.mul(uStorm2.z)))); });
      const dir = vec2(0).toVar();
      const speed = float(1).toVar();
      const water = float(1).toVar();
      const sed = float(0).toVar();
      Loop(40, () => {
        If(pos.x.lessThan(1).or(pos.y.lessThan(1)).or(pos.x.greaterThan(G - 2)).or(pos.y.greaterThan(G - 2)), () => { Break(); });
        const ix = int(floor(pos.x)).toVar(), iy = int(floor(pos.y)).toVar();
        const fx = fract(pos.x).toVar(), fy = fract(pos.y).toVar();
        const hNW = hAt(ix, iy).toVar(), hNE = hAt(ix.add(1), iy).toVar();
        const hSW = hAt(ix, iy.add(1)).toVar(), hSE = hAt(ix.add(1), iy.add(1)).toVar();
        const gx = mix(hNE.sub(hNW), hSE.sub(hSW), fy);
        const gy = mix(hSW.sub(hNW), hSE.sub(hNE), fx);
        const h = mix(mix(hNW, hNE, fx), mix(hSW, hSE, fx), fy).toVar();
        If(h.lessThan(SEA), () => { Break(); });   // reached the sea
        dir.assign(dir.mul(0.08).sub(vec2(gx, gy).mul(0.92)));
        const dl = length(dir);
        If(dl.lessThan(1e-5), () => { Break(); });
        dir.divAssign(dl);
        const np = pos.add(dir).toVar();
        const nh = mix(mix(hAt(int(floor(np.x)), int(floor(np.y))), hAt(int(floor(np.x)).add(1), int(floor(np.y))), fract(np.x)),
          mix(hAt(int(floor(np.x)), int(floor(np.y)).add(1)), hAt(int(floor(np.x)).add(1), int(floor(np.y)).add(1)), fract(np.x)), fract(np.y));
        const dh = nh.sub(h).toVar();
        const cap = max(dh.negate(), 0.02).mul(speed).mul(water).mul(4.0).toVar();
        If(sed.greaterThan(cap).or(dh.greaterThan(0)), () => {
          const amt = dh.greaterThan(0).select(min(dh, sed), sed.sub(cap).mul(0.3)).toVar();
          sed.subAssign(amt);
          const am = amt.mul(uErode.mul(3));
          addAt(ix, iy, am.mul(float(1).sub(fx)).mul(float(1).sub(fy)));
          addAt(ix.add(1), iy, am.mul(fx).mul(float(1).sub(fy)));
          addAt(ix, iy.add(1), am.mul(float(1).sub(fx)).mul(fy));
          addAt(ix.add(1), iy.add(1), am.mul(fx).mul(fy));
        }).Else(() => {
          const amt = min(cap.sub(sed).mul(0.3), dh.negate()).toVar();
          sed.addAssign(amt);
          const am = amt.mul(uErode.mul(3)).negate();
          addAt(ix, iy, am.mul(float(1).sub(fx)).mul(float(1).sub(fy)));
          addAt(ix.add(1), iy, am.mul(fx).mul(float(1).sub(fy)));
          addAt(ix, iy.add(1), am.mul(float(1).sub(fx)).mul(fy));
          addAt(ix.add(1), iy.add(1), am.mul(fx).mul(fy));
        });
        atomicAdd(WAT.element(iy.mul(G).add(ix)), int(water.mul(100)));
        speed.assign(sqrt(max(speed.mul(speed).add(dh.negate().mul(4)), 0.0)));
        water.mulAssign(0.975);
        pos.assign(np);
      });
    })().compute(1, [64]);

    // Uplift toward the range's memory, and a talus slump where the slope
    // is steeper than loose rock stands: without both the range would be
    // worn flat in a minute, or pitted with droplet holes.
    const relax = Fn(() => {
      const i = int(instanceIndex);
      const x = i.mod(G), y = i.div(G);
      const h = hAt(x, y).toVar();
      const hl = hAt(x.sub(1), y), hr = hAt(x.add(1), y), hd = hAt(x, y.sub(1)), hu = hAt(x, y.add(1));
      const avg = hl.add(hr).add(hd).add(hu).mul(0.25);
      const steep = max(max(abs(hl.sub(h)), abs(hr.sub(h))), max(abs(hd.sub(h)), abs(hu.sub(h))));
      const slump = smoothstep(1.6, 3.0, steep).mul(0.25).add(0.02);
      const nh = h.add(avg.sub(h).mul(slump)).add(H0.element(i).sub(h).mul(uRelax));
      HN.element(i).assign(nh);
    })().compute(CELLS, [64]);
    const commit = Fn(() => {
      atomicStore(HT.element(instanceIndex), int(HN.element(instanceIndex).mul(FIX)));
    })().compute(CELLS, [64]);

    // Height, slope and water into the texture the map is drawn from.
    const prep = Fn(() => {
      const i = int(instanceIndex);
      const x = i.mod(G), y = i.div(G);
      const h = hAt(x, y);
      const dx = hAt(x.add(1), y).sub(hAt(x.sub(1), y)).mul(0.5);
      const dy = hAt(x, y.add(1)).sub(hAt(x, y.sub(1))).mul(0.5);
      const w = float(atomicLoad(WAT.element(i))).div(100);
      atomicStore(WAT.element(i), int(0));
      const f = FLX.element(i).mul(0.9).add(w.mul(0.1)).toVar();
      FLX.element(i).assign(f);
      textureStore(tex, uvec2(uint(x), uint(y)), vec4(h, dx, dy, f)).toWriteOnly();
    })().compute(CELLS, [64]);

    // ------------------------------------------------------------ the map
    const SIZE = 100;             // world units across the grid
    const VS = SIZE / G;          // world units per cell
    const uTint = [0, 1, 2, 3, 4].map(() => uniform(new THREE.Color()));
    const uSeaC = uniform(new THREE.Color());
    const uRiverC = uniform(new THREE.Color());
    const uRelief = uniform(0.6);
    const uRing = uniform(new THREE.Vector4(0, 0, 0, 0));   // x, y (cells), radius, strength
    const uGlint = uniform(0);
    const uTime = uniform(0);

    const scene = new THREE.Scene();
    const fogC = new THREE.Color();
    scene.fog = new THREE.Fog(fogC, 85, 240);
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.5, 400);

    const geo = new THREE.PlaneGeometry(SIZE, SIZE, G - 1, G - 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.fog = true;
    const tUV = uv();
    mat.positionNode = Fn(() => {
      const s = texture(tex, tUV).x;
      return positionLocal.add(vec3(0, max(s, SEA).mul(VS), 0));
    })();
    mat.colorNode = Fn(() => {
      const s = texture(tex, tUV).toVar();
      const h = s.x;
      const cell = tUV.mul(G);
      // Hillshade from the north-west, in map space (x across, y down the grid).
      const n = normalize(vec3(s.y.negate(), s.z.negate(), float(1.2).sub(uRelief)));
      const L = normalize(vec3(-0.6, -0.55, 0.62));
      const shade = dot(n, L).mul(0.8).add(0.38).toVar();
      // Hypsometric tints.
      const e = clamp(h.sub(SEA).div(HMAX - SEA), 0.0, 1.0).toVar();
      const t = e.mul(4);
      const land = mix(mix(mix(mix(uTint[0], uTint[1], clamp(t, 0, 1)), uTint[2], clamp(t.sub(1), 0, 1)), uTint[3], clamp(t.sub(2), 0, 1)), uTint[4], smoothstep(2.6, 3.4, t)).toVar();
      const col = land.mul(mix(1.0, shade, uRelief.mul(0.8).add(0.2))).toVar();
      // Engraved contours every 4 cells of height, bolder every 20, and
      // bolder still where the clap's ring passes.
      const ch = h.div(4);
      const aa = max(abs(s.y).add(abs(s.z)).div(4), 0.02);
      const line = smoothstep(aa.mul(1.4), 0.0, abs(fract(ch.add(0.5)).sub(0.5)));
      const major = smoothstep(aa.mul(1.6), 0.0, abs(fract(h.div(20).add(0.5)).sub(0.5)).mul(5));
      const rd = length(cell.sub(uRing.xy));
      const rq = rd.sub(uRing.z).div(9);
      const ring = exp(rq.mul(rq).negate()).mul(uRing.w);   // not pow(): negative base
      col.mulAssign(float(1).sub(line.mul(0.16).add(major.mul(0.14)).add(line.max(major).mul(ring).mul(0.5))));
      // Rivers from the water flux.
      // Rivers are where the flux is well above the rain everywhere.
      const wv = smoothstep(3.0, 5.0, TSL.log2(s.w.add(1)));
      const river = mix(col, uRiverC.mul(mix(0.85, 1.1, shade)), wv.mul(0.92));
      const glint = step(0.975, hash(floor(cell.mul(2)).dot(vec2(1, 157)).add(floor(uTime.mul(20))))).mul(wv).mul(uGlint);
      const landOut = river.add(vec3(glint));
      // The sea: flat, with the shallows lighter.
      const depth = clamp(float(SEA).sub(h).div(SEA), 0.0, 1.0);
      const sea = mix(uSeaC.mul(1.12), uSeaC.mul(0.86), smoothstep(0.0, 0.6, depth));
      return mix(landOut, sea, step(h, SEA));
    })();
    const land = new THREE.Mesh(geo, mat);
    land.frustumCulled = false;
    scene.add(land);
    // The open sea beyond the island, out to the haze.
    const seaMat = new THREE.MeshBasicNodeMaterial();
    seaMat.fog = true;
    seaMat.colorNode = Fn(() => uSeaC.mul(0.86))();
    const seaGeo = new THREE.PlaneGeometry(900, 900);
    seaGeo.rotateX(-Math.PI / 2);
    const seaMesh = new THREE.Mesh(seaGeo, seaMat);
    seaMesh.position.y = SEA * VS - 0.02;
    scene.add(seaMesh);

    // ------------------------------------------------------------ warm-up
    // Carve the range before frame 1, so the valleys are there already.
    const runRain = (n) => { rain.count = n; renderer.compute([rain]); };
    uErode.value = 0.05;
    for (let k = 0; k < 24; k++) {
      uSeed.value = k * 131071 % 100000;
      runRain(60000);
      renderer.compute([relax, commit]);
    }
    for (let k = 0; k < 10; k++) { uSeed.value = 5000 + k * 7919; runRain(50000); renderer.compute(prep); }

    // ---------------------------------------------------------- the music
    let camAng = rnd() * TAU, camT = 0;
    let stormX = G * 0.5, stormY = G * 0.5, storm = 0, storm2X = 0, storm2Y = 0, storm2 = 0;
    let ringR = 0, ringS = 0, ringX = 0, ringY = 0;
    let sd = 1;
    const sky0 = new THREE.Color(), sky1 = new THREE.Color();

    return {
      frame(f) {
        const { dt, t, ears, P: Pm } = f;
        const push = Pm.push;
        const m = MAPS[Math.max(0, Math.min(MAPS.length - 1, Math.round(Pm.map)))];
        for (let i = 0; i < 5; i++) uTint[i].value.set(m.tints[i]);
        uSeaC.value.set(m.sea);
        uRiverC.value.set(m.river);
        sky0.set(m.sky[0]); sky1.set(m.sky[1]);
        fogC.copy(sky1);
        scene.fog.color.copy(fogC);
        renderer.setClearColor(fogC, 1);

        // Kick: a storm cell bursts over part of the range (two on the drop).
        if (ears.kick && Pm.storm > 0.02) {
          stormX = G * (0.5 + 0.3 * Math.sin(t * 0.21 + 0.5) + (rnd() - 0.5) * 0.25);
          stormY = G * (0.5 + 0.3 * Math.sin(t * 0.17 + 2.0) + (rnd() - 0.5) * 0.25);
          storm = 1;
          if (Pm.storm > 1.2) { storm2X = G - stormX + (rnd() - 0.5) * 60; storm2Y = G - stormY + (rnd() - 0.5) * 60; storm2 = 1; }
        }
        const burst = 7000 * Pm.storm * Math.min(1.6, push);
        const s1 = Math.round(burst * storm), s2 = Math.round(burst * 0.8 * storm2);
        storm *= Math.exp(-dt / 0.12); storm2 *= Math.exp(-dt / 0.12);
        uStorm.value.set(stormX, stormY, 18 + 8 * Pm.storm, s1);
        uStorm2.value.set(storm2X, storm2Y, 16 + 8 * Pm.storm, s2);
        // Clap: a ring runs out from the storm over the contours.
        if (ears.snare && push > 0.05) { ringR = 0; ringS = Math.min(1.4, push); ringX = stormX; ringY = stormY; }
        ringR += dt * 170; ringS *= Math.exp(-dt / 0.9);
        uRing.value.set(ringX, ringY, ringR, ringS);
        uGlint.value = Math.min(1.2, ears.hatEnv) * push;
        uRelief.value = Pm.relief;
        uTime.value = t;

        const base = Math.round(9000 + 60000 * Pm.rain * (0.4 + 0.9 * ears.bass * push));
        uErode.value = 0.004 + 0.03 * Pm.carve;
        uRelax.value = 0.0015 + 0.004 * (1 - Pm.carve);
        uSeed.value = (sd = (sd * 16807) % 2147483647) % 100000;
        runRain(s1 + s2 + base);
        renderer.compute([relax, commit, prep]);

        // A slow flight round the range: lower and quicker with `fly`.
        camT += dt * (0.02 + 0.05 * Pm.fly);
        camAng = camT;
        const rad = 78 - 26 * Pm.fly;
        const alt = 44 - 16 * Pm.fly + 4 * Math.sin(t * 0.07);
        camera.position.set(Math.cos(camAng) * rad, alt, Math.sin(camAng) * rad);
        camera.lookAt(Math.cos(camAng + 0.9) * 12, 4, Math.sin(camAng + 0.9) * 12);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();

        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      },
      dispose() {
        geo.dispose(); mat.dispose(); tex.dispose(); seaGeo.dispose(); seaMat.dispose();
        for (const b of [HT, H0, HN, WAT, FLX]) if (b.value && b.value.dispose) b.value.dispose();
      },
    };
  }

  VIZ.register({
    id: 'gpu4',
    name: 'Watershed',
    order: 1119,
    params: [
      { key: 'rain', label: 'Steady rain', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'storm', label: 'Storm on the kick', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'carve', label: 'Erosion', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'fly', label: 'Flight: high to low', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'relief', label: 'Relief shading', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'map', label: 'Map', type: 'select', options: MAPS.map((x) => x.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    finish: { bloom: 0.1, halation: 0.3 },

    gallery: {
      title: 'Watershed',
      technique: 'three.js 0.186.1 WebGPU compute (TSL): droplet hydraulic erosion with up to ~120,000 raindrops a frame, each a thread that walks its whole path downhill in one dispatch and scatters erosion, deposition and water into a 512x512 fixed-point heightmap with integer atomics; a relaxation pass (uplift toward the range and talus slump) keeps it standing; height, slope and smoothed flux go to a half-float storage texture that displaces a 512x512 grid mesh and colours it as a relief map.',
      brief: 'A mountain range carved by rain, seen from a slow flight as a Swiss relief map come alive: hypsometric tints, hillshade from the north-west, engraved contours, the sea, and rivers drawn from the water that actually flows. Every kick bursts a storm over one watershed and its streams light up blue, then drain; claps send a ring over the contours; hats glint the water; the bass swells every stream. On the drop the storms come in pairs, the flight drops lower and faster, and the rivers cut faster, so the valleys deepen over the set.',
      lineage: 'Eduard Imhof\'s Swiss relief cartography; droplet erosion after Hans Theobald Beyer (2015) and Sebastian Lague\'s coding adventure; GPU erosion demos by Mei and Jako.',
    },

    preload(p) {
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      const done = () => { if (hold) p._decrementPreload(); };
      loadKit().then((k) => k.warm(hold)).then(done, (e) => { console.error('gpu4: kit did not load', e); done(); });
    },
    enter() { if (kit) kit.enter(this); },
    leave() { if (kit) kit.leave(this); },
    draw(p, signals, params, ctx) {
      if (!kit) { loadKit(); p.background(SPEC.ground); return; }
      kit.draw(this, SPEC, p, signals, params, ctx);
    },
  });
})();
