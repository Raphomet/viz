// Sunroom: an empty room with tall windows on a bright afternoon. Sun comes
// in through wooden venetian blinds, lays ladders of light across an oiled
// oak floor and up the far plaster wall, and stands in the air as beams full
// of dust. Outside, trees move in the wind, so the light is dappled and never
// still; inside, a fiddle-leaf fig and a palm throw their own moving shadows.
// The only light that matters is the sun: every colour in the room is what
// the sun, the sky in the windows and the warm bounce off the floor make of
// oak, lime plaster, terracotta, chrome and leather.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    one window's blinds flick open, a wave running down the slats top
//           to bottom and settling back; the next kick takes the next window,
//           so the light breathes window by window, never the whole room
//   clap    a gust: the trees outside toss (the dapple shivers) and the house
//           plants flutter
//   hats    dust motes glint, but only where they drift through sunlight
//   bass    the haze in the beams thickens and the sun presses a little harder
//   drop    with Follow the track: the sun comes round and lowers, so the
//           beams swing across the room and climb the far wall; they sharpen,
//           the air thickens, the blinds open, the light turns golden and the
//           camera drifts faster
//
// How it is made:
//   On the shared three.js kit (web/three-kit.js; CONTRACT.md, "three.js
//   scenes").
//     1. The sun is a DirectionalLight with a 4096 PCF shadow map over the
//        whole room: the slats, the window reveals, the plants and two
//        alpha-tested foliage screens outside all cast into it, so the floor
//        stripes, the dapple and the plant shadows are one shadow, not three
//        tricks. Its penumbra (the shadow radius) is the sharpness.
//     2. The room: MeshPhysicalMaterial oak with a clearcoat (the sun patch
//        and the windows gleam in it), lime plaster, painted timber, pale
//        ash slats, chrome and leather, terracotta, celadon glaze; image-based
//        light from a PMREM of a generated room with three bright windows; a
//        RectAreaLight lying in the sun patch facing up, the floor's warm
//        bounce onto the ceiling and walls.
//     3. The beams: a pass inserted into the lens before the grade marches
//        each pixel's view ray through the room (32 jittered steps, stopping
//        at the depth buffer), tests the sun's own shadow map at every step
//        and sums Henyey-Greenstein in-scatter. Beams are therefore exactly
//        where the blinds and leaves let the sun through, and never bloom.
//     4. Dust: points whose vertex shader asks the same shadow map whether
//        they are in the sun, so they only glint inside a beam.
//     5. The kit lens: camera motion blur from the slow dolly, shallow depth
//        of field, bloom above 2.2 (only the sky in the windows), a split
//        grade (cool shade, warm light), grain, AgX.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // The room, in metres. Windows are in the left wall (x = -4).
  const RX0 = -4, RX1 = 4, RZ0 = -8, RZ1 = 6, RH = 4.2;
  const WALL_T = 0.35;
  const WINDOWS = [-4.6, -1.0, 2.6];      // window centres along z
  const WIN_W = 1.5, SILL = 0.45, HEAD = 3.75;
  const SLAT_P = 0.1, SLAT_W = 0.112, SLAT_T = 0.008;
  const SLATS = Math.floor((HEAD - SILL - 0.12) / SLAT_P);
  const BLIND_X = RX0 + 0.07;
  const SHADOW_SIZE = 4096;

  const PRESETS = {
    calm: { sun: 0.32, height: 0.45, blinds: 0.5, haze: 0.4, sharp: 0.3, drift: 0.45, warmth: 0.3 },
    drop: { sun: 0.14, height: 0.14, blinds: 0.62, haze: 0.7, sharp: 0.95, drift: 1.2, warmth: 0.8 },
  };
  const DRIVE = ['sun', 'height', 'blinds', 'haze', 'sharp', 'drift', 'warmth'];

  // ------------------------------------------------------ canvas textures
  function canvas(n) {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    return c;
  }

  // Oiled oak boards, 0.15 m wide, running away from the windows; the
  // texture covers 1.2 x 1.2 m. Returns colour and roughness maps.
  function oakTextures(T) {
    const n = 1024, planks = 8, pw = n / planks;
    const col = canvas(n), rough = canvas(n);
    const g = col.getContext('2d'), r = rough.getContext('2d');
    r.fillStyle = 'rgb(96,96,96)';
    r.fillRect(0, 0, n, n);
    for (let i = 0; i < planks; i++) {
      // Each board is two lengths, with the joint staggered.
      const joint = hash(i * 3.3 + 1) * n;
      for (let part = 0; part < 2; part++) {
        const seed = i * 7 + part * 3.1;
        const tone = hash(seed + 0.7);
        const R = Math.round(lerp(150, 196, tone)), G = Math.round(lerp(104, 140, tone)), B = Math.round(lerp(62, 88, tone));
        const y0 = part ? joint : joint - n, y1 = part ? joint + n : joint;
        g.fillStyle = `rgb(${R},${G},${B})`;
        g.fillRect(i * pw, y0, pw, y1 - y0);
        g.fillRect(i * pw, y0 + n, pw, y1 - y0);
        g.fillRect(i * pw, y0 - n, pw, y1 - y0);
        // Grain: long, gently wandering lines along the board.
        for (let k = 0; k < 26; k++) {
          const x0 = i * pw + hash(seed * 13 + k) * pw;
          const amp = 2 + hash(seed * 5 + k * 1.7) * 6;
          const fr = 0.004 + hash(seed + k * 2.3) * 0.01;
          const dark = hash(seed * 3 + k) < 0.5;
          g.strokeStyle = dark ? `rgba(70,40,18,${0.08 + 0.18 * hash(k + seed)})` : `rgba(230,190,140,${0.06 + 0.1 * hash(k * 2 + seed)})`;
          g.lineWidth = 0.6 + hash(k * 9 + seed) * 1.6;
          g.beginPath();
          for (let y = -8; y <= n + 8; y += 8) {
            const x = x0 + amp * Math.sin(y * fr + k) + 1.5 * Math.sin(y * fr * 3.1 + seed);
            if (y === -8) g.moveTo(Math.min(Math.max(x, i * pw + 1), (i + 1) * pw - 1), y);
            else g.lineTo(Math.min(Math.max(x, i * pw + 1), (i + 1) * pw - 1), y);
          }
          g.stroke();
        }
        // A knot or two.
        if (hash(seed * 1.9) < 0.35) {
          const kx = i * pw + pw * (0.3 + 0.4 * hash(seed * 2.2)), ky = y0 + (y1 - y0) * hash(seed * 4.4);
          const grd = g.createRadialGradient(kx, ky, 0, kx, ky, 9);
          grd.addColorStop(0, 'rgba(60,32,14,0.7)');
          grd.addColorStop(1, 'rgba(60,32,14,0)');
          g.fillStyle = grd;
          g.fillRect(kx - 10, ky - 14, 20, 28);
        }
        // Worn areas are a little rougher.
        r.fillStyle = `rgba(150,150,150,${0.25 * hash(seed * 6.1)})`;
        r.fillRect(i * pw, y0, pw, y1 - y0);
        r.fillRect(i * pw, y0 + n, pw, y1 - y0);
      }
      // Seams between boards and at the joint: dark and matte.
      g.fillStyle = 'rgba(40,22,10,0.85)';
      g.fillRect(i * pw, 0, 2, n);
      g.fillRect(i * pw, joint - 1, pw, 2);
      r.fillStyle = 'rgb(235,235,235)';
      r.fillRect(i * pw, 0, 2, n);
      r.fillRect(i * pw, joint - 1, pw, 2);
    }
    const map = new T.CanvasTexture(col);
    map.colorSpace = T.SRGBColorSpace;
    const rmap = new T.CanvasTexture(rough);
    for (const t of [map, rmap]) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 8;
      t.generateMipmaps = true;
      t.minFilter = T.LinearMipmapLinearFilter;
    }
    return { map, rmap };
  }

  // Lime plaster: a pale, blotchy, trowelled tone.
  function plasterTexture(T) {
    const n = 512, c = canvas(n), g = c.getContext('2d');
    g.fillStyle = 'rgb(226,218,204)';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 700; i++) {
      const x = hash(i * 1.3) * n, y = hash(i * 2.7 + 5) * n, rr = 8 + hash(i * 3.9) * 60;
      const d = hash(i * 7.1) < 0.5;
      const grd = g.createRadialGradient(x, y, 0, x, y, rr);
      const a = 0.012 + 0.02 * hash(i * 4.4);
      grd.addColorStop(0, d ? `rgba(196,178,150,${a})` : `rgba(252,248,240,${a})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        g.save(); g.translate(ox, oy); g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore();
      }
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  // Foliage for the screens outside: a canopy of small leaves, dense at the
  // top and thinning downwards, on a few drooping branches. Alpha only.
  function foliageTexture(T) {
    const n = 1024, c = canvas(n), g = c.getContext('2d');
    g.clearRect(0, 0, n, n);
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    const branches = 14;
    for (let b = 0; b < branches; b++) {
      // Each branch hangs from the top edge and droops across.
      const x0 = hash(b * 4.1 + 2) * n, dir = hash(b * 2.3) < 0.5 ? -1 : 1;
      const reach = 0.35 + 0.5 * hash(b * 5.7);
      const pts = [];
      for (let s = 0; s <= 30; s++) {
        const u = s / 30;
        pts.push([x0 + dir * u * n * 0.45, u * n * reach * (0.6 + 0.4 * u)]);
      }
      g.lineWidth = 5;
      g.beginPath();
      pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
      g.stroke();
      // Leaves along the branch, thicker near the top of the canvas.
      for (let k = 0; k < 420; k++) {
        const u = hash(b * 97 + k * 1.31);
        const q = pts[Math.floor(u * 30)];
        const spread = 30 + 70 * (1 - u);
        const x = q[0] + (hash(k * 3.7 + b) * 2 - 1) * spread;
        const y = q[1] + (hash(k * 5.9 + b * 3) * 2 - 1) * spread * 0.8;
        const L = 7 + hash(k * 2.2 + b) * 9;
        g.save();
        g.translate(((x % n) + n) % n, y);
        g.rotate(hash(k * 8.8 + b) * TAU);
        g.beginPath();
        g.ellipse(0, 0, L, L * 0.45, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    }
    // The canopy proper along the top edge.
    for (let k = 0; k < 2600; k++) {
      const x = hash(k * 1.77) * n, y = Math.pow(hash(k * 3.31 + 9), 2.2) * n * 0.32;
      const L = 8 + hash(k * 4.4) * 10;
      g.save();
      g.translate(x, y);
      g.rotate(hash(k * 6.6) * TAU);
      g.beginPath();
      g.ellipse(0, 0, L, L * 0.5, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = T.RepeatWrapping;
    t.wrapT = T.ClampToEdgeWrapping;
    return t;
  }

  // A room with three bright windows on the -x side, a warm sunlit patch on
  // the floor and a pale plaster box, baked once for image-based light.
  function environmentScene(T, env) {
    const box = new T.Mesh(new T.BoxGeometry(8, 4.2, 14), new T.MeshBasicMaterial({ color: new T.Color(0.2, 0.18, 0.15), side: T.BackSide }));
    box.position.y = 2.1;
    env.add(box);
    const add = (w, h, pos, rot, c) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c[0], c[1], c[2]), side: T.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      env.add(m);
    };
    for (const z of [-4.6, -1.0, 2.6]) add(1.5, 3.3, [-3.95, 2.1, z + 0.8], [0, Math.PI / 2, 0], [2.6, 2.9, 3.3]);
    add(5, 5, [0.5, 0.02, -0.5], [-Math.PI / 2, 0, 0], [1.3, 0.95, 0.62]);
    add(3, 1.6, [3.95, 0.9, -1], [0, -Math.PI / 2, 0], [0.9, 0.7, 0.48]);
  }

  // ----------------------------------------------------------- GLSL pieces
  // Interleaved gradient noise, for jittering march steps and penumbra taps.
  const IGN = 'float ign(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }\n';

  // The beams, in two passes inside the lens, before the grade (HDR, after
  // bloom, so a beam never blooms):
  //   march      at half resolution: each pixel's view ray is marched to the
  //              depth buffer, testing the sun's own shadow map at every
  //              step; out comes in-scattered light (rgb) and the ray length
  //   composite  at full resolution: a depth-aware 12-tap blur of the march,
  //              added to the image. The blur is what turns 32 jittered steps
  //              into smooth shafts; the depth weight keeps a beam behind a
  //              leaf from bleeding over the leaf.
  const RAY_LEN = `
    float rayLen(vec2 uv, out vec3 rd) {
      float d = texture2D(tDepth, uv).x;
      vec4 wp = invViewProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      wp /= wp.w;
      rd = wp.xyz - camPos;
      float len = length(rd);
      rd /= len;
      len = min(len, 22.0);
      // Stop at the window wall: outside, the whole world is in the sun.
      if (rd.x < 0.0) len = min(len, (roomX0 - camPos.x) / rd.x);
      return len;
    }
  `;
  const MARCH_FRAG = `
    precision highp sampler2DShadow;
    uniform sampler2D tDepth;
    uniform sampler2DShadow tShadow;
    uniform mat4 invViewProj;
    uniform mat4 shadowMatrix;
    uniform vec3 camPos;
    uniform vec3 sunDir;       // towards the sun
    uniform vec3 sunColor;
    uniform vec3 skyColor;
    uniform float density;
    uniform float phaseG;
    uniform float penumbra;    // shadow-uv jitter radius
    uniform float time;
    uniform float frame;
    uniform float roomX0;
    uniform float hasShadow;
    varying vec2 vUv;
    ${IGN}
    ${RAY_LEN}
    float hg(float c, float g) {
      float g2 = g * g;
      return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
    }
    // Slow billows of denser air, so the beams are not uniform sheets.
    float billow(vec3 p) {
      return 0.6 + 0.4 * sin(p.x * 1.3 + time * 0.11 + sin(p.z * 0.9 - time * 0.07) * 1.7)
                 * sin(p.y * 1.7 - time * 0.09 + sin(p.x * 0.8) * 1.3)
                 + 0.2 * sin(p.z * 2.3 + p.y * 1.1 + time * 0.13);
    }
    void main() {
      vec3 rd;
      float len = rayLen(vUv, rd);
      const int N = 32;
      float stepL = len / float(N);
      float j = ign(gl_FragCoord.xy + vec2(frame * 5.588, frame * 3.13));
      float j2 = ign(gl_FragCoord.yx * 1.37 + vec2(frame * 2.1, 7.0)) * 6.2832;
      float acc = 0.0;
      for (int i = 0; i < N; i++) {
        float dist = (float(i) + j) * stepL;
        vec3 p = camPos + rd * dist;
        vec4 sc = shadowMatrix * vec4(p, 1.0);
        float a = j2 + float(i) * 2.39996;
        vec2 o = vec2(cos(a), sin(a)) * penumbra * sqrt(fract(j + float(i) * 0.618));
        float vis = hasShadow > 0.5 ? texture(tShadow, vec3(sc.xy + o, sc.z - 0.0008)) : 1.0;
        // Air within a couple of metres of the lens barely scatters: the camera
        // drifts through beams, and a beam at the lens would fog the whole frame.
        acc += vis * billow(p) * smoothstep(0.6, 3.0, dist);
      }
      acc *= stepL;
      float ph = hg(dot(rd, sunDir), phaseG) + 0.03;
      vec3 ins = sunColor * acc * density * ph + skyColor * density * 0.006 * len;
      gl_FragColor = vec4(ins, len);
    }
  `;
  const COMP_FRAG = `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBeam;
    uniform sampler2D tDepth;
    uniform mat4 invViewProj;
    uniform vec3 camPos;
    uniform vec2 beamTexel;
    uniform float density;
    uniform float roomX0;
    varying vec2 vUv;
    ${RAY_LEN}
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 rd;
      float len = rayLen(vUv, rd);
      vec3 sum = vec3(0.0);
      float wsum = 0.0;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt((float(i) + 0.5) / 12.0) * 3.0;
        vec4 s = texture2D(tBeam, vUv + vec2(cos(a), sin(a)) * r * beamTexel);
        float w = exp(-r * r * 0.15) * exp(-abs(s.a - len) / (0.06 * len + 0.03));
        sum += s.rgb * w;
        wsum += w;
      }
      vec3 ins = wsum > 1e-4 ? sum / wsum : texture2D(tBeam, vUv).rgb;
      // A little extinction, so the far side of a thick beam is veiled.
      float ext = exp(-density * 0.02 * len);
      gl_FragColor = vec4(base.rgb * ext + ins, base.a);
    }
  `;

  const DUST_VERT = `
    precision highp sampler2DShadow;
    attribute float seed;
    uniform sampler2DShadow tShadow;
    uniform mat4 shadowMatrix;
    uniform float time, glint, scale, hasShadow, sizeMax;
    uniform vec3 boxMin, boxSize;
    varying float vLit;
    varying float vTw;
    void main() {
      // Brownian-ish drift and a slow fall, wrapped in the room box.
      vec3 p = position + vec3(
        0.25 * sin(time * 0.13 + seed * 17.0) + 0.1 * sin(time * 0.41 + seed * 5.0),
        -time * 0.018 * (0.5 + fract(seed * 7.3)) + 0.12 * sin(time * 0.23 + seed * 11.0),
        0.25 * sin(time * 0.11 + seed * 23.0) + 0.1 * cos(time * 0.37 + seed * 3.0));
      p = boxMin + mod(p - boxMin, boxSize);
      vec4 sc = shadowMatrix * vec4(p, 1.0);
      vLit = hasShadow > 0.5 ? texture(tShadow, vec3(sc.xy, sc.z - 0.0008)) : 1.0;
      float tw = 0.5 + 0.5 * sin(time * (3.0 + 6.0 * fract(seed * 3.1)) + seed * 40.0);
      vTw = mix(0.35, 1.0, tw * tw) * (1.0 + glint * step(0.55, fract(seed * 13.7 + floor(time * 8.0) * 0.37)) * 2.5);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = min(sizeMax, (0.9 + 0.8 * fract(seed * 5.1)) * scale / -mv.z);
    }
  `;
  const DUST_FRAG = `
    uniform vec3 sunColor;
    uniform float bright;
    varying float vLit;
    varying float vTw;
    void main() {
      vec2 q = gl_PointCoord - 0.5;
      float a = smoothstep(0.5, 0.0, length(q));
      float lit = vLit * vTw;
      if (lit < 0.01) discard;
      gl_FragColor = vec4(sunColor * bright * lit * a, 1.0);
    }
  `;

  // ------------------------------------------------------------ scene build
  function build(kit) {
    const T = kit.THREE;
    const A = kit.addons;
    const scene = new T.Scene();
    scene.background = new T.Color(0.6, 0.7, 0.85);
    scene.environment = kit.environment(environmentScene, 0.04);
    scene.environmentIntensity = 0.55;

    const camera = new T.PerspectiveCamera(42, kit.aspect, 0.05, 60);

    // Materials.
    const oak = oakTextures(T);
    oak.map.repeat.set(8 / 1.2, 14 / 1.2);
    oak.rmap.repeat.copy(oak.map.repeat);
    const floorMat = new T.MeshPhysicalMaterial({
      color: 0xffffff, map: oak.map, roughness: 0.62, roughnessMap: oak.rmap,
      clearcoat: 0.45, clearcoatRoughness: 0.22, envMapIntensity: 0.9,
    });
    const plaster = plasterTexture(T);
    const wallMat = new T.MeshStandardMaterial({ color: 0xffffff, map: plaster, roughness: 0.93, envMapIntensity: 0.7 });
    // Walls cast from their sunward faces: from the default back faces the
    // shadow depth sat on the room-side face, and the skirting and the floor
    // along the window wall caught a leak of light at the seam.
    wallMat.shadowSide = T.FrontSide;
    const ceilMat = new T.MeshStandardMaterial({ color: 0xf2eee6, map: plaster, roughness: 0.95, envMapIntensity: 0.7 });
    const paint = new T.MeshPhysicalMaterial({ color: 0xece8df, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35 });
    const beamWood = new T.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.75, map: oak.map });
    const ash = new T.MeshPhysicalMaterial({ color: 0xe9dcc4, roughness: 0.55, sheen: 0.3, sheenColor: new T.Color(1, 0.95, 0.85), sheenRoughness: 0.6 });
    const chrome = new T.MeshPhysicalMaterial({ color: 0xf2f2f4, metalness: 1, roughness: 0.1, envMapIntensity: 1.3 });
    const leather = new T.MeshPhysicalMaterial({ color: 0x7a3f1c, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new T.Color(0.9, 0.6, 0.4) });
    const terracotta = new T.MeshStandardMaterial({ color: 0xb4633c, roughness: 0.9 });
    const celadon = new T.MeshPhysicalMaterial({ color: 0x7fa697, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 });
    const leafMat = new T.MeshPhysicalMaterial({
      color: 0x1f4f14, roughness: 0.5, side: T.DoubleSide, sheen: 0.2, sheenColor: new T.Color(0.35, 0.6, 0.2), sheenRoughness: 0.5,
      clearcoat: 0.3, clearcoatRoughness: 0.3,
    });
    const bark = new T.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.9 });
    const stone = new T.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.85 });

    const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    // Contact shade: the skylight a pot or a chair leg keeps off the floor
    // right around its foot (no AO pass; this is where it would show).
    const blobTex = (() => {
      const c = canvas(128), g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      return new T.CanvasTexture(c);
    })();
    const blobMat = new T.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const blobGeo = new T.PlaneGeometry(1, 1);
    blobGeo.rotateX(-Math.PI / 2);
    const blob = (parent, x, z, sx, sz) => {
      const m = new T.Mesh(blobGeo, blobMat);
      m.position.set(x, 0.003, z);
      m.scale.set(sx, 1, sz || sx);
      parent.add(m);
      return m;
    };
    const box = (w, h, d, mat, x, y, z) => {
      const m = shadowy(new T.Mesh(new T.BoxGeometry(w, h, d), mat));
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };

    // Floor, ceiling, and the plain walls.
    const floorGeo = new T.PlaneGeometry(RX1 - RX0, RZ1 - RZ0);
    const floor = shadowy(new T.Mesh(floorGeo, floorMat));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((RX0 + RX1) / 2, 0, (RZ0 + RZ1) / 2);
    scene.add(floor);
    box(RX1 - RX0 + 1, 0.3, RZ1 - RZ0 + 1, ceilMat, 0, RH + 0.15, (RZ0 + RZ1) / 2);
    box(0.3, RH, RZ1 - RZ0 + 0.6, wallMat, RX1 + 0.15, RH / 2, (RZ0 + RZ1) / 2);
    box(RX1 - RX0, RH, 0.3, wallMat, 0, RH / 2, RZ1 + 0.15);
    // Back wall, with a doorway into a dimmer room beyond.
    const DX0 = 1.3, DX1 = 2.5, DH = 2.6;
    box(DX0 - RX0, RH, 0.3, wallMat, (RX0 + DX0) / 2, RH / 2, RZ0 - 0.15);
    box(RX1 - DX1, RH, 0.3, wallMat, (DX1 + RX1) / 2, RH / 2, RZ0 - 0.15);
    box(DX1 - DX0, RH - DH, 0.3, wallMat, (DX0 + DX1) / 2, (RH + DH) / 2, RZ0 - 0.15);
    box(4, 0.2, 4, floorMat, 1.9, -0.1, RZ0 - 2.3);
    box(4, 0.2, 4, ceilMat, 1.9, RH + 0.1, RZ0 - 2.3);
    box(0.2, RH, 4, wallMat, -0.1, RH / 2, RZ0 - 2.3);
    box(0.2, RH, 4, wallMat, 3.9, RH / 2, RZ0 - 2.3);
    box(4, RH, 0.2, wallMat, 1.9, RH / 2, RZ0 - 4.3);
    // Skirting and ceiling beams.
    box(0.03, 0.14, RZ1 - RZ0, paint, RX1 - 0.015, 0.07, (RZ0 + RZ1) / 2);
    box(DX0 - RX0, 0.14, 0.03, paint, (RX0 + DX0) / 2, 0.07, RZ0 + 0.015);
    for (const z of [-5.8, -2.8, 0.2, 3.2]) box(RX1 - RX0, 0.24, 0.18, beamWood, 0, RH - 0.12, z);

    // The window wall: piers, sills and heads around three openings, each
    // with a deep reveal, a painted frame and an inside sill board.
    const zs = [RZ0].concat(...WINDOWS.map((c) => [c - WIN_W / 2, c + WIN_W / 2]), [RZ1]);
    const WX = RX0 - WALL_T / 2;
    for (let i = 0; i < zs.length; i += 2) {
      const za = zs[i], zb = zs[i + 1];
      if (zb - za > 0.001) box(WALL_T, RH, zb - za, wallMat, WX, RH / 2, (za + zb) / 2);
    }
    // Skirting along the window wall, and a sill plate under it: without
    // it the sun leaked through the wall-floor seam in a bright line.
    box(0.03, 0.14, RZ1 - RZ0, paint, RX0 + 0.015, 0.07, (RZ0 + RZ1) / 2);
    box(WALL_T + 0.1, 0.4, RZ1 - RZ0, wallMat, WX, -0.19, (RZ0 + RZ1) / 2);
    for (const c of WINDOWS) {
      box(WALL_T, SILL, WIN_W, wallMat, WX, SILL / 2, c);
      box(WALL_T, RH - HEAD, WIN_W, wallMat, WX, (HEAD + RH) / 2, c);
      box(0.3, 0.04, WIN_W + 0.1, paint, RX0 - 0.1, SILL + 0.02, c);               // sill board
      box(0.06, HEAD - SILL, 0.06, paint, RX0 - WALL_T + 0.05, (SILL + HEAD) / 2, c - WIN_W / 2 + 0.03);
      box(0.06, HEAD - SILL, 0.06, paint, RX0 - WALL_T + 0.05, (SILL + HEAD) / 2, c + WIN_W / 2 - 0.03);
      box(0.06, 0.06, WIN_W, paint, RX0 - WALL_T + 0.05, HEAD - 0.03, c);
      box(0.06, 0.05, WIN_W, paint, RX0 - WALL_T + 0.05, (SILL + HEAD) * 0.62, c);  // transom
      box(0.06, 0.06, WIN_W, paint, RX0 - WALL_T + 0.05, SILL + 0.06, c);
      box(0.1, 0.07, WIN_W - 0.06, paint, BLIND_X, HEAD - 0.05, c);                  // blind head rail
    }

    // Blinds: every slat of every window in one instanced mesh.
    const slatGeo = new T.BoxGeometry(SLAT_W, SLAT_T, WIN_W - 0.08);
    const slats = shadowy(new T.InstancedMesh(slatGeo, ash, SLATS * WINDOWS.length));
    slats.instanceMatrix.setUsage(T.DynamicDrawUsage);
    slats.frustumCulled = false;
    scene.add(slats);
    // Ladder cords, two per window, thin and dark.
    const cordMat = new T.MeshStandardMaterial({ color: 0x8c8274, roughness: 0.8 });
    for (const c of WINDOWS) for (const dz of [-0.45, 0.45]) {
      box(0.004, HEAD - SILL - 0.1, 0.01, cordMat, BLIND_X - SLAT_W * 0.35, (SILL + HEAD) / 2, c + dz);
      box(0.004, HEAD - SILL - 0.1, 0.01, cordMat, BLIND_X + SLAT_W * 0.35, (SILL + HEAD) / 2, c + dz);
    }

    // Outside: bright sky, a pale stone terrace, two foliage screens.
    const skyGeo = new T.PlaneGeometry(60, 30, 1, 12);
    const skyCol = new Float32Array(skyGeo.attributes.position.count * 3);
    for (let i = 0; i < skyGeo.attributes.position.count; i++) {
      const v = clamp01((skyGeo.attributes.position.getY(i) + 15) / 30);
      skyCol[i * 3] = lerp(2.9, 1.2, v);
      skyCol[i * 3 + 1] = lerp(2.8, 1.7, v);
      skyCol[i * 3 + 2] = lerp(2.6, 2.6, v);
    }
    skyGeo.setAttribute('color', new T.BufferAttribute(skyCol, 3));
    const skyMat = new T.MeshBasicMaterial({ vertexColors: true, fog: false });
    const sky = new T.Mesh(skyGeo, skyMat);
    sky.rotation.y = Math.PI / 2;
    sky.position.set(-16, 8, -1);
    scene.add(sky);
    const terrace = new T.Mesh(new T.PlaneGeometry(14, 30), stone);
    terrace.rotation.x = -Math.PI / 2;
    terrace.position.set(-11, -0.25, -1);
    terrace.receiveShadow = true;
    scene.add(terrace);
    const leafTex = foliageTexture(T);
    const foliage = [];
    for (let i = 0; i < 2; i++) {
      const tex = leafTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(i ? 2.2 : 1.6, 1);
      tex.offset.set(i * 0.37, 0);
      const mat = new T.MeshStandardMaterial({ color: i ? 0x2c4a22 : 0x223d1a, alphaMap: tex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.8 });
      // The shadow depth material only copies map/alphaMap/alphaTest; that
      // is all the foliage needs to cast its dapple.
      const m = new T.Mesh(new T.PlaneGeometry(22, 8), mat);
      m.rotation.y = Math.PI / 2;
      m.castShadow = true;
      const x = i ? -9.5 : -6.8, y = i ? 7.2 : 6.4;
      m.position.set(x, y, -1);
      scene.add(m);
      foliage.push({ m, tex, x, y });
    }

    // House plants. A leaf: an ovate blade, cupped and bent along its length.
    const leafShape = new T.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.34, 0.18, 0.42, 0.62, 0, 1);
    leafShape.bezierCurveTo(-0.42, 0.62, -0.34, 0.18, 0, 0);
    const leafGeo = new T.ShapeGeometry(leafShape, 10);
    {
      const pos = leafGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, 0.35 * x * x - 0.18 * y * y);
      }
      leafGeo.computeVertexNormals();
    }
    const narrowShape = new T.Shape();
    narrowShape.moveTo(0, 0);
    narrowShape.bezierCurveTo(0.09, 0.2, 0.08, 0.7, 0, 1);
    narrowShape.bezierCurveTo(-0.08, 0.7, -0.09, 0.2, 0, 0);
    const frondGeo = new T.ShapeGeometry(narrowShape, 10);
    {
      const pos = frondGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, 0.6 * x * x - 0.45 * y * y);
      }
      frondGeo.computeVertexNormals();
    }
    const potProfile = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; potProfile.push(new T.Vector2(0.17 + 0.07 * u + (i === 8 ? 0.02 : 0), u * 0.42)); }
    potProfile.unshift(new T.Vector2(0, 0));
    potProfile.push(new T.Vector2(0.23, 0.42), new T.Vector2(0.22, 0.36), new T.Vector2(0, 0.36));
    const potGeo = new T.LatheGeometry(potProfile, 40);

    const plants = [];
    const makePlant = (x, z, kind) => {
      const g = new T.Group();
      g.position.set(x, 0, z);
      scene.add(g);
      const pot = shadowy(new T.Mesh(potGeo, terracotta));
      pot.scale.setScalar(kind === 'fig' ? 1.15 : 1.0);
      g.add(pot);
      blob(g, 0, 0, 0.85);
      const sway = new T.Group();
      sway.position.y = 0.4;
      g.add(sway);
      const leaves = [];
      let count;
      if (kind === 'fig') {
        const trunk = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(0.05, 0.6, 0.02), new T.Vector3(-0.04, 1.2, 0.05), new T.Vector3(0.03, 1.75, -0.02)]);
        sway.add(shadowy(new T.Mesh(new T.TubeGeometry(trunk, 24, 0.025, 8), bark)));
        count = 34;
        for (let i = 0; i < count; i++) {
          const u = i / count;
          const pt = trunk.getPoint(0.25 + 0.75 * u);
          leaves.push({ base: pt, yaw: i * 2.39996 + hash(i) * 0.5, tilt: lerp(0.9, 0.35, u) + hash(i * 3.3) * 0.3, size: lerp(0.46, 0.3, u) * (0.85 + 0.3 * hash(i * 7)), ph: hash(i * 9.1) * TAU });
        }
      } else {
        count = 26;
        for (let i = 0; i < count; i++) {
          leaves.push({ base: new T.Vector3(0, 0.02, 0), yaw: i * 2.39996, tilt: 0.35 + 0.8 * hash(i * 2.7), size: 0.85 + 0.45 * hash(i * 5.3), ph: hash(i * 4.1) * TAU });
        }
      }
      const mesh = shadowy(new T.InstancedMesh(kind === 'fig' ? leafGeo : frondGeo, leafMat, count));
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      sway.add(mesh);
      plants.push({ g, sway, mesh, leaves, kind, seed: plants.length * 3.7 });
    };
    makePlant(-3.05, 0.45, 'fig');
    makePlant(-3.2, -2.75, 'palm');
    makePlant(-3.25, 4.1, 'palm');

    // A cantilever chair in chrome tube and cognac leather, in the sun.
    {
      const chair = new T.Group();
      const path = new T.CatmullRomCurve3([
        new T.Vector3(-0.05, 0.86, 0), new T.Vector3(-0.04, 0.46, 0), new T.Vector3(0.42, 0.44, 0), new T.Vector3(0.48, 0.3, 0),
        new T.Vector3(0.44, 0.03, 0), new T.Vector3(0.1, 0.015, 0), new T.Vector3(-0.1, 0.015, 0),
      ], false, 'catmullrom', 0.2);
      const tube = new T.TubeGeometry(path, 80, 0.012, 10);
      for (const s of [-0.22, 0.22]) {
        const m = shadowy(new T.Mesh(tube, chrome));
        m.position.z = s;
        chair.add(m);
      }
      const seat = shadowy(new T.Mesh(new T.BoxGeometry(0.46, 0.035, 0.46), leather));
      seat.position.set(0.2, 0.46, 0);
      chair.add(seat);
      const back = shadowy(new T.Mesh(new T.BoxGeometry(0.03, 0.3, 0.46), leather));
      back.position.set(-0.04, 0.7, 0);
      back.rotation.z = -0.08;
      chair.add(back);
      blob(chair, 0.2, 0, 1.0, 0.7);
      chair.position.set(0.6, 0, -3.6);
      chair.rotation.y = 0.9;
      scene.add(chair);
    }
    // A tall celadon vase on the floor by the far wall.
    {
      const prof = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        prof.push(new T.Vector2(0.04 + 0.13 * Math.sin(Math.PI * Math.pow(u, 0.8)) + 0.035 * (u > 0.85 ? (u - 0.85) * 6 : 0), u * 0.72));
      }
      prof.unshift(new T.Vector2(0, 0));
      const vase = shadowy(new T.Mesh(new T.LatheGeometry(prof, 48), celadon));
      vase.position.set(3.5, 0, -4.2);
      scene.add(vase);
      const vase2 = shadowy(new T.Mesh(new T.LatheGeometry(prof, 48), terracotta));
      vase2.scale.set(0.8, 0.6, 0.8);
      vase2.position.set(3.4, 0, -3.75);
      scene.add(vase2);
      blob(scene, 3.45, -4.0, 0.9, 1.1);
    }

    // The sun, and its shadow over the whole room.
    const sun = new T.DirectionalLight(0xffffff, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
    const sc = sun.shadow.camera;
    sc.left = -9.5; sc.right = 9.5; sc.top = 9.5; sc.bottom = -9.5; sc.near = 0.5; sc.far = 50;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.015;
    sun.target.position.set(0, 1.4, -1);
    scene.add(sun, sun.target);

    // The floor's warm bounce: a rect light lying in the sun patch, facing up.
    const bounce = new T.RectAreaLight(0xffc89a, 0, 4.5, 6);
    // A light shines down its -z, like a camera: +90 degrees about x faces it up.
    bounce.rotation.x = Math.PI / 2;
    bounce.position.set(0, 0.02, -1);
    scene.add(bounce);
    // Soft skylight so the shade is blue-ish, not empty.
    const hemi = new T.HemisphereLight(0xbcd0ea, 0x6a5040, 0.15);
    scene.add(hemi);

    // Dust in the room, lit only where the sun reaches it.
    const DUST = 2400;
    const dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST);
    const boxMin = new T.Vector3(RX0 + 0.05, 0.05, RZ0 + 0.3), boxSize = new T.Vector3(RX1 - RX0 - 0.6, RH - 0.3, RZ1 - RZ0 - 0.6);
    for (let i = 0; i < DUST; i++) {
      dPos[i * 3] = boxMin.x + hash(i * 3.17 + 0.5) * boxSize.x;
      dPos[i * 3 + 1] = boxMin.y + hash(i * 5.31 + 1.7) * boxSize.y;
      dPos[i * 3 + 2] = boxMin.z + hash(i * 7.73 + 2.9) * boxSize.z;
      dSeed[i] = hash(i * 1.93 + 4.4);
    }
    const dGeo = new T.BufferGeometry();
    dGeo.setAttribute('position', new T.BufferAttribute(dPos, 3));
    dGeo.setAttribute('seed', new T.BufferAttribute(dSeed, 1));
    const dustU = {
      tShadow: { value: null }, shadowMatrix: { value: new T.Matrix4() }, hasShadow: { value: 0 },
      time: { value: 0 }, glint: { value: 0 }, scale: { value: 3 }, sizeMax: { value: 4 },
      boxMin: { value: boxMin }, boxSize: { value: boxSize },
      sunColor: { value: new T.Color(1, 0.9, 0.75) }, bright: { value: 1.5 },
    };
    const dustMat = new T.ShaderMaterial({
      uniforms: dustU, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
    const dust = new T.Points(dGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // The lens, graded for a sunlit room: cool shade, warm light.
    const lens = kit.lens({ msaa: 4, motionBlurSamples: 10, dofSamples: 32 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.9, 0.97, 1.1);
    lens.grade.lift.value.set(0.004, 0.0035, 0.003);
    lens.grade.vignette.value = 0.42;
    lens.grade.grain.value = 0.05;
    lens.grade.aberration.value = 0.0015;
    lens.maxVelocity = 0.03;
    lens.farBlur = 0.4;
    lens.bloom.threshold = 2.2;

    const beamU = {
      tDepth: { value: null }, tShadow: { value: null },
      invViewProj: { value: new T.Matrix4() }, shadowMatrix: { value: new T.Matrix4() },
      camPos: { value: new T.Vector3() }, sunDir: { value: new T.Vector3(-1, 1, 0) },
      sunColor: { value: new T.Vector3(1, 1, 1) }, skyColor: { value: new T.Vector3(0.5, 0.6, 0.75) },
      density: { value: 0.05 }, phaseG: { value: 0.55 }, penumbra: { value: 0.0005 },
      time: { value: 0 }, frame: { value: 0 }, roomX0: { value: RX0 - 0.02 }, hasShadow: { value: 0 },
    };
    const beamRT = kit.target(0.5, { type: T.HalfFloatType, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    const compU = {
      tDiffuse: { value: null }, tBeam: { value: beamRT.texture }, tDepth: beamU.tDepth,
      invViewProj: beamU.invViewProj, camPos: beamU.camPos, density: beamU.density, roomX0: beamU.roomX0,
      beamTexel: { value: new T.Vector2(1, 1) },
    };
    const march = kit.shaderPass(MARCH_FRAG, beamU);
    const beamPass = kit.shaderPass(COMP_FRAG, compU);
    // The composite is the pass the lens runs; it renders the march into the
    // half-size target first. Holding the march material on the composite
    // lets lens.compile find it and compile it ahead of the first frame.
    beamPass.marchMaterial = march.material;
    const compRender = beamPass.render;
    beamPass.render = function (renderer, writeBuffer, readBuffer, dt, mask) {
      compU.beamTexel.value.set(1 / beamRT.width, 1 / beamRT.height);
      march.render(renderer, beamRT, readBuffer);
      compRender.call(this, renderer, writeBuffer, readBuffer, dt, mask);
    };
    lens.insertPass(beamPass);

    return {
      T, scene, camera, lens, sun, bounce, hemi, slats, plants, foliage, dust, dustU, beamU, beamPass, sky,
      M: new T.Matrix4(), Q: new T.Quaternion(), E: new T.Euler(), V: new T.Vector3(), S: new T.Vector3(1, 1, 1),
      vp: new T.Matrix4(), look: new T.Vector3(),
    };
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'sunroom',
    name: 'Sunroom',
    order: 1008,
    requires: 'three',
    three: { addons: ['RectAreaLightUniformsLib'] },

    params: [
      { key: 'sun', label: 'Sun angle', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'height', label: 'Sun height', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'blinds', label: 'Blinds open', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'haze', label: 'Dust in the air', type: 'range', min: 0, max: 1, default: 0.42, step: 0.01 },
      { key: 'sharp', label: 'Beam sharpness', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'drift', label: 'Camera drift', type: 'range', min: 0, max: 2, default: 0.6, step: 0.01 },
      { key: 'warmth', label: 'Noon to golden hour', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    // The lens chain is this scene's finish; the shared Finish would add a
    // second motion blur, bloom and tone curve.
    finish: false,

    gallery: {
      title: 'Sunroom',
      technique: 'three.js 0.186.1 on the shared kit: a DirectionalLight sun with a 4096 PCF shadow map over the whole room, cast by instanced wooden venetian slats, the window reveals, instanced house-plant leaves and two alpha-tested foliage screens outside; MeshPhysicalMaterial oiled oak (canvas-generated boards, roughness map, clearcoat), lime plaster, painted timber, chrome, leather, terracotta and celadon glaze; PMREM image light from a generated room with three bright windows; a RectAreaLight in the sun patch as the floor\'s warm bounce; volumetric beams from a lens pass that ray-marches the depth buffer and samples the sun\'s own shadow map (Henyey-Greenstein in-scatter, jittered, never bloomed); dust points that test the same shadow map in their vertex shader; the kit lens (camera motion blur, depth of field, bloom above 2.2 on the sky only, split grade, AgX).',
      brief: 'An empty sunlit room with three tall windows: afternoon sun through wooden venetian blinds lays ladders of light across an oak floor and up a plaster wall, stands in the air as dusty beams, and is dappled by trees moving outside; a fiddle-leaf fig and two palms add their own swaying shadows, a chrome and leather chair sits in the light. The camera drifts slowly through the room. Kicks flick one window\'s blinds open in a wave down the slats, window by window; claps send a gust through the trees and plants; hats glint the dust only where it is in the sun; bass thickens the air. On the drop the sun comes round and lowers, the beams swing across the room, climb the far wall and sharpen, the light turns golden.',
      lineage: 'Batch 07, "Rendered" (2026-09-29), from the brief\'s entry 8; after the light studies of Vilhelm Hammershøi\'s empty Copenhagen rooms and James Turrell\'s patience with a single source, on the kit whose reference is Rendered.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      const R = this.R;
      this.lastMs = null;
      this.t = 0;
      this.camT = 0;
      this.env = { prevK: 0, b4: 0, prevS: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.blindKicks = WINDOWS.map(() => ({ at: -99, amp: 0 }));
      this.nextWindow = 0;
      this.gust = 0;
      this.gustPhase = 0;
      this.glints = 0;
      this.focus = null;
      // Shadow maps on before compiling, so the programs are built with them.
      const r = ctx.three.renderer;
      r.shadowMap.enabled = true;
      r.shadowMap.type = R.T.PCFShadowMap;
      this.layout(0, { sun: 0.45, height: 0.45, blinds: 0.6, sharp: 0.45, warmth: 0.4 });
      return R.lens.compile(R.scene, R.camera);
    },

    leave() {
      // The 4096 shadow map is 64 MB of depth; the kit does not know it.
      const s = this.R && this.R.sun.shadow;
      if (s && s.map) { s.map.dispose(); s.map = null; }
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        const w = this.blindKicks[this.nextWindow];
        w.at = this.t;
        w.amp = clamp01((0.65 + 0.35 * kRaw) * push);
        this.nextWindow = (this.nextWindow + 1) % WINDOWS.length;
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        this.gust = Math.min(1.6, this.gust + 0.9 * push);
      }
      e.prevS = sRaw;
      this.gust *= Math.exp(-dt / 0.7);

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.glints = Math.min(1.5, this.glints + 0.8 * hRaw * push);
      }
      e.prevH = hRaw;
      this.glints *= Math.exp(-dt / 0.12);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    // Sun direction and blinds, from the look params. Returns the apparent
    // elevation of the sun in the wall's cross-section (for slat tilt).
    layout(dt, Pm) {
      const R = this.R;
      // Azimuth sweeps from raking in from the front of the room to raking
      // from the back; a slow drift keeps the light walking across the walls.
      const az = lerp(-0.75, 0.75, Pm.sun) + 0.12 * Math.sin(this.t * 0.021);
      const el = lerp(0.2, 0.72, Pm.height) + 0.03 * Math.sin(this.t * 0.017 + 1);
      const L = R.V.set(-Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
      this.sunDir = this.sunDir || new R.T.Vector3();
      this.sunDir.copy(L);
      R.sun.position.copy(R.sun.target.position).addScaledVector(L, 25);
      R.sun.updateMatrixWorld();
      R.sun.target.updateMatrixWorld();
      // Slat cross-section: light travels +x, -y at apparent elevation eApp.
      const eApp = Math.atan2(L.y, -L.x);
      // Closed at 1.2 rad, fully open when the slats lie along the rays.
      const base = lerp(1.2, -eApp, Pm.blinds);
      const M = R.M, Q = R.Q, E = R.E, V = R.V, S = R.S.set(1, 1, 1);
      for (let w = 0; w < WINDOWS.length; w++) {
        const kick = this.blindKicks ? this.blindKicks[w] : { at: -99, amp: 0 };
        for (let k = 0; k < SLATS; k++) {
          // The kick runs down the blind: each slat flicks towards the rays
          // then settles, a little after the one above it.
          const tt = this.t - kick.at - k * 0.011;
          const env = tt < 0 ? 0 : (1 - Math.exp(-tt / 0.045)) * Math.exp(-tt / 0.5);
          const phi = lerp(base, -eApp, clamp01(env * 1.25 * kick.amp)) + 0.015 * Math.sin(this.t * 0.8 + k * 0.4 + w);
          E.set(0, 0, phi);
          Q.setFromEuler(E);
          V.set(BLIND_X, HEAD - 0.14 - k * SLAT_P, WINDOWS[w]);
          M.compose(V, Q, S);
          R.slats.setMatrixAt(w * SLATS + k, M);
        }
      }
      R.slats.instanceMatrix.needsUpdate = true;
      return eApp;
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three, R = this.R, T = R.T;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      this.t += dt;
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 0.9 : 0.4, dt);
      const Pm = {};
      for (const key of DRIVE) Pm[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? e.auto : 0);

      this.layout(dt, Pm);
      const L = this.sunDir;

      // Sun colour: noon white to golden hour, and warmer as it lowers.
      const warm = clamp01(Pm.warmth + 0.25 * (1 - Pm.height));
      const sunC = [1, lerp(0.95, 0.74, warm), lerp(0.88, 0.5, warm)];
      const sunI = 8 * (1 + 0.1 * e.bass * push);
      R.sun.color.setRGB(sunC[0], sunC[1], sunC[2]);
      R.sun.intensity = sunI;
      R.sun.shadow.radius = lerp(4.5, 0.6, Pm.sharp);
      // The bounce sits where the sun lands on the floor, below the middle window.
      const reach = Math.min(6, 2.1 / Math.max(0.2, Math.tan(Math.asin(L.y))));
      R.bounce.position.set(clamp(RX0 + reach * (-L.x / Math.hypot(L.x, L.z)) + 0.5, -2, 2), 0.02, clamp(-1 + reach * (-L.z / Math.hypot(L.x, L.z)), -6, 4));
      R.bounce.color.setRGB(1, lerp(0.8, 0.66, warm), lerp(0.62, 0.44, warm));
      R.bounce.intensity = 0.55 * sunI * lerp(0.5, 1, Pm.blinds);

      // Wind: outside trees and the house plants.
      this.gustPhase += dt * (0.6 + 2.5 * this.gust);
      const gp = this.gustPhase;
      R.foliage.forEach((f, i) => {
        const a = 0.05 + 0.12 * this.gust;
        f.m.position.z = -1 + a * Math.sin(gp * (1.1 + i * 0.3) + i) + 0.4 * Math.sin(this.t * 0.05 + i * 2);
        f.m.position.y = f.y + 0.4 * a * Math.sin(gp * (1.7 + i * 0.2) + 2 * i);
        f.tex.offset.x = i * 0.37 + 0.004 * Math.sin(gp * 2.3 + i) * (1 + 3 * this.gust);
      });
      const M = R.M, Q = R.Q, E = R.E, S = R.S;
      for (const pl of R.plants) {
        pl.sway.rotation.set(0.02 * Math.sin(gp * 0.9 + pl.seed) * (1 + 2 * this.gust), 0, 0.02 * Math.sin(gp * 0.7 + pl.seed * 2) * (1 + 2 * this.gust));
        pl.leaves.forEach((lf, i) => {
          const flutter = (0.05 + 0.25 * this.gust) * Math.sin(gp * (3 + (i % 5)) + lf.ph);
          E.set(-(lf.tilt + flutter), lf.yaw + 0.3 * flutter, 0, 'YXZ');
          Q.setFromEuler(E);
          const s = pl.kind === 'fig' ? lf.size : lf.size * 0.95;
          S.set(pl.kind === 'fig' ? s : s * 0.9, s, s);
          M.compose(lf.base, Q, S);
          pl.mesh.setMatrixAt(i, M);
        });
        pl.mesh.instanceMatrix.needsUpdate = true;
        S.set(1, 1, 1);
      }

      // ------------------------------------------------------------ camera
      // A slow dolly down the room on the side away from the windows, looking
      // back across the beams towards the light.
      this.camT += dt * Pm.drift * (1 + 0.25 * e.bass * push);
      const u = this.camT;
      const cam = R.camera;
      const cz = 3.0 + 2.2 * Math.sin(u * 0.045) + 0.5 * Math.sin(u * 0.11 + 1);
      cam.position.set(2.4 + 0.8 * Math.sin(u * 0.063 + 0.5), 1.4 + 0.3 * Math.sin(u * 0.081 + 2), cz);
      const look = R.look.set(-1.7 + 1.3 * Math.sin(u * 0.041 - 0.6), 1.15 + 0.35 * Math.sin(u * 0.052), cz - 7 + 1.5 * Math.sin(u * 0.037 + 2.2));
      cam.lookAt(look);
      cam.rotateZ(0.025 * Math.sin(u * 0.07));
      cam.updateMatrixWorld();
      const fd = cam.position.distanceTo(look) * 0.6;
      this.focus = this.focus == null ? fd : ease(this.focus, fd, 1.5, dt);

      // ---------------------------------------------------------- dust + beams
      const shadow = R.sun.shadow;
      // The shadow matrix three will use this frame (it updates it again
      // while rendering; same inputs, same result).
      shadow.updateMatrices(R.sun);
      const hasShadow = shadow.map ? 1 : 0;
      const du = R.dustU;
      if (shadow.map) du.tShadow.value = shadow.map.depthTexture;
      du.hasShadow.value = hasShadow;
      du.shadowMatrix.value.copy(shadow.matrix);
      du.time.value = this.t;
      du.glint.value = this.glints;
      du.scale.value = 0.028 * kit.height;
      du.sizeMax.value = 5 * kit.height / 720;
      du.sunColor.value.setRGB(sunC[0], sunC[1], sunC[2]);
      du.bright.value = 1.6 + 2.2 * this.glints;

      const Lz = R.lens;
      const bu = R.beamU;
      bu.tDepth.value = Lz.sceneTarget.depthTexture;
      if (shadow.map) bu.tShadow.value = shadow.map.depthTexture;
      bu.hasShadow.value = hasShadow;
      bu.shadowMatrix.value.copy(shadow.matrix);
      bu.invViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert();
      bu.camPos.value.copy(cam.position);
      bu.sunDir.value.copy(L);
      const bI = sunI * 0.85;
      bu.sunColor.value.set(sunC[0] * bI, sunC[1] * bI, sunC[2] * bI);
      bu.density.value = lerp(0.02, 0.09, Pm.haze) * (1 + 0.55 * e.bass * push);
      bu.phaseG.value = lerp(0.4, 0.55, Pm.sharp);
      bu.penumbra.value = lerp(0.0016, 0.0002, Pm.sharp);
      bu.time.value = this.t;
      bu.frame.value = p.frameCount % 64;

      // ------------------------------------------------------------ render
      kit.renderer.shadowMap.enabled = true;
      kit.renderer.shadowMap.type = T.PCFShadowMap;
      Lz.shutter = 0.8;
      Lz.focus = this.focus;
      Lz.blur = 0.0055;
      Lz.bloom.strength = 0.18;
      Lz.bloom.radius = 0.5;
      Lz.exposure = 0.9;
      Lz.grade.highlightTint.value.set(lerp(1.02, 1.12, warm), lerp(1.0, 0.97, warm), lerp(0.96, 0.82, warm));
      Lz.render(R.scene, cam);
      kit.composite();
    },
  });
})();
