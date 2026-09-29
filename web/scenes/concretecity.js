// Concrete City: batch 07 ("Rendered"), entry 2. LEXSAN #16's neon city
// re-thought as a dusk city, not synthwave: a low flight down an avenue of
// brutalist towers in sodium haze, the last of the sunset at the far end.
//
// The world:
//   - board-formed concrete towers in three depth layers each side, some with
//     cantilevered upper blocks and plant cores, all window grids computed in
//     the shader from each box's own facade coordinates, so the grids line up
//     with the corners whatever size the box is; punched, ribbon and slit
//     window styles; rain stains under the sills; recessed glass that reflects
//     the dusk sky (a PMREM of a generated sky ring with warm city dots), lit
//     rooms in tungsten or fluorescent
//   - timber water tanks on steel legs on the roofs (one merged, vertex-coloured
//     instanced mesh), red aviation beacons on the tall ones
//   - sodium streetlamps down the avenue; the pools they throw on the asphalt,
//     and the orange uplight on the tower bases, are computed in the shader
//     rather than lit with real lights (dozens of point lights would blow the
//     budget; the pools are periodic, so the maths is exact)
//   - traffic as pairs of lamps: headlights coming, tail lights going
//   - a height fog (analytic integral along each ray) in two colours, sodium
//     near the street and the sky's horizon above it, with the sun's glow
//     scattered in along its direction; a gradient sky dome with the same maths
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a floor of windows lights up across one tower in three, sweeping
//           along each facade, near the camera's eye level
//   clap    the aviation beacons on the skyline flash
//   hats    a scatter of single windows flicker on
//   bass    flight speed swells, the sodium haze thickens a little
//   drop    with Follow the track: the flight banks into a dive down to
//           street level between the lamps and the traffic, faster, more
//           rooms lit, the sky goes on to blue hour
//
// Render path: one main pass into the kit lens (4x MSAA half-float HDR), then
// the kit's camera motion blur (the avenue's travel passed as worldMove), depth
// of field, bloom above 1.8 (only lamps, beacons, the kick's windows), a
// blue-shadow / warm-highlight split grade, AgX.

