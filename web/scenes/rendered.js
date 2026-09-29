// Rendered (spike): can three.js give viz the finish of a pro C4D / After
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
//   three.js 0.186.1 and its own addons, loaded with dynamic import() from
//   jsDelivr's +esm endpoint. Every addon URL is under the same
//   three@0.186.1 package, and jsDelivr rewrites their bare 'three' import to
//   exactly /npm/three@0.186.1/+esm, the URL the core is loaded from, so the
//   page holds one copy of three (checked 2026-09-28; mixing packages would
//   not, see docs/research/2026-09-28-js-libraries.md). No import map needed.
//
//   The lifecycle: preload() starts the import but does not wait for it in the
//   app (the rest of viz must not stall on a 750 KB module the performer may
//   never pick); draw() keeps the music state advancing and paints black
//   until the library is in, then builds the scene on the first ready frame.
//   Under the render harness preload() does hold p5's preload counter, because
//   the harness steps frames synchronously and would otherwise capture the
//   loading frames.
//
//   Render path per frame:
//     1. mirror pass: the scene from the camera reflected in the floor plane,
//        half resolution, HDR, mipmapped (roughness picks the mip, so the
//        reflection blurs like wet stone rather than a mirror)
//     2. main pass: MeshPhysicalMaterial (clearcoat, metalness), RectAreaLights
//        on the nearest strips, image-based light from a PMREM of a generated
//        dark room with orange and violet panels, exponential fog; into a
//        4x MSAA half-float target with a depth texture
//     3. lens: camera motion blur by depth reprojection against last frame's
//        view-projection, and signed circle of confusion into alpha
//     4. depth of field: scatter-as-gather disc blur, far samples clipped so
//        the background never bleeds onto a sharp foreground
//     5. UnrealBloomPass with a threshold above 1, so only the HDR emitters
//        bloom, never the lit concrete
//     6. grade: split tone (violet shadows, orange highlights), edge
//        aberration, vignette, grain, in linear light
//     7. OutputPass: AgX tone mapping and sRGB
//   The result is drawn into the p5 canvas (as every WebGL scene here is), so
//   the harness captures it. `?rendered=overlay` in the page URL instead
//   stacks the three.js canvas over the stage, to measure the copy's cost.

