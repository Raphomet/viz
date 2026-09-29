// Chrome Bloom: a mass of liquid chrome hangs over a travertine drum in a
// round plaster studio, and grows. Lobes of it slide round each other,
// merge and part; kicks push a bud out of the surface that either swells
// back in or pinches off as a droplet; on the drop the mass splits into a
// flock of beads that circle it and fold back in.
//
// The chrome has no colour of its own: everything it shows is the studio.
// A warm key softbox, a cool rim strip, a white overhead ring, the apricot
// plaster cove and the dark terrazzo floor are baked into an environment
// that matches the real room, so the reflections agree with the lighting.
//
// Music, each in its own place (harness/TASTE.md):
//   kick    a bud grows out of the mass towards one side of the frame, then
//           either merges back or pinches off and evaporates as a droplet
//   clap    the light rig (key, rim and their reflections) swings round the
//           studio: highlights slide over the chrome, the shadow swings
//   hats    two pin lights near the mass flick on: glints on the chrome and
//           the floating beads
//   bass    the lobes swell
//   drop    with Follow the track: the mass splits into a swarm of beads,
//           the camera pulls back and orbits faster, the key warms
//
// Render path per frame (on the shared kit, web/three-kit.js):
//   1. MarchingCubes (three's addon) re-meshes the metaball field on the CPU
//   2. the key spot's soft shadow map, once per frame (autoUpdate is off so
//      the mirror pass does not render it a second time)
//   3. mirror pass: the scene reflected in the floor, half resolution, mip-
//      blurred by the floor's roughness map, injected into the floor's
//      physical material
//   4. the kit lens: MSAA HDR, camera motion blur, depth of field on the mass,
//      bloom above 2 (the softbox and the glints), a warm split grade, AgX
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);

  // The metaball field: a cube of side 2 * MC_SCALE centred at MC_CENTER.
  // 44 cells a side keeps the CPU mesh near 2 ms; the field's own gradient
  // gives smooth normals, so chrome does not show the cells.
  const MC_RES = 44;
  const MC_SCALE = 2.7;
  const MC_Y = 1.75;
  const ISO = 80, SUB = 10;
  const LOBES = 4, BUDS = 8, SWARM = 14, BEADS = 44;
  const MIRROR_SCALE = 0.4;

  // Studio, in metres: floor disc to the cove, the cove's radius, the wall.
  const FLOOR_R = 11, COVE_R = 3.5, WALL_H = 9, DOME_H = 16;

  // Light inks, linear.
  const KEY_WARM = [1.0, 0.72, 0.48];
  const KEY_NEUTRAL = [1.0, 0.9, 0.8];
  const RIM = [0.6, 0.74, 1.0];

  const PRESETS = {
    calm: { flow: 0.5, mass: 1, swarm: 0, orbit: 0.45, focus: 0.6, warmth: 0.5, gilt: 0.1 },
    drop: { flow: 1.35, mass: 1.1, swarm: 0.9, orbit: 1.4, focus: 0.8, warmth: 0.9, gilt: 0.2 },
  };
  const DRIVE = ['flow', 'mass', 'swarm', 'orbit', 'focus', 'warmth', 'gilt'];

  // ------------------------------------------------------------- textures
  function valueNoise(u, v, f, seed) {
    const xi = Math.floor(u * f), yi = Math.floor(v * f);
    const xf = u * f - xi, yf = v * f - yi;
    const h = (i, j) => hash(((i % f) + f) % f * 71.3 + (((j % f) + f) % f) * 13.7 + f + seed);
    const a = smooth(xf), b = smooth(yf);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), a), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), a), b);
  }

  function dataTex(T, n, fill, srgb) {
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) fill(x / n, y / n, data, (y * n + x) * 4);
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }

  // Dark terrazzo: umber resin with chips of bone, rust and grey. Chips are
  // cells of a jittered grid, so they stay put and tile.
  function terrazzo(T) {
    const n = 512, G = 48;
    const chip = (u, v) => {
      const gx = Math.floor(u * G), gy = Math.floor(v * G);
      let best = 9, id = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = gx + i, cy = gy + j, wx = ((cx % G) + G) % G, wy = ((cy % G) + G) % G;
        const hx = hash(wx * 3.1 + wy * 17.3), hy = hash(wx * 7.7 + wy * 2.9 + 5);
        const dx = u * G - (cx + hx), dy = v * G - (cy + hy);
        const r = 0.18 + 0.3 * hash(wx * 1.3 + wy * 9.1 + 2);
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d < best) { best = d; id = wx * 131 + wy; }
      }
      return best < 1 ? id : -1;
    };
    const albedo = dataTex(T, n, (u, v, d, i) => {
      const c = chip(u, v);
      let r = 0.1, g = 0.078, b = 0.066;
      const m = 0.85 + 0.3 * valueNoise(u, v, 8, 3);
      r *= m; g *= m; b *= m;
      if (c >= 0) {
        const k = hash(c * 0.37);
        if (k < 0.45) { r = 0.72; g = 0.66; b = 0.56; }        // bone
        else if (k < 0.7) { r = 0.52; g = 0.26; b = 0.16; }    // rust
        else if (k < 0.9) { r = 0.36; g = 0.35; b = 0.34; }    // grey
        else { r = 0.05; g = 0.04; b = 0.04; }                 // black
        const s = 0.85 + 0.3 * hash(c * 1.91);
        r *= s; g *= s; b *= s;
      }
      d[i] = Math.round(clamp01(r) * 255); d[i + 1] = Math.round(clamp01(g) * 255); d[i + 2] = Math.round(clamp01(b) * 255); d[i + 3] = 255;
    }, true);
    const rough = dataTex(T, n, (u, v, d, i) => {
      // Polished, with the smudges a mop leaves.
      const sm = 0.55 * valueNoise(u, v, 4, 11) + 0.3 * valueNoise(u, v, 16, 12) + 0.15 * valueNoise(u, v, 64, 13);
      d[i] = 255; d[i + 1] = Math.round((0.06 + 0.2 * Math.pow(sm, 1.8)) * 255); d[i + 2] = 0; d[i + 3] = 255;
    }, false);
    return { albedo, rough };
  }

  // Travertine: pale warm stone in horizontal beds, with pits.
  function travertine(T) {
    return dataTex(T, 256, (u, v, d, i) => {
      const bed = valueNoise(0.1, v + 0.08 * valueNoise(u, v, 4, 21), 24, 22);
      const pit = valueNoise(u * 4, v, 64, 23) > 0.82 ? 0.72 : 1;
      const tone = (0.78 + 0.14 * bed + 0.05 * valueNoise(u, v, 32, 24)) * pit;
      d[i] = Math.round(clamp01(tone * 0.93) * 255);
      d[i + 1] = Math.round(clamp01(tone * 0.84) * 255);
      d[i + 2] = Math.round(clamp01(tone * 0.7) * 255);
      d[i + 3] = 255;
    }, true);
  }

  // The studio's profile, turned about the vertical: floor edge, a quarter-
  // round cove, the wall, and a low dome.
  function roomProfile(T) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI / 2;
      pts.push(new T.Vector2(FLOOR_R + COVE_R * Math.sin(a), COVE_R - COVE_R * Math.cos(a)));
    }
    const W = FLOOR_R + COVE_R;
    pts.push(new T.Vector2(W, WALL_H));
    for (let i = 1; i <= 16; i++) {
      const a = (i / 16) * Math.PI / 2;
      pts.push(new T.Vector2(W * Math.cos(a) + 0.001, WALL_H + (DOME_H - WALL_H) * Math.sin(a)));
    }
    return pts;
  }

  // Where the rig's lights sit, at rig angle 0: the key softbox in front-left
  // of the default camera, the rim strip behind and to the right.
  const KEY_AZ = 0.7, KEY_R = 7, KEY_H = 6.2;
  const RIM_AZ = 0.7 + 2.75, RIM_R = 5.2, RIM_H = 2.6;
  const polar = (az, r, h) => [Math.sin(az) * r, h, Math.cos(az) * r];

  // The environment the chrome reflects: the same room, painted as it looks
  // lit, with the softboxes as emitters. Baked once; clap swings it with the
  // rig. PMREM bakes from the origin, so the room is lowered by MC_Y to be
  // seen from where the chrome hangs: baked from floor level, the floor and
  // the drum were edge-on and the chrome's underside reflected nothing.
  function environment(T, env) {
    const room = new T.Group();
    room.position.y = -MC_Y;
    env.add(room);
    const geo = new T.LatheGeometry(roomProfile(T), 96);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const az = Math.atan2(x, z);
      // Warm plaster, darker at the cove foot and into the dome, with one
      // narrow lit band brightest on the far side from the key, where its
      // light lands. Lit plaster everywhere read as grey plastic; dark
      // plaster read as black glass against an apricot room.
      const facing = 0.5 + 0.5 * Math.cos(az - KEY_AZ - Math.PI);
      const band = Math.exp(-Math.pow((y - 4.6) / 1.1, 2));
      const foot = Math.exp(-Math.pow((y - 1.2) / 0.9, 2));
      const wall = 1 - smooth(clamp01((y - 7) / 5));
      const k = 0.3 * Math.pow(facing, 2) * band + 0.1 * (0.55 + 0.45 * facing) * wall * (1 - 0.6 * foot) + 0.004;
      col[i * 3] = 0.9 * k; col[i * 3 + 1] = 0.66 * k; col[i * 3 + 2] = 0.5 * k;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    room.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })));
    const basic = (c) => new T.MeshBasicMaterial({ color: new T.Color(c[0], c[1], c[2]), side: T.DoubleSide });
    const floor = new T.Mesh(new T.CircleGeometry(FLOOR_R + 0.1, 64), basic([0.035, 0.025, 0.021]));
    floor.rotation.x = -Math.PI / 2;
    room.add(floor);
    // The travertine drum right below: the pale disc the underside shows.
    const drumTop = new T.Mesh(new T.CircleGeometry(1.45, 48), basic([0.55, 0.45, 0.33]));
    drumTop.rotation.x = -Math.PI / 2;
    drumTop.position.y = 0.345;
    room.add(drumTop);
    const drumSide = new T.Mesh(new T.CylinderGeometry(1.45, 1.5, 0.34, 48, 1, true), basic([0.16, 0.13, 0.1]));
    drumSide.position.y = 0.17;
    room.add(drumSide);
    const panel = (w, h, p, c, k) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), basic([c[0] * k, c[1] * k, c[2] * k]));
      m.position.set(p[0], p[1] - MC_Y, p[2]);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(3.2, 3.2, polar(KEY_AZ, KEY_R, KEY_H), KEY_NEUTRAL, 9);
    panel(0.7, 4.2, polar(RIM_AZ, RIM_R, RIM_H), RIM, 7);
    panel(2.4, 1.2, polar(KEY_AZ - 1.9, 6, 0.9), [1, 0.92, 0.84], 0.9);   // a white bounce card, low
    const ring = new T.Mesh(new T.RingGeometry(2.2, 2.6, 64), basic([3, 2.8, 2.6]));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 8.5;
    room.add(ring);
  }

  // ---------------------------------------------------------------- build
  function build(kit) {
    const T = kit.THREE, A = kit.addons;
    const scene = new T.Scene();
    scene.background = new T.Color(0.01, 0.008, 0.007);
    scene.fog = new T.FogExp2(new T.Color(0.05, 0.036, 0.028), 0.022);
    scene.environment = kit.environment(environment, 0.015);
    scene.environmentIntensity = 1;

    const camera = new T.PerspectiveCamera(36, kit.aspect, 0.1, 80);
    const mirrorCam = new T.PerspectiveCamera(36, kit.aspect, 0.1, 80);

    // --- materials
    const chrome = new T.MeshPhysicalMaterial({ color: 0xf2eee8, metalness: 1, roughness: 0.035, envMapIntensity: 1 });
    // The key spot is bright enough to light the plaster, and GGX's long
    // tail at that intensity washed the underside of the chrome to a flat
    // grey (measured: 54 -> 98 of 255 with the key on). The chrome takes its
    // light from the environment's softbox instead and keeps a quarter of
    // the direct highlights; the pins are brightened to match.
    const chromeDirect = { value: 0.25 };
    chrome.onBeforeCompile = (sh) => {
      sh.uniforms.chromeDirect = chromeDirect;
      sh.fragmentShader = 'uniform float chromeDirect;\n' + sh.fragmentShader.replace(
        '#include <lights_fragment_end>', '#include <lights_fragment_end>\n  reflectedLight.directSpecular *= chromeDirect;');
    };
    const plaster = new T.MeshStandardMaterial({ color: 0xc79a7c, roughness: 0.95, metalness: 0, envMapIntensity: 0.35, side: T.DoubleSide });
    const stone = new T.MeshPhysicalMaterial({ color: 0xffffff, map: travertine(T), roughness: 0.62, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.5 });
    const tz = terrazzo(T);
    tz.albedo.repeat.set(6, 6); tz.rough.repeat.set(6, 6);

    // --- the room
    const room = new T.Mesh(new T.LatheGeometry(roomProfile(T), 128), plaster);
    room.receiveShadow = true;
    scene.add(room);

    // Floor: terrazzo with a planar reflection folded into its physical
    // material, the rendered.js way (roughness picks the mirror's mip).
    const mirrorRT = kit.target(MIRROR_SCALE, {
      type: T.HalfFloatType, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, generateMipmaps: true, depthBuffer: true,
    });
    const reflUniforms = {
      tReflect: { value: mirrorRT.texture },
      reflMatrix: { value: new T.Matrix4() },
      reflStrength: { value: 0.85 },
      reflMaxLod: { value: 5.0 },
    };
    const floorMat = new T.MeshPhysicalMaterial({ color: 0xffffff, map: tz.albedo, roughness: 1, roughnessMap: tz.rough, metalness: 0, envMapIntensity: 0.25 });
    floorMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, reflUniforms);
      sh.vertexShader = 'uniform mat4 reflMatrix;\nvarying vec4 vReflUv;\n' + sh.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vReflUv = reflMatrix * modelMatrix * vec4(transformed, 1.0);');
      sh.fragmentShader = 'uniform sampler2D tReflect;\nuniform float reflStrength, reflMaxLod;\nvarying vec4 vReflUv;\n' + sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `{
          vec2 ruv = vReflUv.xy / vReflUv.w;
          float rgh = clamp(roughnessFactor, 0.0, 1.0);
          vec3 refl = textureLod(tReflect, ruv, rgh * reflMaxLod).rgb * 0.5
                    + textureLod(tReflect, ruv, rgh * reflMaxLod + 1.0).rgb * 0.5;
          float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
          outgoingLight += refl * reflStrength * mix(0.3, 1.0, fres) * (1.0 - rgh * 0.8);
        }
        #include <opaque_fragment>`);
    };
    const floor = new T.Mesh(new T.CircleGeometry(FLOOR_R + 0.05, 96), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // The drum the chrome hangs over.
    const drum = new T.Mesh(new T.CylinderGeometry(1.45, 1.5, 0.34, 96), stone);
    drum.position.y = 0.17;
    drum.castShadow = drum.receiveShadow = true;
    scene.add(drum);

    // --- the chrome
    const mc = new A.MarchingCubes(MC_RES, chrome, false, false, 60000);
    mc.isolation = ISO;
    mc.position.set(0, MC_Y, 0);
    mc.scale.setScalar(MC_SCALE);
    mc.castShadow = true;
    mc.frustumCulled = false;
    scene.add(mc);

    // Floating beads: the foreground layer the camera orbits through.
    const beadGeo = new T.SphereGeometry(1, 32, 16);
    const beads = new T.InstancedMesh(beadGeo, chrome, BEADS);
    beads.instanceMatrix.setUsage(T.DynamicDrawUsage);
    beads.frustumCulled = false;
    beads.castShadow = true;
    scene.add(beads);
    const beadSeed = [];
    for (let i = 0; i < BEADS; i++) {
      beadSeed.push({
        az: hash(i * 3.3 + 1) * TAU,
        r: 3.2 + hash(i * 5.1 + 2) * 5.5,
        y: 0.5 + hash(i * 7.9 + 3) * 3.6,
        size: 0.025 + Math.pow(hash(i * 2.2 + 4), 2) * 0.08,
        ph: hash(i * 9.4 + 5) * TAU,
        w: 0.04 + hash(i * 1.7 + 6) * 0.06,
      });
    }

    // --- the light rig (a group, so a clap can swing it)
    const rig = new T.Group();
    scene.add(rig);
    const key = new T.SpotLight(0xffffff, 0, 30, 0.5, 1, 2);
    key.position.set(...polar(KEY_AZ, KEY_R, KEY_H));
    key.target.position.set(0, MC_Y - 0.6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 3;
    key.shadow.camera.near = 3;
    key.shadow.camera.far = 20;
    rig.add(key, key.target);
    // The softbox itself, visible when the orbit comes round past it.
    const boxMat = new T.MeshBasicMaterial({ color: new T.Color(6, 5, 4), toneMapped: false, side: T.DoubleSide });
    const box = new T.Mesh(new T.PlaneGeometry(3.2, 3.2), boxMat);
    box.position.copy(key.position).multiplyScalar(1.08);
    box.lookAt(0, MC_Y, 0);
    rig.add(box);
    const rim = new T.RectAreaLight(0xffffff, 0, 0.7, 4.2);
    rim.position.set(...polar(RIM_AZ, RIM_R, RIM_H));
    rim.lookAt(0, MC_Y, 0);
    rig.add(rim);
    const rimMat = new T.MeshBasicMaterial({ color: new T.Color(RIM[0] * 2.6, RIM[1] * 2.6, RIM[2] * 2.6), toneMapped: false, side: T.DoubleSide });
    const rimBox = new T.Mesh(new T.PlaneGeometry(0.7, 4.2), rimMat);
    rimBox.position.copy(rim.position).multiplyScalar(1.02);
    rimBox.lookAt(0, MC_Y, 0);
    // Seen in the frame the strip read as a white board standing in the
    // room; it stays in the reflections (the environment) only.
    rimBox.visible = false;
    rig.add(rimBox);
    // A background light, the portrait photographer's: a soft pool on the
    // cove behind the mass, kept opposite the camera so the chrome always
    // has a glow to stand against. Without it the backdrop was one flat
    // brown. Its colour walks between peach and dusty rose.
    const back = new T.SpotLight(0xffffff, 0, 30, 0.42, 1, 1.4);
    scene.add(back, back.target);
    // The overhead ring's fill. It was a RectAreaLight, dropped for frame
    // rate (48 fps at 3024x1890 with it, among other costs).
    const hemi = new T.HemisphereLight(0x806050, 0x1a100c, 0.45);
    scene.add(hemi);
    // Pin lights for the hats: small, hot, close to the chrome.
    const pins = [0, 1].map(() => {
      const l = new T.PointLight(0xfff4e8, 0, 4, 2);
      scene.add(l);
      return l;
    });

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 8, dofSamples: 36 });
    lens.grade.split.value = 0.7;
    lens.grade.shadowTint.value.set(0.9, 0.95, 1.08);
    lens.grade.lift.value.set(0.004, 0.003, 0.003);
    lens.grade.vignette.value = 0.5;
    lens.grade.grain.value = 0.05;
    lens.grade.aberration.value = 0.0025;
    lens.maxVelocity = 0.04;
    lens.farBlur = 0.5;
    lens.bloom.threshold = 2.0;

    return {
      T, scene, camera, mirrorCam, mc, chrome, floor, floorMat, reflUniforms, mirrorRT, beads, beadSeed,
      rig, key, box, boxMat, rim, rimMat, pins, back, lens,
      M: new T.Matrix4(), Q: new T.Quaternion(), S: new T.Vector3(), V: new T.Vector3(),
      fwd: new T.Vector3(), up: new T.Vector3(), col: new T.Color(),
    };
  }

  // Add a ball whose lone surface radius is `r` metres at world (x, y, z).
  function ball(mc, x, y, z, r) {
    if (r <= 0.01) return;
    const u = r / (2 * MC_SCALE);
    const str = u * u * (ISO + SUB);
    const fx = ((x) / MC_SCALE + 1) / 2, fy = ((y - MC_Y) / MC_SCALE + 1) / 2, fz = ((z) / MC_SCALE + 1) / 2;
    mc.addBall(clamp(fx, 0.06, 0.94), clamp(fy, 0.06, 0.94), clamp(fz, 0.06, 0.94), str, SUB);
  }

  VIZ.register({
    id: 'chromebloom',
    name: 'Chrome Bloom',
    order: 1004,
    requires: 'three',
    three: { addons: ['MarchingCubes', 'RectAreaLightUniformsLib'] },
    // The lens chain is this scene's finish.
    finish: false,

    params: [
      { key: 'flow', label: 'Flow', type: 'range', min: 0, max: 2, default: 0.7, step: 0.01 },
      { key: 'mass', label: 'Mass', type: 'range', min: 0.4, max: 1.6, default: 1, step: 0.01 },
      { key: 'swarm', label: 'Split into swarm', type: 'range', min: 0, max: 1, default: 0.1, step: 0.01 },
      { key: 'orbit', label: 'Camera orbit', type: 'range', min: 0, max: 2, default: 0.6, step: 0.01 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.65, step: 0.01 },
      { key: 'warmth', label: 'Key light: neutral to warm', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'gilt', label: 'Chrome to gold', type: 'range', min: 0, max: 1, default: 0.12, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Chrome Bloom',
      technique: 'three.js 0.186.1 on the shared kit: MarchingCubes (CPU, 44³) over a metaball field of lobes, kick buds and a swarm; MeshPhysicalMaterial chrome lit only by a PMREM of a generated copy of the studio (warm softbox, cool rim strip, overhead ring, apricot cove) that swings with the light rig; a SpotLight key with a soft shadow map, RectAreaLight rim; a lathe-turned plaster cyclorama; procedural terrazzo with a 0.4-scale planar mirror injected into its physical material; a travertine drum; instanced chrome beads as a foreground layer; the kit lens (MSAA HDR, camera motion blur, depth of field, bloom above 2, warm split grade, AgX).',
      brief: 'Liquid chrome in a soft round studio. A mass of mercury-bright metal hangs over a travertine drum on a dark terrazzo floor, its lobes sliding round each other, merging and parting, reflecting a warm softbox, a cool rim strip and the apricot plaster cove. The camera orbits slowly, focused on the mass, through a scatter of floating chrome beads. Kicks push a bud out of the surface towards one side of the frame, which swells back in or pinches off as a droplet and evaporates; claps swing the whole light rig round the studio so the highlights slide over the chrome and the shadow turns; hats flick pin lights that glint on the metal; bass swells the lobes. On the drop the mass splits into a flock of beads circling it, the camera pulls back and orbits faster, and the key warms.',
      lineage: 'Batch 07 "Rendered" (2026-09-29), entry 4 of the brief: liquid chrome metaballs in a soft studio. After the chrome-blob still lifes of 3D product renders and C4D loops, Jeff Koons-style mirror polish and studio cyclorama photography; the lighting is the product photographer\'s (key softbox, rim strip, bounce card, black flags as darkness).',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      const r = ctx.three.renderer, T = this.R.T;
      // Shadows before the compile, so the programs compiled are the ones used.
      r.shadowMap.enabled = true;
      r.shadowMap.type = T.PCFShadowMap;   // soft via shadow.radius; PCFSoft was removed in r18x
      r.shadowMap.autoUpdate = false;
      this.lastMs = null;
      this.t = 0;
      this.flowT = 0;
      this.orbitA = 0;
      this.rigA = 0; this.rigTarget = 0;
      this.env = { prevK: 0, b4: 0, prevS: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.kicks = 0;
      this.buds = [];
      this.glint = [0, 0];
      this.hats = 0;
      this.swarmS = 0;
      this.focus = null;
      this.R.mc.reset();
      this.fillField(0, 1, 0, 0, 0);
      this.R.mc.update();
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    leave() {
      // The kit resets shadowMap.enabled for the next scene but not this.
      const r = VIZ_THREE.renderer;
      if (r) r.shadowMap.autoUpdate = true;
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        if (push > 0.05) this.bud(kRaw, push);
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        if (push > 0.05) this.rigTarget += (hash(this.kicks * 0.71) < 0.5 ? 1 : -1) * 0.95 * Math.min(1.3, push);
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        const i = this.hats++ % 2;
        this.glint[i] = Math.min(1.5, this.glint[i] + hRaw * push);
      }
      e.prevH = hRaw;
      this.glint[0] *= Math.exp(-dt / 0.08);
      this.glint[1] *= Math.exp(-dt / 0.08);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 3, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    // A bud grows towards the left or right of the frame as the camera sees
    // it (never straight at or away from the lens, where it would not read).
    bud(amp, push) {
      const n = this.kicks++;
      const side = n % 2 ? 1 : -1;
      const az = this.orbitA + side * (Math.PI / 2 + (hash(n * 1.37) - 0.5) * 1.1);
      const el = -0.25 + hash(n * 2.71) * 0.95;
      this.buds.unshift({
        age: 0,
        dir: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)],
        size: (0.3 + 0.16 * amp) * Math.min(1.4, 0.5 + 0.5 * push),
        free: hash(n * 4.13 + 0.5) < 0.45,       // pinches off rather than merging back
      });
      this.buds.length = Math.min(this.buds.length, BUDS);
    },

    // Every ball in the field: lobes, buds, swarm.
    fillField(t, mass, swell, swarm, dt) {
      const mc = this.R.mc;
      const core = mass * (1 + 0.28 * swell) * (1 - 0.55 * swarm);
      // Lobes: four bodies on slow incommensurate orbits round the centre,
      // close enough that they are always partly merged, never quite round.
      for (let i = 0; i < LOBES; i++) {
        const a = t * (0.31 + 0.07 * i) + i * 1.9;
        const b = t * (0.23 + 0.05 * i) + i * 2.7;
        const R = 0.42 + 0.18 * Math.sin(t * 0.17 + i);
        const x = R * Math.sin(a), z = R * Math.cos(a * 0.9 + 0.3);
        const y = 0.34 * Math.sin(b) + 0.1 * i - 0.15;
        ball(mc, x, MC_Y + y, z, (0.52 - 0.05 * i) * core);
      }
      // Buds: out along their direction; a merging bud comes back, a free one
      // keeps going, lifts and evaporates.
      for (const q of this.buds) {
        const a = q.age;
        const grow = smooth(clamp01(a / 0.28));
        let d, r;
        if (q.free) {
          d = 0.55 + 1.05 * smooth(clamp01(a / 0.7)) + 0.35 * Math.max(0, a - 0.7);
          r = q.size * grow * (1 - smooth(clamp01((a - 0.9) / 1.3)));
        } else {
          d = 0.55 + 0.75 * smooth(clamp01(a / 0.45)) * (1 - smooth(clamp01((a - 0.6) / 0.9)));
          r = q.size * grow * (1 - 0.4 * smooth(clamp01((a - 0.9) / 0.6)));
        }
        const lift = q.free ? 0.25 * Math.max(0, a - 0.6) : 0;
        ball(mc, q.dir[0] * d * mass, MC_Y + q.dir[1] * d * mass + lift, q.dir[2] * d * mass, r);
      }
      // Swarm: beads that leave the mass for a tilted, rippling ring round it.
      if (swarm > 0.02) {
        for (let j = 0; j < SWARM; j++) {
          const th = (j / SWARM) * TAU + t * 0.55 * (j % 2 ? 1 : 0.8);
          const R = lerp(0.3, 1.75, smooth(swarm)) * (0.9 + 0.12 * Math.sin(t * 1.3 + j * 2.1));
          const y = (0.45 * Math.sin(th * 2 + t * 0.7) + 0.2 * Math.sin(j * 1.7)) * swarm;
          const tilt = 0.35;
          const x = R * Math.cos(th), zz = R * Math.sin(th);
          ball(mc, x, MC_Y + y + zz * Math.sin(tilt) * 0.5, zz * Math.cos(tilt), (0.12 + 0.13 * hash(j * 3.3)) * (0.4 + 0.6 * mass) * smooth(clamp01(swarm * 2.2)));
        }
      }
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three, R = this.R, T = R.T;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.0 : 0.4, dt);
      const Pm = {};
      for (const k of DRIVE) Pm[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      this.t += dt;
      this.flowT += dt * (0.25 + Pm.flow) * (1 + 0.4 * e.bass * push);
      for (const q of this.buds) q.age += dt;
      this.buds = this.buds.filter((q) => q.age < 2.4);
      this.swarmS = ease(this.swarmS, Pm.swarm, 1.2, dt);

      // ---------------------------------------------------------- the field
      const mc = R.mc;
      mc.reset();
      this.fillField(this.flowT, Pm.mass, e.bass * push, this.swarmS, dt);
      mc.update();
      const gilt = Pm.gilt;
      R.chrome.color.setRGB(lerp(0.9, 1.0, gilt), lerp(0.88, 0.74, gilt), lerp(0.85, 0.42, gilt));
      R.chrome.roughness = 0.035 + 0.05 * gilt;

      // --------------------------------------------------------------- rig
      this.rigA = ease(this.rigA, this.rigTarget, 4.5, dt);
      R.rig.rotation.y = this.rigA;
      R.scene.environmentRotation.set(0, this.rigA, 0);
      const w = Pm.warmth;
      const kc = [lerp(KEY_NEUTRAL[0], KEY_WARM[0], w), lerp(KEY_NEUTRAL[1], KEY_WARM[1], w), lerp(KEY_NEUTRAL[2], KEY_WARM[2], w)];
      R.key.color.setRGB(kc[0], kc[1], kc[2]);
      R.key.intensity = 360 * (1 + 0.15 * w);
      R.boxMat.color.setRGB(kc[0] * 6, kc[1] * 6, kc[2] * 6);
      R.rim.color.setRGB(RIM[0], RIM[1], RIM[2]);
      R.rim.intensity = 10;

      // The background pool sits behind the mass as the camera sees it.
      const bz = Math.sin(this.orbitA), bc = Math.cos(this.orbitA);
      R.back.position.set(bz * 1.5, 5.5, bc * 1.5);
      R.back.target.position.set(-bz * (FLOOR_R + COVE_R), 3.2, -bc * (FLOOR_R + COVE_R));
      const rose = 0.5 + 0.5 * Math.sin(this.t * 0.05);
      R.back.color.setRGB(1.0, lerp(0.62, 0.5, rose), lerp(0.42, 0.5, rose));
      R.back.intensity = 260 * (1 + 0.5 * e.auto + 0.15 * e.bass * push);

      // Pins circle the mass just outside it, on opposite sides.
      for (let i = 0; i < 2; i++) {
        const a = this.t * 0.4 + i * Math.PI + this.orbitA;
        const l = R.pins[i];
        l.position.set(Math.sin(a) * 1.5, MC_Y + 0.9 - i * 0.8, Math.cos(a) * 1.5);
        l.intensity = 90 * this.glint[i];
      }

      // Beads bob and drift against the orbit, for parallax.
      const M = R.M, Q = R.Q, S = R.S, V = R.V;
      for (let i = 0; i < BEADS; i++) {
        const b = R.beadSeed[i];
        const a = b.az - this.t * b.w;
        V.set(Math.sin(a) * b.r, b.y + 0.18 * Math.sin(this.t * 0.5 + b.ph), Math.cos(a) * b.r);
        S.setScalar(b.size * (1 + 0.5 * this.swarmS));
        M.compose(V, Q, S);
        R.beads.setMatrixAt(i, M);
      }
      R.beads.instanceMatrix.needsUpdate = true;

      // ------------------------------------------------------------ camera
      this.orbitA += dt * (0.02 + 0.11 * Pm.orbit);
      const t = this.t, oa = this.orbitA;
      const radius = lerp(6.3, 8.2, smooth(this.swarmS)) + 0.5 * Math.sin(t * 0.11);
      const cam = R.camera;
      cam.position.set(Math.sin(oa) * radius, 1.55 + 0.6 * Math.sin(t * 0.07 + 1) + 0.5 * this.swarmS, Math.cos(oa) * radius);
      cam.up.set(0.05 * Math.sin(t * 0.13), 1, 0).normalize();
      cam.lookAt(0.25 * Math.sin(t * 0.09), MC_Y - 0.1 + 0.15 * Math.sin(t * 0.13), 0);
      cam.updateMatrixWorld();
      const fdist = cam.position.distanceTo(R.V.set(0, MC_Y, 0)) - 0.4;
      this.focus = this.focus == null ? fdist : ease(this.focus, fdist, 3, dt);

      // ------------------------------------------------------------ render
      const renderer = kit.renderer;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;

      kit.fitCamera(cam);
      const mcam = R.mirrorCam;
      mcam.projectionMatrix.copy(cam.projectionMatrix);
      mcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      const fwd = R.fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
      const up = R.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      mcam.position.set(cam.position.x, -cam.position.y, cam.position.z);
      mcam.up.set(up.x, -up.y, up.z);
      mcam.lookAt(cam.position.x + fwd.x, -(cam.position.y + fwd.y), cam.position.z + fwd.z);
      mcam.updateMatrixWorld();
      R.reflUniforms.reflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
        .multiply(mcam.projectionMatrix).multiply(mcam.matrixWorldInverse);
      R.floor.visible = false;
      renderer.setRenderTarget(R.mirrorRT);
      renderer.render(R.scene, mcam);
      R.floor.visible = true;

      const L = R.lens;
      L.shutter = 0.9;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.016 * (0.25 + Pm.focus) : 0;
      L.bloom.strength = 0.14 + 0.1 * e.auto;
      L.bloom.radius = 0.22;
      L.grade.highlightTint.value.set(lerp(1.02, 1.12, w), lerp(1.0, 0.95, w), lerp(0.96, 0.8, w));
      L.render(R.scene, cam);
      kit.composite();
    },
  });
})();