(function () {
  'use strict';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // City layout, in metres.
  const PZ = 36;          // block pitch along the avenue
  const SLOTS = 22;       // rows from 2 behind the camera to 19 ahead
  const BEHIND = 2;
  const FH = 3.4;         // floor height
  const STREET = 13;      // kerb distance from the centre line
  const LAYERS = [        // depth layers each side: inner x, height range
    { x: 17, h: [10, 110] },
    { x: 50, h: [40, 150] },
    { x: 88, h: [60, 210] },
  ];
  const PIECES = 3;       // boxes per tower: base, cantilevered upper block, plant core
  const CARS = 36;        // per direction
  const CAR_SPAN = 760;   // traffic wraps over this length of avenue

  const SODIUM = [1.0, 0.45, 0.13];

  const PRESETS = {
    calm: { speed: 0.55, altitude: 0.7, bank: 0.35, lights: 0.35, haze: 0.55, dusk: 0.35, focus: 0.5 },
    drop: { speed: 1.7, altitude: 0.04, bank: 0.95, lights: 0.75, haze: 0.45, dusk: 0.7, focus: 0.7 },
  };
  const DRIVE = ['speed', 'altitude', 'bank', 'lights', 'haze', 'dusk', 'focus'];

  // --------------------------------------------------------------- shaders
  // Height fog shared by every material in the city.
  const HAZE_PARS = `
    uniform vec3 hazeCam, hazeLow, hazeHigh, sunDir, sunCol;
    uniform float hazeDensity, hazeFalloff, hazeLowH;
    varying vec3 vHazeW;
    vec3 hazeApply(vec3 c) {
      vec3 d = vHazeW - hazeCam;
      float L = length(d);
      vec3 rd = d / max(L, 1e-3);
      float ry = rd.y * hazeFalloff * L;
      // Integral of a exp(-b y) along the ray: exact, so a tower's top can
      // stand out of the haze that swallows its base.
      float f = hazeDensity * exp(-hazeFalloff * hazeCam.y) * L * (abs(ry) > 1e-3 ? (1.0 - exp(-ry)) / ry : 1.0);
      float amt = 1.0 - exp(-f);
      float hmid = max(hazeCam.y + rd.y * L * 0.5, 0.0);
      vec3 col = mix(hazeHigh, hazeLow, exp(-hmid / hazeLowH));
      col += sunCol * pow(max(dot(rd, sunDir), 0.0), 6.0);
      return mix(c, col, amt);
    }
  `;
  const HAZE_VERT = `
    {
      vec4 hzW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        hzW = instanceMatrix * hzW;
      #endif
      vHazeW = (modelMatrix * hzW).xyz;
    }
  `;

  function hazeify(mat, U, extra) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vHazeW;\n' + sh.vertexShader.replace(
        '#include <project_vertex>', '#include <project_vertex>\n' + HAZE_VERT);
      sh.fragmentShader = HAZE_PARS + sh.fragmentShader.replace(
        '#include <fog_fragment>', 'gl_FragColor.rgb = hazeApply(gl_FragColor.rgb);');
      if (extra) extra(sh);
    };
    return mat;
  }

  // The towers: window grids, concrete, stains, lit rooms, the kick's floors.
  const TOWER_VERT_PARS = `
    attribute vec4 aTower;
    varying vec3 vLoc; varying vec3 vSz; varying float vY; varying vec3 vBoxN; varying vec4 vTower;
  `;
  const TOWER_VERT = `
    {
      vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vLoc = position * sc; vSz = sc;
      vY = instanceMatrix[3].y + vLoc.y;
      vBoxN = normal; vTower = aTower;
    }
  `;
  const TOWER_FRAG_PARS = `
    varying vec3 vLoc; varying vec3 vSz; varying float vY; varying vec3 vBoxN; varying vec4 vTower;
    uniform vec4 kicks[6];      // floor, tower group, age, amplitude
    uniform float litShare, hatSeed, hatAmt, sodiumUp;
    float th(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
    float twWinPre(float a, float b) { return a * b; }
    float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(th(vec3(i, 7.1, 3.3)), th(vec3(i + 1.0, 7.1, 3.3)), f); }
  `;
  const TOWER_FRAG_MAP = `
    float twWin = 0.0; vec3 twLit = vec3(0.0); float twShade = 1.0;
    {
      vec3 an = abs(vBoxN);
      float side = step(an.y, 0.5);
      float u = an.x > 0.5 ? vLoc.z : vLoc.x;
      float w = an.x > 0.5 ? vSz.z : vSz.x;
      float uu = u + 0.5 * w;
      float nb = max(1.0, floor(w / 3.1));
      float bw = w / nb;
      float bay = floor(uu / bw), bu = fract(uu / bw);
      float fl = floor(vY / ${FH.toFixed(2)}), fv = fract(vY / ${FH.toFixed(2)});
      float seed = vTower.x, style = vTower.y;
      float faceId = an.x > 0.5 ? sign(vBoxN.x) : 2.0 + sign(vBoxN.z);
      // Window rectangle in bay / floor units, by style.
      vec4 r = style < 0.45 ? vec4(0.16, 0.84, 0.30, 0.82)          // punched
             : style < 0.75 ? vec4(-0.01, 1.01, 0.40, 0.80)        // ribbon
             : vec4(0.36, 0.64, 0.10, 0.92);                        // slit, between fins
      if (fl < 0.5) r = vec4(0.05, 0.95, 0.05, 0.80);               // shopfronts
      float inX = step(r.x, bu) * step(bu, r.y);
      float inY = step(r.z, fv) * step(fv, r.w);
      // Corner columns stay solid; a few blank bays per tower (stair cores).
      float solid = step(0.7, uu) * step(uu, w - 0.7) * step(0.12, th(vec3(bay, faceId, seed * 91.0)));
      float mull = style >= 0.45 && style < 0.75 ? step(0.03, abs(fract(bu * 2.0) - 0.5) * 2.0 - 0.0) : 1.0;
      twWin = side * inX * inY * solid * mull;
      // Recess: the lintel shades the top of the glass, the sill catches light.
      twShade = mix(0.35, 1.0, smoothstep(0.0, 0.16, r.w - fv));

      // Board-formed concrete: pour lines, panel tone, rain stains under sills.
      float tone = 0.25 + 0.08 * (seed - 0.5) + 0.05 * (th(vec3(bay, fl, seed * 13.0)) - 0.5);
      float board = 0.035 * step(0.93, fract(vY / 0.3));
      float stainCol = n1(uu * 2.3 + seed * 40.0);
      float below = fv < r.z ? (r.z - fv) / max(r.z, 0.01) : (fv > r.w ? 0.0 : 0.0);
      float stain = side * inX * smoothstep(0.35, 0.9, stainCol) * smoothstep(1.0, 0.1, below) * step(0.001, below) * 0.16;
      float grime = 0.06 * n1(vY * 0.15 + seed * 17.0) * side;
      // A lip of light on each spandrel's top edge and a shadow under it,
      // standing in for the relief the boxes do not have.
      float lip = side * (1.0 - twWinPre(inX, inY)) * (0.05 * smoothstep(0.05, 0.0, abs(fv - r.w - 0.03)) - 0.05 * smoothstep(0.06, 0.0, abs(fv - r.z + 0.03)));
      vec3 conc = vec3(tone - board - stain - grime + lip) * vec3(0.96, 0.98, 1.03);
      if (side < 0.5) conc = vec3(0.09, 0.088, 0.085);              // roofs: tar and gravel
      diffuseColor.rgb = mix(conc, vec3(0.012, 0.014, 0.018), twWin);

      // Lit rooms: a share of windows per tower, warm tungsten or cool tube.
      vec3 wid = vec3(bay, fl, seed * 57.0 + faceId * 5.0);
      float h1 = th(wid), h2 = th(wid + 11.7), h3 = th(wid + 23.1);
      float share = clamp(litShare * vTower.z * 1.15 + (fl < 0.5 ? 0.35 : 0.0), 0.0, 0.95);
      vec3 warmC = vec3(1.0, 0.56, 0.26), coolC = vec3(0.62, 0.80, 1.0);
      vec3 room = h2 < vTower.w ? coolC : warmC;
      float roomK = (0.6 + 1.1 * h3) * mix(0.75, 1.0, fv);
      twLit = room * roomK * step(h1, share);
      // The kick: one floor across a group of towers, sweeping along each face.
      for (int i = 0; i < 6; i++) {
        vec4 k = kicks[i];
        if (k.w <= 0.0) continue;
        float on = step(abs(fl - k.x), 0.5) * step(th(vec3(seed * 71.0, k.y, 4.0)), 0.36);
        float sweep = smoothstep(0.0, 0.08, k.z * 2.6 - uu / max(w, 1.0));
        twLit += vec3(1.0, 0.72, 0.42) * 7.0 * k.w * on * sweep * exp(-k.z * 1.7);
      }
      // Hats: single rooms flick on.
      twLit += coolC * 4.0 * hatAmt * step(th(wid * 1.37 + hatSeed), 0.012);
      twLit *= twWin * twShade;
    }
  `;
  const TOWER_FRAG_ROUGH = `
    roughnessFactor = mix(roughnessFactor, 0.07, twWin);
  `;
  const TOWER_FRAG_LIGHT = `
    // Canyon occlusion: low on the facades the sky is mostly other towers.
    reflectedLight.indirectDiffuse *= mix(0.3, 1.0, smoothstep(0.0, 80.0, vY));
    reflectedLight.indirectSpecular *= mix(0.5, 1.0, smoothstep(0.0, 80.0, vY));
    // Sodium from the street washing up the tower bases.
    reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(1.0, 0.45, 0.13) * sodiumUp * exp(-max(vY, 0.0) / 9.0) * step(abs(vBoxN.y), 0.5);
  `;

  // The street: asphalt with wet patches, lane paint, sodium pools.
  const STREET_FRAG_PARS = `
    varying vec3 vSt;
    uniform float lampPitch, lampX, lampK;
    float sh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    float sn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(sh(i), sh(i + vec2(1, 0)), f.x), mix(sh(i + vec2(0, 1)), sh(i + vec2(1, 1)), f.x), f.y); }
  `;
  const STREET_FRAG_MAP = `
    float stWet = 0.0;
    {
      vec2 q = vSt.xz;
      float n = 0.6 * sn(q * 0.08) + 0.4 * sn(q * 0.35);
      stWet = smoothstep(0.45, 0.8, n);
      float grain = sn(q * 7.0) * 0.02;
      vec3 asph = vec3(0.045 + grain) * mix(1.0, 0.55, stWet);
      // Lane paint: centre double line, dashed lanes.
      float ax = abs(q.x);
      float centre = step(abs(ax - 0.18), 0.07);
      float dash = step(abs(ax - 5.2), 0.07) * step(fract(q.y / 9.0), 0.45);
      float kerbLine = step(abs(ax - 11.6), 0.08);
      vec3 paint = centre > 0.5 ? vec3(0.55, 0.42, 0.12) : vec3(0.6);
      diffuseColor.rgb = mix(asph, paint, clamp(centre + dash + kerbLine, 0.0, 1.0) * 0.85);
    }
  `;
  const STREET_FRAG_ROUGH = `
    roughnessFactor = mix(0.7, 0.16, stWet);
  `;
  const STREET_FRAG_LIGHT = `
    {
      // Periodic lamp pools, both kerbs; the nearest three lamps each side.
      vec3 acc = vec3(0.0);
      float zc = floor(vSt.z / lampPitch + 0.5) * lampPitch;
      for (int j = -1; j <= 1; j++) {
        float lz = zc + float(j) * lampPitch;
        for (int s = 0; s < 2; s++) {
          vec3 lp = vec3(s == 0 ? -lampX : lampX, 9.0, lz);
          vec3 d = lp - vSt;
          float d2 = dot(d, d);
          float ndl = max(d.y / sqrt(d2), 0.0);
          acc += ndl / (1.0 + d2 * 0.09);
        }
      }
      reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 0.45, 0.13) * lampK * acc;
      // Wet asphalt catches the lamps as soft streaks.
      reflectedLight.directSpecular += vec3(1.0, 0.45, 0.13) * lampK * 0.08 * acc * stWet;
    }
  `;

  // Dusk sky: zenith to horizon, the sun's glow at the far end of the avenue.
  const SKY_VERT = `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }
  `;
  const SKY_FRAG = `
    varying vec3 vDir;
    uniform vec3 zenith, mid, hazeHigh, sunDir, sunCol, hazeLow;
    void main() {
      vec3 d = normalize(vDir);
      float y = d.y;
      vec3 c = mix(mid, zenith, smoothstep(0.05, 0.6, y));
      c = mix(hazeHigh, c, smoothstep(-0.02, 0.16, y));
      float s = max(dot(d, sunDir), 0.0);
      c += sunCol * (pow(s, 6.0) + 0.3 * pow(s, 60.0)) * smoothstep(0.35, -0.02, y);
      // Below the horizon: the far city lost in sodium haze.
      c = mix(c, hazeLow * 0.9 + sunCol * pow(s, 6.0), smoothstep(0.0, -0.06, y));
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  // ---------------------------------------------------------------- build
  function build(kit) {
    const T = kit.THREE, A = kit.addons;
    const scene = new T.Scene();
    scene.background = null;

    const U = {
      hazeCam: { value: new T.Vector3() },
      hazeLow: { value: new T.Color() },
      hazeHigh: { value: new T.Color() },
      sunDir: { value: new T.Vector3(0.05, 0.05, -1).normalize() },
      sunCol: { value: new T.Color() },
      hazeDensity: { value: 0.006 },
      hazeFalloff: { value: 0.02 },
      hazeLowH: { value: 20 },
    };
    const skyU = {
      zenith: { value: new T.Color() }, mid: { value: new T.Color() },
      hazeHigh: U.hazeHigh, hazeLow: U.hazeLow, sunDir: U.sunDir, sunCol: U.sunCol,
    };

    // The environment the glass and the wet street reflect: the dusk sky at
    // its default setting, a ring of warm city lights below the horizon.
    scene.environment = kit.environment((TT, env) => {
      const zen = new TT.Color(0.045, 0.06, 0.13), mid = new TT.Color(0.2, 0.15, 0.2);
      const hh = new TT.Color(0.75, 0.38, 0.2), hl = new TT.Color(0.26, 0.13, 0.06);
      const sd = new TT.Vector3(0.05, 0.05, -1).normalize(), sc = new TT.Color(1.3, 0.55, 0.22);
      env.add(new TT.Mesh(new TT.SphereGeometry(100, 48, 24), new TT.ShaderMaterial({
        side: TT.BackSide, depthWrite: false, vertexShader: SKY_VERT.replace('p.xyww', 'p'), fragmentShader: SKY_FRAG,
        uniforms: { zenith: { value: zen }, mid: { value: mid }, hazeHigh: { value: hh }, hazeLow: { value: hl }, sunDir: { value: sd }, sunCol: { value: sc } },
      })));
      const g = new TT.BoxGeometry(1, 1, 1);
      for (let i = 0; i < 240; i++) {
        const a = hash(i * 1.37) * Math.PI * 2, r = 45 + hash(i * 2.11) * 30;
        const warm = hash(i * 3.3) < 0.8;
        const k = 1.5 + 3 * hash(i * 4.7);
        const m = new TT.Mesh(g, new TT.MeshBasicMaterial({ color: warm ? new TT.Color(k, k * 0.55, k * 0.25) : new TT.Color(k * 0.6, k * 0.8, k) }));
        m.position.set(Math.cos(a) * r, -2 + hash(i * 5.9) * 14, Math.sin(a) * r);
        m.scale.set(1.5, 0.8, 1.5);
        env.add(m);
      }
    }, 0.03);
    scene.environmentIntensity = 0.9;

    const camera = new T.PerspectiveCamera(58, kit.aspect, 0.5, 2000);
    const city = new T.Group();
    scene.add(city);

    // Sky dome at the far plane (xyww), drawn after the city so its shader
    // runs only on the pixels the towers leave open.
    const sky = new T.Mesh(new T.SphereGeometry(1500, 48, 24), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyU,
    }));
    sky.frustumCulled = false;
    sky.renderOrder = 10;
    scene.add(sky);

    // Lights: a low sun down the avenue for rims, a dusk sky fill.
    const sun = new T.DirectionalLight(0xffffff, 1);
    sun.position.set(-40, 30, -400);
    sun.target.position.set(0, 0, 0);
    scene.add(sun, sun.target);
    const hemi = new T.HemisphereLight(0x5a6a9a, 0x3a1e10, 0.5);
    scene.add(hemi);

    // Towers: one instanced unit box, the window grid in the shader.
    const towerU = {
      kicks: { value: Array.from({ length: 6 }, () => new T.Vector4(0, 0, 9, 0)) },
      litShare: { value: 0.3 }, hatSeed: { value: 0 }, hatAmt: { value: 0 }, sodiumUp: { value: 0.6 },
    };
    const towerMat = hazeify(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 1 }), U, (sh) => {
      Object.assign(sh.uniforms, towerU);
      sh.vertexShader = TOWER_VERT_PARS + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + TOWER_VERT);
      sh.fragmentShader = TOWER_FRAG_PARS + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + TOWER_FRAG_MAP)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + TOWER_FRAG_ROUGH)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += twLit;')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + TOWER_FRAG_LIGHT);
    });
    const towerCount = SLOTS * 2 * LAYERS.length * PIECES;
    const boxGeo = new T.BoxGeometry(1, 1, 1);
    const towerAttr = new T.InstancedBufferAttribute(new Float32Array(towerCount * 4), 4);
    towerAttr.setUsage(T.DynamicDrawUsage);
    boxGeo.setAttribute('aTower', towerAttr);
    const towers = new T.InstancedMesh(boxGeo, towerMat, towerCount);
    towers.instanceMatrix.setUsage(T.DynamicDrawUsage);
    towers.frustumCulled = false;
    city.add(towers);

    // Water tanks: timber staves, a conical cap, steel legs; one merged
    // geometry with vertex colours.
    const BGU = A.BufferGeometryUtils;
    const paint = (geo, c) => {
      const n = geo.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; }
      geo.setAttribute('color', new T.BufferAttribute(a, 3));
      return geo;
    };
    const tankParts = [];
    tankParts.push(paint(new T.CylinderGeometry(2.1, 2.2, 5, 28, 1, true).translate(0, 5.5, 0), [0.22, 0.12, 0.07]));
    tankParts.push(paint(new T.CircleGeometry(2.1, 28).rotateX(Math.PI / 2).translate(0, 3.0, 0), [0.05, 0.05, 0.05]));
    tankParts.push(paint(new T.ConeGeometry(2.35, 1.6, 28).translate(0, 8.8, 0), [0.07, 0.065, 0.06]));
    for (const band of [3.9, 5.5, 7.1]) tankParts.push(paint(new T.TorusGeometry(2.2, 0.05, 6, 28).rotateX(Math.PI / 2).translate(0, band, 0), [0.1, 0.1, 0.11]));
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      tankParts.push(paint(new T.BoxGeometry(0.18, 3, 0.18).translate(Math.cos(a) * 1.6, 1.5, Math.sin(a) * 1.6), [0.06, 0.06, 0.065]));
    }
    tankParts.push(paint(new T.BoxGeometry(3.6, 0.15, 0.15).translate(0, 1.6, 0).rotateY(Math.PI / 4), [0.06, 0.06, 0.065]));
    tankParts.push(paint(new T.BoxGeometry(3.6, 0.15, 0.15).translate(0, 1.6, 0).rotateY(-Math.PI / 4), [0.06, 0.06, 0.065]));
    const tankGeo = BGU.mergeGeometries(tankParts.map((g) => g.toNonIndexed()));
    const tankMat = hazeify(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1, side: T.DoubleSide }), U, (sh) => {
      sh.uniforms.sodiumUp = towerU.sodiumUp;
    });
    const tankCount = SLOTS * 2 * 2;
    const tanks = new T.InstancedMesh(tankGeo, tankMat, tankCount);
    tanks.instanceMatrix.setUsage(T.DynamicDrawUsage);
    tanks.frustumCulled = false;
    city.add(tanks);

    // Emitters: beacons, lamp heads, traffic. Hazed, so distance dims them.
    const emitMat = () => hazeify(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), U);
    const beaconCount = SLOTS * 2 * LAYERS.length;
    const beacons = new T.InstancedMesh(new T.SphereGeometry(0.45, 12, 8), emitMat(), beaconCount);
    beacons.instanceMatrix.setUsage(T.DynamicDrawUsage);
    beacons.instanceColor = new T.InstancedBufferAttribute(new Float32Array(beaconCount * 3), 3);
    beacons.frustumCulled = false;
    city.add(beacons);

    // Streetlamps: two per block per kerb, static in city space.
    const lampPitch = PZ / 2, lampX = STREET - 1.4;
    const poleGeo = BGU.mergeGeometries([
      new T.CylinderGeometry(0.1, 0.14, 9, 8).translate(0, 4.5, 0).toNonIndexed(),
      new T.BoxGeometry(2.2, 0.12, 0.12).translate(-1.1, 9, 0).toNonIndexed(),
    ]);
    const poleMat = hazeify(new T.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5, metalness: 0.7 }), U);
    const headMat = hazeify(new T.MeshBasicMaterial({ color: new T.Color(SODIUM[0] * 9, SODIUM[1] * 9, SODIUM[2] * 9), toneMapped: false }), U);
    const lampCount = SLOTS * 2 * 2;
    const poles = new T.InstancedMesh(poleGeo, poleMat, lampCount);
    const heads = new T.InstancedMesh(new T.BoxGeometry(0.9, 0.16, 0.4), headMat, lampCount);
    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(), V = new T.Vector3(), E = new T.Euler();
    for (let s = 0; s < SLOTS; s++) {
      for (let j = 0; j < 2; j++) {
        const z = -(s - BEHIND) * PZ - j * lampPitch;
        for (let side = 0; side < 2; side++) {
          const sx = side ? 1 : -1, i = (s * 2 + j) * 2 + side;
          Q.setFromEuler(E.set(0, side ? 0 : Math.PI, 0));
          M.compose(V.set(sx * (lampX + 2.2), 0, z), Q, S.set(1, 1, 1));
          poles.setMatrixAt(i, M);
          M.compose(V.set(sx * lampX, 8.9, z), Q, S.set(1, 1, 1));
          heads.setMatrixAt(i, M);
        }
      }
    }
    poles.frustumCulled = heads.frustumCulled = false;
    city.add(poles, heads);

    // The street, in city space so its paint and pools scroll with the lamps.
    const streetU = { lampPitch: { value: lampPitch }, lampX: { value: lampX }, lampK: { value: 1 } };
    const streetMat = hazeify(new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, envMapIntensity: 0.8 }), U, (sh) => {
      Object.assign(sh.uniforms, streetU);
      sh.vertexShader = 'varying vec3 vSt;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vSt = (vec4(transformed, 1.0)).xyz; vSt = vec3(vSt.x, 0.0, -vSt.y) + vec3(0.0, 0.0, ' + (-(SLOTS * PZ) / 2 + BEHIND * PZ).toFixed(1) + ');');
      sh.fragmentShader = STREET_FRAG_PARS + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + STREET_FRAG_MAP)
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + STREET_FRAG_ROUGH)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + STREET_FRAG_LIGHT);
    });
    const street = new T.Mesh(new T.PlaneGeometry(420, SLOTS * PZ, 1, 1), streetMat);
    street.rotation.x = -Math.PI / 2;
    street.position.z = -(SLOTS * PZ) / 2 + BEHIND * PZ;
    city.add(street);
    // Kerbs and pavements: uniform along the avenue, so they need not scroll.
    const paveMat = hazeify(new T.MeshStandardMaterial({ color: 0x5a5650, roughness: 0.85 }), U, (sh) => {
      sh.uniforms.sodiumUp = towerU.sodiumUp;
      sh.fragmentShader = 'uniform float sodiumUp;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>',
        '#include <lights_fragment_end>\n reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(1.0, 0.45, 0.13) * sodiumUp * 0.8;');
    });
    for (const sx of [-1, 1]) {
      const pave = new T.Mesh(new T.BoxGeometry(5, 0.25, SLOTS * PZ), paveMat);
      pave.position.set(sx * (STREET + 2.5), 0.12, -(SLOTS * PZ) / 2 + BEHIND * PZ);
      scene.add(pave);
    }

    // Traffic: world space, so a car's own speed is not tied to the scroll.
    const lampPair = (w) => BGU.mergeGeometries([
      new T.BoxGeometry(0.22, 0.14, 1).translate(-w / 2, 0, 0).toNonIndexed(),
      new T.BoxGeometry(0.22, 0.14, 1).translate(w / 2, 0, 0).toNonIndexed(),
    ]);
    const headLights = new T.InstancedMesh(lampPair(1.5), hazeify(new T.MeshBasicMaterial({ color: new T.Color(6, 5.2, 4.2), toneMapped: false }), U), CARS);
    const tailLights = new T.InstancedMesh(lampPair(1.5), hazeify(new T.MeshBasicMaterial({ color: new T.Color(3.2, 0.25, 0.12), toneMapped: false }), U), CARS);
    headLights.instanceMatrix.setUsage(T.DynamicDrawUsage);
    tailLights.instanceMatrix.setUsage(T.DynamicDrawUsage);
    headLights.frustumCulled = tailLights.frustumCulled = false;
    scene.add(headLights, tailLights);
    const cars = [];
    for (let i = 0; i < CARS * 2; i++) {
      cars.push({
        z0: hash(i * 3.91 + 0.7) * CAR_SPAN,
        v: 11 + 7 * hash(i * 5.13 + 1.1),
        lane: i < CARS ? (hash(i * 7.7) < 0.5 ? -2.6 : -7.8) : (hash(i * 7.7) < 0.5 ? 2.6 : 7.8),
      });
    }

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 12, dofSamples: 24 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.84, 0.94, 1.16);
    lens.grade.lift.value.set(0.002, 0.003, 0.006);
    lens.grade.vignette.value = 0.5;
    lens.grade.grain.value = 0.06;
    lens.grade.aberration.value = 0.003;
    lens.maxVelocity = 0.05;
    lens.farBlur = 0.4;
    lens.bloom.threshold = 1.8;

    return {
      T, scene, camera, city, sky, sun, hemi, U, skyU, towerU, streetU,
      towers, towerAttr, tanks, beacons, headLights, tailLights, cars, lens,
      M, Q, S, V, col: new T.Color(), dealtK: null, towerTops: [],
    };
  }

  // Lay out the towers of every row for the current scroll index k. Content
  // is a function of the row's absolute index (seg), so rows never shuffle.
  function deal(R, k) {
    const { M, Q, S, V } = R;
    Q.identity();
    let ti = 0, tk = 0, bi = 0;
    const hide = () => M.makeScale(0, 0, 0);
    for (let s = 0; s < SLOTS; s++) {
      const seg = k + s - BEHIND;
      const zRow = -(s - BEHIND) * PZ;
      for (let side = 0; side < 2; side++) {
        const sx = side ? 1 : -1;
        for (let l = 0; l < LAYERS.length; l++) {
          const L = LAYERS[l];
          const h = (n) => hash(seg * 13.37 + side * 71.3 + l * 7.9 + n * 3.17);
          const seed = h(1), style = h(2);
          const empty = l === 0 && h(3) < 0.16;           // a plaza: the layers behind show
          const w = 12 + 12 * h(4) + l * 4;
          const d = Math.min(PZ - 10, 14 + 14 * h(5));
          const x0 = L.x + 3 * h(6) + (l === 0 ? 0 : 6 * h(7));
          const zc = zRow + (h(8) - 0.5) * (PZ - 10 - d);
          let H = Math.round(lerp(L.h[0], L.h[1], Math.pow(h(9), 1.4)) / FH) * FH;
          const xc = sx * (x0 + w / 2);
          const attr = [seed, style, 0.4 + 0.6 * h(10), h(11) < 0.3 ? 0.55 : 0.12];
          const put = (i, m) => {
            R.towers.setMatrixAt(i, m);
            R.towerAttr.setXYZW(i, attr[0], attr[1], attr[2], attr[3]);
          };
          if (empty) {
            for (let p = 0; p < PIECES; p++) put(ti++, hide());
            R.beacons.setMatrixAt(bi++, hide());
            continue;
          }
          let top = H;
          // Base block, or the lower part of a cantilevered tower.
          const canti = h(12) < 0.45 && H > 40;
          const hBase = canti ? Math.round(H * lerp(0.45, 0.65, h(13)) / FH) * FH : H;
          M.compose(V.set(xc, hBase / 2, zc), Q, S.set(w, hBase, d)); put(ti++, M);
          let topW = w, topD = d, topX = xc, topZ = zc;
          if (canti) {
            // The upper block oversails toward the avenue and along it.
            const w2 = w * lerp(0.9, 1.25, h(14)), d2 = Math.min(PZ - 8, d * lerp(0.8, 1.3, h(15)));
            const over = lerp(1, 4, h(16)) * (l === 0 ? 1 : 1.5);
            const x2 = sx * (x0 - over + w2 / 2);
            const hUp = H - hBase;
            M.compose(V.set(x2, hBase + hUp / 2, zc), Q, S.set(w2, hUp, d2)); put(ti++, M);
            topW = w2; topD = d2; topX = x2;
          } else put(ti++, hide());
          // Plant core on the roof.
          if (h(17) < 0.55) {
            const cw = Math.min(topW, topD) * lerp(0.25, 0.45, h(18)), ch = FH * (1 + Math.floor(h(19) * 3));
            M.compose(V.set(topX + (h(20) - 0.5) * (topW - cw) * 0.6, top + ch / 2, topZ + (h(21) - 0.5) * (topD - cw) * 0.6), Q, S.set(cw, ch, cw * lerp(1, 1.8, h(22))));
            put(ti++, M);
            top += ch;
          } else put(ti++, hide());
          // Water tank on the roof, for the two nearer layers.
          if (l < 2) {
            if (h(23) < 0.5) {
              const tx = topX - sx * (topW * 0.25) * h(24), tz = topZ + (h(25) - 0.5) * topD * 0.5;
              const ts = lerp(0.8, 1.2, h(26));
              M.compose(V.set(tx, H, tz), Q, S.set(ts, ts, ts));
            } else hide();
            R.tanks.setMatrixAt(tk++, M);
          }
          // Beacon on the tall ones.
          if (top > 70) M.compose(V.set(topX, top + 1.2, topZ), Q, S.set(1, 1, 1)); else hide();
          R.beacons.setMatrixAt(bi++, M);
        }
      }
    }
    R.towers.instanceMatrix.needsUpdate = true;
    R.towerAttr.needsUpdate = true;
    R.tanks.instanceMatrix.needsUpdate = true;
    R.beacons.instanceMatrix.needsUpdate = true;
    R.dealtK = k;
  }

  VIZ.register({
    id: 'concretecity',
    name: 'Concrete City',
    order: 1002,
    requires: 'three',
    three: { addons: ['BufferGeometryUtils'] },
    finish: false,

    params: [
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 0.8, step: 0.01 },
      { key: 'altitude', label: 'Altitude: street to rooftops', type: 'range', min: 0, max: 1, default: 0.55, step: 0.01 },
      { key: 'bank', label: 'Bank and weave', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'lights', label: 'Rooms lit', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'haze', label: 'Sodium haze', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'dusk', label: 'Golden to blue hour', type: 'range', min: 0, max: 1, default: 0.4, step: 0.01 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Concrete City',
      technique: 'three.js 0.186.1 on the shared kit: instanced unit boxes whose MeshStandardMaterial is extended in the shader with facade-aligned window grids (punched, ribbon, slit), board-formed concrete tone, rain stains and recessed glass, lit rooms and the kick\'s floors as emission; an analytic height fog in two colours with sun inscatter on every material and a matching gradient sky dome; a PMREM of that sky ringed with warm city dots for the glass and wet asphalt to reflect; sodium lamp pools and tower uplight computed in the shader; a merged vertex-coloured water-tank mesh; the kit lens (motion blur with the avenue\'s travel as worldMove, DOF, bloom above 1.8, split grade, AgX).',
      brief: 'A low banking flight down the avenue of a brutalist city at dusk: concrete towers with cantilevered upper blocks and plant cores, timber water tanks on the roofs, sodium lamps and traffic in the street, the sunset glowing at the far end through an orange haze. The kick lights a floor of windows across a group of towers, sweeping along each facade; claps flash the aviation beacons on the skyline; hats flick single rooms on; bass swells the speed and the haze. On the drop the flight banks into a dive to street level between the lamps and the traffic, and the sky moves on to blue hour.',
      lineage: 'Batch 07, "Rendered" (2026-09-29): LEXSAN #16\'s neon city fly-through re-thought as a lit, hazy dusk rather than synthwave; after the Barbican, Boston City Hall and the water-tank rooftops of New York.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      this.lastMs = null;
      this.dist = 0;
      this.prevDist = null;
      this.t = 0;
      this.env = { prevK: 0, prevS: 0, prevH: 0, b4: 0, b8: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.kicks = [];
      this.kickN = 0;
      this.beacon = 0;
      this.hat = 0; this.hatSeed = 0;
      this.smSpeed = null;
      this.camY = null;
      this.focus = null;
      this.R.dealtK = null;
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        if (push > 0.02) {
          const n = ++this.kickN;
          const eye = Math.floor((this.camY == null ? 20 : this.camY) / FH);
          const floor = Math.max(1, eye + Math.round((hash(n * 3.3) - 0.35) * 7));
          this.kicks.unshift({ floor, grp: Math.floor(hash(n * 7.1) * 97), age: 0, amp: (0.6 + 0.4 * kRaw) * Math.min(1.5, push) });
          this.kicks.length = Math.min(this.kicks.length, 6);
        }
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        this.beacon = Math.min(1.5, push);
      }
      e.prevS = sRaw;
      this.beacon *= Math.exp(-dt / 0.22);

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.hatSeed = (this.hatSeed + 17.31) % 1000;
        this.hat = Math.min(1.2, 0.5 + hRaw) * push;
      }
      e.prevH = hRaw;
      this.hat *= Math.exp(-dt / 0.12);

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
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.4 : 0.45, dt);
      const Pm = {};
      for (const key of DRIVE) Pm[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? e.auto : 0);

      this.t += dt;
      const t = this.t;
      const target = Pm.speed * (0.6 + 0.8 * e.bass * push) * 16;
      this.smSpeed = this.smSpeed == null ? target : ease(this.smSpeed, target, 1.2, dt);
      this.dist += this.smSpeed * dt;

      // ------------------------------------------------------------ city
      const k = Math.floor(this.dist / PZ);
      const shift = this.dist - k * PZ;
      if (R.dealtK !== k) deal(R, k);
      R.city.position.z = shift;

      // Beacons: a slow red pulse, flashed by claps.
      const bk = 0.35 + 0.25 * Math.max(0, Math.sin(t * 2.1)) + 5 * this.beacon;
      R.col.setRGB(1.0 * bk, 0.08 * bk, 0.04 * bk);
      for (let i = 0; i < R.beacons.count; i++) R.beacons.setColorAt(i, R.col);
      R.beacons.instanceColor.needsUpdate = true;

      // Traffic, wrapped over the avenue around the camera.
      const M = R.M, V = R.V, Q = R.Q, S = R.S;
      Q.identity();
      const streak = 1 + this.smSpeed * 0.05;
      for (let i = 0; i < R.cars.length; i++) {
        const c = R.cars[i];
        const toward = i < CARS;
        let z = c.z0 + (toward ? c.v : -c.v) * t + this.dist;
        z = ((z % CAR_SPAN) + CAR_SPAN) % CAR_SPAN - (CAR_SPAN - 30);
        M.compose(V.set(c.lane, 0.75, z), Q, S.set(1, 1, toward ? streak * 0.6 : streak));
        (toward ? R.headLights : R.tailLights).setMatrixAt(toward ? i : i - CARS, M);
      }
      R.headLights.instanceMatrix.needsUpdate = true;
      R.tailLights.instanceMatrix.needsUpdate = true;

      // ------------------------------------------------------------ camera
      const bank = Pm.bank;
      const yTarget = lerp(5.5, 52, Math.pow(Pm.altitude, 1.2)) + (2 + 6 * Pm.altitude) * Math.sin(t * 0.11 + 0.6);
      this.camY = this.camY == null ? yTarget : ease(this.camY, yTarget, 1.3, dt);
      const x = bank * (5.2 * Math.sin(t * 0.19) + 1.6 * Math.sin(t * 0.43 + 1.3));
      const vx = bank * (5.2 * 0.19 * Math.cos(t * 0.19) + 1.6 * 0.43 * Math.cos(t * 0.43 + 1.3));
      const cam = R.camera;
      cam.position.set(x, this.camY, 0);
      const vy = (yTarget - this.camY) * 1.3;
      const yaw = -0.06 * vx + 0.12 * Math.sin(t * 0.07);
      const pitch = clamp(0.03 * vy, -0.25, 0.2) + lerp(0.1, -0.1, Pm.altitude) + 0.03 * Math.sin(t * 0.13);
      const roll = -bank * (0.12 * vx + 0.06 * Math.sin(t * 0.23)) - 0.02;
      cam.rotation.set(pitch, yaw, roll, 'YXZ');
      cam.updateMatrixWorld();

      // ------------------------------------------------------ atmosphere
      const dusk = Pm.dusk;
      const haze = Pm.haze * (1 + 0.3 * e.bass * push);
      R.U.hazeCam.value.copy(cam.position);
      R.U.hazeDensity.value = lerp(0.0006, 0.009, haze);
      R.U.hazeFalloff.value = 0.028;
      R.U.hazeLowH.value = 14;
      R.U.hazeLow.value.setRGB(lerp(0.34, 0.26, dusk), lerp(0.16, 0.12, dusk), lerp(0.06, 0.07, dusk));
      R.U.hazeHigh.value.setRGB(lerp(0.85, 0.3, dusk), lerp(0.46, 0.26, dusk), lerp(0.24, 0.36, dusk));
      R.U.sunCol.value.setRGB(lerp(1.5, 0.55, dusk), lerp(0.62, 0.22, dusk), lerp(0.22, 0.14, dusk));
      R.U.sunDir.value.set(-0.1, lerp(0.045, -0.01, dusk), -1).normalize();
      R.skyU.zenith.value.setRGB(lerp(0.07, 0.012, dusk), lerp(0.09, 0.022, dusk), lerp(0.18, 0.075, dusk));
      R.skyU.mid.value.setRGB(lerp(0.36, 0.08, dusk), lerp(0.24, 0.09, dusk), lerp(0.26, 0.2, dusk));
      R.sky.position.copy(cam.position);
      R.sun.intensity = lerp(1.2, 0.15, dusk);
      R.sun.color.setRGB(1.0, lerp(0.55, 0.5, dusk), lerp(0.28, 0.4, dusk));
      R.hemi.intensity = lerp(0.45, 0.22, dusk);
      R.hemi.color.setRGB(lerp(0.5, 0.25, dusk), lerp(0.45, 0.32, dusk), lerp(0.55, 0.6, dusk));
      R.scene.environmentIntensity = lerp(0.6, 0.32, dusk);

      // Windows: the share lit rises into blue hour, as it would.
      const TU = R.towerU;
      TU.litShare.value = clamp01(Pm.lights * lerp(0.7, 1.15, dusk));
      TU.sodiumUp.value = lerp(0.35, 0.9, dusk) * (1 + 0.3 * e.bass * push);
      TU.hatAmt.value = this.hat;
      TU.hatSeed.value = this.hatSeed;
      for (const q of this.kicks) q.age += dt;
      this.kicks = this.kicks.filter((q) => q.age < 3);
      for (let i = 0; i < 6; i++) {
        const q = this.kicks[i];
        // Floors are counted from the street, so they are fixed on the towers
        // even as the rows scroll.
        if (q) TU.kicks.value[i].set(q.floor, q.grp, q.age, q.amp); else TU.kicks.value[i].set(0, 0, 9, 0);
      }
      R.streetU.lampK.value = 1.4;

      // ------------------------------------------------------------ render
      // Focus: the facades a little ahead, nearer when low among them.
      const fTarget = lerp(22, 60, Pm.altitude);
      this.focus = this.focus == null ? fTarget : ease(this.focus, fTarget, 1.5, dt);
      const L = R.lens;
      const moved = this.prevDist == null ? 0 : this.dist - this.prevDist;
      this.prevDist = this.dist;
      L.shutter = 0.8;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.009 * (0.3 + Pm.focus) : 0;
      L.bloom.strength = 0.22 + 0.1 * e.auto;
      L.bloom.radius = 0.35;
      L.grade.highlightTint.value.set(lerp(1.14, 1.04, dusk), lerp(0.97, 0.96, dusk), lerp(0.82, 0.92, dusk));
      L.render(R.scene, cam, { worldMove: [0, 0, moved] });
      kit.composite();
    },

    leave() {},
  });
})();
