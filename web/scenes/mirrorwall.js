// Mirror Wall: a kinetic sculpture in a dim gallery. Ten thousand small
// mirror tiles hang on pins across a long plaster wall, each free to tilt. At
// rest they show the room behind the camera, a tall warm window and the
// ceiling; as they tilt in waves the reflection slides between the window,
// the dark ceiling, the floor and a few coloured lamps that drift through the
// room on slow paths. Every tile is a mirror on the front and brushed brass on
// the back, so a tile that turns right over shows a flash of gold.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a flip ring: from a point in view, a ring of tiles rolls right
//           over (mirror, brass, mirror) and runs outward across the wall
//   snare   a straight glint front: a line sweeps the view and tips its tiles
//           up into the window light, a bright bar that crosses and is gone
//   hats    a scatter of single tiles twitches, glinting
//   bass    the swell: the depth of the travelling tilt waves
//   drop    with Follow the track: a figure (an eye, rings, petals) is thrown
//           across the wall, drawn by tiles that all turn to catch the
//           window; two more lamps join, the camera comes closer and rakes
//           harder, the waves deepen
//
// How it is made:
//   On the shared three.js kit (web/three-kit.js; CONTRACT.md, "three.js
//   scenes"). The tiles are one InstancedMesh with three materials (mirror
//   face, brass back, steel edges) whose vertex shaders are patched to tilt
//   each tile from a per-instance wall position, so the whole field of waves,
//   rings, sweeps and figures costs the CPU nothing per tile.
//
//   The reflections are live: a small cube camera renders a stand-in of the
//   room (the window, ceiling strips, the moving lamps as glowing balls) each
//   frame and a PMREM of it becomes scene.environment, so the mirrors really
//   reflect the lamps as they move. Real PointLights ride with the lamps for
//   the specular glints and the light they throw on plaster, floor and brass.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);

  // The wall, in metres. Tiles hang in front of a plaster wall at z = 0.
  const WALL_W = 22;
  const WALL_Y0 = 0.9;
  const PITCH = 0.13;
  const TILE = 0.118;
  const COLS = Math.round(WALL_W / PITCH);       // 169
  const ROWS = 62;                               // 8 m tall
  const WALL_H = ROWS * PITCH;
  const TILE_Z = 0.1;
  const KICKS = 6;
  const KICK_SPEED = 6.5;     // m/s, the flip ring's radius growth
  const KICK_WIDTH = 0.9;     // m over which a tile turns right over
  const ENV_SIZE = 128;

  // The window behind the camera, as a direction from the wall: the one bright
  // thing in the room, so a tile that faces it lights up.
  const WINDOW_POS = [3, 7.5, 16];
  const WINDOW_COL = [1.0, 0.72, 0.45];
  // The upper lights show evening sky, so the window reflects in two colours.
  const DUSK_COL = [0.5, 0.58, 0.95];

  // Lamps: three always, two more with the drop. Coloured gels, not neon:
  // amber, sea green, rose; then pale lilac and a warm white.
  const LAMPS = [
    { col: [1.0, 0.52, 0.2], ax: 4.2, ay: 2.1, az: 1.0, fx: 0.071, fy: 0.113, fz: 0.052, ph: 0.3, y: 3.8, z: 2.6 },
    { col: [0.22, 0.72, 0.62], ax: 4.8, ay: 2.4, az: 1.1, fx: 0.059, fy: 0.087, fz: 0.066, ph: 2.4, y: 4.4, z: 2.2 },
    { col: [1.0, 0.38, 0.45], ax: 3.9, ay: 1.8, az: 0.9, fx: 0.083, fy: 0.071, fz: 0.047, ph: 4.1, y: 3.2, z: 2.9 },
    { col: [0.62, 0.52, 1.0], ax: 5.2, ay: 2.0, az: 1.0, fx: 0.064, fy: 0.097, fz: 0.058, ph: 1.2, y: 5.2, z: 2.0 },
    { col: [1.0, 0.85, 0.66], ax: 4.4, ay: 2.2, az: 1.2, fx: 0.077, fy: 0.061, fz: 0.071, ph: 5.3, y: 2.8, z: 3.3 },
  ];

  const FIGURES = ['Eye', 'Rings', 'Petals', 'Cycle'];

  const PRESETS = {
    calm: { swell: 0.45, drift: 0.5, lamps: 0.55, figure: 0, rake: 0.3, focus: 0.55, warmth: 0.4 },
    drop: { swell: 0.95, drift: 1.1, lamps: 1, figure: 1, rake: 0.85, focus: 0.8, warmth: 0.75 },
  };
  const DRIVE = ['swell', 'drift', 'lamps', 'figure', 'rake', 'focus', 'warmth'];

  // ------------------------------------------------------ the tilt shader
  // Shared by the three tile materials. aTile = (x, y) in wall metres, and a
  // per-tile random. The rotation is built at beginnormal (which comes first)
  // and applied to the position after begin_vertex; the instance matrix that
  // three applies afterwards is a pure translation.
  const TILT_GLSL = `
    attribute vec3 aTile;
    uniform float uTime, uSwell, uHang;
    uniform vec2 uDir1, uDir2;
    uniform vec4 uKicks[${KICKS}];
    uniform vec4 uSnare;          // dir.xy, position along it, amount
    uniform vec2 uSparkle;        // amount, seed
    uniform vec4 uFig;            // centre.xy, scale, amount
    uniform vec4 uFigShape;       // type, rotation, time, unused
    uniform vec3 uEye, uWin;      // the camera, and the window pane tiles turn to

    mat3 rotAxis(vec3 a, float t) {
      float c = cos(t), s = sin(t), C = 1.0 - c;
      return mat3(
        c + a.x * a.x * C, a.y * a.x * C + a.z * s, a.z * a.x * C - a.y * s,
        a.x * a.y * C - a.z * s, c + a.y * a.y * C, a.z * a.y * C + a.x * s,
        a.x * a.z * C + a.y * s, a.y * a.z * C - a.x * s, c + a.z * a.z * C);
    }

    float figureMask(vec2 p) {
      if (uFig.w <= 0.001) return 0.0;
      vec2 q = (p - uFig.xy) / uFig.z;
      float cr = cos(uFigShape.y), sr = sin(uFigShape.y);
      q = mat2(cr, sr, -sr, cr) * q;
      float r = length(q);
      float d;
      if (uFigShape.x < 0.5) {
        // An eye: an almond outline, an iris ring and a pupil.
        float almond = max(length(q - vec2(0.0, -0.62)) - 1.0, length(q - vec2(0.0, 0.62)) - 1.0);
        float outline = abs(almond) - 0.07;
        float iris = abs(r - 0.34) - 0.075;
        float pupil = r - 0.13;
        d = min(outline, min(iris, pupil));
      } else if (uFigShape.x < 1.5) {
        // Rings that run outward from the centre.
        float rr = r * 2.6 - uFigShape.z * 0.9;
        d = (abs(fract(rr) - 0.5) - 0.2) / 2.6;
        d = max(d, r - 1.05);
      } else {
        // Seven petals, an outline that breathes.
        float a = atan(q.y, q.x);
        float rp = 0.42 + 0.58 * abs(cos(3.5 * a + uFigShape.z * 0.4));
        d = max(abs(r - rp * 0.98) - 0.075, -(r - 0.08));
        d = min(d, r - 0.16);
      }
      return uFig.w * (1.0 - smoothstep(-0.02, 0.05, d * uFig.z));
    }

    mat3 tileRotation() {
      vec2 p = aTile.xy;
      // The tilt that shows this tile's viewer the window: the normal halfway
      // between the directions to the eye and to the pane.
      vec3 wp = vec3(p, ${TILE_Z.toFixed(2)});
      vec3 hn = normalize(normalize(uEye - wp) + normalize(uWin - wp));
      vec2 uAim = vec2(asin(clamp(hn.y, -1.0, 1.0)), atan(hn.x, hn.z));
      float rnd = aTile.z;
      // Hung by hand: every tile a hair off true, so the rest state sparkles.
      float rx = uHang * (fract(rnd * 17.13) - 0.5);
      float ry = uHang * (fract(rnd * 29.71) - 0.5);
      // The swell: two travelling waves at an angle to each other.
      rx += uSwell * sin(dot(p, uDir1) * 0.85 - uTime * 1.25);
      ry += uSwell * 0.35 * sin(dot(p, uDir2) * 1.45 - uTime * 0.95);
      // Hats: a scattered few twitch.
      float pick = step(0.955, fract(rnd * 91.7 + uSparkle.y));
      rx += pick * uSparkle.x * 0.45 * (fract(rnd * 13.1 + uSparkle.y) - 0.5);
      ry += pick * uSparkle.x * 0.45 * (fract(rnd * 7.37 + uSparkle.y) - 0.5);
      // Snare: a straight front that tips its tiles up into the window.
      float ds = dot(p, uSnare.xy) - uSnare.z;
      float sw = exp(-ds * ds / 0.35) * uSnare.w;
      rx = mix(rx, uAim.x, sw);
      ry = mix(ry, uAim.y, sw);
      // The figure: tiles inside it turn to face the window.
      float f = figureMask(p);
      rx = mix(rx, uAim.x, f);
      ry = mix(ry, uAim.y, f);
      mat3 R = rotAxis(vec3(0.0, 1.0, 0.0), ry) * rotAxis(vec3(1.0, 0.0, 0.0), -rx);
      // Kicks: a ring of tiles rolls right over about the ring's tangent.
      for (int i = 0; i < ${KICKS}; i++) {
        vec4 k = uKicks[i];
        if (k.w <= 0.0) continue;
        vec2 d = p - k.xy;
        float r = length(d);
        float ph = clamp((k.z * ${KICK_SPEED.toFixed(2)} - r) / ${KICK_WIDTH.toFixed(2)}, 0.0, 1.0);
        if (ph <= 0.0 || ph >= 1.0) continue;
        vec2 dir = d / max(r, 1e-3);
        R = rotAxis(vec3(-dir.y, dir.x, 0.0), -${TAU.toFixed(5)} * smoothstep(0.0, 1.0, ph)) * R;
      }
      return R;
    }
  `;

  function patchTilt(mat, uniforms) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = TILT_GLSL + sh.vertexShader
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  mat3 tileR = tileRotation();\n  objectNormal = tileR * objectNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = tileR * transformed;');
      // A point light's highlight on a near-perfect mirror peaks thousands of
      // times over white; hundreds of those at once bloomed into a fog over
      // the wall. Capped, a glint still blooms, but as a glint.
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>',
        '#include <lights_fragment_end>\n  reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(3.0));');
    };
    // Same patch for every tile material; three keys programs on this.
    mat.customProgramCacheKey = () => 'mirrorwall-tilt';
    return mat;
  }

  // ------------------------------------------------- procedural textures
  function plasterTexture(T) {
    // Lime plaster: soft blotches and trowel marks, used as albedo.
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    const noise = (x, y, f) => {
      const xi = Math.floor(x * f), yi = Math.floor(y * f);
      const u = smooth(x * f - xi), v = smooth(y * f - yi);
      const h = (i, j) => hash((((i % f) + f) % f) * 71.3 + (((j % f) + f) % f) * 13.7 + f);
      return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
    };
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n, v = y / n;
        const b = 0.5 * noise(u, v, 4) + 0.3 * noise(u, v, 12) + 0.2 * noise(u, v, 48);
        const trowel = 0.04 * Math.sin((u * 9 + v * 3 + noise(u, v, 6) * 2) * TAU);
        const val = clamp01(0.7 + 0.22 * (b - 0.5) + trowel);
        const i = (y * n + x) * 4;
        data[i] = Math.round(val * 255);
        data[i + 1] = Math.round(val * 0.97 * 255);
        data[i + 2] = Math.round(val * 0.92 * 255);
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

  function floorTexture(T) {
    // Polished concrete: roughness (G) with smudges and saw-cut joints.
    const n = 256;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n, v = y / n;
        const sm = 0.5 * hash(Math.floor(u * 8) * 7.1 + Math.floor(v * 8) * 3.3) + 0.5 * hash(x * 0.71 + y * 1.37);
        const joint = (x % 128 < 2 || y % 128 < 2) ? 1 : 0;
        const rough = joint ? 0.95 : 0.22 + 0.2 * sm;
        const i = (y * n + x) * 4;
        data[i] = 255; data[i + 1] = Math.round(rough * 255); data[i + 2] = 0; data[i + 3] = 255;
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }

  // ------------------------------------------------------------ build
  function build(kit) {
    const T = kit.THREE;
    const scene = new T.Scene();
    scene.background = new T.Color(0.006, 0.005, 0.005);
    scene.fog = new T.FogExp2(new T.Color(0.012, 0.01, 0.009), 0.022);

    // The room the mirrors see, rendered live into a small cube each frame.
    const envScene = new T.Scene();
    // A dome of soft light: a warm lobe where the window is, a cool
    // overhead, a dark warm floor, two faint gels low on the far wall. Every
    // tilt then moves a tile through a gradient rather than on and off.
    const dome = new T.SphereGeometry(40, 64, 32);
    const dcol = new Float32Array(dome.attributes.position.count * 3);
    const wdir = new T.Vector3(WINDOW_POS[0], WINDOW_POS[1] - 4, WINDOW_POS[2]).normalize();
    const teal = new T.Vector3(-0.75, -0.05, 0.65).normalize();
    const rose = new T.Vector3(0.8, -0.05, 0.6).normalize();
    const d = new T.Vector3();
    for (let i = 0; i < dome.attributes.position.count; i++) {
      d.fromBufferAttribute(dome.attributes.position, i).normalize();
      const w = Math.max(0, d.dot(wdir));
      const lobe = 0.07 * Math.pow(w, 40) + 0.008 * Math.pow(w, 4);
      const up = Math.pow(Math.max(0, d.y), 2) * 0.022;
      const down = Math.max(0, -d.y) * 0.01;
      const tl = 0.14 * Math.pow(Math.max(0, d.dot(teal)), 14);
      const rs = 0.12 * Math.pow(Math.max(0, d.dot(rose)), 14);
      dcol[i * 3] = 0.005 + lobe * WINDOW_COL[0] + up * 0.8 + down * 1.0 + tl * 0.25 + rs * 0.95;
      dcol[i * 3 + 1] = 0.0045 + lobe * WINDOW_COL[1] + up * 0.86 + down * 0.7 + tl * 0.62 + rs * 0.45;
      dcol[i * 3 + 2] = 0.0045 + lobe * WINDOW_COL[2] + up * 1.0 + down * 0.5 + tl * 0.58 + rs * 0.48;
    }
    dome.setAttribute('color', new T.BufferAttribute(dcol, 3));
    const domeMesh = new T.Mesh(dome, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide }));
    envScene.add(domeMesh);
    const plane = (w, h, c, k, pos, rot) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c[0] * k, c[1] * k, c[2] * k), side: T.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      envScene.add(m);
      return m;
    };
    // The window's four panes, crisp, and the ceiling's light strips.
    // Five tall lights with a transom, wide mullions so they survive the
    // blur and read as a window, brighter low where the sun comes in.
    for (let i = 0; i < 5; i++) {
      const x = WINDOW_POS[0] - 2.8 + i * 1.4;
      plane(0.9, 3.4, DUSK_COL, 0.7, [x, WINDOW_POS[1] + 0.2, WINDOW_POS[2]], [0, Math.PI, 0]);
      plane(0.9, 2.2, WINDOW_COL, 1.1, [x, WINDOW_POS[1] - 2.9, WINDOW_POS[2]], [0, Math.PI, 0]);
    }
    for (let i = -2; i <= 2; i++) plane(0.35, 40, [0.8, 0.86, 1.0], 0.45, [i * 4.5, 9.9, 8], [Math.PI / 2, 0, 0]);
    const envLamps = LAMPS.map((L) => {
      const m = new T.Mesh(new T.SphereGeometry(0.22, 16, 12), new T.MeshBasicMaterial({ color: new T.Color(0, 0, 0) }));
      envScene.add(m);
      return m;
    });
    const cubeRT = new T.WebGLCubeRenderTarget(ENV_SIZE, { type: T.HalfFloatType, generateMipmaps: false });
    const cubeCam = new T.CubeCamera(0.1, 80, cubeRT);
    envScene.add(cubeCam);
    const pmrem = new T.PMREMGenerator(kit.renderer);
    cubeCam.position.set(0, 4, 1.5);
    cubeCam.update(kit.renderer, envScene);
    const envRT = pmrem.fromCubemap(cubeRT.texture);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 1;

    const camera = new T.PerspectiveCamera(38, kit.aspect, 0.1, 120);

    // Materials against materials: silvered glass, brushed brass, blued steel,
    // lime plaster, polished concrete.
    const tileU = {
      uTime: { value: 0 }, uSwell: { value: 0.05 }, uHang: { value: 0.018 },
      uDir1: { value: new T.Vector2(1, 0) }, uDir2: { value: new T.Vector2(0, 1) },
      uKicks: { value: Array.from({ length: KICKS }, () => new T.Vector4(0, 0, 0, 0)) },
      uSnare: { value: new T.Vector4(1, 0, -99, 0) },
      uSparkle: { value: new T.Vector2(0, 0) },
      uFig: { value: new T.Vector4(0, 4, 1.8, 0) },
      uFigShape: { value: new T.Vector4(0, 0, 0, 0) },
      uEye: { value: new T.Vector3() }, uWin: { value: new T.Vector3(WINDOW_POS[0], WINDOW_POS[1] - 2.9, WINDOW_POS[2]) },
    };
    const mirror = patchTilt(new T.MeshStandardMaterial({ color: 0xdcdde0, metalness: 1, roughness: 0.1, envMapIntensity: 1 }), tileU);
    const brass = patchTilt(new T.MeshStandardMaterial({ color: 0xc8963e, metalness: 1, roughness: 0.34, envMapIntensity: 1.1 }), tileU);
    const steel = patchTilt(new T.MeshStandardMaterial({ color: 0x3a3c44, metalness: 1, roughness: 0.3 }), tileU);

    const tileGeo = new T.BoxGeometry(TILE, TILE, 0.01);
    // Box groups: +x, -x, +y, -y, +z (face), -z (back).
    const tiles = new T.InstancedMesh(tileGeo, [steel, steel, steel, steel, mirror, brass], COLS * ROWS);
    const aTile = new Float32Array(COLS * ROWS * 3);
    const M = new T.Matrix4();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x = -WALL_W / 2 + (c + 0.5) * PITCH;
        const y = WALL_Y0 + (r + 0.5) * PITCH;
        M.makeTranslation(x, y, TILE_Z);
        tiles.setMatrixAt(i, M);
        aTile[i * 3] = x; aTile[i * 3 + 1] = y; aTile[i * 3 + 2] = hash(i * 0.618 + 3.1);
      }
    }
    tileGeo.setAttribute('aTile', new T.InstancedBufferAttribute(aTile, 3));
    tiles.instanceMatrix.needsUpdate = true;
    tiles.frustumCulled = false;
    scene.add(tiles);

    // The plaster wall, the brass frame, the pins' rail shadows are implied.
    const plaster = new T.MeshStandardMaterial({ color: 0x6d655c, map: plasterTexture(T), roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
    plaster.map.repeat.set(6, 3);
    const wall = new T.Mesh(new T.PlaneGeometry(60, 14), plaster);
    wall.position.set(0, 7, 0);
    scene.add(wall);
    const frameMat = new T.MeshStandardMaterial({ color: 0xb08a4a, metalness: 1, roughness: 0.28 });
    const fw = WALL_W + 0.3, fh = WALL_H + 0.3, fb = 0.08;
    for (const [w, h, x, y] of [[fw, fb, 0, WALL_Y0 - 0.11], [fw, fb, 0, WALL_Y0 + WALL_H + 0.11], [fb, fh + 0.14, -fw / 2, WALL_Y0 + WALL_H / 2], [fb, fh + 0.14, fw / 2, WALL_Y0 + WALL_H / 2]]) {
      const bar = new T.Mesh(new T.BoxGeometry(w, h, 0.14), frameMat);
      bar.position.set(x, y, 0.07);
      scene.add(bar);
    }
    // A low bench-height plinth line where wall meets floor.
    const skirting = new T.Mesh(new T.BoxGeometry(60, 0.12, 0.05), new T.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.6 }));
    skirting.position.set(0, 0.06, 0.025);
    scene.add(skirting);

    const floorRough = floorTexture(T);
    floorRough.repeat.set(15, 8);
    const floor = new T.Mesh(new T.PlaneGeometry(60, 32),
      new T.MeshPhysicalMaterial({ color: 0x3a3632, roughness: 1, roughnessMap: floorRough, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.5 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 16);
    scene.add(floor);

    // The lamps: small frosted globes (HDR, the only things that bloom) and a
    // point light each for glints and the light on plaster and floor.
    const lamps = LAMPS.map((L) => {
      const globe = new T.Mesh(new T.SphereGeometry(0.07, 20, 14), new T.MeshBasicMaterial({ color: new T.Color(0, 0, 0), toneMapped: false }));
      const light = new T.PointLight(new T.Color(L.col[0], L.col[1], L.col[2]), 0, 0, 2);
      scene.add(globe, light);
      return { globe, light, L };
    });
    // A dim warm key from the window side, and a cool bounce.
    const key = new T.DirectionalLight(new T.Color(WINDOW_COL[0], WINDOW_COL[1], WINDOW_COL[2]), 0.35);
    key.position.set(WINDOW_POS[0], WINDOW_POS[1], WINDOW_POS[2]);
    scene.add(key);
    scene.add(new T.HemisphereLight(0x303848, 0x100c0a, 0.25));

    // Dust in the air between camera and wall, lit by the lamps.
    const DUST = 420;
    const dPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dPos[i * 3] = (hash(i * 3.17 + 0.5) * 2 - 1) * 9;
      dPos[i * 3 + 1] = 0.3 + hash(i * 5.31 + 1.7) * 8;
      dPos[i * 3 + 2] = 0.6 + hash(i * 7.73 + 2.9) * 7;
    }
    const dGeo = new T.BufferGeometry();
    dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3));
    const dustMat = new T.PointsMaterial({ color: new T.Color(1.1, 0.85, 0.65), size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0.4, depthWrite: false, blending: T.AdditiveBlending, fog: true });
    // Cap point size: a mote by the lens would otherwise be a flat square.
    const dustMax = { value: 4 };
    dustMat.onBeforeCompile = (sh) => {
      sh.uniforms.dustMax = dustMax;
      sh.vertexShader = 'uniform float dustMax;\n' + sh.vertexShader.replace(
        '#include <fog_vertex>', '#include <fog_vertex>\n  gl_PointSize = min(gl_PointSize, dustMax);');
    };
    const dust = new T.Points(dGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 10, dofSamples: 32 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.9, 0.95, 1.1);
    lens.grade.lift.value.set(0.003, 0.0025, 0.002);
    lens.grade.vignette.value = 0.5;
    lens.grade.grain.value = 0.06;
    lens.grade.aberration.value = 0.0025;
    lens.maxVelocity = 0.04;
    lens.farBlur = 0.5;
    lens.bloom.threshold = 2;

    return {
      T, scene, camera, envScene, envLamps, cubeRT, cubeCam, pmrem, envRT, tiles, tileU,
      lamps, dust, dustMat, dustMax, lens,
    };
  }

  // -------------------------------------------------------------- scene
  VIZ.register({
    id: 'mirrorwall',
    name: 'Mirror Wall',
    order: 1009,
    requires: 'three',
    params: [
      { key: 'swell', label: 'Swell depth', type: 'range', min: 0, max: 1, default: 0.55, step: 0.01 },
      { key: 'drift', label: 'Camera drift', type: 'range', min: 0, max: 2, default: 0.6, step: 0.01 },
      { key: 'lamps', label: 'Coloured lamps', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'figure', label: 'Figure on the wall', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'shape', label: 'Figure', type: 'select', options: FIGURES, default: 3 },
      { key: 'rake', label: 'Raking angle', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'warmth', label: 'Grade: cool to warm', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    // The kit's lens chain is this scene's finish.
    finish: false,

    gallery: {
      title: 'Mirror Wall',
      technique: 'three.js 0.186.1 on the shared kit: ~10,500 mirror tiles in one InstancedMesh with three MeshStandardMaterials (silvered face, brushed brass back, steel edges) whose vertex shaders are patched to tilt each tile from its wall position (travelling swell waves, kick flip rings rolling about the ring tangent, a snare glint front, hat sparkle, SDF figures); live reflections from a 128px CubeCamera render of a stand-in room (window, ceiling strips, the moving lamps) turned into a PMREM every frame; PointLights riding the lamps for glints; lime plaster and clearcoat concrete; the kit lens: MSAA HDR, camera motion blur, depth of field, bloom above 1 on the lamp globes only, split grade, AgX.',
      brief: 'A kinetic sculpture in a dim gallery: a long wall of small mirrors, each on a pin, that tilt in slow waves and show the room behind the camera, a tall warm window, the ceiling, and a few coloured lamps drifting on slow paths. The camera trucks along the wall at a raking angle. The kick rolls a ring of tiles right over, mirror to brass to mirror, running outward; the snare sweeps a straight glint across the view; hats twitch a scatter of single tiles; bass deepens the swell. On the drop a figure (an eye, rings, petals) is thrown across the wall in tiles that all turn to the window, two more lamps join and the camera comes in closer.',
      lineage: 'Batch 07, Rendered (2026-09-29), entry 9. After Daniel Rozin\'s mechanical mirrors and the kinetic facades of the 2000s; built on the kit and reference scene of the three.js spike.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      this.lastMs = null;
      this.t = 0;
      this.phase = 0;
      this.env = { prevK: 0, b4: 0, prevS: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.kicks = [];
      this.kickN = 0;
      this.snare = { pos: -99, amt: 0, dir: [1, 0], n: 0, from: 0, to: 0, age: 9 };
      this.sparkle = 0; this.sparkleSeed = 0;
      this.swell = 0.05;
      this.fig = { x: 0, age: 99, n: 0, type: 0 };
      this.lampOn = LAMPS.map((_, i) => (i < 3 ? 1 : 0));
      this.focus = null;
      this.envTick = 0;
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      let kick = false, snare = false;
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) { since.kick = 0; kick = true; }
      e.prevK = kRaw;
      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) { since.snare = 0; snare = true; }
      e.prevS = sRaw;
      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.sparkle = Math.min(1.6, this.sparkle + 1.1 * hRaw * push);
        this.sparkleSeed = (this.sparkleSeed + 0.377) % 1;
      }
      e.prevH = hRaw;
      this.sparkle *= Math.exp(-dt / 0.12);
      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 3, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      return { kick, snare, kRaw };
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three, R = this.R, T = R.T;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const hit = this.listen(signals, dt, push);
      const e = this.env;
      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const Pm = {};
      for (const k of DRIVE) Pm[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      this.t += dt;
      const t = this.t;

      // ------------------------------------------------------- camera
      // Trucks along the wall; rake turns the view to look along it.
      this.phase += dt * 0.055 * Pm.drift;
      const ph = this.phase;
      const rake = Pm.rake;
      const cx = 4.6 * Math.sin(ph) + 0.9 * Math.sin(ph * 2.3 + 1);
      const dist = lerp(9.5, 6, rake) + 0.9 * Math.sin(ph * 1.7 + 0.4);
      const cy = 2.7 + 0.7 * Math.sin(ph * 1.3 + 2);
      const vx = Math.cos(ph);   // direction of travel, for leading the view
      const look = rake * 3.8 * (vx >= 0 ? 1 : -1) * Math.min(1, Math.abs(vx) * 2.5) + 1.2 * Math.sin(ph * 0.7);
      const cam = R.camera;
      cam.position.set(cx, cy, dist);
      const tx = cx + look, ty = 3.7 + 0.6 * Math.sin(ph * 0.9);
      cam.up.set(Math.sin(ph * 0.8) * 0.04, 1, 0);
      cam.lookAt(tx, ty, 0);
      cam.updateMatrixWorld();

      // ---------------------------------------------------- reactions
      const U = R.tileU;
      if (hit.kick && push > 0.05) {
        // From a point near where the camera looks, dealt by hash.
        const n = this.kickN++;
        this.kicks.unshift({ x: tx + (hash(n * 3.3) - 0.5) * 4, y: clamp(ty + (hash(n * 7.9) - 0.5) * 3, WALL_Y0 + 1, WALL_Y0 + WALL_H - 1), age: 0 });
        this.kicks.length = Math.min(this.kicks.length, KICKS);
      }
      for (const k of this.kicks) k.age += dt;
      this.kicks = this.kicks.filter((k) => k.age < 3.2);
      for (let i = 0; i < KICKS; i++) {
        const k = this.kicks[i];
        if (k) U.uKicks.value[i].set(k.x, k.y, k.age, 1); else U.uKicks.value[i].set(0, 0, 0, 0);
      }
      const S = this.snare;
      if (hit.snare && push > 0.05) {
        const n = S.n++;
        const a = (n % 2 ? 0.35 : -0.35) + Math.PI * (n % 4 < 2 ? 0 : 1);
        S.dir = [Math.cos(a), Math.sin(a)];
        const cproj = tx * S.dir[0] + ty * S.dir[1];
        S.from = cproj - 6; S.to = cproj + 6; S.age = 0;
      }
      S.age += dt;
      const sp = clamp01(S.age / 0.9);
      U.uSnare.value.set(S.dir[0], S.dir[1], lerp(S.from, S.to, smooth(sp)), sp < 1 ? Math.min(1, push) * Math.sin(Math.PI * sp) : 0);
      U.uSparkle.value.set(this.sparkle, this.sparkleSeed);
      this.swell = ease(this.swell, (0.03 + 0.15 * e.bass * push) * (0.35 + Pm.swell), 3, dt);
      U.uSwell.value = this.swell;
      U.uTime.value = t;
      const a1 = 0.6 + t * 0.021, a2 = 2.1 - t * 0.017;
      U.uDir1.value.set(Math.cos(a1), Math.sin(a1));
      U.uDir2.value.set(Math.cos(a2), Math.sin(a2));

      // The figure is thrown across the view, one after another.
      const F = this.fig;
      F.age += dt;
      const FLIGHT = 7;
      if (F.age > FLIGHT) {
        F.age = 0; F.n++;
        const choice = Math.round(params.shape);
        F.type = choice === 3 ? F.n % 3 : choice;
        F.dirSign = hash(F.n * 1.9) < 0.5 ? -1 : 1;
        F.y = ty + (hash(F.n * 4.1) - 0.5) * 1.5;
      }
      const fp = F.age / FLIGHT;
      const fx = tx + (F.dirSign || 1) * lerp(-7, 7, fp);
      const figScale = 1.7 + 0.25 * e.bass;
      U.uFig.value.set(fx, (F.y || ty) + 0.4 * Math.sin(fp * Math.PI), figScale, Pm.figure * clamp01(Math.sin(Math.PI * fp) * 3));
      U.uFigShape.value.set(F.type, (F.dirSign || 1) * (fp - 0.5) * 0.5, t, 0);

      U.uEye.value.set(cx, cy, dist);

      // ------------------------------------------------------- lamps
      const lampsK = Pm.lamps;
      const extra = clamp01((Pm.lamps - 0.75) / 0.25) + e.auto;
      R.lamps.forEach((o, i) => {
        const L = o.L;
        const target = i < 3 ? 1 : clamp01(extra);
        this.lampOn[i] = ease(this.lampOn[i], target, 1.2, dt);
        const on = this.lampOn[i] * lampsK;
        const x = cx * 0.6 + L.ax * Math.sin(t * L.fx * TAU + L.ph);
        const y = L.y + L.ay * Math.sin(t * L.fy * TAU + L.ph * 1.7);
        const z = L.z + L.az * Math.sin(t * L.fz * TAU + L.ph * 0.6);
        o.globe.position.set(x, y, z);
        o.light.position.set(x, y, z);
        o.light.intensity = 5 * on;
        const g = 3.2 * on;
        o.globe.material.color.setRGB(L.col[0] * g, L.col[1] * g, L.col[2] * g);
        o.globe.visible = on > 0.01;
        const em = R.envLamps[i];
        em.position.set(x, y, z);
        const ek = 12 * on;
        em.material.color.setRGB(L.col[0] * ek, L.col[1] * ek, L.col[2] * ek);
      });

      // Dust drifts up slowly and wraps; hats make it glint too.
      const dp = R.dust.geometry.attributes.position.array;
      for (let i = 1; i < dp.length; i += 3) { dp[i] += dt * 0.05; if (dp[i] > 8.3) dp[i] -= 8; }
      R.dust.geometry.attributes.position.needsUpdate = true;
      R.dustMat.opacity = clamp01(0.25 + 0.5 * this.sparkle);
      R.dustMax.value = (3 + 2 * this.sparkle) * kit.height / 720;

      // ------------------------------------------------- live reflections
      const renderer = kit.renderer;
      // From just in front of the tiles, so the lamps sit at the distance the
      // tiles see them from (a cube camera out in the room saw them huge).
      // Every other frame: the lamps move a few millimetres a frame, so the
      // six faces and the PMREM are a fixed cost worth halving.
      if ((this.envTick = (this.envTick || 0) + 1) % 2 === 1) {
        R.cubeCam.position.set(tx * 0.7 + cx * 0.3, ty, 0.3);
        R.cubeCam.update(renderer, R.envScene);
        R.pmrem.fromCubemap(R.cubeRT.texture, R.envRT);
      }

      // ------------------------------------------------------- render
      this.focus = this.focus == null ? 0 : this.focus;
      const focusD = Math.hypot(cx - tx, cy - ty, dist);
      this.focus = this.focus === 0 ? focusD : ease(this.focus, focusD, 2, dt);
      const L = R.lens;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.012 * (0.25 + Pm.focus) : 0;
      L.shutter = 0.9;
      L.bloom.strength = 0.06 + 0.08 * lampsK;
      L.bloom.radius = 0.2;
      const warm = Pm.warmth;
      L.grade.highlightTint.value.set(lerp(0.96, 1.12, warm), lerp(0.99, 0.95, warm), lerp(1.06, 0.8, warm));
      L.render(R.scene, cam);
      kit.composite();
    },
  });
})();
