// Shardfall: a flight through glass. LEXSAN #13 (the psychedelic mirror
// shards, one of Raph's favourites) re-thought as light rather than colour:
// faceted glass shards, mirrored left-right into symmetric figures like
// moths or masks, hang in a deep starfield ahead of a warm galactic core.
// Each figure arrives as a closed emblem and opens like a flower as the
// camera reaches it, so the flight passes through its middle; every shard
// keeps morphing between facet shapes as it comes. Colour is what the glass
// does to the light behind it: amber, rose, smoke and jade tints deepening
// with thickness, clear and frosted panes, a little dispersion at the edges.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    a wave runs away from the camera through the figures: the rims of
//           the shards it passes light up with the glass's own tint and the
//           petals flutter open (a band that travels, not a flash)
//   clap    every shard morphs to its next facet shape at once
//   hats    the near stars twinkle
//   bass    flight speed swells, the figures breathe open, the core warms
//   drop    with Follow the track: the mirror goes four ways (the lower half
//           of every figure dissolves and regrows as the upper half's
//           reflection), the flight speeds up, dispersion opens, the core
//           brightens and the bloom widens
//
// How it is made (web/three-kit.js; CONTRACT.md, "three.js scenes"):
//   - One prism geometry whose shape lives in the vertex shader: a star-
//     shaped profile of SHARD_N points, radii hashed from a per-instance seed
//     and blended between two shape sets by a per-instance phase, extruded
//     into a thin slab with pyramid-faceted faces; normals are rebuilt per
//     facet in the shader, so morphing shards stay faceted and catch light.
//   - Four InstancedMeshes, one per mirror (identity, x, y, xy). Each shares
//     the same per-instance attributes; its geometry carries its mirror (and
//     reversed winding where the mirror flips handedness) and its instance
//     matrices are S·M·S, so every copy is the exact reflection of the base.
//   - MeshPhysicalMaterial with transmission, thickness, attenuation,
//     dispersion and clearcoat, lit by a PMREM of the same sky it flies
//     through, plus a warm key and a cool rim.
//   - The sky: a nebula baked once to a cube, procedural stars and an
//     analytic core on a camera-locked sphere (opaque, so the glass refracts
//     it); near stars as HDR points that stream past and streak.
//   - The kit lens: world-move motion blur, depth of field racking onto the
//     next figure, bloom above 2 (the core and the brightest stars only),
//     a split-tone grade, AgX.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);
  const sstep = (a, b, x) => smooth(clamp01((x - a) / (b - a)));

  // The flight, in metres.
  const P = 7;              // one figure every P metres
  const SLOTS = 13;         // slots from 1 behind the camera to 11 ahead
  const BEHIND = 1;
  const FIG = 5;            // shards per half-figure, at most
  const LOOSE = 5;          // loose shards per slot
  const PER = FIG + LOOSE;
  const COUNT = SLOTS * PER;
  const SHARD_N = 7;        // profile points per shard
  const NEAR_STARS = 900;

  // Glass tints in linear light: [tints], mixed by hash per shard.
  const GLASS = [
    { name: 'Amber and rose', tints: [[1.0, 0.55, 0.18], [1.0, 0.42, 0.48], [0.92, 0.92, 0.96], [0.42, 0.44, 0.52], [0.55, 0.85, 0.66]], atten: [1.0, 0.78, 0.6] },
    { name: 'Ice', tints: [[0.9, 0.95, 1.0], [0.55, 0.78, 1.0], [0.5, 0.95, 0.92], [0.45, 0.47, 0.56], [0.78, 0.66, 1.0]], atten: [0.8, 0.9, 1.0] },
    { name: 'Smoke and gold', tints: [[0.38, 0.37, 0.4], [1.0, 0.8, 0.45], [0.7, 0.45, 0.22], [0.93, 0.92, 0.9], [0.62, 0.56, 0.5]], atten: [0.9, 0.8, 0.7] },
  ];

  const PRESETS = {
    calm: { speed: 0.7, open: 0.5, morph: 0.6, mirror: 0, disp: 0.2, frost: 0.35, focus: 0.6 },
    drop: { speed: 2.0, open: 0.85, morph: 1.4, mirror: 1, disp: 0.6, frost: 0.2, focus: 0.5 },
  };
  const DRIVE = ['speed', 'open', 'morph', 'mirror', 'disp', 'frost', 'focus'];

  // ------------------------------------------------------------ the shard
  // A slab of SHARD_N rim points with a pyramid apex on each face. Every
  // vertex records which profile points it is made of (aProf: this point,
  // the facet's two rim points, which face), so the vertex shader can place
  // it and rebuild the facet's normal from whatever shape the profile has
  // morphed into. Nothing here is a real position; the shader writes them.
  function shardGeometry(T, sx, sy) {
    const prof = [], kind = [], mir = [], pos = [], idx = [];
    let v = 0;
    const add = (k, a, b, zs, kd) => {
      prof.push(k, a, b, zs); kind.push(kd); mir.push(sx, sy);
      const ang = (k < 0 ? 0 : k) / SHARD_N * TAU, r = k < 0 ? 0 : 1;
      pos.push(Math.cos(ang) * r, Math.sin(ang) * r, zs);
      return v++;
    };
    const tris = [];
    for (const zs of [1, -1]) {
      for (let k = 0; k < SHARD_N; k++) {
        const kb = (k + 1) % SHARD_N;
        const a = add(-1, k, kb, zs, 0), b = add(k, k, kb, zs, 0), c = add(kb, k, kb, zs, 0);
        tris.push(zs > 0 ? [a, b, c] : [a, c, b]);
      }
    }
    for (let k = 0; k < SHARD_N; k++) {
      const kb = (k + 1) % SHARD_N;
      const a = add(k, k, kb, 1, 1), b = add(kb, k, kb, 1, 1), c = add(k, k, kb, -1, 1), d = add(kb, k, kb, -1, 1);
      tris.push([c, d, b], [c, b, a]);
    }
    // A mirror with negative determinant turns every triangle inside out;
    // reversing the winding keeps the front faces facing out.
    const flip = sx * sy < 0;
    for (const t of tris) idx.push(...(flip ? [t[0], t[2], t[1]] : t));
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(new Float32Array(pos.length), 3));
    g.setAttribute('aProf', new T.Float32BufferAttribute(prof, 4));
    g.setAttribute('aKind', new T.Float32BufferAttribute(kind, 1));
    g.setAttribute('aMir', new T.Float32BufferAttribute(mir, 2));
    g.setIndex(idx);
    g.boundingSphere = new T.Sphere(new T.Vector3(), 2);
    return g;
  }

  const SHARD_VERT_PARS = `
attribute vec4 aProf;
attribute float aKind;
attribute vec2 aMir;
attribute vec4 aInst;      // seed, shape phase, rim glow, roughness
uniform float uApex;
varying float vGlow;
varying float vKind;
varying float vRough;
varying vec3 vTint;
float shH(float s, float k, float n) { return fract(sin(s * 12.9898 + k * 78.233 + n * 37.719) * 43758.5453); }
vec2 shProf(float k) {
  if (k < 0.0) return vec2(0.0);
  float s = aInst.x;
  float f = floor(aInst.y);
  float u = fract(aInst.y); u = u * u * (3.0 - 2.0 * u);
  float ang = (k + 0.4 * (shH(s, k, 1.0) - 0.5)) / ${SHARD_N}.0 * 6.2831853;
  // Radii from two shape sets, blended: a few long points and some short
  // ones, which is what makes a shard read as broken rather than round.
  float ra = 0.22 + 0.78 * pow(shH(s, k, f * 3.1 + 5.0), 0.8);
  float rb = 0.22 + 0.78 * pow(shH(s, k, (f + 1.0) * 3.1 + 5.0), 0.8);
  float r = mix(ra, rb, u);
  return vec2(cos(ang), sin(ang)) * r;
}
`;

  const SHARD_NORMAL = `
vec3 shP;
vec3 objectNormal;
{
  float zs = aProf.w;
  shP = vec3(shProf(aProf.x), aProf.x < 0.0 ? zs * uApex : zs);
  vec2 pa = shProf(aProf.y), pb = shProf(aProf.z);
  if (aKind < 0.5) {
    vec3 a0 = vec3(0.0, 0.0, zs * uApex), a1 = vec3(pa, zs), a2 = vec3(pb, zs);
    objectNormal = normalize(cross(a1 - a0, a2 - a0));
    if (objectNormal.z * zs < 0.0) objectNormal = -objectNormal;
  } else {
    vec2 e = pb - pa;
    vec2 n2 = normalize(vec2(e.y, -e.x) + 1e-6);
    if (dot(n2, pa + pb) < 0.0) n2 = -n2;
    objectNormal = vec3(n2, 0.0);
  }
  shP.xy *= aMir;
  objectNormal.xy *= aMir;
  vGlow = aInst.z;
  vKind = aKind;
  vRough = aInst.w;
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #else
    vTint = vec3(1.0);
  #endif
}
`;

  function glassMaterial(T, uniforms) {
    const m = new T.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.05,
      transmission: 1, thickness: 0.4, ior: 1.52, dispersion: 0.3,
      attenuationColor: new T.Color(1, 0.8, 0.62), attenuationDistance: 1.1,
      clearcoat: 0.6, clearcoatRoughness: 0.05, specularIntensity: 1,
      envMapIntensity: 1.0,
      // Both sides: the back facets refract and reflect inside the pane,
      // which is most of what makes a shard read as glass rather than resin.
      side: T.DoubleSide,
    });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = SHARD_VERT_PARS + sh.vertexShader
        .replace('#include <beginnormal_vertex>', SHARD_NORMAL)
        .replace('#include <begin_vertex>', 'vec3 transformed = shP;');
      sh.fragmentShader = 'uniform float uGlowK, uEdge;\nvarying float vGlow;\nvarying float vKind;\nvarying float vRough;\nvarying vec3 vTint;\n' + sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(vRough, 0.02, 1.0);')
        // The kick wave: light caught in the glass, in the rims and where the
        // faces turn away (a whole lit face read as opaque plastic).
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float shF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);\n  totalEmissiveRadiance += vTint * (vGlow * uGlowK * mix(shF, 1.0, vKind) + uEdge * vKind);');
    };
    m.customProgramCacheKey = () => 'shardfall-glass';
    return m;
  }

  // ---------------------------------------------------------------- the sky
  // Direction-space value noise; shared by the nebula bake and the
  // environment, so the glass reflects the sky it flies through.
  const NOISE = `
float nH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(nH(i), nH(i + vec3(1,0,0)), f.x), mix(nH(i + vec3(0,1,0)), nH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(nH(i + vec3(0,0,1)), nH(i + vec3(1,0,1)), f.x), mix(nH(i + vec3(0,1,1)), nH(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// Dust lanes and gas: indigo ground, plum and dusty rose clouds, a peach
// glow toward the core ahead (-z). Muted on purpose: not a neon nebula.
vec3 nebula(vec3 d) {
  float core = max(0.0, -d.z);
  float n = fbm(d * 2.2 + vec3(3.0, 1.0, 0.0));
  float m = fbm(d * 4.5 + vec3(n * 1.6, 7.0, 2.0));
  float lanes = smoothstep(0.35, 0.75, fbm(d * 3.0 + vec3(9.0, n, 4.0)));
  vec3 col = vec3(0.0015, 0.002, 0.006);
  col += vec3(0.022, 0.01, 0.03) * pow(n, 2.5) * 1.6;
  col += vec3(0.05, 0.02, 0.024) * pow(m * n, 2.0) * 2.0 * (0.3 + core);
  col += vec3(0.16, 0.09, 0.05) * pow(core, 7.0) * (0.3 + m);
  col *= mix(1.0, 0.25, lanes * (0.6 + 0.4 * core));
  return col;
}
`;

  const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

  // Baked once into a cube: the nebula with the full fbm.
  const BAKE_FRAG = NOISE + `
varying vec3 vDir;
void main() { gl_FragColor = vec4(nebula(normalize(vDir)), 1.0); }
`;

  const SKY_FRAG = `
uniform samplerCube tNebula;
uniform float uCore, uStars, uTime;
uniform vec3 uCoreDir;
varying vec3 vDir;
float sH(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
// One layer of stars on a cube-face grid; the disc is sized in pixels
// through fwidth, so stars stay points at any render size.
vec3 stars(vec3 d, float scale, float keep, float seed) {
  vec3 a = abs(d); vec2 uv; float face;
  if (a.x >= a.y && a.x >= a.z) { uv = d.yz / a.x; face = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { uv = d.xz / a.y; face = d.y > 0.0 ? 2.0 : 3.0; }
  else { uv = d.xy / a.z; face = d.z > 0.0 ? 4.0 : 5.0; }
  vec2 g = uv * scale; vec2 id = floor(g); vec2 f = fract(g);
  float h = sH(vec3(id, face + seed));
  if (h > keep) return vec3(0.0);
  vec2 c = vec2(sH(vec3(id, face + seed + 7.0)), sH(vec3(id, face + seed + 13.0))) * 0.7 + 0.15;
  float px = length(f - c) / max(fwidth(g.x), 1e-5);
  float mag = pow(sH(vec3(id, face + seed + 21.0)), 6.0);
  float tw = 0.75 + 0.25 * sin(uTime * (1.0 + 3.0 * h) + h * 40.0);
  float t = sH(vec3(id, face + seed + 29.0));
  vec3 tint = mix(vec3(1.0, 0.78, 0.6), vec3(0.75, 0.85, 1.0), t);
  return tint * exp(-px * px * 0.9) * (0.12 + 2.4 * mag) * tw;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = textureCube(tNebula, d).rgb;
  col += (stars(d, 70.0, 0.06, 0.0) + stars(d, 180.0, 0.05, 50.0) * 0.5) * uStars;
  float c = max(0.0, dot(d, uCoreDir));
  // The core: a hot white-gold heart, a wide peach halo. Brighter than 2 at
  // its centre only, so it is the one thing in the sky that blooms.
  col += vec3(1.0, 0.82, 0.62) * (pow(c, 1400.0) * 4.0 + pow(c, 160.0) * 0.25) * uCore;
  col += vec3(0.5, 0.24, 0.16) * pow(c, 10.0) * 0.06 * uCore;
  gl_FragColor = vec4(col, 1.0);
}
`;

  const STAR_VERT = `
attribute float aSeed;
uniform float uScale, uMax, uGlint, uTick;
varying vec3 vCol;
float h1(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = (0.6 + 1.4 * h1(aSeed)) * uScale / max(0.5, -mv.z);
  gl_PointSize = clamp(sz, 1.0, uMax);
  // Hats: a random few stars flare on each tick of the glint clock.
  float g = step(0.86, h1(aSeed * 1.37 + uTick)) * uGlint;
  vec3 tint = mix(vec3(1.0, 0.8, 0.62), vec3(0.72, 0.84, 1.0), h1(aSeed + 3.1));
  float fade = smoothstep(90.0, 55.0, -mv.z) * smoothstep(2.0, 8.0, -mv.z);
  vCol = tint * (0.7 + 1.6 * h1(aSeed + 7.7) + 2.5 * g) * fade;
}
`;
  const STAR_FRAG = `
varying vec3 vCol;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  gl_FragColor = vec4(vCol * exp(-r * 3.5), 1.0);
}
`;

  // ------------------------------------------------------------ scene build
  function build(kit) {
    const T = kit.THREE;
    const renderer = kit.renderer;

    const scene = new T.Scene();
    scene.background = new T.Color(0, 0, 0);

    // Bake the nebula to a cube once (it never changes; the core and the
    // stars that do are drawn on top per pixel).
    const bakeScene = new T.Scene();
    bakeScene.add(new T.Mesh(new T.SphereGeometry(10, 32, 16),
      new T.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: BAKE_FRAG, side: T.BackSide, depthWrite: false })));
    const cubeRT = new T.WebGLCubeRenderTarget(512, { type: T.HalfFloatType, generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter });
    const cubeCam = new T.CubeCamera(0.1, 100, cubeRT);
    const prevTarget = renderer.getRenderTarget();
    cubeCam.update(renderer, bakeScene);
    renderer.setRenderTarget(prevTarget);
    bakeScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });

    // Environment for the glass: the same nebula, a brighter core ahead
    // and two soft studio panels (warm above-right, cool below-left), so
    // facets catch shaped highlights instead of a uniform sheen.
    scene.environment = kit.environment((T2, env) => {
      env.add(new T2.Mesh(new T2.SphereGeometry(10, 32, 16),
        new T2.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: BAKE_FRAG, side: T2.BackSide, depthWrite: false })));
      const panel = (w, h, pos, col, k) => {
        const m = new T2.Mesh(new T2.PlaneGeometry(w, h), new T2.MeshBasicMaterial({ color: new T2.Color(col[0] * k, col[1] * k, col[2] * k), side: T2.DoubleSide }));
        m.position.set(pos[0], pos[1], pos[2]);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      panel(2.2, 2.2, [0, 0, -8], [1.0, 0.8, 0.6], 6);
      // Thin strips all round and behind: crisp lines in the facets read as
      // glass, where broad soft panels made every pane look milky.
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * TAU + 0.3, z = 6 - (i % 3) * 3;
        const warm = i % 3 !== 1;
        panel(0.22, 7, [Math.cos(a) * 8, Math.sin(a) * 8, z], warm ? [1.0, 0.82, 0.62] : [0.6, 0.75, 1.0], warm ? 7 : 5);
      }
    }, 0.02);
    scene.environmentIntensity = 1;

    const camera = new T.PerspectiveCamera(50, kit.aspect, 0.1, 160);

    // Sky sphere, camera-locked. Opaque, so three's transmission pass sees
    // it and the glass refracts the stars and the core.
    const skyUniforms = {
      tNebula: { value: cubeRT.texture }, uCore: { value: 1 }, uStars: { value: 1 },
      uTime: { value: 0 }, uCoreDir: { value: new T.Vector3(0, 0, -1) },
    };
    const sky = new T.Mesh(new T.SphereGeometry(120, 48, 24),
      new T.ShaderMaterial({ uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: T.BackSide, depthWrite: false }));
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);

    // Shards: four mirrored InstancedMeshes sharing their per-instance data.
    const shardUniforms = { uApex: { value: 2.6 }, uGlowK: { value: 1 }, uEdge: { value: 0.3 } };
    const glass = glassMaterial(T, shardUniforms);
    const inst = new T.InstancedBufferAttribute(new Float32Array(COUNT * 4), 4);
    inst.setUsage(T.DynamicDrawUsage);
    const tint = new T.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
    const mirrors = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => {
      const g = shardGeometry(T, sx, sy);
      g.setAttribute('aInst', inst);
      const m = new T.InstancedMesh(g, glass, COUNT);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.instanceColor = tint;
      m.frustumCulled = false;
      scene.add(m);
      return { mesh: m, sx, sy };
    });

    // Near stars: a cylinder of points streaming past, placed by hash.
    const sPos = new Float32Array(NEAR_STARS * 3), sSeed = new Float32Array(NEAR_STARS);
    for (let i = 0; i < NEAR_STARS; i++) {
      const a = hash(i * 3.17 + 0.5) * TAU, r = 3 + Math.pow(hash(i * 5.31 + 1.7), 0.7) * 38;
      sPos[i * 3] = Math.cos(a) * r;
      sPos[i * 3 + 1] = Math.sin(a) * r;
      sPos[i * 3 + 2] = 5 - hash(i * 7.73 + 2.9) * 95;
      sSeed[i] = i + 1;
    }
    const sGeo = new T.BufferGeometry();
    sGeo.setAttribute('position', new T.BufferAttribute(sPos, 3));
    sGeo.setAttribute('aSeed', new T.BufferAttribute(sSeed, 1));
    const starUniforms = { uScale: { value: 6 }, uMax: { value: 4 }, uGlint: { value: 0 }, uTick: { value: 0 } };
    const nearStars = new T.Points(sGeo, new T.ShaderMaterial({
      uniforms: starUniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    }));
    nearStars.frustumCulled = false;
    scene.add(nearStars);

    // A warm key from behind the camera, high and left, for the facet glints;
    // a cool rim from ahead-below for the edges.
    const key = new T.DirectionalLight(0xffe2c4, 2.2);
    key.position.set(-4, 6, 8);
    const rim = new T.DirectionalLight(0x9fb8ff, 1.2);
    rim.position.set(3, -4, -10);
    scene.add(key, rim);

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 10, dofSamples: 32 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.86, 0.84, 1.12);
    lens.grade.highlightTint.value.set(1.08, 0.97, 0.88);
    lens.grade.lift.value.set(0.0015, 0.001, 0.004);
    lens.grade.vignette.value = 0.5;
    lens.grade.grain.value = 0.05;
    lens.grade.aberration.value = 0.003;
    lens.bloom.threshold = 2.0;
    lens.farBlur = 0.35;
    lens.maxVelocity = 0.06;

    return {
      T, scene, camera, sky, skyUniforms, cubeRT, glass, shardUniforms, inst, tint, mirrors,
      nearStars, starUniforms, lens,
      M: new T.Matrix4(), Q: new T.Quaternion(), E: new T.Euler(), V: new T.Vector3(), S: new T.Vector3(),
    };
  }

  // Row i times s_i, column j times s_j: the reflection S·M·S of a matrix
  // (column-major), scaled on its first three columns by w.
  const MS = [1, 1, 1, 1];
  function mirrorInto(src, dst, off, sx, sy, w) {
    MS[0] = sx; MS[1] = sy;
    for (let c = 0; c < 4; c++) {
      const cw = c < 3 ? w : 1;
      for (let r = 0; r < 4; r++) dst[off + c * 4 + r] = src[c * 4 + r] * MS[r] * MS[c] * cw;
    }
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'shardfall',
    name: 'Shardfall',
    order: 1001,
    requires: 'three',
    three: {},
    finish: false,   // the kit lens is this scene's finish

    params: [
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'open', label: 'Figures open', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'morph', label: 'Morph rate', type: 'range', min: 0, max: 2, default: 0.8, step: 0.01 },
      { key: 'mirror', label: 'Mirror: two-way to four-way', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'glass', label: 'Glass', type: 'select', options: GLASS.map((g) => g.name), default: 0 },
      { key: 'disp', label: 'Dispersion', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'frost', label: 'Frosted panes', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Shardfall',
      technique: 'three.js 0.186.1 on the shared kit: faceted glass shards whose profile, facets and normals are built in the vertex shader from a per-instance seed and shape phase (so every shard morphs and stays faceted), drawn as four mirrored InstancedMeshes (S·M·S instance matrices, mirrored and re-wound geometry); MeshPhysicalMaterial transmission with thickness, attenuation, dispersion and clearcoat, frosted panes by per-instance roughness, rim glow injected as emissive; a nebula baked once to a cube with procedural pixel-sized stars and an analytic core on a camera-locked sphere the glass refracts, and a PMREM of the same sky for reflections; HDR near stars as points; the kit lens with world-move motion blur, depth of field racking to the next figure, bloom above 2, split-tone grade and AgX.',
      brief: 'LEXSAN #13, the mirror shards, re-thought as light: a flight through a deep starfield toward a warm galactic core, past symmetric figures of tinted and frosted glass that arrive as closed emblems and open like flowers to let the camera through, every shard morphing between facet shapes as it comes. The colour is the glass: amber, rose, smoke and jade deepening with thickness, a little dispersion on the edges. Kicks send a wave running away through the figures, lighting the rims it passes; claps morph every shard at once; hats twinkle the near stars; bass swells the speed and breathes the figures open. On the drop the mirror goes four ways, the flight speeds up, dispersion opens and the core brightens.',
      lineage: 'Batch 07, Rendered (2026-09-29): LEXSAN #13 (psychedelic mirror shards over a starfield, docs/research/2026-09-28-lexsan-takeaways.md) through the three.js kit whose reference is Rendered; the figures after Rorschach plates and kaleidoscope mirrors, the glass after cathedral and art-glass offcuts.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      this.lastMs = null;
      this.dist = 0;
      this.prevDist = null;
      this.t = 0;
      this.focusD = null;
      this.env = { prevK: 0, prevS: 0, b4: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.waves = [];
      this.claps = 0;
      this.clapPos = 0;
      this.glint = 0;
      this.tick = 0;
      this.smSpeed = 6;
      this.q4 = 0;
      this.phase = 0;
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    listen(s, dt, push) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        this.waves.unshift({ age: 0, amp: (0.6 + 0.4 * kRaw) * Math.min(1.6, push) });
        this.waves.length = Math.min(this.waves.length, 5);
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        if (push > 0.05) this.claps += 1;
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.glint = Math.min(1.5, this.glint + 0.9 * hRaw * push);
        this.tick += 1;
      }
      e.prevH = hRaw;
      this.glint *= Math.exp(-dt / 0.12);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three, R = this.R;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      this.listen(signals, dt, push);
      const e = this.env;

      const follow = Math.round(params.follow) === 1;
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.2 : 0.45, dt);
      const D = follow ? e.auto : 0;
      const Pm = {};
      for (const key of DRIVE) Pm[key] = params[key] + (PRESETS.drop[key] - params[key]) * D;
      const energy = Math.max(D, clamp01((Pm.speed - 1) / 1.5) * 0.6);

      this.t += dt;
      const target = Pm.speed * (0.6 + 0.8 * e.bass * push) * 6;
      this.smSpeed = ease(this.smSpeed, target, 1.5, dt);
      this.dist += this.smSpeed * dt;
      for (const w of this.waves) w.age += dt;
      this.waves = this.waves.filter((w) => w.age < 2.4);
      this.clapPos = ease(this.clapPos, this.claps, 6, dt);
      this.phase += dt * 0.12 * Pm.morph;
      this.q4 = ease(this.q4, Pm.mirror, 3, dt);

      const waveAt = (d) => {
        // d: metres ahead of the camera. Each wave runs away at 36 m/s.
        let v = 0;
        for (const w of this.waves) {
          const x = (d - (w.age * 36 + 6)) / 3.5;
          v += w.amp * Math.exp(-x * x) * Math.exp(-w.age * 1.1);
        }
        return v;
      };

      // --------------------------------------------------------- the shards
      const k0 = Math.floor(this.dist / P);
      const shift = this.dist - k0 * P;
      const glass = GLASS[clamp(Math.round(params.glass), 0, GLASS.length - 1)];
      const tints = glass.tints;
      R.glass.attenuationColor.setRGB(glass.atten[0], glass.atten[1], glass.atten[2]);
      R.glass.dispersion = 0.05 + 1.6 * Pm.disp;
      const inst = R.inst.array, tint = R.tint.array;
      const { M, Q, E, V, S } = R;
      const mats = R.mirrors.map((m) => m.mesh.instanceMatrix.array);
      const q = smooth(clamp01(this.q4));
      const openK = Pm.open * (0.75 + 0.5 * e.bass * push);
      const frost = Pm.frost;
      const t = this.t;
      let focusD = null;

      for (let s = 0; s < SLOTS; s++) {
        const seg = k0 + s - BEHIND;
        const zFig = -(s - BEHIND) * P + shift;      // figure plane, world z
        const d = -zFig;                             // metres ahead
        // Grow in at the far end, so the wrap never pops.
        const appear = sstep((SLOTS - BEHIND) * P - 2, (SLOTS - BEHIND - 1.3) * P, d);
        if (focusD === null && d > 2.5) focusD = d;
        const open = sstep(26, 3, d);
        const wv = waveAt(d);
        const nFig = 3 + Math.floor(hash(seg * 1.13 + 0.7) * (FIG - 2));
        const fScale = 0.8 + 0.6 * hash(seg * 2.71 + 0.3);
        const yc = (hash(seg * 3.3 + 1.1) - 0.5) * 0.7;
        const figSeed = seg * 17.13;

        for (let j = 0; j < PER; j++) {
          const i = s * PER + j;
          const h = (n) => hash(figSeed + j * 7.31 + n * 1.618);
          let w = appear, px, py, pz;
          let rough = h(9) < frost ? 0.28 + 0.2 * h(10) : 0.03;
          let glow = 0;
          if (j < FIG) {
            if (j >= nFig) w = 0;
            // A petal: angle across the right half, long axis radial; it
            // swings its outer end toward the camera as the figure opens.
            const phi = lerp(-1.25, 1.25, (j + 0.5) / nFig) + (h(1) - 0.5) * 0.35;
            const L = (0.7 + 0.8 * h(2)) * fScale;
            const W = (0.28 + 0.3 * h(3)) * fScale;
            const Th = 0.07 + 0.05 * h(4);
            const flutter = 0.6 * wv;
            const op = clamp01(open * openK + flutter * 0.4);
            const r = (0.15 + 0.35 * h(5)) * fScale + L * 0.55 + op * 2.4;
            px = Math.cos(phi) * r;
            py = yc + Math.sin(phi) * r;
            pz = zFig + (h(6) - 0.5) * 0.6;
            E.set(0, -(0.25 + 1.0 * op) - 0.12 * Math.sin(t * 0.7 + j), phi + (h(7) - 0.5) * 0.4, 'ZYX');
            Q.setFromEuler(E);
            S.set(L, W, Th);
            // Near petals fill the frame; they stay out of the wave so the
            // kick lands in the figures ahead, not on the whole screen.
            glow = 1.6 * wv * sstep(5, 12, d);
          } else {
            // Loose shards on the periphery, tumbling slowly.
            const a = (h(1) - 0.5) * Math.PI * 1.1;
            const r = 2.6 + 5.5 * h(2);
            px = Math.cos(a) * r;
            py = Math.sin(a) * r * 0.9;
            pz = zFig - h(3) * P;
            const size = 0.25 + 0.55 * h(4);
            const spin = t * (0.15 + 0.3 * h(5));
            E.set(h(6) * TAU + spin, h(7) * TAU + spin * 0.7, h(8) * TAU, 'XYZ');
            Q.setFromEuler(E);
            S.set(size * 1.4, size * 0.8, 0.06);
            const dl = -pz;
            w *= sstep((SLOTS - BEHIND) * P - 2, (SLOTS - BEHIND - 1.3) * P, dl) * (0.35 + 0.65 * sstep(0, 0.2, 0.5 + energy - h(11)));
            glow = 1.2 * waveAt(dl) * sstep(5, 12, dl);
          }
          V.set(px, py, pz);
          M.compose(V, Q, S);
          const me = M.elements;
          // Four-way: lower-half shards give way to the upper half's
          // reflection as the mirror param rises.
          const lower = py < 0;
          const wBase = w * (lower ? 1 - q : 1);
          const wUp = w * (lower ? 0 : q);
          mirrorInto(me, mats[0], i * 16, 1, 1, wBase);
          mirrorInto(me, mats[1], i * 16, -1, 1, wBase);
          mirrorInto(me, mats[2], i * 16, 1, -1, wUp);
          mirrorInto(me, mats[3], i * 16, -1, -1, wUp);

          // Shape phase: its own offset, the slow clock, the claps, and a
          // turn per slot travelled so shards morph as they pass.
          inst[i * 4] = figSeed + j * 3.7;
          inst[i * 4 + 1] = h(12) * 5 + this.phase + this.clapPos + (seg * 0.35);
          inst[i * 4 + 2] = glow;
          inst[i * 4 + 3] = rough;
          const tc = tints[Math.floor(h(13) * tints.length)];
          // Paled toward clear: the attenuation already deepens the colour
          // with thickness, and full-strength tints read as stone, not glass.
          tint[i * 3] = lerp(1, tc[0], 0.7); tint[i * 3 + 1] = lerp(1, tc[1], 0.7); tint[i * 3 + 2] = lerp(1, tc[2], 0.7);
        }
      }
      for (const m of R.mirrors) m.mesh.instanceMatrix.needsUpdate = true;
      R.inst.needsUpdate = true;
      R.tint.needsUpdate = true;
      R.shardUniforms.uGlowK.value = 1.2 + 0.6 * energy;

      // ----------------------------------------------------------- the sky
      R.skyUniforms.uTime.value = t;
      R.skyUniforms.uCore.value = 0.8 + 0.5 * e.bass * push + 0.9 * energy;
      const sp = R.nearStars.geometry.attributes.position;
      const arr = sp.array, adv = this.smSpeed * dt;
      for (let i = 2; i < arr.length; i += 3) { arr[i] += adv; if (arr[i] > 5) arr[i] -= 95; }
      sp.needsUpdate = true;
      R.starUniforms.uScale.value = 7 * kit.height / 720;
      R.starUniforms.uMax.value = (3.5 + 2 * this.glint) * kit.height / 720;
      R.starUniforms.uGlint.value = this.glint;
      R.starUniforms.uTick.value = this.tick * 0.731;

      // ------------------------------------------------------------ camera
      const cam = R.camera;
      cam.position.set(0.25 * Math.sin(t * 0.13), 0.18 * Math.sin(t * 0.17 + 1.1), 0);
      const roll = 0.35 * Math.sin(t * 0.045) + 0.12 * energy * Math.sin(t * 0.2);
      cam.rotation.set(0.02 * Math.sin(t * 0.11), 0.03 * Math.sin(t * 0.09), roll, 'YXZ');
      cam.updateMatrixWorld();
      R.sky.position.copy(cam.position);

      this.focusD = this.focusD == null ? (focusD || 8) : ease(this.focusD, focusD || 8, 2.5, dt);

      // ------------------------------------------------------------ render
      const L = R.lens;
      const moved = this.prevDist == null ? 0 : this.dist - this.prevDist;
      this.prevDist = this.dist;
      L.shutter = 0.9 + 0.4 * energy;
      L.focus = this.focusD;
      L.blur = Pm.focus > 0.02 ? 0.012 * (0.3 + Pm.focus) : 0;
      L.bloom.strength = 0.18 + 0.25 * energy;
      L.bloom.radius = 0.3 + 0.2 * energy;
      // The glass samples the scene behind it from three's transmission
      // target; at half size it is soft enough behind refraction and depth
      // of field, and it bought back the frames to hold 60 at 3024x1890.
      // The renderer is shared, so the setting is put back straight after.
      const r = kit.renderer, trs = r.transmissionResolutionScale;
      r.transmissionResolutionScale = 0.5;
      L.render(R.scene, cam, { worldMove: [0, 0, moved] });
      r.transmissionResolutionScale = trs;
      kit.composite();
    },
  });
})();