(function () {
  'use strict';

  const THREE_VER = '0.186.1';
  const CDN = 'https://cdn.jsdelivr.net/npm/three@' + THREE_VER;
  const ADDON = (p) => CDN + '/examples/jsm/' + p + '/+esm';

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
  const MSAA = 4;
  const RENDER_PIXELS = 2.3e6;
  const MIRROR_SCALE = 0.5;
  // Spike-only quality knobs for measuring what costs what, from the page
  // URL: ?rq=scale:0.75,msaa:0,mirror:0.5,dof:24,mb:8,rects:0
  const QUALITY = (() => {
    const q = { scale: 0, msaa: MSAA, mirror: MIRROR_SCALE, dof: 36, mb: 12, rects: 8 };
    try {
      const m = /[?&]rq=([^&]*)/.exec(location.search);
      if (m) decodeURIComponent(m[1]).split(',').forEach((kv) => { const [k, v] = kv.split(':'); if (k in q && isFinite(+v)) q[k] = +v; });
    } catch (e) { /* defaults */ }
    return q;
  })();

  // Two inks in linear light, pre-multiplied to HDR by the strip intensity.
  const SODIUM = [1.0, 0.42, 0.12];
  const VIOLET = [0.42, 0.22, 1.0];
  const WHITE = [1.0, 0.86, 0.72];

  const PRESETS = {
    calm: { speed: 0.55, bank: 0.35, focus: 0.55, shutter: 0.5, bloom: 0.35, warmth: 0.35, gates: 0 },
    drop: { speed: 1.9, bank: 0.8, focus: 0.75, shutter: 0.85, bloom: 0.6, warmth: 0.8, gates: 1 },
  };
  const DRIVE = ['speed', 'bank', 'focus', 'shutter', 'bloom', 'warmth', 'gates'];

  // ------------------------------------------------------------ the library
  let lib = null;
  let libError = null;
  let libPromise = null;
  function loadLib() {
    if (libPromise) return libPromise;
    const urls = [
      CDN + '/+esm',
      ADDON('postprocessing/EffectComposer.js'),
      ADDON('postprocessing/ShaderPass.js'),
      ADDON('postprocessing/UnrealBloomPass.js'),
      ADDON('postprocessing/OutputPass.js'),
      ADDON('lights/RectAreaLightUniformsLib.js'),
    ];
    const t0 = (window.HARNESS ? null : performance.now());
    libPromise = Promise.all(urls.map((u) => import(u))).then((m) => {
      lib = {
        THREE: m[0], EffectComposer: m[1].EffectComposer, ShaderPass: m[2].ShaderPass,
        UnrealBloomPass: m[3].UnrealBloomPass, OutputPass: m[4].OutputPass,
      };
      m[5].RectAreaLightUniformsLib.init();
      if (t0 !== null) lib.loadMs = performance.now() - t0;
      return lib;
    }, (e) => {
      libError = e;
      console.error('rendered: three.js did not load', e);
    });
    return libPromise;
  }

  // ---------------------------------------------------------------- shaders
  const FS_VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

  // Camera motion blur by reprojection, plus signed CoC (px) into alpha.
  const LENS_FRAG = `
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform mat4 invViewProj;
    uniform mat4 prevViewProj;
    uniform vec2 resolution;
    uniform float cameraNear, cameraFar, shutter, maxVel, focusDist, cocScale, maxCoc, farScale;
    varying vec2 vUv;
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      float d = texture2D(tDepth, vUv).x;
      vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      vec4 world = invViewProj * clip; world /= world.w;
      vec4 prev = prevViewProj * world;
      vec2 prevUv = prev.xy / prev.w * 0.5 + 0.5;
      vec2 vel = (vUv - prevUv) * shutter;
      float vl = length(vel * resolution);
      float vmax = maxVel * resolution.y;
      if (vl > vmax) vel *= vmax / vl;
      vec3 col = vec3(0.0);
      const int N = MB_N;
      float j = ign(gl_FragCoord.xy);
      for (int i = 0; i < N; i++) {
        float t = (float(i) + j) / float(N) - 0.5;
        col += texture2D(tColor, vUv + vel * t).rgb;
      }
      col /= float(N);
      float z = (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear));
      float coc = cocScale * (1.0 - focusDist / z);
      // Background blurs less than foreground, as a long lens focused near does.
      coc = clamp(coc > 0.0 ? coc * farScale : coc, -maxCoc, maxCoc);
      gl_FragColor = vec4(col, coc);
    }`;

  const DOF_FRAG = `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float maxCoc;
    varying vec2 vUv;
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    void main() {
      vec4 c0 = texture2D(tDiffuse, vUv);
      float r0 = abs(c0.a);
      vec3 acc = c0.rgb; float wsum = 1.0;
      const int N = DOF_N;
      float rot = ign(gl_FragCoord.xy) * 6.2831853;
      for (int i = 0; i < N; i++) {
        float t = (float(i) + 0.5) / float(N);
        float rr = sqrt(t) * maxCoc;
        float a = float(i) * 2.39996323 + rot;
        vec4 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr / resolution);
        float sr = abs(s.a);
        // A sample farther than this pixel may not spread over it by more
        // than this pixel's own blur: sharp foreground keeps its edge.
        if (s.a > c0.a) sr = min(sr, r0);
        float w = clamp(sr - rr + 1.0, 0.0, 1.0);
        acc += s.rgb * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`;

  const GRADE_FRAG = `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float warmth, split, vignette, grain, aberration, seed;
    varying vec2 vUv;
    float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() {
      vec2 dc = vUv - 0.5;
      vec2 off = dc * aberration;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv - off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv + off).b;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float tone = smoothstep(0.0, 1.0, l / (l + 0.35));
      vec3 shadowT = vec3(0.78, 0.70, 1.18);
      vec3 highT = mix(vec3(1.0, 0.93, 0.88), vec3(1.18, 0.90, 0.68), warmth);
      vec3 tint = mix(mix(vec3(1.0), shadowT, split), mix(vec3(1.0), highT, split), tone);
      c *= tint;
      c += vec3(0.0035, 0.0015, 0.007) * split;
      float asp = resolution.x / resolution.y;
      float v = length(dc * vec2(asp, 1.0));
      c *= mix(1.0, smoothstep(1.25, 0.25, v), vignette);
      float n = h12(gl_FragCoord.xy + seed * 917.0) - 0.5;
      c *= 1.0 + n * grain;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`;

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
  function makeEnvironment(T, renderer) {
    const env = new T.Scene();
    const room = new T.Mesh(new T.BoxGeometry(20, 10, 40), new T.MeshBasicMaterial({ color: 0x050409, side: T.BackSide }));
    env.add(room);
    const panel = (w, h, pos, rgb, k, rotY) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(rgb[0] * k, rgb[1] * k, rgb[2] * k), side: T.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]);
      if (rotY) m.rotation.y = rotY;
      env.add(m);
    };
    panel(0.4, 30, [-3, 4.9, 0], WHITE, 6, 0);
    env.children[env.children.length - 1].rotation.x = Math.PI / 2;
    panel(0.4, 30, [3, 4.9, 0], WHITE, 6, 0);
    env.children[env.children.length - 1].rotation.x = Math.PI / 2;
    for (let i = -3; i <= 3; i++) {
      panel(0.3, 6, [-9.9, 3, i * 5], i % 2 ? SODIUM : VIOLET, 5, Math.PI / 2);
      panel(0.3, 6, [9.9, 3, i * 5 + 2.5], i % 2 ? VIOLET : SODIUM, 5, -Math.PI / 2);
    }
    panel(8, 3, [0, 2, -19.9], SODIUM, 1.2, 0);
    const pm = new T.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.02);
    pm.dispose();
    return rt.texture;
  }

  // ------------------------------------------------------------ scene build
  function build(self, w, h) {
    const T = lib.THREE;
    const canvas = document.createElement('canvas');
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.toneMapping = T.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = T.SRGBColorSpace;

    const scene = new T.Scene();
    scene.background = new T.Color(0.004, 0.003, 0.008);
    scene.fog = new T.FogExp2(new T.Color(0.012, 0.008, 0.02), 0.028);
    scene.environment = makeEnvironment(T, renderer);
    scene.environmentIntensity = 0.55;

    const camera = new T.PerspectiveCamera(52, w / h, 0.1, 140);
    const mirrorCam = new T.PerspectiveCamera(52, w / h, 0.1, 140);
    const hall = new T.Group();
    scene.add(hall);

    const concreteMap = concreteTexture(T);
    const concrete = new T.MeshPhysicalMaterial({ color: 0x8a847c, map: concreteMap, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
    const concreteDark = new T.MeshPhysicalMaterial({ color: 0x2c2a2b, map: concreteMap, roughness: 0.9, metalness: 0, envMapIntensity: 0.4 });
    const chrome = new T.MeshPhysicalMaterial({ color: 0xe6e4ee, roughness: 0.1, metalness: 1, envMapIntensity: 1.3 });
    const lacquer = new T.MeshPhysicalMaterial({ color: 0x0a090c, roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
    const emit = new T.MeshBasicMaterial({ color: 0xffffff, fog: true, toneMapped: false });

    // Floor: polished black stone with a planar reflection injected into a
    // physical material (so it is still lit by the rect lights).
    const floorRough = floorTexture(T);
    floorRough.repeat.set(5, (SLOTS * P) / 2);
    const mirrorRT = new T.WebGLRenderTarget(Math.max(1, Math.round(w * (QUALITY.mirror || 0.05))), Math.max(1, Math.round(h * (QUALITY.mirror || 0.05))), {
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
    for (let i = 0; i < QUALITY.rects; i++) {
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
    const DUST = 320;
    const dPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dPos[i * 3] = (Math.random() * 2 - 1) * HALL_W;
      dPos[i * 3 + 1] = 0.2 + Math.random() * (HALL_H - 0.5);
      dPos[i * 3 + 2] = -Math.random() * 30 + 3;
    }
    const dGeo = new T.BufferGeometry();
    dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3));
    const dustMat = new T.PointsMaterial({ color: new T.Color(1.2, 0.8, 0.6), size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, fog: true });
    const dust = new T.Points(dGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // Render targets and the post chain.
    const sceneRT = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: QUALITY.msaa, depthBuffer: true });
    sceneRT.depthTexture = new T.DepthTexture(w, h);
    sceneRT.depthTexture.type = T.FloatType;

    const composer = new lib.EffectComposer(renderer, new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, depthBuffer: false }));
    composer.setPixelRatio(1);
    composer.setSize(w, h);
    const lens = new lib.ShaderPass(new T.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null },
        invViewProj: { value: new T.Matrix4() }, prevViewProj: { value: new T.Matrix4() },
        resolution: { value: new T.Vector2(w, h) },
        cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
        shutter: { value: 0.5 }, maxVel: { value: 0.04 },
        focusDist: { value: 6 }, cocScale: { value: 8 }, maxCoc: { value: 16 }, farScale: { value: 0.45 },
      },
      defines: { MB_N: Math.max(1, QUALITY.mb | 0) }, vertexShader: FS_VERT, fragmentShader: LENS_FRAG, depthTest: false, depthWrite: false,
    }), 'none');
    const dof = new lib.ShaderPass(new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, resolution: { value: new T.Vector2(w, h) }, maxCoc: { value: 16 } },
      defines: { DOF_N: Math.max(1, QUALITY.dof | 0) }, vertexShader: FS_VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false,
    }));
    const bloom = new lib.UnrealBloomPass(new T.Vector2(w, h), 0.6, 0.55, 1.6);
    const grade = new lib.ShaderPass(new T.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, resolution: { value: new T.Vector2(w, h) },
        warmth: { value: 0.5 }, split: { value: 1 }, vignette: { value: 0.55 }, grain: { value: 0.07 }, aberration: { value: 0.004 }, seed: { value: 0 },
      },
      vertexShader: FS_VERT, fragmentShader: GRADE_FRAG, depthTest: false, depthWrite: false,
    }));
    const output = new lib.OutputPass();
    composer.addPass(lens);
    composer.addPass(dof);
    composer.addPass(bloom);
    composer.addPass(grade);
    composer.addPass(output);

    return {
      T, canvas, renderer, scene, camera, mirrorCam, hall, floor, floorMat, reflUniforms, mirrorRT, sceneRT,
      fins, beams, wallStrips, ceilStrips, gates, forms, rects, ceilRects, dust, dustMat,
      composer, lens, dof, bloom, grade, w, h,
      prevVP: null, tmpM: new T.Matrix4(), tmpM2: new T.Matrix4(), col: new T.Color(),
      overlay: false,
    };
  }

  function resize(R, w, h) {
    R.w = w; R.h = h;
    R.renderer.setSize(w, h, false);
    R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    R.mirrorCam.aspect = w / h;
    R.sceneRT.setSize(w, h);
    R.mirrorRT.setSize(Math.max(1, Math.round(w * (QUALITY.mirror || 0.05))), Math.max(1, Math.round(h * (QUALITY.mirror || 0.05))));
    R.composer.setSize(w, h);
    for (const pass of [R.lens, R.dof, R.grade]) pass.uniforms.resolution.value.set(w, h);
    R.prevVP = null;
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'rendered',
    name: 'Rendered (spike)',
    order: 990,

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
    // grade on top of this scene's own lens chain, which is the point of it.
    finish: false,

    gallery: {
      title: 'Rendered (spike)',
      technique: 'three.js 0.186.1 loaded at runtime from jsDelivr (+esm, one core shared by every addon): MeshPhysicalMaterial concrete, chrome and clearcoat lacquer under RectAreaLights and a PMREM of a generated room; a half-resolution planar mirror pass injected into the floor\'s physical material with roughness-driven mip blur and streaks; 4x MSAA half-float HDR; camera motion blur by depth reprojection; scatter-as-gather depth of field; UnrealBloomPass thresholded above 1 so only emitters bloom; split-tone grade, aberration, grain; AgX tone mapping. Composited into the p5 canvas.',
      brief: 'A banked flight down an endless brutalist colonnade at night: board-formed concrete fins, a black stone floor that mirrors the light, sodium and violet strips as the only sources, chrome and lacquer forms on plinths. The finish is the point: lit, filmic, shallow focus, no neon wash. The kick sends a pulse of light running away down the ceiling strips; claps turn every form a quarter turn; hats glint the dust near the lens; bass swells the speed. On the drop the gates of light switch on down the hall, the flight speeds and banks harder and the grade warms.',
      lineage: 'A feasibility spike (2026-09-28) against the finish of professional Cinema 4D / After Effects VJ loops (a neon-city fly-through with DOF, motion blur, emissive-only bloom and a split-tone grade); original subject after Tadao Ando\'s concrete and the long lit halls of architectural visualisation.',
    },

    preload(p) {
      // In the app, start fetching early but never hold the page for it.
      // Under the harness, hold p5's preload so captured frames are rendered.
      const hold = !!window.HARNESS && typeof p._incrementPreload === 'function';
      if (hold) p._incrementPreload();
      loadLib().then(() => { if (hold) p._decrementPreload(); });
    },

    setup() {},

    enter() {
      loadLib();
      this.lastMs = null;
      this.dist = 0;
      this.t = 0;
      this.env = { kick: 0, prevK: 0, snare: 0, prevS: 0, b4: 0, b8: 0, hat: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.pulses = [];
      this.turns = 0;        // quarter turns owed to the forms
      this.turnPos = 0;      // eased
      this.glints = 0;
      this.smSpeed = 0.8;
      if (this.R) this.R.prevVP = null;
    },

    leave() {
      // Give the GPU back most of the memory (the MSAA HDR targets at
      // 3024x1890 are ~300 MB) but keep the compiled programs.
      if (this.R) {
        resize(this.R, 2, 2);
        if (this.R.overlay && this.R.canvas.parentNode) this.R.canvas.parentNode.removeChild(this.R.canvas);
        this.R.overlay = false;
      }
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
      if (!this.env) this.enter();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const Pm = {};
      for (const k of DRIVE) Pm[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      // Music state advances whether or not three.js is in yet.
      this.t += dt;
      const target = Pm.speed * (0.55 + 0.9 * e.bass * push) * 5.5;
      this.smSpeed = ease(this.smSpeed, target, 1.5, dt);
      this.dist += this.smSpeed * dt;
      for (const q of this.pulses) q.age += dt;
      this.pulses = this.pulses.filter((q) => q.age < 2.2);
      this.turnPos = ease(this.turnPos, this.turns, 5, dt);

      const g = p.drawingContext;
      if (!lib) {
        p.background(0);
        if (libError) {
          p.push(); p.fill(170, 60, 60); p.noStroke(); p.textAlign(p.CENTER, p.CENTER); p.textSize(16);
          p.text('three.js did not load (see console)', ctx.width / 2, ctx.height / 2);
          p.pop();
        }
        return;
      }

      // Render at about 1080p's pixel count and let the composite scale up:
      // measured 2026-09-28 on the M4 Pro, the full chain holds 60 fps at
      // 0.63 of 3024x1890 (2.3 MP) and manages 16 fps at full size. After
      // depth of field, motion blur and grain the upscale does not show.
      const dw = p.width * p.pixelDensity(), dh = p.height * p.pixelDensity();
      const scale = QUALITY.scale > 0 ? QUALITY.scale : Math.min(1, Math.sqrt(RENDER_PIXELS / (dw * dh)));
      const w = Math.max(2, Math.round(dw * scale));
      const h = Math.max(2, Math.round(dh * scale));
      if (!this.R) {
        const t0 = performance.now();
        this.R = build(this, w, h);
        this.buildMs = performance.now() - t0;   // spike: reported by the probe
      }
      const R = this.R;
      if (R.w !== w || R.h !== h) resize(R, w, h);
      const T = R.T;

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
      const renderer = R.renderer;
      const prof = window.__renderedProf;   // spike: per-section CPU timing when set
      const tA = performance.now();
      // Mirror camera: reflect position, target and up through y = 0.
      const mc = R.mirrorCam;
      mc.projectionMatrix.copy(cam.projectionMatrix);
      mc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      const fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      mc.position.set(cam.position.x, -cam.position.y, cam.position.z);
      mc.up.set(up.x, -up.y, up.z);
      mc.lookAt(cam.position.x + fwd.x, -(cam.position.y + fwd.y), cam.position.z + fwd.z);
      mc.updateMatrixWorld();
      R.reflUniforms.reflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
        .multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
      if (QUALITY.mirror > 0) {
        R.floor.visible = false; R.dust.visible = false;
        renderer.setRenderTarget(R.mirrorRT);
        renderer.render(R.scene, mc);
        R.floor.visible = true; R.dust.visible = true;
      }
      R.reflUniforms.reflStrength.value = QUALITY.mirror > 0 ? 1 : 0;

      const tB = performance.now();
      renderer.setRenderTarget(R.sceneRT);
      renderer.clear();
      renderer.render(R.scene, cam);

      // Lens uniforms: this frame's inverse VP; last frame's VP with the
      // hall's travel folded in (the world moves, not the camera).
      const vp = R.tmpM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      const L = R.lens.uniforms;
      L.tColor.value = R.sceneRT.texture;
      L.tDepth.value = R.sceneRT.depthTexture;
      L.invViewProj.value.copy(vp).invert();
      const moved = this.prevDist == null ? 0 : this.dist - this.prevDist;
      if (R.prevVP) L.prevViewProj.value.copy(R.prevVP).multiply(R.tmpM2.makeTranslation(0, 0, -moved));
      else L.prevViewProj.value.copy(vp);
      R.prevVP = (R.prevVP || new T.Matrix4()).copy(vp);
      this.prevDist = this.dist;
      const shortSide = Math.min(w, h);
      L.shutter.value = Pm.shutter * 1.4;
      L.maxVel.value = 0.05;
      L.focusDist.value = this.focus;
      const maxCoc = shortSide * 0.014 * (0.3 + Pm.focus);
      L.cocScale.value = maxCoc * 0.9;
      L.maxCoc.value = maxCoc;
      R.dof.uniforms.maxCoc.value = maxCoc;
      R.dof.enabled = Pm.focus > 0.02;

      R.bloom.strength = 0.06 + 0.34 * Pm.bloom;
      R.bloom.radius = 0.2 + 0.25 * Pm.bloom;
      R.bloom.threshold = 2.0;
      const G = R.grade.uniforms;
      G.warmth.value = warm;
      G.seed.value = (p.frameCount % 97);
      renderer.toneMappingExposure = 1.0;

      const tC = performance.now();
      R.composer.render(dt);
      if (this.firstFrameMs == null) { R.renderer.getContext().finish(); this.firstFrameMs = performance.now() - tC; window.__renderedStart = { loadMs: lib.loadMs, buildMs: this.buildMs, firstFrameMs: this.firstFrameMs + (tC - tA) }; }
      const tD = performance.now();

      // --------------------------------------------------------- composite
      if (!R.overlay && /[?&]rendered=overlay\b/.test(location.search)) {
        const stage = document.getElementById('stage');
        if (stage) {
          R.canvas.style.cssText = 'position:absolute;left:0;top:0;width:' + p.width + 'px;height:' + p.height + 'px;pointer-events:none;';
          stage.appendChild(R.canvas);
          R.overlay = true;
        }
      }
      if (!R.overlay) g.drawImage(R.canvas, 0, 0, ctx.width, ctx.height);
      if (prof) {
        const tE = performance.now();
        prof.push({ mirror: tB - tA, main: tC - tB, post: tD - tC, blit: tE - tD, calls: renderer.info.render.calls, programs: renderer.info.programs.length });
      }
    },
  });
})();
