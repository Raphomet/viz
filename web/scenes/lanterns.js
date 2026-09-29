// Lanterns: paper sky lanterns rising over a dark, still lake at night.
//
// The light in this world comes from paper. Each lantern is a lathe of thin
// paper on bamboo ribs with a flame at its mouth; the paper is shaded as a
// translucent shell lit from inside (brightest near the flame and where it is
// thinnest to the eye, redder at grazing angles, rib and hoop shadows, fibre
// and thickness blotches), so it is the lantern itself that glows, not a
// sprite around it. The lake mirrors them all in long vertical streaks, as
// still water does; a low moon behind mist gives the only cool light, over
// three ridges of hills fading into haze. Reeds, wet rocks and old mooring
// posts drift past in the foreground, lit warm by the nearest lanterns.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a lantern is let go from the water: it flares as it lifts, lights
//           the reeds and rocks round it, and a ring runs out on the lake
//   clap    a breath of wind: every lantern leans and drifts together, the
//           flames gutter bright, the reeds bow
//   hats    glitter on the water, only where something bright is mirrored
//           (the moon path, the lantern streaks)
//   bass    the flames swell and the lanterns rise faster
//   drop    with Follow the track: a flock is released along the shore, the
//           camera lifts its gaze, floating lanterns crowd the water and the
//           bloom opens
//
// How it is made (web/three-kit.js; CONTRACT.md, "three.js scenes"):
//   1. mirror pass: the scene from the camera reflected in y = 0, at 0.35 of
//      the render size (the streaks blur it anyway), HDR, mipmapped
//   2. main pass: instanced lanterns in a hand-written paper shader; a water
//      MeshStandardMaterial with the mirror injected, ripple and swell normals
//      that bend the reflection, a vertical streak for the wet-light look and hashed glitter; reeds that
//      sway in the vertex shader; wet stone and wood; a sky dome with moon and
//      haze; hill ridges and exponential fog
//   3. the kit lens: depth of field racking slowly between the near launches
//      and the far flock (which melts into bokeh), bloom thresholded above 1
//      so only flames, the hottest paper and the moon bloom, a moonlit
//      split-tone grade

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);

  const POOL = 360;          // sky lanterns, near and far
  const FLOATS = 48;         // lanterns floating on the water
  const PITCH = 6;           // metres per foreground slot
  const SLOTS = 16;          // slots from 2 behind the camera to 13 ahead
  const BEHIND = 2;
  const BLADES = 26;         // reed blades per clump
  const RIPPLES = 8;
  const LIGHTS = 4;          // point lights riding the newest near lanterns
  const MIRROR_SCALE = 0.35;

  // Moon direction (from the camera), low and left of the flight line.
  const MOON = [-0.36, 0.2, -0.91];
  const MOON_LEN = Math.hypot(MOON[0], MOON[1], MOON[2]);
  const MOON_DIR = MOON.map((v) => v / MOON_LEN);

  // Paper inks, linear. Three papers per look; each lantern picks one by hash.
  const PAPERS = [
    { name: 'Ivory and amber', inks: [[1.0, 0.46, 0.05], [1.0, 0.56, 0.09], [1.0, 0.36, 0.035]] },
    { name: 'Persimmon', inks: [[1.0, 0.26, 0.025], [1.0, 0.34, 0.04], [0.95, 0.18, 0.02]] },
    { name: 'Rice paper', inks: [[1.0, 0.66, 0.24], [1.0, 0.58, 0.16], [0.98, 0.74, 0.34]] },
  ];

  const PRESETS = {
    calm: { density: 0.35, rise: 0.4, drift: 0.35, gaze: 0.3, moon: 0.7, focus: 0.6, bloom: 0.4, floats: 0.35 },
    drop: { density: 0.95, rise: 0.8, drift: 0.55, gaze: 0.7, moon: 0.5, focus: 0.75, bloom: 0.55, floats: 0.9 },
  };
  const DRIVE = ['density', 'rise', 'drift', 'gaze', 'moon', 'focus', 'bloom', 'floats'];

  // -------------------------------------------------------------- shaders
  // Paper lit from inside. Shared by the sky lanterns (a lathe, flame at the
  // mouth) and the floating ones (a box, flame at the base); `aInst` is
  // (glow, seed, ink index, flare).
  const PAPER_VERT = `
    attribute vec4 aInst;
    varying vec3 vLocal;
    varying vec3 vNormalV;
    varying vec3 vViewPos;
    varying vec4 vInst;
    void main() {
      vLocal = position;
      vInst = aInst;
      mat4 mw = modelMatrix * instanceMatrix;
      vec4 wp = mw * vec4(position, 1.0);
      vec4 mv = viewMatrix * wp;
      vViewPos = mv.xyz;
      vNormalV = normalize(mat3(viewMatrix) * mat3(mw) * normal);
      gl_Position = projectionMatrix * mv;
    }`;

  const PAPER_FRAG = `
    uniform vec3 ink0, ink1, ink2, fogColor, moonV;
    uniform float time, fogDensity, heat;
    varying vec3 vLocal;
    varying vec3 vNormalV;
    varying vec3 vViewPos;
    varying vec4 vInst;
    float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float vnoise(vec3 p) {
      vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    void main() {
      float glow = vInst.x, seed = vInst.y, flare = vInst.w;
      vec3 ink = vInst.z < 0.5 ? ink0 : vInst.z < 1.5 ? ink1 : ink2;
      vec3 n = normalize(vNormalV);
      vec3 v = normalize(-vViewPos);
      bool inside = !gl_FrontFacing;
      if (inside) n = -n;
      float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
      vec3 lp = vLocal;
    #ifdef BOX
      vec3 flame = vec3(0.0, 0.06, 0.0);
      vec3 q = abs(lp) / vec3(0.15, 1.0, 0.15);
      float fx = smoothstep(0.9, 0.97, max(q.x, 0.0)) * smoothstep(0.9, 0.97, q.z);
      float frame = max(fx, max(smoothstep(0.018, 0.0, lp.y), smoothstep(0.262, 0.28, lp.y)));
      float ribs = 1.0 - 0.8 * frame;
      float fall = 1.0 / (0.35 + dot(lp - flame, lp - flame) * 40.0);
    #else
      vec3 flame = vec3(0.0, 0.1, 0.0);
      float ang = atan(lp.z, lp.x) / 6.2831853 + seed;
      float fr = fract(ang * 8.0);
      float rib = smoothstep(0.03, 0.0, min(fr, 1.0 - fr));
      float hoop = smoothstep(0.035, 0.012, lp.y);
      float ribs = (1.0 - 0.55 * rib) * (1.0 - 0.85 * hoop);
      // A glued seam where two sheets overlap: a thin darker band.
      float sf = fract(ang + 0.37);
      ribs *= 1.0 - 0.25 * smoothstep(0.012, 0.0, min(sf, 1.0 - sf));
      float fall = 1.0 / (0.2 + dot(lp - flame, lp - flame) * 4.0);
    #endif
      // Paper thickness: large blotches plus fibre.
      float thick = vnoise(lp * 7.0 + seed * 13.0) * 0.6 + vnoise(lp * 38.0 + seed * 5.0) * 0.4;
      float fibre = vnoise(vec3(lp.x * 140.0, lp.y * 22.0, lp.z * 140.0) + seed);
      float trans = (0.72 + 0.28 * (1.0 - thick)) * (0.9 + 0.1 * fibre);
      float flick = 1.0 + 0.07 * sin(time * 11.0 + seed * 40.0) + 0.05 * sin(time * 23.3 + seed * 17.0) + heat * 0.18 * sin(time * 31.0 + seed * 9.0);
      // Straight through the paper is thin and gold; at grazing angles the
      // light crosses more paper and comes out deeper and redder.
      vec3 deep = ink * vec3(1.0, 0.55, 0.3);
      vec3 col = mix(deep, ink, pow(ndv, 0.7)) * (0.35 + 0.65 * ndv);
      float I = glow * flick * (1.0 + 0.8 * flare) * fall * trans * ribs;
      if (inside) I *= 1.5;
      col *= I * 0.8;
      // Faint cool moonlight on the outside of the paper.
      col += vec3(0.03, 0.04, 0.07) * max(dot(n, moonV), 0.0) * (1.0 - 0.6 * ribs);
      float d = length(vViewPos);
      float fog = 1.0 - exp(-d * d * fogDensity * fogDensity);
      gl_FragColor = vec4(mix(col, fogColor, fog), 1.0);
    }`;

  const SKY_VERT = `
    varying vec3 vDir;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vDir = wp.xyz - cameraPosition;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const SKY_FRAG = `
    uniform vec3 moonDir, horizon, zenith, moonCol;
    uniform float moon, time, mirrorK;
    varying vec3 vDir;
    float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() {
      vec3 d = normalize(vDir);
      float el = d.y;
      float up = clamp(el, 0.0, 1.0);
      vec3 col = mix(horizon, zenith, pow(up, 0.45));
      // Below the horizon (seen only past the hills or in the mirror) the
      // haze holds.
      if (el < 0.0) col = horizon;
      float mc = max(dot(d, moonDir), 0.0);
      col += moonCol * moon * mirrorK * (0.025 * pow(mc, 6.0) + 0.06 * pow(mc, 60.0) + 0.25 * pow(mc, 900.0));
      // The disc: a hard edge with faint maria.
      float disc = smoothstep(0.99975, 0.99983, mc);
      float mar = 0.8 + 0.2 * h21(floor(d.xz * 900.0));
      col += moonCol * moon * mirrorK * disc * 2.4 * mar;
      // Stars: a hashed grid on the dome, thinned toward the haze.
      vec2 g = vec2(atan(d.z, d.x) * 180.0, el * 360.0);
      vec2 cell = floor(g);
      float r = h21(cell);
      vec2 off = vec2(h21(cell + 7.1), h21(cell + 3.3));
      float s = smoothstep(0.26, 0.0, length(fract(g) - off)) * step(0.985, r);
      float tw = 0.7 + 0.3 * sin(time * (1.0 + r * 3.0) + r * 60.0);
      col += vec3(0.8, 0.85, 1.0) * s * tw * (r - 0.985) * 50.0 * smoothstep(0.04, 0.3, el) * (1.0 - 0.5 * moon);
      gl_FragColor = vec4(col, 1.0);
    }`;

  // ------------------------------------------------------------- geometry
  function lanternGeometry(T) {
    // A sky lantern's profile, bottom mouth to rounded crown, in metres.
    const pts = [];
    const prof = [
      [0.2, 0.0], [0.23, 0.08], [0.27, 0.2], [0.31, 0.36], [0.335, 0.52], [0.34, 0.66],
      [0.33, 0.76], [0.3, 0.85], [0.25, 0.92], [0.17, 0.97], [0.08, 0.995], [0.0, 1.0],
    ];
    for (const [r, y] of prof) pts.push(new T.Vector2(r, y));
    return new T.LatheGeometry(pts, 20);
  }

  function ridgeGeometry(T, radius, height, seed, rough) {
    // An arc of hills round the camera: a strip whose top is layered noise.
    const N = 240, A0 = -1.9, A1 = 1.9;
    const pos = [];
    const idx = [];
    const noise = (x) => {
      const i = Math.floor(x), f = x - i;
      return lerp(hash(i * 1.37 + seed), hash((i + 1) * 1.37 + seed), smooth(f));
    };
    for (let i = 0; i <= N; i++) {
      const a = lerp(A0, A1, i / N);
      const x = a * 6;
      const h = height * (0.35 + 0.45 * noise(x * 0.5) + 0.25 * noise(x * 1.7) * rough + 0.1 * noise(x * 5.1) * rough);
      const sx = Math.sin(a) * radius, sz = -Math.cos(a) * radius;
      pos.push(sx, -4, sz, sx, h, sz);
      if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function rockGeometry(T) {
    const g = new T.IcosahedronGeometry(1, 3);
    const p = g.attributes.position;
    const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 0.75 + 0.2 * Math.sin(v.x * 3.1 + 1.3) * Math.sin(v.z * 2.7) + 0.08 * Math.sin(v.x * 9 + v.y * 7) + 0.1 * hash(Math.round(v.x * 40) * 3.1 + Math.round(v.y * 40) * 7.7 + Math.round(v.z * 40));
      v.multiplyScalar(n);
      v.y = v.y > 0 ? v.y * 0.7 : v.y * 0.3;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  function stoneTexture(T) {
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const b = 0.55 + 0.25 * hash(Math.floor(x / 9) * 3.7 + Math.floor(y / 7) * 11.3) + 0.2 * hash(x * 0.71 + y * 1.37);
        const i = (y * n + x) * 4;
        data[i] = Math.round(b * 200); data[i + 1] = Math.round(b * 205); data[i + 2] = Math.round(b * 200); data[i + 3] = 255;
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

  // A night environment for the stone, wood and reeds: deep blue with the
  // moon's glow low on one side and a warm band where the lanterns are.
  function environment(T, env) {
    env.add(new T.Mesh(new T.SphereGeometry(50, 32, 16), new T.MeshBasicMaterial({ color: new T.Color(0.006, 0.008, 0.016), side: T.BackSide })));
    const moon = new T.Mesh(new T.CircleGeometry(4, 24), new T.MeshBasicMaterial({ color: new T.Color(3, 3.3, 4), side: T.DoubleSide }));
    moon.position.set(MOON_DIR[0] * 45, MOON_DIR[1] * 45, MOON_DIR[2] * 45);
    moon.lookAt(0, 0, 0);
    env.add(moon);
    const haze = new T.Mesh(new T.PlaneGeometry(90, 6), new T.MeshBasicMaterial({ color: new T.Color(0.04, 0.05, 0.08), side: T.DoubleSide }));
    haze.position.set(0, 2, -40);
    env.add(haze);
    for (let i = 0; i < 6; i++) {
      const w = new T.Mesh(new T.CircleGeometry(1.4, 16), new T.MeshBasicMaterial({ color: new T.Color(1.2, 0.6, 0.25), side: T.DoubleSide }));
      w.position.set(-20 + i * 8, 10 + 6 * hash(i), -30 - 5 * hash(i + 3));
      w.lookAt(0, 0, 0);
      env.add(w);
    }
  }

  // ------------------------------------------------------------ scene build
  function build(kit) {
    const T = kit.THREE;
    const scene = new T.Scene();
    const HORIZON = new T.Color(0.014, 0.019, 0.036);
    scene.background = HORIZON.clone();
    scene.fog = new T.FogExp2(HORIZON.clone(), 0.0085);
    scene.environment = kit.environment(environment, 0.04);
    scene.environmentIntensity = 0.6;

    const camera = new T.PerspectiveCamera(46, kit.aspect, 0.1, 600);
    const mirrorCam = new T.PerspectiveCamera(46, kit.aspect, 0.1, 600);
    const moonDir = new T.Vector3(MOON_DIR[0], MOON_DIR[1], MOON_DIR[2]);

    // Sky dome and hills ride with the camera: they are far enough that
    // parallax would be a pixel at most.
    const far = new T.Group();
    scene.add(far);
    const skyUniforms = {
      moonDir: { value: moonDir.clone() },
      horizon: { value: new T.Vector3(HORIZON.r, HORIZON.g, HORIZON.b) },
      zenith: { value: new T.Vector3(0.0008, 0.0012, 0.004) },
      moonCol: { value: new T.Vector3(0.9, 0.95, 1.1) },
      moon: { value: 0.7 },
      mirrorK: { value: 1 },
      time: { value: 0 },
    };
    const sky = new T.Mesh(new T.SphereGeometry(450, 32, 16), new T.ShaderMaterial({
      uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: T.BackSide, depthWrite: false, fog: false,
    }));
    sky.renderOrder = -1;
    far.add(sky);
    const ridgeMat = [
      new T.MeshStandardMaterial({ color: 0x0b0d12, roughness: 1, envMapIntensity: 0.3 }),
      new T.MeshStandardMaterial({ color: 0x0a0c11, roughness: 1, envMapIntensity: 0.3 }),
      new T.MeshStandardMaterial({ color: 0x07080b, roughness: 1, envMapIntensity: 0.3 }),
    ];
    far.add(new T.Mesh(ridgeGeometry(T, 190, 38, 11.3, 0.6), ridgeMat[0]));
    far.add(new T.Mesh(ridgeGeometry(T, 130, 22, 4.7, 0.9), ridgeMat[1]));
    far.add(new T.Mesh(ridgeGeometry(T, 90, 9, 23.9, 1.2), ridgeMat[2]));

    // Moonlight reaches stone, wood and reeds through the environment map
    // only. A DirectionalLight also struck the water's GGX lobe and, spread
    // by the wave normals, washed half the lake white (2026-09-29, GPU
    // sheet); the moon path now comes from the mirror alone.
    const hemi = new T.HemisphereLight(0x1a2240, 0x050403, 0.25);
    scene.add(hemi);

    // Point lights that ride the newest near lanterns.
    const lights = [];
    for (let i = 0; i < LIGHTS; i++) {
      const l = new T.PointLight(new T.Color(1.0, 0.55, 0.25), 0, 22, 2);
      scene.add(l);
      lights.push({ light: l, idx: -1, level: 0 });
    }

    // --------------------------------------------------------------- water
    const mirrorRT = kit.target(MIRROR_SCALE, {
      type: T.HalfFloatType, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, generateMipmaps: true, depthBuffer: true,
    });
    const ripples = [];
    for (let i = 0; i < RIPPLES; i++) ripples.push(new T.Vector4(0, 0, 99, 0));
    const waterU = {
      tReflect: { value: mirrorRT.texture },
      reflMatrix: { value: new T.Matrix4() },
      ripples: { value: ripples },
      wTime: { value: 0 },
      wSwell: { value: 0.3 },
      wGlint: { value: 0 },
      wStreak: { value: 0.012 },
    };
    const waterMat = new T.MeshStandardMaterial({ color: 0x010203, roughness: 0.07, metalness: 0, envMapIntensity: 0.0 });
    waterMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, waterU);
      sh.vertexShader = 'uniform mat4 reflMatrix;\nvarying vec4 vReflUv;\nvarying vec3 vWp;\n' + sh.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vec4 wpx = modelMatrix * vec4(transformed, 1.0);\n  vWp = wpx.xyz;\n  vReflUv = reflMatrix * wpx;');
      sh.fragmentShader = `uniform sampler2D tReflect;
        uniform vec4 ripples[${RIPPLES}];
        uniform float wTime, wSwell, wGlint, wStreak;
        varying vec4 vReflUv;
        varying vec3 vWp;
        float wh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
        vec2 waveGrad(vec2 p) {
          vec2 g = vec2(0.0);
          // Still water: a long slow swell and a faint cat's-paw chop.
          g += vec2(0.8, 0.3) * cos(dot(p, vec2(0.8, 0.3)) * 0.9 + wTime * 0.7) * 0.02;
          g += vec2(-0.4, 0.9) * cos(dot(p, vec2(-0.4, 0.9)) * 1.7 + wTime * 1.1) * 0.012;
          g += vec2(0.95, -0.3) * cos(dot(p, vec2(0.95, -0.3)) * 4.3 + wTime * 1.9) * 0.006;
          g += vec2(0.2, 1.0) * cos(dot(p, vec2(0.2, 1.0)) * 7.9 - wTime * 2.3) * 0.004;
          g *= wSwell;
          for (int i = 0; i < ${RIPPLES}; i++) {
            vec4 r = ripples[i];
            if (r.w <= 0.0) continue;
            vec2 d = p - r.xy;
            float dist = length(d) + 1e-3;
            float front = r.z * 1.5;
            float x = dist - front;
            float env = exp(-x * x * 3.0) * r.w * exp(-r.z * 0.5) / (1.0 + front * 0.6);
            g += d / dist * sin(x * 10.0) * env * 0.25;
          }
          return g;
        }
        ` + sh.fragmentShader
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 wg = waveGrad(vWp.xz);
          normal = normalize(normal + (viewMatrix * vec4(-wg.x, 0.0, -wg.y, 0.0)).xyz * 3.0);`)
        // The lantern point lights' own GGX highlight on the water sat as a
        // white-hot spot at the bottom of the frame, doubling the mirrored
        // lantern and flaring on every launch (jolt, 2026-09-29): the mirror
        // already carries the lanterns, so the lights barely touch the water.
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          reflectedLight.directSpecular *= 0.1;`)
        .replace('#include <opaque_fragment>', `{
          vec2 ruv = vReflUv.xy / vReflUv.w + wg * vec2(0.35, 0.6);
          vec3 refl = vec3(0.0);
          // Lights on still water stretch into long vertical streaks.
          for (int i = 0; i < 7; i++) {
            float o = (float(i) - 3.0) * wStreak;
            refl += textureLod(tReflect, ruv + vec2(0.0, o), 0.5 + abs(float(i) - 3.0) * 0.5).rgb * (1.0 - abs(float(i) - 3.0) * 0.12);
          }
          refl /= 5.56;
          float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
          float amt = mix(0.2, 1.0, fres);
          // Glitter: tiny facets catching whatever bright thing is mirrored.
          vec2 gc = floor(vWp.xz * vec2(26.0, 9.0));
          float sp = step(0.93, wh(gc + floor(wTime * 9.0) * 17.0));
          float lum = dot(refl, vec3(0.3, 0.5, 0.2));
          refl *= 1.0 + sp * wGlint * 5.0 * smoothstep(0.02, 0.2, lum);
          outgoingLight += refl * amt;
        }
        #include <opaque_fragment>`);
    };
    const water = new T.Mesh(new T.PlaneGeometry(1200, 1200, 1, 1), waterMat);
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    // ----------------------------------------------------------- lanterns
    const paperU = {
      ink0: { value: new T.Vector3() }, ink1: { value: new T.Vector3() }, ink2: { value: new T.Vector3() },
      fogColor: { value: new T.Vector3(HORIZON.r, HORIZON.g, HORIZON.b) },
      fogDensity: { value: 0.0085 },
      moonV: { value: new T.Vector3() },
      time: { value: 0 },
      heat: { value: 0 },
    };
    const paperMat = new T.ShaderMaterial({ uniforms: paperU, vertexShader: PAPER_VERT, fragmentShader: PAPER_FRAG, side: T.DoubleSide });
    const boxMat = new T.ShaderMaterial({ uniforms: paperU, vertexShader: PAPER_VERT, fragmentShader: PAPER_FRAG, side: T.DoubleSide, defines: { BOX: '' } });

    const lanternGeo = lanternGeometry(T);
    const lanternInst = new Float32Array(POOL * 4);
    lanternGeo.setAttribute('aInst', new T.InstancedBufferAttribute(lanternInst, 4).setUsage(T.DynamicDrawUsage));
    const lanterns = new T.InstancedMesh(lanternGeo, paperMat, POOL);
    lanterns.instanceMatrix.setUsage(T.DynamicDrawUsage);
    lanterns.frustumCulled = false;
    scene.add(lanterns);

    // Flames: a small hot bead in each mouth, the thing that blooms.
    const flameMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: true });
    const flames = new T.InstancedMesh(new T.SphereGeometry(1, 10, 8), flameMat, POOL + FLOATS);
    flames.instanceMatrix.setUsage(T.DynamicDrawUsage);
    flames.instanceColor = new T.InstancedBufferAttribute(new Float32Array((POOL + FLOATS) * 3), 3).setUsage(T.DynamicDrawUsage);
    flames.frustumCulled = false;
    scene.add(flames);

    // Floating box lanterns on little wooden rafts.
    const boxGeo = new T.BoxGeometry(0.3, 0.28, 0.3, 1, 1, 1);
    boxGeo.translate(0, 0.14, 0);
    // Open top: drop the +y face (the 3rd face group in BoxGeometry).
    {
      const idx = boxGeo.index.array;
      const keep = [];
      for (let i = 0; i < idx.length; i += 3) {
        const face = Math.floor(i / 6);
        if (face !== 2) keep.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      boxGeo.setIndex(keep);
      boxGeo.clearGroups();
    }
    const floatInst = new Float32Array(FLOATS * 4);
    boxGeo.setAttribute('aInst', new T.InstancedBufferAttribute(floatInst, 4).setUsage(T.DynamicDrawUsage));
    const floats = new T.InstancedMesh(boxGeo, boxMat, FLOATS);
    floats.instanceMatrix.setUsage(T.DynamicDrawUsage);
    floats.frustumCulled = false;
    scene.add(floats);
    const wood = new T.MeshPhysicalMaterial({ color: 0x3a2618, roughness: 0.75, metalness: 0, envMapIntensity: 0.5 });
    const raftGeo = new T.BoxGeometry(0.42, 0.05, 0.42);
    raftGeo.translate(0, -0.005, 0);
    const rafts = new T.InstancedMesh(raftGeo, wood, FLOATS);
    rafts.instanceMatrix.setUsage(T.DynamicDrawUsage);
    rafts.frustumCulled = false;
    scene.add(rafts);

    // -------------------------------------------------------- foreground
    const stone = new T.MeshPhysicalMaterial({ color: 0x5a5a58, map: stoneTexture(T), roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.8 });
    const rocks = new T.InstancedMesh(rockGeometry(T), stone, SLOTS * 2);
    rocks.instanceMatrix.setUsage(T.DynamicDrawUsage);
    rocks.frustumCulled = false;
    scene.add(rocks);
    const postGeo = new T.CylinderGeometry(0.11, 0.13, 1, 10, 1);
    postGeo.translate(0, 0.5, 0);
    const oldWood = new T.MeshPhysicalMaterial({ color: 0x2b2420, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 });
    const posts = new T.InstancedMesh(postGeo, oldWood, SLOTS * 3);
    posts.instanceMatrix.setUsage(T.DynamicDrawUsage);
    posts.frustumCulled = false;
    scene.add(posts);

    const reedU = { uTime: { value: 0 }, uGust: { value: 0 } };
    const reedMat = new T.MeshStandardMaterial({ color: 0x3a3a22, roughness: 0.7, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.6 });
    reedMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, reedU);
      sh.vertexShader = 'uniform float uTime, uGust;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float hh = position.y;
          vec3 ip = vec3(instanceMatrix[3]);
          float ph = ip.x * 1.3 + ip.z * 0.7;
          transformed.x += hh * hh * (0.06 * sin(uTime * 1.2 + ph) + 0.03 * sin(uTime * 2.7 + ph * 2.0) + 0.3 * uGust);
          transformed.z += hh * hh * 0.04 * sin(uTime * 0.9 + ph * 1.7);
        }`);
    };
    const bladeGeo = new T.PlaneGeometry(0.03, 1, 1, 6);
    bladeGeo.translate(0, 0.5, 0);
    {
      // Taper to a point.
      const p = bladeGeo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - p.getY(i) * 0.92));
    }
    const reeds = new T.InstancedMesh(bladeGeo, reedMat, SLOTS * BLADES);
    reeds.instanceMatrix.setUsage(T.DynamicDrawUsage);
    reeds.frustumCulled = false;
    scene.add(reeds);

    // Lens: moonlit grade, cool shadows, warm highlights.
    const lens = kit.lens({ msaa: 4, motionBlurSamples: 6, dofSamples: 28 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.88, 0.95, 1.12);
    lens.grade.highlightTint.value.set(1.06, 0.97, 0.88);
    lens.grade.lift.value.set(0.0012, 0.0018, 0.004);
    lens.grade.vignette.value = 0.6;
    lens.grade.grain.value = 0.06;
    lens.grade.aberration.value = 0.003;
    lens.maxVelocity = 0.03;
    lens.farBlur = 0.6;
    lens.bloom.threshold = 1.4;

    return {
      T, scene, camera, mirrorCam, far, sky, skyUniforms, hemi, lights, water, waterU, mirrorRT, ripples,
      paperU, lanterns, lanternInst, flames, floats, floatInst, rafts, rocks, posts, reeds, reedU, lens,
      M: new T.Matrix4(), Q: new T.Quaternion(), E: new T.Euler(), S: new T.Vector3(), V: new T.Vector3(),
      col: new T.Color(), fwd: new T.Vector3(), up: new T.Vector3(), moonDir,
    };
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'lanterns',
    name: 'Lanterns',
    order: 1010,
    requires: 'three',
    three: {},

    params: [
      { key: 'density', label: 'Lanterns in the sky', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'rise', label: 'Rise speed', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'floats', label: 'Lanterns on the water', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'drift', label: 'Camera drift', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'gaze', label: 'Look up', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'moon', label: 'Moonlight', type: 'range', min: 0, max: 1, default: 0.65, step: 0.01 },
      { key: 'paper', label: 'Paper', type: 'select', options: PAPERS.map((x) => x.name), default: 0 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.65, step: 0.01 },
      { key: 'bloom', label: 'Glow', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    // The kit's lens chain is this scene's finish.
    finish: false,

    gallery: {
      title: 'Lanterns',
      technique: 'three.js 0.186.1 on the shared kit (web/three-kit.js): instanced lathe sky lanterns and box floating lanterns in a hand-written translucent-paper shader (inner flame falloff, view-dependent transmission that deepens toward red at grazing angles, rib, hoop and seam shadows, fibre and thickness noise); a reduced-resolution HDR planar mirror injected into a MeshStandardMaterial lake with swell and ripple normals, vertical light streaks and hashed glitter; point lights riding the newest lanterns onto wet clearcoat stone, weathered wood and vertex-swayed reeds; a sky dome with moon, halo and stars, three hill ridges in exponential fog; the kit lens (4x MSAA half-float HDR, depth of field on a slow rack, camera motion blur, bloom above 1 on flames, hot paper and moon only, moonlit split-tone grade, AgX).',
      brief: 'Paper sky lanterns rising over a dark, still lake at night. The paper glows from within, gold where it faces you and deep red at its edges, with the bamboo ribs in shadow; the lake doubles every lantern in a long wavering streak; a low moon hangs in the haze over three ridges of hills; reeds, wet rocks and old mooring posts drift past as the camera floats slowly across the water. Each kick lets a lantern go from the water: it flares, lights the reeds around it and sends a ring across the lake. A clap is a breath of wind that leans every lantern and bows the reeds; hats glitter on the water where the moon and the lanterns are mirrored; bass swells the flames and lifts the lanterns faster. On the drop a flock is released along the shore, the gaze lifts and small lanterns crowd the water.',
      lineage: 'Batch 07, "Rendered" (2026-09-29), entry 10 of the brief; after lantern festivals (Yi Peng sky lanterns, toro nagashi floating lanterns) and the long still-water reflections of night photography.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      this.lastMs = null;
      this.t = 0;
      this.camZ = 0;
      this.prevCam = null;
      this.focus = null;
      this.env = { prevK: 0, b4: 0, prevS: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.glint = 0;
      this.gust = 0;
      this.gustDir = 1;
      this.heat = 0;
      this.flockLeft = 0;
      this.spawnAcc = 0;
      this.rippleNext = 0;
      this.hero = -1;
      this.serial = 0;
      this.nextSlot = 0;
      // Sky lanterns: the pool starts part-filled (by hash, so a render is
      // repeatable) so the first frame is already a sky, not an empty lake.
      this.L = [];
      for (let i = 0; i < POOL; i++) this.L.push({ alive: false });
      for (let i = 0; i < 140; i++) this.spawn(false, hash(i * 7.3 + 1.1), i * 0.7 + 3);
      for (const l of this.R.lights) { l.idx = -1; l.level = 0; }
      for (const r of this.R.ripples) r.set(0, 0, 99, 0);
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    // A new sky lantern. `near` ones launch from the water in front of the
    // camera; the others belong to the far flock, already in the air.
    spawn(near, u, age0) {
      const L = this.L;
      let i = this.nextSlot;
      for (let k = 0; k < POOL; k++) {
        const j = (this.nextSlot + k) % POOL;
        if (!L[j].alive) { i = j; break; }
      }
      this.nextSlot = (i + 1) % POOL;
      const n = ++this.serial;
      const a = hash(n * 3.91 + u * 17.0), b = hash(n * 5.37 + 2.2), c = hash(n * 9.13 + 4.4);
      const cx = this.camX || 0;
      let dist, x, y, age = age0 || 0;
      if (near) {
        dist = near === 'flock' ? 14 + 30 * a : 10 + 13 * a;
        x = cx + (b * 2 - 1) * dist * (near === 'flock' ? 0.9 : 0.5);
        y = 0.05;
      } else {
        dist = 25 + 120 * a * a;
        x = cx + (b * 2 - 1) * dist * 1.1;
        y = 0.05;
      }
      L[i] = {
        alive: true, near, x, z: this.camZ - dist, y, vy: 0, age, n,
        seed: c, ink: Math.floor(hash(n * 1.7) * 3), size: 0.85 + 0.35 * hash(n * 2.3),
        rise: 0.7 + 0.6 * hash(n * 6.1), sway: hash(n * 8.8) * TAU, flare: near === true ? 1 : near ? 0.3 : 0, lean: 0,
      };
      // A lantern spawned already in flight has risen for its age.
      if (age > 0) {
        const l = L[i];
        l.y = Math.min(90, 0.55 * l.rise * age);
        l.flare = 0;
      }
      return i;
    },

    ripple(x, z, amp) {
      const r = this.R.ripples[this.rippleNext];
      r.set(x, z, 0, amp);
      this.rippleNext = (this.rippleNext + 1) % RIPPLES;
    },

    launch(amp) {
      const i = this.spawn(true, amp, 0);
      const l = this.L[i];
      this.ripple(l.x, l.z, 0.6 + 0.6 * amp);
      this.hero = i;
      // Hand this lantern the dimmest of the riding lights.
      let best = this.R.lights[0];
      for (const q of this.R.lights) if (q.level < best.level) best = q;
      best.idx = i; best.serial = l.n;
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        if (push > 0.05) this.launch(kRaw * Math.min(1.5, push));
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        if (push > 0.05) {
          this.gust = Math.min(1.4, this.gust + 0.9 * push);
          this.gustDir = -this.gustDir;
          this.heat = Math.min(1.5, this.heat + 1);
        }
      }
      e.prevS = sRaw;
      this.gust *= Math.exp(-dt / 0.9);
      this.heat *= Math.exp(-dt / 0.35);

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.glint = Math.min(1.5, this.glint + 0.9 * hRaw * push);
      }
      e.prevH = hRaw;
      this.glint *= Math.exp(-dt / 0.1);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      const was = e.dropOn;
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      if (e.dropOn && !was) this.flockLeft = Math.round(34 * Math.min(1.5, push));
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three;
      const R = this.R;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const follow = Math.round(params.follow) === 1;
      this.listen(signals, dt, push);
      const e = this.env;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const Pm = {};
      for (const key of DRIVE) Pm[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? e.auto : 0);
      this.t += dt;
      const t = this.t;

      // ------------------------------------------------------------ camera
      const drift = Pm.drift;
      this.camZ -= dt * (0.15 + 0.9 * drift);
      const camX = drift * (2.2 * Math.sin(t * 0.045) + 0.8 * Math.sin(t * 0.11 + 1.3));
      this.camX = camX;
      const camY = 1.15 + 0.25 * Math.sin(t * 0.07 + 0.4) + 0.04 * Math.sin(t * 0.6);
      const cam = R.camera;
      cam.position.set(camX, camY, this.camZ);
      const yaw = -0.12 * Math.sin(t * 0.045 + 0.9) * (0.4 + drift) + 0.05 * Math.sin(t * 0.021);
      const pitch = 0.04 + 0.26 * Pm.gaze + 0.025 * Math.sin(t * 0.09);
      const roll = 0.012 * Math.sin(t * 0.13) + 0.008 * Math.sin(t * 0.37);
      cam.rotation.set(pitch, yaw, roll, 'YXZ');
      cam.updateMatrixWorld();
      R.far.position.set(camX, 0, this.camZ);

      // ---------------------------------------------------------- lanterns
      // Ambient launches keep the sky populated with the density param; the
      // far flock refills itself, the near ones mostly come from the kicks.
      const aliveFar = this.L.reduce((n, l) => n + (l.alive && !l.near ? 1 : 0), 0);
      const wantFar = Math.round(40 + 220 * Pm.density);
      this.spawnAcc += dt * (aliveFar < wantFar ? 2 + 10 * Pm.density : 0);
      while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawn(false, hash(this.serial * 0.37), 0); }
      if (this.flockLeft > 0) {
        this.flockAcc = (this.flockAcc || 0) + dt * 18;
        while (this.flockAcc >= 1 && this.flockLeft > 0) {
          this.flockAcc -= 1; this.flockLeft--;
          const i = this.spawn('flock', hash(this.serial * 1.9), 0);
          if (this.flockLeft % 5 === 0) this.ripple(this.L[i].x, this.L[i].z, 0.5);
        }
      }

      const bass = e.bass * push;
      const riseK = (0.25 + 1.3 * Pm.rise) * (1 + 0.6 * bass);
      const glowBase = 0.95 + 0.45 * bass;
      const M = R.M, Q = R.Q, E = R.E, S = R.S, V = R.V;
      const inst = R.lanternInst;
      const fcol = R.col;
      const windX = 0.25 * Math.sin(t * 0.05) + this.gust * this.gustDir * 1.4;
      let cnt = 0;
      for (let i = 0; i < POOL; i++) {
        const l = this.L[i];
        if (!l.alive) continue;
        l.age += dt;
        // Lift builds over the first seconds as the air inside heats.
        const lift = l.rise * riseK * smooth(clamp01(l.age / 2.5));
        l.y += lift * dt;
        l.x += (windX * (0.4 + 0.02 * l.y) + 0.12 * Math.sin(t * 0.3 + l.sway)) * dt;
        l.flare *= Math.exp(-dt / 0.8);
        l.lean = ease(l.lean, -windX * 0.18 + 0.05 * Math.sin(t * 0.5 + l.sway), 2, dt);
        const behind = l.z > cam.position.z - 1.5;
        if (l.y > 110 || l.age > 240 || behind) { l.alive = false; continue; }
        // Burn out high up: the flame dims over the last stretch.
        const out = 1 - smooth(clamp01((l.y - 70) / 40));
        const ign = smooth(clamp01(l.age / 0.4));
        const glow = glowBase * out * (l.near ? 1 : 0.85) * ign;
        E.set(0.04 * Math.sin(t * 0.7 + l.sway), l.sway, l.lean);
        Q.setFromEuler(E);
        S.set(l.size, l.size * (1 + 0.04 * Math.sin(t * 0.9 + l.sway)), l.size);
        M.compose(V.set(l.x, l.y, l.z), Q, S);
        R.lanterns.setMatrixAt(cnt, M);
        inst[cnt * 4] = glow; inst[cnt * 4 + 1] = l.seed; inst[cnt * 4 + 2] = l.ink; inst[cnt * 4 + 3] = l.flare;
        // Flame bead in the mouth.
        V.set(0, 0.09 * l.size, 0).applyQuaternion(Q);
        const fs = 0.045 * l.size * (1 + 0.3 * l.flare + 0.2 * this.heat);
        M.compose(V.set(l.x + V.x, l.y + V.y, l.z + V.z), Q, S.set(fs, fs * 1.6, fs));
        R.flames.setMatrixAt(cnt, M);
        const fk = glow * (6 + 3 * l.flare) * (1 + 0.25 * this.heat);
        fcol.setRGB(fk, fk * 0.52, fk * 0.18);
        R.flames.setColorAt(cnt, fcol);
        l.slot = cnt;
        cnt++;
      }
      R.lanterns.count = cnt;
      const lanternCnt = cnt;

      // ----------------------------------------------- foreground by slots
      const k0 = Math.floor(-cam.position.z / PITCH) - BEHIND;
      let nr = 0, np = 0, nb = 0, nf = 0;
      const floatK = Pm.floats;
      for (let s = 0; s < SLOTS; s++) {
        const seg = k0 + s;
        const z0 = -seg * PITCH;
        // Reed clumps near the margins, rarely right in the path.
        if (hash(seg * 1.31 + 0.2) < 0.55) {
          const side = hash(seg * 2.17) < 0.5 ? -1 : 1;
          const cxr = side * (2.4 + 5 * hash(seg * 3.9)) + (hash(seg * 5.5) - 0.5);
          const czr = z0 - PITCH * hash(seg * 7.1);
          for (let b = 0; b < BLADES; b++) {
            const hb = hash(seg * 11.3 + b * 1.77);
            const rr = Math.sqrt(hash(seg * 13.1 + b * 2.91)) * 0.7;
            const aa = hash(seg * 17.9 + b * 3.3) * TAU;
            E.set((hash(b * 5.1 + seg) - 0.5) * 0.35, aa, (hash(b * 7.7 + seg) - 0.5) * 0.3);
            Q.setFromEuler(E);
            M.compose(V.set(cxr + Math.cos(aa) * rr, -0.05, czr + Math.sin(aa) * rr), Q, S.set(1 + hb, 0.9 + 1.5 * hb, 1));
            R.reeds.setMatrixAt(nr++, M);
          }
        }
        // Rocks, one or two, wet at the waterline.
        if (hash(seg * 4.41 + 1.9) < 0.3) {
          const nRock = hash(seg * 6.6) < 0.4 ? 2 : 1;
          for (let j = 0; j < nRock; j++) {
            const side = hash(seg * 8.3 + j) < 0.5 ? -1 : 1;
            const sz = 0.35 + 0.9 * hash(seg * 9.7 + j);
            E.set(0, hash(seg * 3.3 + j) * TAU, 0);
            Q.setFromEuler(E);
            M.compose(V.set(side * (1.8 + 6 * hash(seg * 10.1 + j)), 0, z0 - PITCH * hash(seg * 12.7 + j)), Q, S.set(sz * 1.3, sz, sz));
            R.rocks.setMatrixAt(nb++, M);
          }
        }
        // Old mooring posts in short leaning rows.
        if (hash(seg * 2.93 + 5.1) < 0.18) {
          const side = hash(seg * 14.2) < 0.5 ? -1 : 1;
          const px = side * (3 + 4 * hash(seg * 15.3));
          for (let j = 0; j < 3; j++) {
            E.set((hash(seg + j * 3.1) - 0.5) * 0.12, 0, (hash(seg + j * 5.3) - 0.5) * 0.14);
            Q.setFromEuler(E);
            M.compose(V.set(px + j * 0.15 * side, -0.1, z0 - j * 1.6), Q, S.set(1, 0.9 + 1.4 * hash(seg * 3 + j), 1));
            R.posts.setMatrixAt(np++, M);
          }
        }
      }
      R.reeds.count = nr; R.rocks.count = nb; R.posts.count = np;

      // Floating lanterns drift slowly on the current, placed by hash along
      // the lake and wrapping round the camera.
      const fInst = R.floatInst;
      const want = Math.round(FLOATS * (0.15 + 0.85 * floatK));
      const span = 70;
      for (let i = 0; i < want && nf < FLOATS; i++) {
        const zz = ((hash(i * 3.3 + 0.7) * span + t * 0.12 * (0.5 + hash(i * 1.9))) % span);
        const z = cam.position.z + 2 - zz;
        const x = camX + (hash(i * 5.7 + 2.1) * 2 - 1) * (2 + zz * 0.55);
        const ph = hash(i * 7.9) * TAU;
        const y = 0.012 * Math.sin(t * 1.3 + ph) + 0.04;
        E.set(0.03 * Math.sin(t * 1.1 + ph), ph + 0.05 * t, 0.03 * Math.cos(t * 0.9 + ph));
        Q.setFromEuler(E);
        const fade = smooth(clamp01(zz / 6)) * smooth(clamp01((span - zz) / 10));
        M.compose(V.set(x, y, z), Q, S.set(1, 1, 1));
        R.floats.setMatrixAt(nf, M);
        R.rafts.setMatrixAt(nf, M);
        const g = glowBase * 0.55 * fade;
        fInst[nf * 4] = g; fInst[nf * 4 + 1] = hash(i * 2.2); fInst[nf * 4 + 2] = Math.floor(hash(i * 4.4) * 3); fInst[nf * 4 + 3] = 0;
        M.compose(V.set(x, y + 0.06, z), Q, S.set(0.025, 0.04, 0.025));
        R.flames.setMatrixAt(lanternCnt + nf, M);
        const fk = g * 4;
        fcol.setRGB(fk, fk * 0.5, fk * 0.16);
        R.flames.setColorAt(lanternCnt + nf, fcol);
        nf++;
      }
      R.floats.count = nf; R.rafts.count = nf;
      R.flames.count = lanternCnt + nf;
      for (const m of [R.lanterns, R.flames, R.floats, R.rafts, R.reeds, R.rocks, R.posts]) m.instanceMatrix.needsUpdate = true;
      R.flames.instanceColor.needsUpdate = true;
      R.lanterns.geometry.attributes.aInst.needsUpdate = true;
      R.floats.geometry.attributes.aInst.needsUpdate = true;

      // Riding lights: follow their lantern, dimming as it climbs away from
      // the water, so the reeds and the lake round a launch light up.
      for (const q of R.lights) {
        const l = q.idx >= 0 ? this.L[q.idx] : null;
        const ok = l && l.alive && l.n === q.serial;
        const target = ok ? (1 + 1.5 * l.flare) * glowBase * Math.exp(-l.y / 5) : 0;
        q.level = ease(q.level, target, 6, dt);
        if (ok) q.light.position.set(l.x, l.y + 0.3, l.z);
        q.light.intensity = 5 * q.level;
        if (!ok && q.level < 0.01) q.idx = -1;
      }

      // Ripples age.
      for (const r of R.ripples) { r.z += dt; if (r.z > 8) r.w = 0; }

      // ------------------------------------------------------- materials
      const paper = PAPERS[clamp(Math.round(params.paper), 0, PAPERS.length - 1)];
      R.paperU.ink0.value.set(...paper.inks[0]);
      R.paperU.ink1.value.set(...paper.inks[1]);
      R.paperU.ink2.value.set(...paper.inks[2]);
      R.paperU.time.value = t;
      R.paperU.heat.value = this.heat;
      R.paperU.moonV.value.copy(R.moonDir).transformDirection(cam.matrixWorldInverse);
      const moon = Pm.moon;
      R.skyUniforms.moon.value = moon;
      R.skyUniforms.time.value = t;
      R.scene.environmentIntensity = 0.25 + 0.6 * moon;
      R.hemi.intensity = 0.08 + 0.2 * moon;
      R.waterU.wTime.value = t;
      R.waterU.wSwell.value = 0.6 + 0.4 * bass + 0.8 * this.gust;
      R.waterU.wGlint.value = this.glint;
      R.reedU.uTime.value = t;
      R.reedU.uGust.value = this.gust * this.gustDir;

      // Focus racks slowly between the near launches and the far flock, on
      // its own clock. Racking to each kick's lantern refocused the whole
      // frame twice a second, and jolt read it as a full-frame kick.
      const focus = 15 + 6 * Math.sin(t * 0.07) + 3 * Math.sin(t * 0.19 + 1.1);
      this.focus = this.focus == null ? focus : ease(this.focus, focus, 0.5, dt);

      // ------------------------------------------------------------ render
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
      R.waterU.reflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
        .multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
      const renderer = kit.renderer;
      // The moon is dimmed in the mirror: its streaked, bloomed reflection
      // should be a path on the water, not a flood.
      R.water.visible = false;
      R.skyUniforms.mirrorK.value = 0.6;
      renderer.setRenderTarget(R.mirrorRT);
      renderer.render(R.scene, mc);
      R.skyUniforms.mirrorK.value = 1;
      R.water.visible = true;

      const L = R.lens;
      L.shutter = 0.6;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.012 * (0.25 + Pm.focus) : 0;
      L.bloom.strength = 0.08 + 0.4 * Pm.bloom;
      L.bloom.radius = 0.12 + 0.2 * Pm.bloom;
      L.render(R.scene, cam);
      kit.composite();
    },
  });
})();
