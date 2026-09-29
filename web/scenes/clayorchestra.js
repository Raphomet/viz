// Clay Orchestra: a miniature stop-motion set in soft daylight. A round clay
// stage stands on a paper floor in a pastel landscape; on it an ensemble of
// clay "instruments" in rings, each section playing one part of the track.
// The camera orbits low and close with a shallow lens, so the set reads as a
// tabletop model, and cranes up on the drop.
//
// Music, each reaction in its own section (harness/TASTE.md):
//   kick    a squash wave runs round the ring of drums (fat cylinders with
//           cream heads), starting at the drum nearest the lens: confined to
//           one ring, travelling rather than flashing
//   clap    half the ball section leaps and lands with a squash, the halves
//           alternating
//   hats    glazed rings on pedestals are knocked into an Euler-disk wobble,
//           their glaze catching the sun as they spin down
//   bass    the stacked pillows at the centre swell, and the orbit quickens
//   drop    with Follow the track: an outer ring of organ pipes rises out of
//           the stage with a clay boing, the camera cranes up, the sun swings
//           low and golden and the shadows lengthen
//
// How it is made (three.js on the shared kit, web/three-kit.js):
//   - one sun (DirectionalLight) with variance shadow maps blurred wide, so
//     shadows are soft the way a big window makes them; a hemisphere sky and
//     a low RoomEnvironment for the glaze's reflections
//   - analytic ambient occlusion: every instrument is also a sphere occluder
//     (world position and radius, updated per frame), and every clay material
//     is patched to darken its indirect light by the sphere-occlusion
//     integral (cos x (r/d)^2) of each, plus a contact term near the stage.
//     Cheaper and steadier than a screen-space AO pass, and it is what gives
//     the clay its weight where things touch
//   - MeshPhysicalMaterial clay: matte with a little sheen, a shared
//     procedural normal map of lumps and thumbprints so nothing is smooth
//     CG; glazed ceramic (clearcoat) rings and satin balls against it
//   - instanced meshes with per-instance colour from a three-to-five clay
//     palette; springs (squash and stretch) and ballistic hops on the CPU
//   - the kit lens: orbit motion blur, depth of field racking slowly between
//     the drums and the centre, bloom only on the sun disc, a gentle grade

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);

  // The set, in metres.
  const STAGE = 0.4;          // stage top
  const STAGE_R = 7.4;
  const N_DRUM = 18, R_DRUM = 5.45;
  const N_BALL = 14, R_BALL = 3.85, BALL_R = 0.3;
  const N_RING = 10, R_RING = 2.35, RING_R = 0.34, RING_T = 0.1, PED_H = 0.26;
  const N_PIPE = 24, R_PIPE = 6.65;
  const N_PILLOW = 3;
  const N_OCC = N_DRUM + N_BALL + N_RING + N_PILLOW + N_PIPE;   // 69

  // Clay palettes, sRGB hex: [floor, stage, rim, then the ensemble colours].
  const PALETTES = [
    { name: 'Sherbet', colors: ['#e4d8c4', '#d9b49c', '#c9705a', '#ee9a7e', '#efc86a', '#8fc9a8', '#84a9da', '#b39ada', '#f6efe4'] },
    { name: 'Terracotta', colors: ['#ece2d2', '#e0c3a4', '#b8674a', '#d27a55', '#e3b25a', '#98ae86', '#7d96b0', '#c9a38f', '#f2e9da'] },
    { name: 'Riso', colors: ['#f3ece1', '#f2c9d2', '#3f8f8a', '#ef8fa6', '#5fb0a8', '#f6d27a', '#ef8fa6', '#5fb0a8', '#fbf4ea'] },
  ];

  const PRESETS = {
    calm: { spin: 0.35, crane: 0.12, focus: 0.75, sun: 0.3, ensemble: 0 },
    drop: { spin: 1.0, crane: 0.75, focus: 0.45, sun: 0.9, ensemble: 1 },
  };
  const DRIVE = ['spin', 'crane', 'focus', 'sun', 'ensemble'];

  // ---------------------------------------------------- procedural textures
  // A tiling height field of soft lumps and a few thumbprints (rings of fine
  // ridges), turned into a normal map: the hand in hand-made.
  function clayNormals(T) {
    const n = 256;
    const h = new Float32Array(n * n);
    const vnoise = (x, y, f) => {
      const xi = Math.floor(x * f), yi = Math.floor(y * f);
      const xf = x * f - xi, yf = y * f - yi;
      const H = (i, j) => hash((((i % f) + f) % f) * 71.3 + ((((j % f) + f) % f)) * 13.7 + f * 1.9);
      const u = smooth(xf), v = smooth(yf);
      return lerp(lerp(H(xi, yi), H(xi + 1, yi), u), lerp(H(xi, yi + 1), H(xi + 1, yi + 1), u), v);
    };
    const prints = [];
    for (let i = 0; i < 7; i++) prints.push([hash(i * 3.3 + 1), hash(i * 5.7 + 2), 0.07 + 0.05 * hash(i * 9.1), hash(i * 1.3) * TAU]);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n, v = y / n;
        let z = 0.6 * vnoise(u, v, 4) + 0.3 * vnoise(u, v, 9) + 0.1 * vnoise(u, v, 23);
        for (const [cx, cy, r, a] of prints) {
          let dx = u - cx, dy = v - cy;
          dx -= Math.round(dx); dy -= Math.round(dy);
          // Elliptical whorl, faded at its edge.
          const ca = Math.cos(a), sa = Math.sin(a);
          const ex = (dx * ca + dy * sa) / r, ey = (-dx * sa + dy * ca) / (r * 0.7);
          const d = Math.sqrt(ex * ex + ey * ey);
          if (d < 1) z += 0.05 * Math.sin(d * 55) * (1 - d) * (1 - d);
        }
        h[y * n + x] = z;
      }
    }
    const data = new Uint8Array(n * n * 4);
    const k = 6;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = h[y * n + ((x + 1) % n)] - h[y * n + ((x - 1 + n) % n)];
        const dy = h[((y + 1) % n) * n + x] - h[((y - 1 + n) % n) * n + x];
        let nx = -dx * k, ny = -dy * k, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * n + x) * 4;
        data[i] = Math.round((nx * 0.5 + 0.5) * 255);
        data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        data[i + 3] = 255;
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.magFilter = T.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }

  // ------------------------------------------------------ analytic occlusion
  // Patch a physical material so its indirect light (and a little of its
  // direct) is darkened by the occluder spheres. `key` holds each occluder's
  // owner origin: a surface skips the occluders its own object carries, or a
  // drum would shade itself from inside.
  function patchAO(mat, U, contact) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.occ = U.occ;
      sh.uniforms.occKey = U.occKey;
      sh.uniforms.occStrength = U.occStrength;
      sh.defines = sh.defines || {};
      sh.defines.N_OCC = N_OCC;
      if (contact) sh.defines.CONTACT_AO = '';
      sh.vertexShader = 'varying vec3 vAoW;\nvarying vec3 vAoO;\n' + sh.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 aoP = vec4(transformed, 1.0);
          vec4 aoO = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            aoP = instanceMatrix * aoP;
            aoO = instanceMatrix * aoO;
          #endif
          vAoW = (modelMatrix * aoP).xyz;
          vAoO = (modelMatrix * aoO).xyz;
        }`);
      sh.fragmentShader = 'uniform vec4 occ[N_OCC];\nuniform vec3 occKey[N_OCC];\nuniform float occStrength;\nvarying vec3 vAoW;\nvarying vec3 vAoO;\n' +
        sh.fragmentShader.replace('#include <aomap_fragment>',
        `#include <aomap_fragment>
        {
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          float ao = 1.0;
          for (int i = 0; i < N_OCC; i++) {
            vec4 s = occ[i];
            if (s.w <= 0.0) continue;
            if (distance(occKey[i], vAoO) < 0.03) continue;
            vec3 d = s.xyz - vAoW;
            float l2 = max(dot(d, d), 1e-4);
            float o = clamp(dot(wn, d * inversesqrt(l2)), 0.0, 1.0) * (s.w * s.w) / l2;
            ao *= 1.0 - clamp(o, 0.0, 1.0) * occStrength;
          }
          #ifdef CONTACT_AO
            // Where a form meets the stage the sky cannot reach the underside.
            float hgt = max(vAoW.y - ${STAGE.toFixed(2)}, 0.0);
            ao *= mix(1.0, 0.45 + 0.55 * smoothstep(0.0, 0.35, hgt), clamp(0.6 - wn.y, 0.0, 1.0));
          #endif
          reflectedLight.indirectDiffuse *= ao;
          reflectedLight.indirectSpecular *= ao;
          reflectedLight.directDiffuse *= mix(1.0, ao, 0.35);
        }`);
    };
    return mat;
  }

  // ------------------------------------------------------------ scene build
  function build(kit) {
    const T = kit.THREE;
    const scene = new T.Scene();
    const normals = clayNormals(T);

    const U = {
      occ: { value: Array.from({ length: N_OCC }, () => new T.Vector4()) },
      occKey: { value: Array.from({ length: N_OCC }, () => new T.Vector3(1e4, 1e4, 1e4)) },
      occStrength: { value: 0.85 },
    };

    // Materials against materials: matte clay, satin clay, glazed ceramic,
    // felt-soft pillows, paper floor.
    const clay = (opts, contact) => patchAO(new T.MeshPhysicalMaterial(Object.assign({
      color: 0xffffff, roughness: 0.72, metalness: 0, sheen: 0.35, sheenRoughness: 0.8,
      sheenColor: new T.Color(1, 0.96, 0.92), normalMap: normals, normalScale: new T.Vector2(0.35, 0.35),
      envMapIntensity: 0.5,
    }, opts)), U, contact);
    const matDrum = clay({}, true);
    const matHead = clay({ roughness: 0.6, normalScale: new T.Vector2(0.15, 0.15) }, true);
    const matBall = clay({ roughness: 0.42, sheen: 0.15, clearcoat: 0.25, clearcoatRoughness: 0.5, normalScale: new T.Vector2(0.2, 0.2) }, true);
    const matGlaze = clay({ roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0, envMapIntensity: 1.1, normalScale: new T.Vector2(0.12, 0.12) }, true);
    const matPillow = clay({ roughness: 0.9, sheen: 0.9, sheenRoughness: 0.5 }, true);
    const matPipe = clay({ roughness: 0.66 }, true);
    const matStage = clay({ roughness: 0.8, normalScale: new T.Vector2(0.4, 0.4) }, false);
    const matRim = clay({ roughness: 0.7 }, false);
    const matFloor = clay({ roughness: 0.95, sheen: 0.2, normalScale: new T.Vector2(0.18, 0.18) }, false);
    const matHill = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.85, sheen: 0.3, normalMap: normals, normalScale: new T.Vector2(0.3, 0.3), envMapIntensity: 0.4 });

    const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    const inst = (geo, mat, count) => {
      const m = new T.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      m.frustumCulled = false;
      shadowed(m);
      scene.add(m);
      return m;
    };

    // Paper floor, the stage, and its pinched rim.
    const floor = new T.Mesh(new T.CircleGeometry(80, 96), matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const stageGeo = new T.CylinderGeometry(STAGE_R, STAGE_R + 0.15, STAGE, 128, 1);
    const stage = shadowed(new T.Mesh(stageGeo, matStage));
    stage.position.y = STAGE / 2;
    scene.add(stage);
    // Scalloped rim, like a pinched pie crust: a torus whose tube swells
    // around its length.
    const rimGeo = new T.TorusGeometry(STAGE_R + 0.02, 0.14, 16, 360);
    {
      const pos = rimGeo.attributes.position, v = new T.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const a = Math.atan2(v.y, v.x);
        const ring = Math.hypot(v.x, v.y);
        const k = 1 + 0.35 * Math.pow(Math.abs(Math.sin(a * 48)), 0.6);
        const off = (ring - (STAGE_R + 0.02)) * k;
        const r2 = STAGE_R + 0.02 + off;
        pos.setXYZ(i, Math.cos(a) * r2, Math.sin(a) * r2, v.z * k);
      }
      rimGeo.computeVertexNormals();
    }
    const rim = shadowed(new T.Mesh(rimGeo, matRim));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = STAGE;
    scene.add(rim);

    // The ensemble.
    const drumGeo = new T.CylinderGeometry(0.42, 0.46, 1, 48, 3); drumGeo.translate(0, 0.5, 0);
    const headGeo = new T.CylinderGeometry(0.43, 0.43, 0.08, 48, 1); headGeo.translate(0, 0.04, 0);
    const drums = inst(drumGeo, matDrum, N_DRUM);
    const heads = inst(headGeo, matHead, N_DRUM);
    const balls = inst(new T.SphereGeometry(BALL_R, 48, 32), matBall, N_BALL);
    const rings = inst(new T.TorusGeometry(RING_R, RING_T, 28, 96).rotateX(Math.PI / 2), matGlaze, N_RING);
    const pedGeo = new T.CylinderGeometry(0.2, 0.26, PED_H, 40, 1); pedGeo.translate(0, PED_H / 2, 0);
    const peds = inst(pedGeo, matDrum, N_RING);
    const pillows = inst(new T.SphereGeometry(1, 64, 40), matPillow, N_PILLOW + 1);
    const pipeGeo = new T.CapsuleGeometry(0.17, 1, 8, 32); pipeGeo.translate(0, 0.67, 0);
    const pipes = inst(pipeGeo, matPipe, N_PIPE);

    // The landscape beyond the set: clay hills, and clouds hung on wires.
    const hillGeo = new T.SphereGeometry(1, 48, 24, 0, TAU, 0, Math.PI / 2);
    const hills = new T.InstancedMesh(hillGeo, matHill, 14);
    hills.instanceColor = new T.InstancedBufferAttribute(new Float32Array(14 * 3), 3);
    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(), V = new T.Vector3(), E = new T.Euler();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + hash(i * 2.1) * 0.35;
      const r = 36 + hash(i * 3.7) * 22;
      const w = 7 + hash(i * 5.3) * 9;
      M.compose(V.set(Math.cos(a) * r, 0, Math.sin(a) * r), Q.identity(), S.set(w, w * (0.25 + 0.25 * hash(i * 7.9)), w * 0.8));
      hills.setMatrixAt(i, M);
    }
    scene.add(hills);
    const clouds = new T.Group();
    const cloudGeo = new T.SphereGeometry(1, 32, 20);
    const wireGeo = new T.CylinderGeometry(0.03, 0.03, 30, 6); wireGeo.translate(0, 15, 0);
    const matCloud = new T.MeshPhysicalMaterial({ color: 0xfbf7f2, roughness: 0.9, sheen: 0.5, normalMap: normals, normalScale: new T.Vector2(0.25, 0.25), envMapIntensity: 0.5 });
    const matWire = new T.MeshBasicMaterial({ color: 0x5a5250 });
    for (let c = 0; c < 7; c++) {
      const g = new T.Group();
      const a = (c / 7) * TAU + 0.4;
      const r = 24 + hash(c * 4.4) * 10;
      g.position.set(Math.cos(a) * r, 9 + hash(c * 6.6) * 5, Math.sin(a) * r);
      const puffs = 3 + Math.floor(hash(c * 8.8) * 3);
      for (let j = 0; j < puffs; j++) {
        const m = new T.Mesh(cloudGeo, matCloud);
        const s = 1.2 + hash(c * 10 + j) * 1.3;
        m.scale.set(s * 1.2, s * 0.8, s);
        m.position.set((j - puffs / 2) * 1.6, hash(c * 12 + j) * 0.8, hash(c * 14 + j) * 0.8);
        g.add(m);
      }
      const wire = new T.Mesh(wireGeo, matWire);
      wire.position.set(0, 0.8, 0);
      g.add(wire);
      g.lookAt(0, g.position.y, 0);
      clouds.add(g);
    }
    scene.add(clouds);

    // Sky: a gradient dome with a glow round the sun; the sun disc itself is
    // the one HDR emitter, so it is the only thing that blooms.
    const skyU = {
      horizon: { value: new T.Color() }, zenith: { value: new T.Color() },
      sunDir: { value: new T.Vector3(0, 1, 0) }, sunCol: { value: new T.Color() },
    };
    const sky = new T.Mesh(new T.SphereGeometry(90, 48, 24), new T.ShaderMaterial({
      uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 horizon, zenith, sunDir, sunCol; varying vec3 vD;
        void main(){
          float h = clamp(vD.y, 0.0, 1.0);
          vec3 c = mix(horizon, zenith, pow(h, 0.55));
          float s = max(dot(normalize(vD), sunDir), 0.0);
          c += sunCol * (0.35 * pow(s, 8.0) + 0.25 * pow(s, 64.0));
          c += sunCol * 7.0 * smoothstep(0.99955, 0.9997, s);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    sky.frustumCulled = false;
    scene.add(sky);
    scene.fog = new T.Fog(new T.Color(), 30, 110);

    // Light: one sun with wide soft shadows, a sky/bounce hemisphere, and a
    // dim studio environment for the glaze to reflect.
    const sun = new T.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 70;
    sun.shadow.radius = 5;
    sun.shadow.blurSamples = 8;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const hemi = new T.HemisphereLight(0xcfe0f5, 0xe8d2bc, 0.6);
    scene.add(hemi);
    scene.environment = kit.environment('room', 0.06);
    scene.environmentIntensity = 0.25;

    const camera = new T.PerspectiveCamera(34, kit.aspect, 0.1, 200);

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 10, dofSamples: 28 });
    lens.grade.split.value = 0.5;
    lens.grade.shadowTint.value.set(0.94, 0.95, 1.06);
    lens.grade.highlightTint.value.set(1.04, 1.0, 0.95);
    lens.grade.lift.value.set(0.004, 0.0035, 0.005);
    lens.grade.vignette.value = 0.3;
    lens.grade.grain.value = 0.035;
    lens.grade.aberration.value = 0.0015;
    lens.maxVelocity = 0.03;
    lens.farBlur = 0.6;
    lens.bloom.threshold = 2.0;

    // Fixed placements, by hash (never Math.random: three draws on it for ids).
    const drumH = [], drumCol = [], ballCol = [], ringCol = [], pipeH = [], pipeCol = [];
    for (let i = 0; i < N_DRUM; i++) { drumH.push(0.62 + 0.55 * hash(i * 1.37 + 0.2)); drumCol.push(i % 3); }
    for (let i = 0; i < N_BALL; i++) ballCol.push((i + 1) % 5);
    for (let i = 0; i < N_RING; i++) ringCol.push((i * 2) % 5);
    // Pan-pipe runs: three rising scales round the ring, coloured like a toy xylophone.
    for (let i = 0; i < N_PIPE; i++) { const k = i % 8; pipeH.push(0.7 + 0.19 * k); pipeCol.push(k % 5); }

    return {
      T, scene, camera, lens, U, sun, hemi, sky, skyU, clouds, hills, floor, stage, rim,
      drums, heads, balls, rings, peds, pillows, pipes,
      mats: { matFloor, matStage, matRim },
      drumH, drumCol, ballCol, ringCol, pipeH, pipeCol,
      M, Q, S, V, E, col: new T.Color(), c2: new T.Color(), axis: new T.Vector3(), look: new T.Vector3(),
    };
  }

  // Palette -> instance colours (linear).
  function applyPalette(R, idx) {
    const T = R.T;
    const pal = PALETTES[idx].colors.map((h) => new T.Color(h));
    const ens = pal.slice(3, 8);
    R.mats.matFloor.color.copy(pal[0]);
    R.mats.matStage.color.copy(pal[1]);
    R.mats.matRim.color.copy(pal[2]);
    for (let i = 0; i < N_DRUM; i++) { R.drums.setColorAt(i, ens[R.drumCol[i]]); R.heads.setColorAt(i, pal[8]); }
    for (let i = 0; i < N_BALL; i++) R.balls.setColorAt(i, ens[R.ballCol[i]]);
    for (let i = 0; i < N_RING; i++) { R.rings.setColorAt(i, ens[R.ringCol[i]]); R.peds.setColorAt(i, pal[8]); }
    for (let i = 0; i < N_PILLOW + 1; i++) R.pillows.setColorAt(i, i === N_PILLOW ? pal[2] : ens[(i * 2 + 3) % 5]);
    for (let i = 0; i < N_PIPE; i++) R.pipes.setColorAt(i, ens[R.pipeCol[i]]);
    const c = R.col;
    for (let i = 0; i < 14; i++) {
      c.copy(ens[(i * 3) % 5]).lerp(pal[0], 0.55);
      R.hills.setColorAt(i, c);
    }
    for (const m of [R.drums, R.heads, R.balls, R.rings, R.peds, R.pillows, R.pipes, R.hills]) m.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'clayorchestra',
    name: 'Clay Orchestra',
    order: 1005,
    requires: 'three',
    three: { addons: [] },
    finish: false,

    params: [
      { key: 'spin', label: 'Orbit speed', type: 'range', min: 0, max: 2, default: 0.45, step: 0.01 },
      { key: 'crane', label: 'Camera: tabletop to crane', type: 'range', min: 0, max: 1, default: 0.2, step: 0.01 },
      { key: 'focus', label: 'Miniature focus', type: 'range', min: 0, max: 1, default: 0.7, step: 0.01 },
      { key: 'sun', label: 'Sun: morning to golden', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'ensemble', label: 'Organ pipes', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'palette', label: 'Clay', type: 'select', options: PALETTES.map((p) => p.name), default: 0 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Clay Orchestra',
      technique: 'three.js 0.186.1 on the shared kit: instanced MeshPhysicalMaterial clay (matte with sheen, a procedural lump-and-thumbprint normal map), satin and clearcoat-glazed ceramic against it; one sun with blurred variance shadow maps, a hemisphere sky and a dim RoomEnvironment; analytic sphere ambient occlusion patched into every clay material (each instrument is an occluder, plus a contact term at the stage); squash-and-stretch springs and ballistic hops on the CPU; the kit lens with orbit motion blur, a slowly racking shallow focus, bloom only on the sun disc, and a gentle split-tone grade under AgX.',
      brief: 'A tabletop stop-motion set in soft daylight: a round clay stage with a pinched rim on a paper floor, pastel hills and clouds on wires beyond, and on the stage an orchestra of clay instruments in rings. The camera orbits low with a miniature\'s shallow focus. The kick sends a squash wave round the ring of drums; claps make half the balls leap and land; hats knock glazed rings into a spinning wobble; bass swells the stacked pillows at the centre and quickens the orbit. On the drop organ pipes boing up round the edge, the camera cranes up and the sun swings low and golden.',
      lineage: 'Batch 07 "Rendered" (three.js); after claymation sets (Aardman, the tabletop worlds of stop-motion music videos) and the soft-shadowed pastel clay renders of 3D illustration, with the springs of classic squash-and-stretch animation.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
      this.palIdx = -1;
    },

    enter(p, ctx) {
      const r = ctx.three.renderer, T = this.R.T;
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.VSMShadowMap;
      this.lastMs = null;
      this.t = 0;
      this.orbit = 0.6;
      this.focus = null;
      this.env = { prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.waves = [];
      this.snares = 0; this.hats = 0;
      this.drum = Array.from({ length: N_DRUM }, () => ({ x: 0, v: 0 }));
      this.ball = Array.from({ length: N_BALL }, () => ({ y: 0, vy: 0, x: 0, v: 0 }));
      this.ring = Array.from({ length: N_RING }, (_, i) => ({ a: 0.05, phi: hash(i * 7.7) * TAU }));
      this.pipe = Array.from({ length: N_PIPE }, () => ({ x: 0, v: 0 }));
      this.pillow = 0;
      this.R.lens.cut();
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    listen(s, dt, push, camAngle) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        // The wave starts at the drum facing the lens, so it is always seen.
        this.waves.push({ age: 0, prev: -1, amp: (0.6 + 0.4 * kRaw) * push, from: camAngle });
        if (this.waves.length > 4) this.waves.shift();
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        const half = this.snares++ % 2;
        for (let i = 0; i < N_BALL; i++) {
          const b = this.ball[i];
          if (i % 2 !== half || b.y > 0.02) continue;
          b.vy = (3.1 + 1.0 * hash(i * 3.3 + this.snares)) * Math.sqrt(Math.max(0, push)) * (0.7 + 0.3 * sRaw);
          b.v -= 3.5 * push;   // stretch on take-off
        }
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hats++;
        for (let j = 0; j < 2; j++) {
          const r = this.ring[Math.floor(hash(this.hats * 1.91 + j * 7.3) * N_RING)];
          r.a = Math.min(0.42, r.a + (0.16 + 0.2 * hRaw) * push);
        }
      }
      e.prevH = hRaw;

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 3, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three, R = this.R, T = R.T;
      const r = kit.renderer;
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.VSMShadowMap;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      this.t += dt;
      const t = this.t;
      const push = params.push;

      const pal = clamp(Math.round(params.palette), 0, PALETTES.length - 1);
      if (pal !== this.palIdx) { applyPalette(R, pal); this.palIdx = pal; }

      this.listen(signals, dt, push, this.orbit);
      const e = this.env;
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.1 : 0.4, dt);
      const Pm = {};
      for (const k of DRIVE) Pm[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      const { M, Q, S, V } = R;
      const occ = R.U.occ.value, key = R.U.occKey.value;
      let oi = 0;
      const addOcc = (x, y, z, rad, kx, ky, kz) => { occ[oi].set(x, y, z, rad); key[oi].set(kx, ky, kz); oi++; };

      // ------------------------------------------------ drums: kick wave
      const WAVE_SPEED = Math.PI / 0.5;   // half way round in half a second
      for (const w of this.waves) { w.prev = w.age; w.age += dt; }
      this.waves = this.waves.filter((w) => w.age < 0.8);
      const wn = 16, wz = 0.3;
      for (let i = 0; i < N_DRUM; i++) {
        const a = (i / N_DRUM) * TAU;
        const d = this.drum[i];
        for (const w of this.waves) {
          let da = Math.abs(a - w.from) % TAU; if (da > Math.PI) da = TAU - da;
          const at = da / WAVE_SPEED;
          if (at > w.prev && at <= w.age) d.v += 11 * w.amp * (1 - 0.35 * da / Math.PI);
        }
        d.v += (-wn * wn * d.x - 2 * wz * wn * d.v) * dt;
        d.x = clamp(d.x + d.v * dt, -0.45, 0.6);
        const h = R.drumH[i];
        const sy = 1 - 0.5 * d.x, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
        const x = Math.cos(a) * R_DRUM, z = Math.sin(a) * R_DRUM;
        Q.identity();
        M.compose(V.set(x, STAGE, z), Q, S.set(sxz, h * sy, sxz)); R.drums.setMatrixAt(i, M);
        M.compose(V.set(x, STAGE + h * sy, z), Q, S.set(sxz, 1, sxz)); R.heads.setMatrixAt(i, M);
        addOcc(x, STAGE + h * sy * 0.5, z, 0.46 * sxz, x, STAGE, z);
      }

      // ------------------------------------------------ balls: snare hops
      const G = 16, bn = 14, bz = 0.22;
      for (let i = 0; i < N_BALL; i++) {
        const b = this.ball[i];
        if (b.y > 0 || b.vy > 0) {
          b.vy -= G * dt;
          b.y += b.vy * dt;
          if (b.y <= 0) { b.v += Math.min(4, -b.vy * 0.9); b.y = 0; b.vy = 0; }
        }
        b.v += (-bn * bn * b.x - 2 * bz * bn * b.v) * dt;
        b.x = clamp(b.x + b.v * dt, -0.5, 0.45);
        const a = ((i + 0.5) / N_BALL) * TAU;
        const sy = 1 - 0.55 * b.x, sxz = 1 / Math.sqrt(Math.max(0.3, sy));
        const x = Math.cos(a) * R_BALL, z = Math.sin(a) * R_BALL;
        const y = STAGE + BALL_R * sy + b.y;
        M.compose(V.set(x, y, z), Q.identity(), S.set(sxz, sy, sxz)); R.balls.setMatrixAt(i, M);
        addOcc(x, y, z, BALL_R * sxz, x, y, z);
      }

      // ------------------------------------------------ rings: hat wobble
      for (let i = 0; i < N_RING; i++) {
        const g = this.ring[i];
        g.a = Math.max(0.035, g.a * Math.exp(-dt / 1.1));
        // An Euler disk: the lower it lies, the faster it precesses.
        g.phi += dt * (3 + 1.4 / (g.a + 0.12));
        const a = ((i + 0.25) / N_RING) * TAU;
        const x = Math.cos(a) * R_RING, z = Math.sin(a) * R_RING;
        R.axis.set(Math.cos(g.phi), 0, Math.sin(g.phi));
        Q.setFromAxisAngle(R.axis, g.a);
        const y = STAGE + PED_H + RING_R * Math.sin(g.a) + RING_T * Math.cos(g.a);
        M.compose(V.set(x, y, z), Q, S.set(1, 1, 1)); R.rings.setMatrixAt(i, M);
        M.compose(V.set(x, STAGE, z), Q.identity(), S.set(1, 1, 1)); R.peds.setMatrixAt(i, M);
        addOcc(x, STAGE + PED_H * 0.6, z, 0.3, x, STAGE, z);
      }

      // ------------------------------------------------ pillows: bass swell
      this.pillow = ease(this.pillow, e.bass * push, 5, dt);
      let py = STAGE;
      const PIL = [[1.45, 0.52], [1.15, 0.46], [0.85, 0.42]];
      for (let i = 0; i < N_PILLOW; i++) {
        const lag = this.pillow * (1 - i * 0.18) + 0.03 * Math.sin(t * 1.3 - i * 0.8);
        const w = PIL[i][0] * (1 + 0.16 * lag), hgt = PIL[i][1] * (1 + 0.32 * lag);
        const y = py + hgt * 0.92;
        M.compose(V.set(0, y, 0), Q.identity(), S.set(w, hgt, w)); R.pillows.setMatrixAt(i, M);
        addOcc(0, y, 0, Math.min(w, hgt * 1.6), 0, y, 0);
        py = y + hgt * 0.78;
      }
      M.compose(V.set(0, py + 0.16, 0), Q.identity(), S.set(0.2, 0.2, 0.2)); R.pillows.setMatrixAt(N_PILLOW, M);

      // ------------------------------------------------ pipes: the drop
      const pn = 11, pz = 0.2;
      for (let i = 0; i < N_PIPE; i++) {
        const q = this.pipe[i];
        // Rise in a sweep round the ring, each with a clay overshoot.
        const order = ((i * 7) % N_PIPE) / N_PIPE;
        const target = clamp01(Pm.ensemble * 1.6 - order * 0.6);
        q.v += (-pn * pn * (q.x - target) - 2 * pz * pn * q.v) * dt;
        q.x += q.v * dt;
        const a = ((i + 0.5) / N_PIPE) * TAU;
        const x = Math.cos(a) * R_PIPE, z = Math.sin(a) * R_PIPE;
        // Pipes slide up out of the stage rather than scaling, so a pipe on
        // its way down never flattens into a disc (it did, 2026-09-29).
        const breath = 1 + 0.06 * e.bass * push * Math.sin(t * 2.2 - a * 3);
        const full = R.pipeH[i] * breath;
        const up = clamp(q.x, 0, 1.2);
        const tall = 1.34 * full;   // the capsule's caps scale with it
        const base = STAGE - 0.02 - (1 - up) * (tall + 0.1);
        const shown = up > 0.005;
        M.compose(V.set(x, base, z), Q.identity(), S.set(shown ? 1 : 0, full, shown ? 1 : 0)); R.pipes.setMatrixAt(i, M);
        const above = Math.max(0, base + tall - STAGE);
        addOcc(x, STAGE + above * 0.5, z, shown ? clamp(above * 0.35, 0, 0.3) : 0, x, base, z);
      }
      for (const m of [R.drums, R.heads, R.balls, R.rings, R.peds, R.pillows, R.pipes]) m.instanceMatrix.needsUpdate = true;

      // ------------------------------------------------ sun and sky
      const sunK = Pm.sun;
      // The sun keeps to the side of and behind the orbit, drifting slowly, so
      // the forms stay modelled (a sun behind the lens flattens clay) and the
      // shadows wheel round like a time-lapse.
      const elev = lerp(0.85, 0.26, sunK), azim = this.orbit + 2.0 + 0.55 * Math.sin(t * 0.045) + 0.3 * sunK;
      const sd = V.set(Math.cos(elev) * Math.cos(azim), Math.sin(elev), Math.cos(elev) * Math.sin(azim)).normalize();
      R.sun.position.set(sd.x * 30, sd.y * 30, sd.z * 30);
      R.sun.target.position.set(0, 0, 0);
      R.sun.target.updateMatrixWorld();
      R.sun.color.setRGB(1, lerp(0.95, 0.74, sunK), lerp(0.88, 0.5, sunK));
      R.sun.intensity = lerp(4.4, 5.0, sunK);
      R.hemi.color.setRGB(lerp(0.72, 0.9, sunK), lerp(0.82, 0.72, sunK), lerp(0.98, 0.78, sunK));
      R.hemi.groundColor.setRGB(0.85, lerp(0.7, 0.6, sunK), lerp(0.58, 0.45, sunK));
      R.hemi.intensity = lerp(0.62, 0.45, sunK);
      R.skyU.sunDir.value.copy(sd);
      R.skyU.horizon.value.setRGB(lerp(0.78, 0.98, sunK), lerp(0.8, 0.72, sunK), lerp(0.84, 0.6, sunK));
      R.skyU.zenith.value.setRGB(lerp(0.3, 0.5, sunK), lerp(0.48, 0.5, sunK), lerp(0.82, 0.72, sunK));
      R.skyU.sunCol.value.setRGB(1, lerp(0.9, 0.62, sunK), lerp(0.75, 0.35, sunK));
      R.scene.fog.color.copy(R.skyU.horizon.value);
      R.clouds.rotation.y = t * 0.012;

      // ------------------------------------------------ camera
      const spinRate = Pm.spin * (0.07 + 0.09 * e.bass * push);
      this.orbit += spinRate * dt;
      const crane = smooth(clamp01(Pm.crane));
      const rad = lerp(10.6, 14, crane) + 0.6 * Math.sin(t * 0.07);
      const hgt = lerp(1.8, 8.5, crane) + 0.25 * Math.sin(t * 0.11 + 1);
      const cam = R.camera;
      const ca = this.orbit;
      cam.position.set(Math.cos(ca) * rad, hgt, Math.sin(ca) * rad);
      const inward = lerp(2.4, 0.3, crane);
      const side = 1.1 * Math.sin(t * 0.09);
      const look = R.look.set(Math.cos(ca) * inward - Math.sin(ca) * side, lerp(1.0, 0.2, crane), Math.sin(ca) * inward + Math.cos(ca) * side);
      cam.up.set(0, 1, 0);
      cam.lookAt(look);
      cam.rotateZ(0.025 * Math.sin(t * 0.13));
      cam.updateMatrixWorld();

      // Rack focus slowly between the near drums and the centre pillows.
      const nearDrum = Math.hypot(rad - R_DRUM, hgt - STAGE - 0.5);
      const centre = Math.hypot(rad, hgt - 1.2);
      const rack = smooth(clamp01(0.5 + 0.9 * Math.sin(t * TAU / 34)));
      const f = lerp(nearDrum, centre, rack);
      this.focus = this.focus == null ? f : ease(this.focus, f, 1.5, dt);

      // ------------------------------------------------ render
      const L = R.lens;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.015 * (0.15 + Pm.focus) * lerp(1, 0.6, crane) : 0;
      L.shutter = 0.9;
      L.bloom.strength = 0.25;
      L.bloom.radius = 0.5;
      L.exposure = 1.0;
      L.render(R.scene, cam);
      kit.composite();
    },

    leave(p) {},
  });
})();
