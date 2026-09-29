// Silk: a slow walk down a dark stone hall hung with long silk banners, one
// warm low sun raking across them through tall windows.
//
// The idea is a light study in cloth. Every colour on screen is a lit surface:
// shot silk (a base dye with a sheen of a different hue, the way warp and weft
// of two colours shift as the cloth turns), a tone-on-tone damask woven into
// each banner (the figure is satin, shinier than the twill ground, so it only
// shows where the light grazes it), brass rods, pale limestone columns and a
// polished dark floor that catches the light pools and the banners' shadows.
// The sun comes in through window mullions, so the light lies across the
// folds in bars.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a gust runs down the row, away from the camera: each banner in
//           turn billows, its hem lifting, then settles (a wave that travels,
//           not a flash of the frame)
//   clap    a snap: a quick ripple runs down every banner from rod to hem
//   hats    dust motes in the sunbeam glint
//   bass    the draught swells: folds deepen and move faster
//   drop    with Follow the track: the wind rises until the banners stream,
//           the walk quickens, the sun climbs and brightens, and gold leaf
//           tumbles through the beam
//
// How it is made:
//   On the shared three.js kit (web/three-kit.js; CONTRACT.md, "three.js
//   scenes"). The banners are one InstancedMesh of a finely divided plane.
//   The cloth is simulated in the vertex shader rather than stepped on the
//   CPU: each column of the banner is a hanging chain whose angle from the
//   vertical is a function of arc length, time, wind and the gusts, and its
//   shape is that angle integrated from the rod down. Integrating an angle
//   keeps the cloth's length (a Verlet-free inextensible hang), so a hem that
//   blows out also rises, as silk does. The normal comes from the analytic
//   tangent down the chain and a second integration one step across. The
//   same displacement drives a custom depth material, so the banners cast and
//   receive their own shadows from the spot light.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);

  // Hall geometry, in metres. The hall scrolls past a camera that stays near
  // z = 0; slots wrap as they pass behind it.
  const P = 3.2;           // slot pitch
  const SLOTS = 18;
  const BEHIND = 1;
  const BANNER_X = 4.4;   // banner centre from the centre line
  const BANNER_W = 1.6;
  const BANNER_L = 7.4;
  const ROD_Y = 9.8;
  const COLUMN_X = 6.5;
  const HALL_H = 13;
  const MOTES = 700;
  const LEAVES = 360;

  // Dyes, in linear light: [base, sheen]. Shot silk: the sheen is another hue.
  const DYES = [
    { name: 'Imperial', cloth: [
      [[0.30, 0.012, 0.014], [1.0, 0.42, 0.16]],   // crimson shot with gold
      [[0.42, 0.20, 0.035], [1.0, 0.86, 0.55]],    // old gold
      [[0.62, 0.55, 0.43], [1.0, 0.92, 0.80]],     // ivory
      [[0.16, 0.012, 0.03], [0.85, 0.30, 0.35]],   // oxblood shot with rose
    ] },
    { name: 'Indigo', cloth: [
      [[0.018, 0.024, 0.13], [0.55, 0.36, 0.95]],  // indigo shot with violet
      [[0.012, 0.09, 0.10], [0.35, 0.80, 0.65]],   // teal shot with jade
      [[0.60, 0.56, 0.48], [0.90, 0.92, 1.0]],     // pale ivory
      [[0.24, 0.07, 0.02], [1.0, 0.55, 0.25]],     // rust
    ] },
    { name: 'Ivory', cloth: [
      [[0.66, 0.58, 0.46], [1.0, 0.92, 0.78]],
      [[0.55, 0.47, 0.36], [1.0, 0.85, 0.66]],
      [[0.70, 0.66, 0.58], [0.95, 0.95, 1.0]],
      [[0.48, 0.38, 0.28], [1.0, 0.80, 0.60]],
    ] },
    { name: 'Saffron', cloth: [
      [[0.55, 0.20, 0.012], [1.0, 0.70, 0.25]],    // saffron
      [[0.12, 0.012, 0.06], [0.95, 0.40, 0.45]],   // plum shot with rose
      [[0.20, 0.05, 0.012], [1.0, 0.50, 0.20]],    // rust
      [[0.03, 0.06, 0.035], [0.65, 0.75, 0.35]],   // bottle green shot with olive
    ] },
  ];

  const PRESETS = {
    calm: { speed: 0.4, wind: 0.35, sun: 0.25, gold: 0, focus: 0.6 },
    drop: { speed: 1.3, wind: 1.25, sun: 0.7, gold: 1, focus: 0.75 },
  };
  const DRIVE = ['speed', 'wind', 'sun', 'gold', 'focus'];

  // ------------------------------------------------------------ the cloth
  // Shared by the physical material and the shadow depth material. `d` is the
  // banner's distance ahead of the camera, so gust fronts (in metres ahead)
  // reach each banner in turn.
  const CLOTH_GLSL = `
    uniform float uTime, uWind, uSnapAge, uSnapAmp;
    uniform vec4 uGusts[4];
    attribute vec4 aInfo;       // phase, stiffness, width scale, unused
    const float SILK_W = ${BANNER_W.toFixed(3)};
    const float SILK_L = ${BANNER_L.toFixed(3)};

    // Angle from the vertical (positive blows the cloth away from the camera)
    // at arc length s down column u of a banner d metres ahead.
    float silkTheta(float s, float u, float d) {
      float t = uTime;
      float ph = aInfo.x;
      float sn = s / SILK_L;
      float stiff = aInfo.y;
      // The draught: slow and coherent down the hall, so neighbours move
      // together like a real room's air rather than each on its own clock.
      float w = uWind * (0.17 + 0.09 * sin(t * 0.53 + d * 0.21 + ph) + 0.05 * sin(t * 1.21 - d * 0.37 + ph * 2.0));
      float th = w * (0.25 + 0.95 * sn) * stiff;
      // Ripples running down the cloth, freer at the edges and the hem.
      float edge = abs(u - 0.5) * 2.0;
      float wa = 0.25 + uWind;
      th += wa * (0.05 + 0.06 * edge) * sn * sin(s * 1.7 - t * 2.3 + u * 2.4 + ph);
      th += wa * 0.03 * sn * sn * sin(s * 3.9 - t * 4.1 - u * 5.5 + ph * 1.7);
      // Gusts: fronts running away from the camera at 11 m/s. Each banner
      // billows as its front passes (lagged down the cloth) and settles with
      // a damped swing.
      for (int i = 0; i < 4; i++) {
        vec4 g = uGusts[i];
        if (g.y == 0.0) continue;
        float tau = (g.x - d) / 11.0 - s * 0.045;
        float r = tau < 0.0 ? exp(-tau * tau / 0.03) : exp(-tau * 1.5) * cos(tau * 3.6 - s * 0.25);
        th += g.y * r * (0.3 + 0.7 * sn) * (0.85 + 0.3 * sin(u * 3.0 + ph));
      }
      // The snap: a short ripple from rod to hem on every banner at once.
      float front = uSnapAge * 16.0 - s;
      th += uSnapAmp * exp(-uSnapAge * 2.6) * sn * sin(front * 2.2) * smoothstep(0.0, 0.8, front) * exp(-max(0.0, front - 3.0) * 0.6);
      return th;
    }

    // The shape of column u down to arc length s: the angle integrated from
    // the rod. Integrating an angle keeps the cloth's length, so a hem that
    // blows out also rises.
    vec3 silkPos(float u, float s, float d) {
      const int N = 8;
      float ds = s / float(N);
      vec2 p = vec2(0.0);
      for (int i = 0; i < N; i++) {
        float th = silkTheta((float(i) + 0.5) * ds, u, d);
        p += vec2(-sin(th), -cos(th)) * ds;
      }
      // Pleats gathered at the rod, pulled mostly flat by the hem's weight.
      float pleat = 0.045 * sin(u * 6.2831 * 2.5 + aInfo.x * 3.0) * (1.0 - 0.6 * s / SILK_L);
      float x = (u - 0.5) * SILK_W * aInfo.z;
      // A banner blowing out draws its edges in a little, as a sail does.
      x *= 1.0 - 0.06 * clamp(-p.x / SILK_L, 0.0, 1.0);
      return vec3(x, p.y, p.x + pleat);
    }

    float silkDist() { return -(modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).z; }
  `;

  // ---------------------------------------------------- procedural textures
  function makeTex(T, data, w, h, srgb) {
    const t = new T.DataTexture(data, w, h, T.RGBAFormat);
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }

  // Damask: an ogee lattice with a flower in each cell, woven tone on tone.
  // `map` darkens the twill ground a little; `rough` makes the satin figure
  // shinier, so the figure appears only where the light grazes the cloth.
  // A woven border runs down the edges and across the hem, and a fringe of
  // threads (cut out by alpha) hangs from the hem.
  function damask(T) {
    const w = 256, h = 1024;
    const map = new Uint8Array(w * h * 4), rough = new Uint8Array(w * h * 4);
    const REP_X = 2, REP_Y = 5;
    for (let y = 0; y < h; y++) {
      const v = y / h;                       // 0 at the hem (PlaneGeometry uv), 1 at the rod
      for (let x = 0; x < w; x++) {
        const u = x / w;
        let figure = 0;
        const bx = 0.07, fringe = 0.035, hemBand = 0.075;
        const inBorder = u < bx || u > 1 - bx;
        const inHem = v > fringe && v < fringe + hemBand;
        if (v < fringe) {
          // Fringe: threads every few texels, cut unevenly at the ends.
          const thread = (x % 5) < 2;
          const len = fringe * (0.55 + 0.45 * hash(Math.floor(x / 5) * 1.37));
          const i = (y * w + x) * 4;
          const on = thread && v > fringe - len;
          map[i] = map[i + 1] = map[i + 2] = 235; map[i + 3] = on ? 255 : 0;
          rough[i] = 255; rough[i + 1] = 90; rough[i + 2] = 0; rough[i + 3] = 255;
          continue;
        }
        if (inBorder || inHem) {
          // Border: satin stripes.
          const q = inBorder ? (u < bx ? u / bx : (1 - u) / bx) : (v - fringe) / hemBand;
          figure = (q > 0.18 && q < 0.32) || (q > 0.55 && q < 0.85) ? 1 : 0;
        } else {
          const uu = (u - bx) / (1 - 2 * bx), vv = (v - fringe - hemBand) / (1 - fringe - hemBand);
          const a = (uu * REP_X) % 1, b = (vv * REP_Y) % 1;
          // Ogee lattice: two mirrored sine curves.
          const c1 = 0.5 + 0.38 * Math.sin(TAU * b), c2 = 0.5 - 0.38 * Math.sin(TAU * b);
          const lattice = Math.min(Math.abs(a - c1), Math.abs(a - c2)) < 0.035 ? 1 : 0;
          // A six-petalled flower in each cell, and a small bud on the seam.
          const fx = a - 0.5, fy = (b - 0.5) * 0.9;
          const r = Math.hypot(fx, fy), th = Math.atan2(fy, fx);
          const petal = r < 0.13 * (0.62 + 0.38 * Math.cos(6 * th)) && r > 0.025 ? 1 : 0;
          const bud = Math.hypot(Math.min(a, 1 - a), (((b + 0.5) % 1) - 0.5) * 0.9) < 0.05 ? 1 : 0;
          figure = lattice || petal || bud ? 1 : 0;
        }
        // Weave grain: fine horizontal slubs, as raw silk has.
        const slub = 0.94 + 0.06 * hash(Math.floor(y / 2) * 7.1 + Math.floor(x / 23) * 3.3);
        const i = (y * w + x) * 4;
        const tone = (figure ? 1.0 : 0.84) * slub;
        map[i] = map[i + 1] = map[i + 2] = Math.round(clamp01(tone) * 255);
        map[i + 3] = 255;
        rough[i] = 255;
        rough[i + 1] = Math.round((figure ? 0.26 : 0.52) * 255);
        rough[i + 2] = 0; rough[i + 3] = 255;
      }
    }
    return { map: makeTex(T, map, w, h, true), rough: makeTex(T, rough, w, h, false) };
  }

  // Polished dark stone: roughness (G) with smudges, grout every 1.5 m.
  function stoneFloor(T) {
    const n = 512;
    const data = new Uint8Array(n * n * 4);
    const noise = (x, y, f) => {
      const xi = Math.floor(x * f), yi = Math.floor(y * f);
      const xf = x * f - xi, yf = y * f - yi;
      const hh = (i, j) => hash(((i % f) + f) % f * 71.3 + (((j % f) + f) % f) * 13.7 + f);
      const u = smooth(xf), v = smooth(yf);
      return lerp(lerp(hh(xi, yi), hh(xi + 1, yi), u), lerp(hh(xi, yi + 1), hh(xi + 1, yi + 1), u), v);
    };
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n, v = y / n;
        const sm = 0.55 * noise(u, v, 4) + 0.3 * noise(u, v, 16) + 0.15 * noise(u, v, 64);
        const gu = Math.min(u % 0.5, 0.5 - (u % 0.5)), gv = Math.min(v % 0.5, 0.5 - (v % 0.5));
        const seam = Math.min(gu, gv) < 0.004 ? 1 : 0;
        const i = (y * n + x) * 4;
        data[i] = Math.round((seam ? 0.55 : 0.85 + 0.15 * sm) * 255);
        data[i + 1] = Math.round((seam ? 0.85 : 0.14 + 0.2 * Math.pow(sm, 1.4)) * 255);
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    return makeTex(T, data, n, n, false);
  }

  // Limestone: pale, soft, with bedding lines.
  function limestone(T) {
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const bed = 0.05 * Math.sin(y * 0.11 + 2 * Math.sin(x * 0.02)) + 0.04 * hash(Math.floor(y / 3) * 1.9);
        const g = hash(x * 0.71 + y * 1.37) * 0.07;
        const v = clamp01(0.78 + bed + g);
        const i = (y * n + x) * 4;
        data[i] = Math.round(v * 255); data[i + 1] = Math.round(v * 0.96 * 255); data[i + 2] = Math.round(v * 0.9 * 255);
        data[i + 3] = 255;
      }
    }
    return makeTex(T, data, n, n, true);
  }

  // The window the sun comes through, projected by the spot light: tall
  // panes between mullions and transoms, the bars soft as a real sun's are.
  function windowCookie(T) {
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n, v = y / n;
        const cx = Math.abs(((u * 4) % 1) - 0.5), cy = Math.abs(((v * 3) % 1) - 0.5);
        const bar = Math.min(smooth(clamp01((0.5 - cx) / 0.09)), smooth(clamp01((0.5 - cy) / 0.06)));
        const r = Math.hypot(u - 0.5, v - 0.5);
        const edge = smooth(clamp01((0.5 - r) / 0.12));
        const val = bar * edge;
        const i = (y * n + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.round(val * 255);
        data[i + 3] = 255;
      }
    }
    const t = makeTex(T, data, n, n, true);
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    return t;
  }

  // The far window: a pointed arch with two lancets and a rose, seen through
  // 70 m of haze, so it is soft-edged and wrapped in a glow of lit air.
  function archWindow(T) {
    const w = 128, h = 192;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x + 0.5) / w * 2 - 1, v = (y + 0.5) / h * 3;   // u -1..1, v 0..3 (bottom to top)
        // The opening, in a frame half the texture wide; a pointed arch from
        // two circles centred on the opposite jambs.
        const au = u * 2.2, av = (v - 0.12) * 1.1;
        const spring = 1.3;
        let d = Math.max(Math.abs(au) - 0.92, -av);                  // signed distance, roughly
        if (av > spring) d = Math.max(Math.hypot(au + 0.92, av - spring), Math.hypot(au - 0.92, av - spring)) - 1.84;
        let a = smooth(clamp01(0.5 - d / 0.12));
        if (Math.abs(au) < 0.05 && av < 1.5) a *= 0.2;
        if (Math.abs(av - 0.8) < 0.03 || Math.abs(av - 1.2) < 0.03) a *= 0.3;
        if (Math.abs(Math.hypot(au, av - 2.05) - 0.34) < 0.04) a *= 0.3;
        // The glow of the air in front of it.
        const halo = Math.max(0, Math.exp(-(u * u * 3.0 + (v - 1.3) * (v - 1.3) * 0.9)) - 0.06) * smooth(clamp01(v / 0.3));
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(clamp01(0.8 * a + 0.3 * halo) * 255);
      }
    }
    const t = new T.DataTexture(data, w, h, T.RGBAFormat);
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }

  function environmentSpec() {
    // A dark hall with the sun's windows on the left and a dim cool bounce on
    // the right, so brass and polished stone reflect a world that matches.
    const panels = [];
    for (let i = -3; i <= 3; i++) {
      panels.push({ size: [3, 6], position: [-9.9, 7, i * 6], rotation: [0, Math.PI / 2, 0], color: [1.0, 0.72, 0.45], intensity: 3.2 });
    }
    panels.push({ size: [20, 30], position: [9.9, 3, 0], rotation: [0, -Math.PI / 2, 0], color: [0.35, 0.38, 0.5], intensity: 0.12 });
    panels.push({ size: [18, 36], position: [0, -4.9, 0], rotation: [-Math.PI / 2, 0, 0], color: [0.5, 0.36, 0.25], intensity: 0.08 });
    return { background: 0x040305, room: [20, 10, 40], panels };
  }

  // ------------------------------------------------------------ scene build
  function build(kit) {
    const T = kit.THREE;
    const scene = new T.Scene();
    scene.background = new T.Color(0.016, 0.011, 0.008);
    scene.fog = new T.FogExp2(new T.Color(0.016, 0.011, 0.008), 0.042);
    scene.environment = kit.environment(environmentSpec(), 0.04);
    scene.environmentIntensity = 0.5;

    const camera = new T.PerspectiveCamera(50, kit.aspect, 0.1, 120);
    const hall = new T.Group();
    scene.add(hall);

    // Shared cloth uniforms.
    const U = {
      uTime: { value: 0 }, uWind: { value: 0.5 },
      uSnapAge: { value: 9 }, uSnapAmp: { value: 0 },
      uGusts: { value: [0, 1, 2, 3].map(() => new T.Vector4(-100, 0, 0, 0)) },
      uBack: { value: 0.35 },
      uKeyPos: { value: new T.Vector3() }, uKeyDir: { value: new T.Vector3() },
      uKeyCos: { value: new T.Vector2(0.8, 0.9) }, uKeyCol: { value: new T.Color() },
    };

    // ---- banners
    const tex = damask(T);
    const N = SLOTS * 2;
    const clothGeo = new T.PlaneGeometry(BANNER_W, BANNER_L, 16, 84);
    clothGeo.translate(0, -BANNER_L / 2, 0);
    const aInfo = new T.InstancedBufferAttribute(new Float32Array(N * 4), 4);
    const aSheen = new T.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    aInfo.setUsage(T.DynamicDrawUsage); aSheen.setUsage(T.DynamicDrawUsage);
    clothGeo.setAttribute('aInfo', aInfo);
    clothGeo.setAttribute('aSheen', aSheen);

    const silk = new T.MeshPhysicalMaterial({
      color: 0xffffff, map: tex.map, roughnessMap: tex.rough, roughness: 1, metalness: 0,
      sheen: 1, sheenRoughness: 0.35, sheenColor: 0xffffff,
      anisotropy: 0.6, anisotropyRotation: Math.PI / 2,
      side: T.DoubleSide, alphaTest: 0.5, envMapIntensity: 0.7,
    });
    silk.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = CLOTH_GLSL + '\nattribute vec3 aSheen;\nvarying vec3 vSheen;\n' + sh.vertexShader
        .replace('#include <beginnormal_vertex>', `
          float silkD = silkDist();
          float silkU = position.x / SILK_W + 0.5;
          float silkS = -position.y;
          vec3 silkP = silkPos(silkU, silkS, silkD);
          vec3 silkPu = silkPos(silkU + 0.03, silkS, silkD);
          float silkTh = silkTheta(silkS, silkU, silkD);
          vec3 silkTs = vec3(0.0, -cos(silkTh), -sin(silkTh));
          vec3 objectNormal = normalize(cross(silkTs, silkPu - silkP));
          vSheen = aSheen;`)
        .replace('#include <begin_vertex>', 'vec3 transformed = silkP;');
      sh.fragmentShader = 'uniform float uBack;\nuniform vec3 uKeyPos, uKeyDir, uKeyCol;\nuniform vec2 uKeyCos;\nvarying vec3 vSheen;\n' + sh.fragmentShader
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.sheenColor = vSheen;')
        .replace('#include <opaque_fragment>', `{
          // Thin silk lets the sun through: a surface lit from behind glows
          // in its own dye. (No shadow test: the spot's cone and the dye's
          // depth keep it modest.)
          vec3 P = -vViewPosition;
          vec3 L = normalize(uKeyPos - P);
          float cone = smoothstep(uKeyCos.x, uKeyCos.y, dot(-L, uKeyDir));
          float back = max(0.0, dot(-normal, L));
          outgoingLight += diffuseColor.rgb * uKeyCol * back * cone * uBack;
          // Satin along the thread is nearly a mirror, and the sun is a point:
          // where the two lined up the silk returned the sun at hundreds of
          // times white and the bloom made an orb of it (36 s and 84 s of the
          // 96 s pass). A cap keeps it a glint.
          outgoingLight = min(outgoingLight, vec3(2.4));
        }
        #include <opaque_fragment>`);
    };
    const silkDepth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: tex.map, alphaTest: 0.5, side: T.DoubleSide });
    silkDepth.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = CLOTH_GLSL + sh.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = silkPos(position.x / SILK_W + 0.5, -position.y, silkDist());`);
    };
    const banners = new T.InstancedMesh(clothGeo, silk, N);
    banners.instanceMatrix.setUsage(T.DynamicDrawUsage);
    banners.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    banners.instanceColor.setUsage(T.DynamicDrawUsage);
    banners.customDepthMaterial = silkDepth;
    banners.castShadow = true;
    banners.receiveShadow = true;
    banners.frustumCulled = false;
    hall.add(banners);

    // ---- brass: rods, finials, cords up into the dark
    const brass = new T.MeshPhysicalMaterial({ color: 0xc79a52, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 });
    const cord = new T.MeshPhysicalMaterial({ color: 0x3a2a1c, roughness: 0.8 });
    const rodGeo = new T.CylinderGeometry(0.035, 0.035, BANNER_W + 0.3, 16);
    rodGeo.rotateZ(Math.PI / 2);
    const finialGeo = new T.SphereGeometry(0.07, 16, 12);
    const cordGeo = new T.CylinderGeometry(0.008, 0.008, HALL_H - ROD_Y, 6);
    const inst = (geo, mat, count, shadow) => {
      const m = new T.InstancedMesh(geo, mat, count);
      m.frustumCulled = false;
      m.castShadow = !!shadow;
      m.receiveShadow = true;
      hall.add(m);
      return m;
    };
    const rods = inst(rodGeo, brass, N, true);
    const finials = inst(finialGeo, brass, N * 2, false);
    const cords = inst(cordGeo, cord, N * 2, false);

    // ---- limestone columns and dark walls
    const limeMap = limestone(T);
    limeMap.repeat.set(1, 4);
    const lime = new T.MeshPhysicalMaterial({ color: 0x8c8374, map: limeMap, roughness: 0.78, envMapIntensity: 0.5 });
    const colGeo = new T.CylinderGeometry(0.38, 0.42, HALL_H, 32);
    const baseGeo = new T.BoxGeometry(1.05, 0.45, 1.05);
    const columns = inst(colGeo, lime, SLOTS * 2, true);
    const bases = inst(baseGeo, lime, SLOTS * 2, false);
    const wallMat = new T.MeshPhysicalMaterial({ color: 0x2a231d, roughness: 0.9, envMapIntensity: 0.3 });
    for (const sx of [-1, 1]) {
      const wall = new T.Mesh(new T.BoxGeometry(0.3, HALL_H, 140), wallMat);
      wall.position.set(sx * 7.8, HALL_H / 2, -60);
      wall.receiveShadow = true;
      scene.add(wall);
    }

    // ---- floor: polished dark stone
    const floorRough = stoneFloor(T);
    floorRough.repeat.set(16 / 3.2, 92 / 3.2);
    const floorMat = new T.MeshPhysicalMaterial({
      color: 0x2a221c, roughness: 1, roughnessMap: floorRough, metalness: 0,
      clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.5,
    });
    const FLOOR_L = 92;
    const floor = new T.Mesh(new T.PlaneGeometry(16, FLOOR_L), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -FLOOR_L / 2 + BEHIND * P;
    floor.receiveShadow = true;
    hall.add(floor);

    // Static transforms for the per-slot furniture.
    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(1, 1, 1), V = new T.Vector3();
    for (let s = 0; s < SLOTS; s++) {
      const z = -(s - BEHIND) * P;
      for (let k = 0; k < 2; k++) {
        const sx = k ? 1 : -1;
        M.makeTranslation(sx * COLUMN_X, HALL_H / 2, z + P / 2);
        columns.setMatrixAt(s * 2 + k, M);
        M.makeTranslation(sx * COLUMN_X, 0.22, z + P / 2);
        bases.setMatrixAt(s * 2 + k, M);
      }
    }
    columns.instanceMatrix.needsUpdate = true;
    bases.instanceMatrix.needsUpdate = true;

    // ---- the sun: a warm spot through a window, with soft shadows
    const key = new T.SpotLight(0xffffff, 0, 60, 0.5, 0.55, 1.1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 3;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 60;
    key.map = windowCookie(T);
    scene.add(key, key.target);
    // A dim cool fill so the shadowed side keeps its colour.
    const fill = new T.HemisphereLight(0x39455e, 0x1a120c, 0.28);
    scene.add(fill);

    // ---- dust in the beam: lit only inside the spot's cone
    const mPos = new Float32Array(MOTES * 3), mRnd = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      mPos[i * 3] = (hash(i * 3.17 + 0.5) * 2 - 1) * 6.5;
      mPos[i * 3 + 1] = 0.2 + hash(i * 5.31 + 1.7) * 12;
      mPos[i * 3 + 2] = -hash(i * 7.73 + 2.9) * 32 + 2;
      mRnd[i] = hash(i * 11.9 + 4.4);
    }
    const mGeo = new T.BufferGeometry();
    mGeo.setAttribute('position', new T.BufferAttribute(mPos, 3));
    mGeo.setAttribute('aRnd', new T.BufferAttribute(mRnd, 1));
    const moteU = {
      uTime: U.uTime, uKeyPosW: { value: new T.Vector3() }, uKeyDirW: { value: new T.Vector3() },
      uKeyCos: U.uKeyCos, uKeyCol: U.uKeyCol, uGlint: { value: 0 }, uDrift: { value: 0 },
      uPx: { value: 1 }, uAmount: { value: 1 },
    };
    const moteMat = new T.ShaderMaterial({
      uniforms: moteU, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uTime, uGlint, uDrift, uPx;
        uniform vec3 uKeyPosW, uKeyDirW;
        uniform vec2 uKeyCos;
        attribute float aRnd;
        varying float vA;
        void main() {
          vec3 p = position;
          // Drift: a slow fall and wander, and the hall's travel toward us.
          p.x += 0.25 * sin(uTime * 0.21 + aRnd * 40.0);
          p.y += 0.3 * sin(uTime * 0.17 + aRnd * 23.0) - mod(uTime * 0.05 * (0.5 + aRnd), 1.0) * 0.4;
          p.z = mod(p.z + uDrift + 30.0, 32.0) - 30.0;
          vec3 L = p - uKeyPosW;
          float cone = smoothstep(uKeyCos.x, uKeyCos.y, dot(normalize(L), uKeyDirW));
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float dist = -mv.z;
          float tw = 0.5 + 0.5 * sin(uTime * (1.5 + aRnd * 4.0) + aRnd * 60.0);
          vA = cone * (0.25 + 0.75 * tw) * (1.0 + uGlint * step(0.72, aRnd) * 3.0) * exp(-dist * 0.05);
          gl_PointSize = clamp(uPx * (0.02 + 0.015 * uGlint * step(0.72, aRnd)) / max(dist, 0.1), 1.0, 5.0 * uPx / 720.0 * 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uKeyCol;
        uniform float uAmount;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = dot(c, c) * 4.0;
          if (r > 1.0) discard;
          gl_FragColor = vec4(uKeyCol * 0.09 * vA * uAmount * (1.0 - r), 1.0);
        }`,
    });
    const motes = new T.Points(mGeo, moteMat);
    motes.frustumCulled = false;
    scene.add(motes);

    // ---- gold leaf, for the drop: small flakes that tumble through the beam
    const gold = new T.MeshPhysicalMaterial({ color: 0xffc46b, metalness: 1, roughness: 0.55, side: T.DoubleSide, envMapIntensity: 1.4 });
    // A flake turned square to the sun mirrors it at hundreds of times white,
    // and the lens then spread it into a disc the size of a fist (seen at
    // 36 s and 84 s of the 96 s pass). Cap the flake's radiance so a glint
    // blooms a little and never becomes an orb.
    gold.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
        'outgoingLight = min(outgoingLight, vec3(2.6));\n#include <opaque_fragment>');
    };
    const leafGeo = new T.PlaneGeometry(0.045, 0.06);
    const leaves = new T.InstancedMesh(leafGeo, gold, LEAVES);
    leaves.instanceMatrix.setUsage(T.DynamicDrawUsage);
    leaves.frustumCulled = false;
    scene.add(leaves);

    // ---- the far end: a tall arched window, so the hall has somewhere to go.
    // It keeps a fixed distance (it is 70 m off; a walk would barely move it)
    // and ignores the fog, which would otherwise swallow it.
    const winMat = new T.MeshBasicMaterial({ map: archWindow(T), color: new T.Color(0.8, 0.46, 0.22), transparent: true, fog: false, toneMapped: false, depthWrite: false });
    const farWindow = new T.Mesh(new T.PlaneGeometry(20, 30), winMat);
    farWindow.position.set(0, 14.4, -80);
    scene.add(farWindow);

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 10, dofSamples: 36 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.9, 0.94, 1.1);
    lens.grade.highlightTint.value.set(1.06, 0.98, 0.9);
    lens.grade.lift.value.set(0.003, 0.0022, 0.0018);
    lens.grade.vignette.value = 0.6;
    lens.grade.grain.value = 0.06;
    lens.grade.aberration.value = 0.0025;
    lens.maxVelocity = 0.04;
    lens.farBlur = 0.5;
    lens.bloom.threshold = 2.0;
    lens.bloom.strength = 0.12;
    lens.bloom.radius = 0.35;

    return {
      T, scene, camera, hall, banners, aInfo, aSheen, rods, finials, cords, U, key, fill,
      motes, moteU, leaves, lens, M, Q, S, V, E: new T.Euler(), col: new T.Color(),
      tmp: new T.Vector3(), tmp2: new T.Vector3(),
    };
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'silk',
    name: 'Silk',
    order: 1006,
    requires: 'three',
    three: { addons: [] },
    finish: false,

    params: [
      { key: 'speed', label: 'Walk speed', type: 'range', min: 0, max: 2, default: 0.6, step: 0.01 },
      { key: 'wind', label: 'Wind', type: 'range', min: 0, max: 1.5, default: 0.5, step: 0.01 },
      { key: 'gust', label: 'Gust on the kick', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'sun', label: 'Sun: low rake to high', type: 'range', min: 0, max: 1, default: 0.35, step: 0.01 },
      { key: 'dye', label: 'Dye', type: 'select', options: DYES.map((d) => d.name), default: 0 },
      { key: 'gold', label: 'Gold leaf', type: 'range', min: 0, max: 1, default: 0.1, step: 0.01 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Silk',
      technique: 'three.js 0.186.1 on the shared kit (web/three-kit.js): an InstancedMesh of banners whose cloth is simulated in the vertex shader (each column a hanging chain, its angle from the vertical integrated from the rod so the silk keeps its length; gusts are fronts travelling down the hall), with the same displacement in a custom depth material so the banners cast and receive soft shadows; MeshPhysicalMaterial shot silk (per-banner sheen colour of a different hue, anisotropic highlights along the threads, a satin-on-twill damask as a roughness map, a cut fringe by alpha test, a back-light term for translucency); brass, limestone and a clearcoated stone floor; a warm SpotLight projecting a window-mullion cookie; dust lit only inside the beam; gold-leaf flakes on the drop; the kit lens (MSAA HDR, camera motion blur with the hall\'s travel folded in, depth of field, bloom above 2, split-tone grade, grain, AgX).',
      brief: 'A slow walk down a dark stone hall hung with long silk banners, a low warm sun raking across them through tall windows so the light lies across the folds in bars. Shot silk changes colour as it turns; a woven damask shows only where the light grazes. Kicks send a gust running down the row, each banner billowing in turn; claps snap a ripple down every banner; hats glint the dust in the beam; bass swells the draught. On the drop the wind rises until the banners stream, the walk quickens, the sun climbs and gold leaf tumbles through the light.',
      lineage: 'Batch 07 "Rendered", entry 6, after the three.js spike (web/scenes/rendered.js). Light after the raking sun of Dutch interiors and the hung silks of processional halls; cloth as an inextensible hanging chain rather than a Verlet grid, so it costs a vertex shader.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      const r = ctx.three.renderer;
      r.shadowMap.enabled = true;
      r.shadowMap.type = ctx.three.THREE.PCFSoftShadowMap;
      this.lastMs = null;
      this.dist = 0;
      this.prevDist = null;
      this.t = 0;
      this.focus = null;
      this.env = { prevK: 0, prevS: 0, b4: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.gusts = [];
      this.snap = { age: 9, amp: 0 };
      this.glints = 0;
      this.smSpeed = 0.6;
      this.smWind = 0.5;
      this.leafAmt = 0;
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.gusts.unshift({ age: 0, amp: (0.6 + 0.4 * kRaw) });
        this.gusts.length = Math.min(this.gusts.length, 4);
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        this.snap = { age: 0, amp: 0.16 * Math.min(1.5, push) };
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.glints = Math.min(1.5, this.glints + 0.8 * hRaw);
      }
      e.prevH = hRaw;
      this.glints *= Math.exp(-dt / 0.1);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three, R = this.R, T = R.T;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.gust;
      this.listen(signals, dt, push);
      const e = this.env;
      kit.renderer.shadowMap.enabled = true;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.0 : 0.4, dt);
      const Pm = {};
      for (const k of DRIVE) Pm[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);

      this.t += dt;
      const t = this.t;
      this.smSpeed = ease(this.smSpeed, Pm.speed * (0.8 + 0.4 * e.bass) * 1.2, 1.2, dt);
      this.dist += this.smSpeed * dt;
      this.smWind = ease(this.smWind, Pm.wind * (0.7 + 0.7 * e.bass), 1.5, dt);

      // ------------------------------------------------ cloth uniforms
      const U = R.U;
      U.uTime.value = t;
      U.uWind.value = this.smWind;
      for (const g of this.gusts) g.age += dt;
      this.gusts = this.gusts.filter((g) => g.age < 6);
      for (let i = 0; i < 4; i++) {
        const g = this.gusts[i];
        // x: the front's distance ahead of the camera; y: its strength in radians.
        if (g) U.uGusts.value[i].set(g.age * 11 - 1.5, 0.55 * g.amp * push, 0, 0);
        else U.uGusts.value[i].set(-100, 0, 0, 0);
      }
      this.snap.age += dt;
      U.uSnapAge.value = this.snap.age;
      U.uSnapAmp.value = this.snap.age < 4 ? this.snap.amp : 0;

      // ------------------------------------------------ slots
      const k = Math.floor(this.dist / P);
      const shift = this.dist - k * P;
      R.hall.position.z = shift;
      const dye = DYES[clamp(Math.round(params.dye), 0, DYES.length - 1)].cloth;
      const { M, Q, S, V, E, col } = R;
      for (let s = 0; s < SLOTS; s++) {
        const seg = k + s - BEHIND;
        const z = -(s - BEHIND) * P;
        for (let side = 0; side < 2; side++) {
          const id = seg * 2 + side;
          const i = s * 2 + side;
          const sx = side ? 1 : -1;
          const yaw = (hash(id * 1.9 + 0.3) - 0.5) * 0.35;
          const x = sx * (BANNER_X + (hash(id * 2.3) - 0.5) * 0.3);
          const zz = z + (hash(id * 3.1) - 0.5) * 0.5;
          const topY = ROD_Y + (hash(id * 4.7) - 0.5) * 0.4;
          E.set(0, yaw, 0);
          Q.setFromEuler(E);
          M.compose(V.set(x, topY, zz), Q, S.set(1, 1, 1));
          R.banners.setMatrixAt(i, M);
          R.rods.setMatrixAt(i, M);
          const hw = (BANNER_W + 0.3) / 2;
          for (let f = 0; f < 2; f++) {
            const fx = x + (f ? hw : -hw) * Math.cos(yaw), fz = zz - (f ? hw : -hw) * Math.sin(yaw);
            M.makeTranslation(fx, topY, fz);
            R.finials.setMatrixAt(i * 2 + f, M);
            const cx = x + (f ? hw - 0.12 : -hw + 0.12) * Math.cos(yaw), cz = zz - (f ? hw - 0.12 : -hw + 0.12) * Math.sin(yaw);
            M.makeTranslation(cx, topY + (HALL_H - ROD_Y) / 2, cz);
            R.cords.setMatrixAt(i * 2 + f, M);
          }
          // Dye: the palette's cloths dealt by hash, never the same twice in a row.
          const ci = Math.floor(hash(id * 5.7 + 0.9) * dye.length);
          const c = dye[(ci + (side ? 1 : 0)) % dye.length];
          col.setRGB(c[0][0], c[0][1], c[0][2]);
          R.banners.setColorAt(i, col);
          R.aSheen.setXYZ(i, c[1][0], c[1][1], c[1][2]);
          R.aInfo.setXYZW(i, hash(id * 6.1) * TAU, 0.8 + 0.4 * hash(id * 8.3), 0.92 + 0.16 * hash(id * 9.7), 0);
        }
      }
      for (const m of [R.banners, R.rods, R.finials, R.cords]) m.instanceMatrix.needsUpdate = true;
      R.banners.instanceColor.needsUpdate = true;
      R.aSheen.needsUpdate = true;
      R.aInfo.needsUpdate = true;

      // ------------------------------------------------ the sun
      // Low sun rakes almost level across the banners and throws long
      // shadows; a high sun comes down steeper and paler. It drifts slowly
      // along the hall so the lit bays change.
      const sun = Pm.sun;
      const key = R.key;
      const drift = 2.5 * Math.sin(t * 0.045) + 1.2 * Math.sin(t * 0.11 + 1);
      key.position.set(-15, lerp(8, 19, sun), -9 + drift);
      key.target.position.set(3.5, lerp(3.5, 1.5, sun), -12 + drift * 0.6);
      key.target.updateMatrixWorld();
      key.angle = lerp(0.42, 0.5, sun);
      key.penumbra = 0.5;
      const warmth = 1 - sun;
      const kc = R.col.setRGB(1.0, lerp(0.86, 0.66, warmth), lerp(0.7, 0.4, warmth));
      key.color.copy(kc);
      key.intensity = lerp(380, 520, sun) * (1 + 0.12 * e.bass);
      // The translucency and mote uniforms need the sun in view and world space.
      const cam = R.camera;

      // ------------------------------------------------ camera
      const x = 0.9 * Math.sin(t * 0.07) + 0.25 * Math.sin(t * 0.19 + 1.1);
      const y = 2.3 + 0.4 * Math.sin(t * 0.09 + 0.4);
      cam.position.set(x, y, 0);
      const yaw = 0.42 * Math.sin(t * 0.045 - 1.2) + 0.05 * Math.sin(t * 0.13);
      const pitch = 0.15 + 0.05 * Math.sin(t * 0.11);
      const roll = 0.02 * Math.sin(t * 0.08);
      cam.rotation.set(pitch, yaw, roll, 'YXZ');
      kit.fitCamera(cam);
      cam.updateMatrixWorld();

      const kp = R.tmp.copy(key.position).applyMatrix4(cam.matrixWorldInverse);
      U.uKeyPos.value.copy(kp);
      const kd = R.tmp2.copy(key.target.position).sub(key.position).normalize();
      R.moteU.uKeyPosW.value.copy(key.position);
      R.moteU.uKeyDirW.value.copy(kd);
      U.uKeyDir.value.copy(kd).transformDirection(cam.matrixWorldInverse);
      U.uKeyCos.value.set(Math.cos(key.angle), Math.cos(key.angle * (1 - key.penumbra)));
      U.uKeyCol.value.copy(kc).multiplyScalar(0.9);
      U.uBack.value = 0.35;

      // ------------------------------------------------ motes and leaves
      R.moteU.uTime.value = t;
      R.moteU.uGlint.value = this.glints;
      R.moteU.uDrift.value = this.dist;
      R.moteU.uPx.value = kit.height * 1.2;
      R.moteU.uAmount.value = 1;

      this.leafAmt = ease(this.leafAmt, Pm.gold, 1.2, dt);
      const la = this.leafAmt;
      const nLeaves = Math.floor(LEAVES * la);
      for (let i = 0; i < LEAVES; i++) {
        if (i >= nLeaves) { M.makeScale(0, 0, 0); R.leaves.setMatrixAt(i, M); continue; }
        const h1 = hash(i * 1.13 + 0.1), h2 = hash(i * 2.71 + 0.2), h3 = hash(i * 3.97 + 0.3), h4 = hash(i * 5.3 + 0.4);
        const fall = 0.35 + 0.3 * h4;
        const yy = 12 - ((t * fall + h2 * 12) % 12);
        const blown = this.smWind * 0.8;
        const zz = ((-h3 * 24 + this.dist * 1.0 - t * blown) % 24 + 24) % 24 - 31;
        const xx = (h1 * 2 - 1) * 5.5 + 0.5 * Math.sin(t * 0.7 + i);
        E.set(t * (1.5 + 2 * h1) + i, t * (1.1 + h2 * 2) + i * 2, t * (0.9 + h3));
        Q.setFromEuler(E);
        M.compose(V.set(xx, yy, zz), Q, S.set(1, 1, 1));
        R.leaves.setMatrixAt(i, M);
      }
      R.leaves.instanceMatrix.needsUpdate = true;

      // ------------------------------------------------ focus and render
      // Focus: the lit bays, where the sun lands, eased.
      const focus = clamp(-(key.target.position.z) - 1, 5, 14);
      this.focus = this.focus == null ? focus : ease(this.focus, focus, 1.2, dt);
      const L = R.lens;
      const moved = this.prevDist == null ? 0 : this.dist - this.prevDist;
      this.prevDist = this.dist;
      L.shutter = 0.9;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.012 * (0.25 + Pm.focus) : 0;
      L.render(R.scene, cam, { worldMove: [0, 0, moved] });
      kit.composite();
    },

    leave() {},
  });
})();
