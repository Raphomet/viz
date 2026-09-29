// Rendered: can three.js give viz the finish of a pro C4D / After
// Effects VJ loop — physically lit materials, reflections on dark gloss,
// depth of field, motion blur, bloom only on emitters, a filmic grade — live,
// music-reactive and at 60 fps?
//
// The subject is an original one: a flight down an endless brutalist
// colonnade at night. Raw concrete fins march past on both sides, a lacquered
// black floor mirrors everything, thin light strips (sodium orange and cold
// violet, two inks, never a spectrum) are the only sources, and chrome and
// lacquer forms stand in the hall. The camera flies banked, weaving between
// them, so fins pass close enough to fall out of focus.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a pulse of light runs away from the camera along the two ceiling
//           strips (a band that travels, not a flash of the frame)
//   clap    every standing form turns a quarter turn, eased
//   hats    dust motes near the lens glint
//   bass    flight speed swells; the ceiling strips breathe a little
//   drop    with Follow the track: faster, more banked, the light gates switch
//           on down the hall, the grade warms, the bloom opens
//
// How it is made:
//   On the shared three.js kit (web/three-kit.js; CONTRACT.md, "three.js
//   scenes"), which loads three 0.186.1 and owns the renderer, the render
//   scale (about 1080p's pixel count, scaled up), the lens chain and the
//   compositing into the p5 canvas. This file is the kit's reference scene.
//
//   Render path per frame:
//     1. mirror pass: the scene from the camera reflected in the floor plane,
//        half resolution, HDR, mipmapped (roughness picks the mip, so the
//        reflection blurs like wet stone rather than a mirror)
//     2. main pass: MeshPhysicalMaterial (clearcoat, metalness), RectAreaLights
//        on the nearest strips, image-based light from a PMREM of a generated
//        dark room with orange and violet panels, exponential fog; into the
//        kit lens's 4x MSAA half-float target
//     3. the kit lens: camera motion blur by depth reprojection (the hall's
//        travel folded in), depth of field, bloom thresholded above 1 so only
//        the HDR emitters bloom, a split-tone grade (violet shadows, orange
//        highlights), aberration, vignette, grain, AgX and sRGB

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);

  // Corridor geometry, in metres.
  const P = 4;            // slot pitch along the hall
  const SLOTS = 24;       // slots from 2 behind the camera to 21 ahead
  const BEHIND = 2;
  const HALL_W = 4.3;     // fin face distance from the centre line
  const HALL_H = 7.2;
  const MIRROR_SCALE = 0.5;
  const RECTS = 8;

  // Two inks in linear light, pre-multiplied to HDR by the strip intensity.
  const SODIUM = [1.0, 0.42, 0.12];
  const VIOLET = [0.42, 0.22, 1.0];
  const WHITE = [1.0, 0.86, 0.72];

  const PRESETS = {
    calm: { speed: 0.55, bank: 0.35, focus: 0.55, shutter: 0.5, bloom: 0.35, warmth: 0.35, gates: 0 },
    drop: { speed: 1.9, bank: 0.8, focus: 0.75, shutter: 0.85, bloom: 0.6, warmth: 0.8, gates: 1 },
  };
  const DRIVE = ['speed', 'bank', 'focus', 'shutter', 'bloom', 'warmth', 'gates'];

  // ----------------------------------------------------- procedural textures
  function floorTexture(T) {
    // Roughness (G) and a faint albedo variation for polished stone tiles:
    // low roughness with smudges, rough grout seams every 2 m.
    const n = 512;
    const data = new Uint8Array(n * n * 4);
    const noise = (x, y, f) => {
      const xi = Math.floor(x * f), yi = Math.floor(y * f);
      const xf = x * f - xi, yf = y * f - yi;
      const h = (i, j) => hash(((i % f) + f) % f * 71.3 + (((j % f) + f) % f) * 13.7 + f);
      const u = smooth(xf), v = smooth(yf);
      return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
    };
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n, v = y / n;
        const sm = 0.55 * noise(u, v, 4) + 0.3 * noise(u, v, 16) + 0.15 * noise(u, v, 64);
        const gu = Math.min(u % 0.5, 0.5 - (u % 0.5)), gv = Math.min(v % 0.5, 0.5 - (v % 0.5));
        const seam = Math.min(gu, gv) < 0.004 ? 1 : 0;
        const rough = seam ? 0.9 : 0.1 + 0.16 * Math.pow(sm, 1.5);
        const i = (y * n + x) * 4;
        data[i] = 255;
        data[i + 1] = Math.round(rough * 255);
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }

  function concreteTexture(T) {
    // Board-formed concrete: horizontal pour lines and blotchy tone.
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const b = hash(Math.floor(y / 16) * 3.1 + 7) * 0.12;
        const g = hash(x * 0.37 + y * 1.93) * 0.08 + 0.1 * Math.sin(x * 0.05 + hash(Math.floor(y / 16)) * 6);
        const line = (y % 16) === 0 ? -0.12 : 0;
        const v = clamp01(0.62 + b + g + line);
        const i = (y * n + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
        data[i + 3] = 255;
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }

  // A dark room with a few panels in the two inks, baked to a PMREM once, so
  // chrome and clearcoat reflect a world that matches the hall.
  function environmentSpec() {
    const panels = [
      { size: [0.4, 30], position: [-3, 4.9, 0], rotation: [Math.PI / 2, 0, 0], color: WHITE, intensity: 6 },
      { size: [0.4, 30], position: [3, 4.9, 0], rotation: [Math.PI / 2, 0, 0], color: WHITE, intensity: 6 },
    ];
    for (let i = -3; i <= 3; i++) {
      panels.push({ size: [0.3, 6], position: [-9.9, 3, i * 5], rotation: [0, Math.PI / 2, 0], color: i % 2 ? SODIUM : VIOLET, intensity: 5 });
      panels.push({ size: [0.3, 6], position: [9.9, 3, i * 5 + 2.5], rotation: [0, -Math.PI / 2, 0], color: i % 2 ? VIOLET : SODIUM, intensity: 5 });
    }
    panels.push({ size: [8, 3], position: [0, 2, -19.9], color: SODIUM, intensity: 1.2 });
    return { background: 0x050409, room: [20, 10, 40], panels };
  }

  // ------------------------------------------------------------ scene build
  function build(kit) {
    const T = kit.THREE;

    const scene = new T.Scene();
    scene.background = new T.Color(0.004, 0.003, 0.008);
    scene.fog = new T.FogExp2(new T.Color(0.012, 0.008, 0.02), 0.028);
    scene.environment = kit.environment(environmentSpec(), 0.02);
    scene.environmentIntensity = 0.55;

    const camera = new T.PerspectiveCamera(52, kit.aspect, 0.1, 140);
    const mirrorCam = new T.PerspectiveCamera(52, kit.aspect, 0.1, 140);
    const hall = new T.Group();
    scene.add(hall);

    const concreteMap = concreteTexture(T);
    const concrete = new T.MeshPhysicalMaterial({ color: 0x8a847c, map: concreteMap, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
    const concreteDark = new T.MeshPhysicalMaterial({ color: 0x2c2a2b, map: concreteMap, roughness: 0.9, metalness: 0, envMapIntensity: 0.4 });
    const chrome = new T.MeshPhysicalMaterial({ color: 0xe6e4ee, roughness: 0.1, metalness: 1, envMapIntensity: 1.3 });
    const lacquer = new T.MeshPhysicalMaterial({ color: 0x0a090c, roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
    const emit = new T.MeshBasicMaterial({ color: 0xffffff, fog: true, toneMapped: false });

    // Floor: polished black stone with a planar reflection injected into a
    // physical material (so it is still lit by the rect lights). The mirror
    // target is a kit target: it follows the render size and is freed on leave.
    const floorRough = floorTexture(T);
    floorRough.repeat.set(5, (SLOTS * P) / 2);
    const mirrorRT = kit.target(MIRROR_SCALE, {
      type: T.HalfFloatType, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, generateMipmaps: true, depthBuffer: true,
    });
    const reflUniforms = {
      tReflect: { value: mirrorRT.texture },
      reflMatrix: { value: new T.Matrix4() },
      reflStrength: { value: 1.0 },
      reflMaxLod: { value: 5.0 },
      reflStreak: { value: 0.012 },
    };
    const floorMat = new T.MeshPhysicalMaterial({ color: 0x08070a, roughness: 1, roughnessMap: floorRough, metalness: 0, envMapIntensity: 0.15 });
    floorMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, reflUniforms);
      sh.vertexShader = 'uniform mat4 reflMatrix;\nvarying vec4 vReflUv;\n' + sh.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vReflUv = reflMatrix * modelMatrix * vec4(transformed, 1.0);');
      sh.fragmentShader = 'uniform sampler2D tReflect;\nuniform float reflStrength, reflMaxLod, reflStreak;\nvarying vec4 vReflUv;\n' + sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `{
          vec2 ruv = vReflUv.xy / vReflUv.w;
          float rgh = clamp(roughnessFactor, 0.0, 1.0);
          float lod = rgh * reflMaxLod;
          vec3 refl = vec3(0.0);
          // A vertical smear that grows with roughness: the long streaks a
          // light makes on wet stone.
          for (int i = 0; i < 6; i++) {
            float o = (float(i) - 2.5) * reflStreak * (0.3 + rgh * 3.0);
            refl += textureLod(tReflect, ruv + vec2(0.0, o), lod + abs(float(i) - 2.5) * 0.4).rgb;
          }
          refl /= 6.0;
          float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
          outgoingLight += refl * reflStrength * mix(0.35, 1.0, fres) * (1.0 - rgh * 0.85);
        }
        #include <opaque_fragment>`);
    };
    const floor = new T.Mesh(new T.PlaneGeometry(HALL_W * 2 + 2, SLOTS * P), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -(SLOTS * P) / 2 + BEHIND * P;
    hall.add(floor);

    // Back walls and ceiling slab: uniform along the hall, so they do not scroll.
    const wallGeo = new T.BoxGeometry(0.3, HALL_H + 1, SLOTS * P);
    for (const sx of [-1, 1]) {
      const wall = new T.Mesh(wallGeo, concreteDark);
      wall.position.set(sx * (HALL_W + 1.3), (HALL_H + 1) / 2, -(SLOTS * P) / 2 + BEHIND * P);
      scene.add(wall);
    }
    const ceil = new T.Mesh(new T.BoxGeometry(HALL_W * 2 + 3, 0.3, SLOTS * P), concreteDark);
    ceil.position.set(0, HALL_H + 0.45, -(SLOTS * P) / 2 + BEHIND * P);
    scene.add(ceil);

    // Instanced slot furniture.
    const inst = (geo, mat, count, colored) => {
      const m = new T.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      if (colored) {
        m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        m.instanceColor.setUsage(T.DynamicDrawUsage);
      }
      m.frustumCulled = false;
      hall.add(m);
      return m;
    };
    const fins = inst(new T.BoxGeometry(0.9, HALL_H, 1.1), concrete, SLOTS * 2, false);
    const beams = inst(new T.BoxGeometry(HALL_W * 2 + 2, 0.55, 0.45), concrete, SLOTS, false);
    const wallStrips = inst(new T.BoxGeometry(0.06, 5.2, 0.06), emit, SLOTS * 2, true);
    const ceilStrips = inst(new T.BoxGeometry(0.07, 0.05, P * 0.94), emit, SLOTS * 2, true);
    const gates = inst(new T.BoxGeometry(1, 1, 1), emit, SLOTS * 3, true);

    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(1, 1, 1), V = new T.Vector3();
    for (let s = 0; s < SLOTS; s++) {
      const z = -(s - BEHIND) * P;
      for (let k = 0; k < 2; k++) {
        const sx = k ? 1 : -1;
        M.makeTranslation(sx * (HALL_W + 0.45), HALL_H / 2, z);
        fins.setMatrixAt(s * 2 + k, M);
        M.makeTranslation(sx * (HALL_W + 1.12), 3.0, z + P / 2);
        wallStrips.setMatrixAt(s * 2 + k, M);
        M.makeTranslation(sx * 1.55, HALL_H - 0.5, z + P / 2);
        ceilStrips.setMatrixAt(s * 2 + k, M);
      }
      M.makeTranslation(0, HALL_H - 0.02, z);
      beams.setMatrixAt(s, M);
      // A gate: two jambs and a lintel of light just inside the fins.
      const gz = z + P / 2;
      M.compose(V.set(-HALL_W + 0.25, HALL_H * 0.42, gz), Q, S.set(0.05, HALL_H * 0.84, 0.05)); gates.setMatrixAt(s * 3, M);
      M.compose(V.set(HALL_W - 0.25, HALL_H * 0.42, gz), Q, S.set(0.05, HALL_H * 0.84, 0.05)); gates.setMatrixAt(s * 3 + 1, M);
      M.compose(V.set(0, HALL_H * 0.84, gz), Q, S.set(HALL_W * 2 - 0.5, 0.05, 0.05)); gates.setMatrixAt(s * 3 + 2, M);
      S.set(1, 1, 1);
    }
    for (const m of [fins, beams, wallStrips, ceilStrips, gates]) m.instanceMatrix.needsUpdate = true;

    // Standing forms: a small pool re-dealt as slots scroll.
    const formGeos = [
      new T.IcosahedronGeometry(0.75, 0),
      new T.TorusGeometry(0.62, 0.2, 48, 128),
      new T.BoxGeometry(0.7, 2.4, 0.7),
      new T.OctahedronGeometry(0.8, 0),
    ];
    const plinthGeo = new T.CylinderGeometry(0.55, 0.62, 0.5, 48);
    const forms = [];
    for (let i = 0; i < SLOTS; i++) {
      const g = new T.Group();
      const meshes = formGeos.map((geo, j) => {
        const m = new T.Mesh(geo, j === 2 ? lacquer : chrome);
        m.visible = false;
        g.add(m);
        return m;
      });
      const plinth = new T.Mesh(plinthGeo, lacquer);
      plinth.position.y = 0.25;
      g.add(plinth);
      g.visible = false;
      hall.add(g);
      forms.push({ g, meshes, plinth });
    }

    // Real lights on the strips nearest the camera, which move with the slots.
    const rects = [];
    for (let i = 0; i < RECTS; i++) {
      const r = new T.RectAreaLight(0xffffff, 0, 0.35, 5.2);
      scene.add(r);
      rects.push(r);
    }
    const ceilRects = [];
    for (const sx of [-1, 1]) {
      const r = new T.RectAreaLight(0xffffff, 0, 0.2, 60);
      r.position.set(sx * 1.55, HALL_H - 0.55, -24);
      r.lookAt(sx * 1.55, 0, -24);
      scene.add(r);
      ceilRects.push(r);
    }
    // A low violet bounce so the shadows are coloured, not empty.
    const hemi = new T.HemisphereLight(0x2a1a50, 0x0a0608, 0.35);
    scene.add(hemi);

    // Dust in the air near the lens: the foreground layer, glinting on hats.
    // Placed by hash rather than Math.random, so the motes do not move when
    // three's own use of Math.random (object UUIDs) changes.
    const DUST = 320;
    const dPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dPos[i * 3] = (hash(i * 3.17 + 0.5) * 2 - 1) * HALL_W;
      dPos[i * 3 + 1] = 0.2 + hash(i * 5.31 + 1.7) * (HALL_H - 0.5);
      dPos[i * 3 + 2] = -hash(i * 7.73 + 2.9) * 30 + 3;
    }
    const dGeo = new T.BufferGeometry();
    dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3));
    const dustMat = new T.PointsMaterial({ color: new T.Color(1.2, 0.8, 0.6), size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, fog: true });
    // A mote that drifts within a hand's width of the lens would otherwise
    // grow into a flat square a tenth of the frame wide (seen on the GPU,
    // 2026-09-29); past a few pixels a mote is out of focus anyway.
    const dustMax = { value: 4 };
    dustMat.onBeforeCompile = (sh) => {
      sh.uniforms.dustMax = dustMax;
      sh.vertexShader = 'uniform float dustMax;\n' + sh.vertexShader.replace(
        '#include <fog_vertex>', '#include <fog_vertex>\n  gl_PointSize = min(gl_PointSize, dustMax);');
    };
    const dust = new T.Points(dGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // The kit's lens chain, graded for this hall: violet shadows, highlights
    // from pale to sodium with the warmth param, a faint violet lift.
    const lens = kit.lens({ msaa: 4, motionBlurSamples: 12, dofSamples: 36 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.78, 0.70, 1.18);
    lens.grade.lift.value.set(0.0035, 0.0015, 0.007);
    lens.grade.vignette.value = 0.55;
    lens.grade.grain.value = 0.07;
    lens.grade.aberration.value = 0.004;
    lens.maxVelocity = 0.05;
    lens.farBlur = 0.45;
    lens.bloom.threshold = 2.0;

    return {
      T, scene, camera, mirrorCam, hall, floor, floorMat, reflUniforms, mirrorRT,
      fins, beams, wallStrips, ceilStrips, gates, forms, rects, ceilRects, dust, dustMat,
      dustMax, lens, col: new T.Color(), fwd: new T.Vector3(), up: new T.Vector3(),
    };
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'rendered',
    name: 'Rendered',
    order: 990,
    requires: 'three',
    three: { addons: ['RectAreaLightUniformsLib'] },

    params: [
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 0.8, step: 0.01 },
      { key: 'bank', label: 'Bank and weave', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'shutter', label: 'Motion blur', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'bloom', label: 'Bloom', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'warmth', label: 'Grade: violet to sodium', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'gates', label: 'Light gates', type: 'range', min: 0, max: 1, default: 0.15, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    // The shared Finish (web/fx.js) would put a second motion blur, bloom and
    // grade on top of the kit's lens chain, which already is the finish.
    finish: false,

    gallery: {
      title: 'Rendered',
      technique: 'three.js 0.186.1 on the shared kit (web/three-kit.js): MeshPhysicalMaterial concrete, chrome and clearcoat lacquer under RectAreaLights and a PMREM of a generated room; a half-resolution planar mirror pass injected into the floor\'s physical material with roughness-driven mip blur and streaks; the kit lens: 4x MSAA half-float HDR, camera motion blur by depth reprojection, scatter-as-gather depth of field, UnrealBloomPass thresholded above 1 so only emitters bloom, split-tone grade, aberration, grain, AgX tone mapping. Rendered at about 1080p\'s pixel count and composited into the p5 canvas.',
      brief: 'A banked flight down an endless brutalist colonnade at night: board-formed concrete fins, a black stone floor that mirrors the light, sodium and violet strips as the only sources, chrome and lacquer forms on plinths. The finish is the point: lit, filmic, shallow focus, no neon wash. The kick sends a pulse of light running away down the ceiling strips; claps turn every form a quarter turn; hats glint the dust near the lens; bass swells the speed. On the drop the gates of light switch on down the hall, the flight speeds and banks harder and the grade warms.',
      lineage: 'A feasibility spike (2026-09-28) against the finish of professional Cinema 4D / After Effects VJ loops (a neon-city fly-through with DOF, motion blur, emissive-only bloom and a split-tone grade), then the reference scene of the three.js kit (2026-09-29); original subject after Tadao Ando\'s concrete and the long lit halls of architectural visualisation.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      this.lastMs = null;
      this.dist = 0;
      this.prevDist = null;
      this.t = 0;
      this.focus = null;
      this.env = { kick: 0, prevK: 0, snare: 0, prevS: 0, b4: 0, b8: 0, hat: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.pulses = [];
      this.turns = 0;        // quarter turns owed to the forms
      this.turnPos = 0;      // eased
      this.glints = 0;
      this.smSpeed = 0.8;
      // Core holds the loading state until this resolves, so the ~130 ms of
      // shader compiles never land on a live frame.
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.pulses.unshift({ age: 0, amp: (0.6 + 0.4 * kRaw) * Math.min(1.5, push) });
        this.pulses.length = Math.min(this.pulses.length, 5);
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        if (push > 0.05) this.turns += 1;
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.glints = Math.min(1.5, this.glints + 0.8 * hRaw * push);
      }
      e.prevH = hRaw;
      this.glints *= Math.exp(-dt / 0.09);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three;
      const R = this.R;
      const T = R.T;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const Pm = {};
      for (const key of DRIVE) Pm[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? e.auto : 0);

      this.t += dt;
      const target = Pm.speed * (0.55 + 0.9 * e.bass * push) * 5.5;
      this.smSpeed = ease(this.smSpeed, target, 1.5, dt);
      this.dist += this.smSpeed * dt;
      for (const q of this.pulses) q.age += dt;
      this.pulses = this.pulses.filter((q) => q.age < 2.2);
      this.turnPos = ease(this.turnPos, this.turns, 5, dt);

      // -------------------------------------------------- slots and content
      const k = Math.floor(this.dist / P);
      const shift = this.dist - k * P;
      R.hall.position.z = shift;

      const pulseAt = (z) => {
        // z: metres ahead of the camera. Each pulse runs away at 28 m/s.
        let v = 0;
        for (const q of this.pulses) {
          const front = q.age * 28 - 2;
          const d = (z - front) / 2.2;
          v += q.amp * Math.exp(-d * d) * Math.exp(-q.age * 1.3);
        }
        return v;
      };
      const warm = Pm.warmth;
      const inkOf = (seg) => {
        const r = hash(seg * 3.7 + 1.3);
        // Mostly sodium when warm, mostly violet when cool; a few dark bays.
        if (r < 0.12) return null;
        return hash(seg * 9.1 + 4.2) < 0.25 + 0.55 * warm ? SODIUM : VIOLET;
      };
      const col = R.col;
      const breathe = 1 + 0.35 * e.bass * push;
      for (let s = 0; s < SLOTS; s++) {
        const seg = k + s - BEHIND;
        const zAhead = (s - BEHIND) * P - shift - P / 2;   // strip distance ahead of the camera
        for (let side = 0; side < 2; side++) {
          const ink = inkOf(seg * 2 + side);
          const kI = ink ? 5 : 0;
          if (ink) col.setRGB(ink[0] * kI, ink[1] * kI, ink[2] * kI); else col.setRGB(0, 0, 0);
          R.wallStrips.setColorAt(s * 2 + side, col);
          const c = 2.2 * breathe + 30 * pulseAt(zAhead);
          col.setRGB(WHITE[0] * c, WHITE[1] * c, WHITE[2] * c);
          R.ceilStrips.setColorAt(s * 2 + side, col);
        }
        // Gates: every other slot, fading in with the param from the far end.
        const gOn = (seg % 4 === 0 ? 1 : 0) * clamp01(Pm.gates * 1.6 - (s / SLOTS) * 0.6);
        const gInk = hash(seg * 5.3) < 0.3 + 0.5 * warm ? SODIUM : VIOLET;
        const gk = 6 * gOn;
        col.setRGB(gInk[0] * gk, gInk[1] * gk, gInk[2] * gk);
        for (let j = 0; j < 3; j++) R.gates.setColorAt(s * 3 + j, col);

        // Forms: about one slot in three, alternating sides.
        const F = R.forms[s];
        const has = hash(seg * 1.7 + 0.4) < 0.36;
        F.g.visible = has;
        if (has) {
          const type = Math.floor(hash(seg * 2.9 + 8.1) * 4);
          const sideX = hash(seg * 4.1) < 0.5 ? -1 : 1;
          F.meshes.forEach((m, i) => { m.visible = i === type; });
          const m = F.meshes[type];
          F.g.position.set(sideX * 2.55, 0, -(s - BEHIND) * P);
          m.position.y = type === 2 ? 1.7 : 1.45;
          const turn = this.turnPos * Math.PI / 2 * (hash(seg) < 0.5 ? 1 : -1);
          m.rotation.set(0.35 * Math.sin(this.t * 0.3 + seg), turn + this.t * 0.15 + seg, 0.2);
        }
      }
      R.wallStrips.instanceColor.needsUpdate = true;
      R.ceilStrips.instanceColor.needsUpdate = true;
      R.gates.instanceColor.needsUpdate = true;

      // Rect lights on the four nearest bays each side; the farthest behind
      // fades out and the farthest ahead fades in, so wrapping never pops.
      for (let i = 0; i < 4; i++) {
        const s = BEHIND - 1 + i;
        const seg = k + s - BEHIND;
        const fade = i === 0 ? 1 - shift / P : i === 3 ? shift / P : 1;
        for (let side = 0; side < 2; side++) {
          const r = R.rects[i * 2 + side];
          if (!r) continue;
          const ink = inkOf(seg * 2 + side);
          const sx = side ? 1 : -1;
          r.position.set(sx * (HALL_W + 1.05), 3.0, -(s - BEHIND) * P + shift + P / 2);
          r.lookAt(0, 2.6, r.position.z);
          if (ink) r.color.setRGB(ink[0], ink[1], ink[2]); else r.color.setRGB(0, 0, 0);
          r.intensity = 16 * fade;
        }
      }
      let pNear = 0;
      for (let z = 0; z < 24; z += 4) pNear += pulseAt(z);
      for (const r of R.ceilRects) { r.color.setRGB(WHITE[0], WHITE[1], WHITE[2]); r.intensity = 2.4 * breathe + 6 * pNear; }

      // Dust drifts toward the camera with the flight and wraps.
      const dp = R.dust.geometry.attributes.position.array;
      const adv = this.smSpeed * dt * 0.35;
      for (let i = 2; i < dp.length; i += 3) { dp[i] += adv; if (dp[i] > 3) dp[i] -= 33; }
      R.dust.geometry.attributes.position.needsUpdate = true;
      R.dustMat.opacity = clamp01(0.22 + 1.1 * this.glints);
      R.dustMat.size = 0.02 + 0.02 * this.glints;
      R.dustMax.value = (3 + 3 * this.glints) * kit.height / 720;

      // ------------------------------------------------------------ camera
      const t = this.t, bank = Pm.bank;
      const cam = R.camera;
      const x = bank * (1.05 * Math.sin(t * 0.21) + 0.35 * Math.sin(t * 0.47 + 1.3));
      const y = 1.7 + 0.55 * Math.sin(t * 0.13 + 0.4) + 0.25 * bank * Math.sin(t * 0.37);
      const vx = bank * (1.05 * 0.21 * Math.cos(t * 0.21) + 0.35 * 0.47 * Math.cos(t * 0.47 + 1.3));
      cam.position.set(x, y, 0);
      const yaw = -0.35 * vx + 0.06 * Math.sin(t * 0.09);
      const pitch = 0.07 + 0.05 * Math.sin(t * 0.17);
      const roll = -bank * (0.22 * Math.sin(t * 0.21 + 0.6) + 0.9 * vx * 0.5) - 0.05;
      cam.rotation.set(pitch, yaw, roll, 'YXZ');
      cam.updateMatrixWorld();

      // Focus: on the nearest standing form ahead if there is one, else 7 m.
      let focus = 7;
      for (let s = BEHIND; s < BEHIND + 4; s++) {
        const F = R.forms[s];
        if (F.g.visible) { const z = (s - BEHIND) * P - shift; if (z > 2.5) { focus = z; break; } }
      }
      this.focus = this.focus == null ? focus : ease(this.focus, focus, 2, dt);

      // ------------------------------------------------------------ render
      // Mirror camera: reflect position, target and up through y = 0.
      kit.fitCamera(cam);
      const mc = R.mirrorCam;
      mc.projectionMatrix.copy(cam.projectionMatrix);
      mc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      const fwd = R.fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
      const up = R.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      mc.position.set(cam.position.x, -cam.position.y, cam.position.z);
      mc.up.set(up.x, -up.y, up.z);
      mc.lookAt(cam.position.x + fwd.x, -(cam.position.y + fwd.y), cam.position.z + fwd.z);
      mc.updateMatrixWorld();
      R.reflUniforms.reflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
        .multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
      const renderer = kit.renderer;
      R.floor.visible = false; R.dust.visible = false;
      renderer.setRenderTarget(R.mirrorRT);
      renderer.render(R.scene, mc);
      R.floor.visible = true; R.dust.visible = true;

      // The lens: the hall's travel is folded into last frame's camera (the
      // world moves, not the camera), so the fins streak as they pass.
      const L = R.lens;
      const moved = this.prevDist == null ? 0 : this.dist - this.prevDist;
      this.prevDist = this.dist;
      L.shutter = Pm.shutter * 1.4;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.014 * (0.3 + Pm.focus) : 0;
      L.bloom.strength = 0.06 + 0.34 * Pm.bloom;
      L.bloom.radius = 0.2 + 0.25 * Pm.bloom;
      L.grade.highlightTint.value.set(lerp(1.0, 1.18, warm), lerp(0.93, 0.90, warm), lerp(0.88, 0.68, warm));
      L.render(R.scene, cam, { worldMove: [0, 0, moved] });
      kit.composite();
    },
  });
})();
