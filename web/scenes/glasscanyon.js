// Glass Canyon: a low daylight flight down a canyon whose walls are tall fins
// of glass standing in pale sand. Each fin is a lens in section (thick in the
// middle, rounded to an edge), sheared to a slanted top like a shard, tinted
// sea-glass aqua, pale amber or clear. The sun sits ahead and to the right,
// so the fins are backlit: they bend the sky, the sand and the fins behind
// them, and throw their light forward onto the floor as tinted shadows full
// of moving caustic filaments. Mesas stand far off in the haze.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    one fin near the camera rings like a bell: it bends, a ripple
//           and a band of light caught in the glass run up it, the refraction
//           through it shivers and its caustic on the sand dances (on the
//           drop the kick rings a pair)
//   clap    the fins near the camera swing a few degrees, alternately, eased:
//           every refraction slides and the caustic shadows swing round
//   hats    mica in the sand glints in the sunlit patches
//   bass    flight speed swells; the caustics move faster and brighter
//   drop    with Follow the track: the sun comes down to a golden hour into
//           the frame, the glass deepens in colour, blown sand glitters in
//           the air, the flight speeds and banks
//
// How it is made:
//   On the shared three.js kit (web/three-kit.js; CONTRACT.md, "three.js
//   scenes"). The world scrolls past a still camera, as in rendered.js, and
//   the lens is told how far it moved so the fins streak.
//
//   Glass comes in two tiers, because three's transmission pass renders only
//   opaque things behind the glass: a glass fin cannot see another. So the
//   fins in the slots nearest the camera are true transmissive
//   MeshPhysicalMaterial (IOR 1.5, dispersion, tint from the instance
//   colour), and every other fin is an opaque "fake glass" that reflects the
//   environment and looks through itself into it along a refracted ray. The
//   fake fins are opaque, so the real ones refract them: the near glass shows
//   the far glass bent.
//
//   The sky is a small analytic shader (gradient, halo, HDR sun disc), used
//   as the backdrop and, with a stand-in canyon of tinted slabs, sand and
//   rock, rebaked to a PMREM whenever the sun moves as the image-based light,
//   so reflections follow the golden hour.
//
//   The caustics are computed, not traced: the sand's shader follows a ray
//   from each ground point toward the sun, and where it passes through a fin
//   (a vertical plate in the ray's path, below its slanted top) the light is
//   tinted by that fin and concentrated into caustic filaments in the fin's
//   own coordinates. So a ringing fin shakes its own caustic, and a turning
//   fin swings its shadow, with no shadow map.

(function () {
  'use strict';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // Canyon layout, in metres. Four fins a slot: inner and outer, each side.
  const P = 5;             // slot pitch along the flight
  const SLOTS = 22;        // 2 behind the camera, 19 ahead
  const BEHIND = 2;
  const NEAR = 6;          // inner fins in slots 0..NEAR-1 are true transmission
  const CAUSTIC_SLOTS = 12; // fins the sand shader knows about
  const NF = CAUSTIC_SLOTS * 4;
  const SLANT = 0.34;      // top shear: height varies +-17% along the fin
  const FIN_HALF_T = 0.24; // half thickness, as a fraction of the fin's length

  // Glass inks in linear light: sea-glass aqua and pale amber, plus clear.
  const AQUA = [0.42, 0.93, 0.82];
  const AMBER = [1.0, 0.62, 0.26];
  const CLEAR = [0.95, 0.98, 1.0];

  const PRESETS = {
    calm: { speed: 0.5, weave: 0.35, sun: 0.12, tint: 0.3, caustics: 0.55, glitter: 0.05, focus: 0.45 },
    drop: { speed: 1.7, weave: 0.8, sun: 0.9, tint: 0.8, caustics: 1, glitter: 0.75, focus: 0.65 },
  };
  const DRIVE = ['speed', 'weave', 'sun', 'tint', 'caustics', 'glitter', 'focus'];

  // ---------------------------------------------------------------- sky
  // One analytic sky for the backdrop and the environment bake. Linear HDR:
  // the disc is far above the bloom threshold, the rest of the sky below it.
  const SKY_GLSL = `
    uniform vec3 uSun, uSunCol, uZenith, uHorizon, uGround;
    vec3 skyColor(vec3 dir) {
      float y = dir.y;
      vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.42));
      if (y < 0.0) col = mix(uHorizon, uGround, clamp(-y * 7.0, 0.0, 1.0));
      float mu = max(dot(dir, uSun), 0.0);
      // Forward haze round the sun, a tighter halo, then the disc.
      col += uSunCol * (0.10 * pow(mu, 5.0) + 0.4 * pow(mu, 60.0) + 1.2 * pow(mu, 900.0));
      col += uSunCol * 16.0 * smoothstep(0.99975, 0.99988, mu);
      return col;
    }`;

  function skyMaterial(T, uniforms) {
    return new T.ShaderMaterial({
      uniforms,
      vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: SKY_GLSL + '\nvarying vec3 vDir;\nvoid main() { gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0); }',
      side: T.BackSide, depthWrite: false, fog: false,
    });
  }

  // ---------------------------------------------------------------- fins
  // A thick lens in section, extruded up in 28 steps (so the ring can bend
  // it), then sheared so the top slants like a broken shard. Object space,
  // before the instance scale (length, height, length): x is thickness, y is
  // height 0..1, z is length -0.5..0.5. Thick and curved on purpose: the
  // first pass used 0.4 m slabs, which passed the scene through undistorted
  // and read as tinted panes, not glass.
  function finGeometry(T) {
    const shape = new T.Shape();
    const N = 40, half = FIN_HALF_T;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = half * Math.pow(Math.sin(Math.PI * t), 0.6);
      if (i === 0) shape.moveTo(0, t - 0.5); else shape.lineTo(x, t - 0.5);
    }
    for (let i = N - 1; i > 0; i--) {
      const t = i / N;
      shape.lineTo(-half * Math.pow(Math.sin(Math.PI * t), 0.6), t - 0.5);
    }
    const g = new T.ExtrudeGeometry(shape, {
      depth: 1, steps: 28, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.02, bevelSegments: 3, curveSegments: 4,
    });
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), z = pos.getZ(i);
      pos.setY(i, y + SLANT * z * Math.max(0, y));
    }
    pos.needsUpdate = true;
    return g;
  }

  // The bell: a bending mode plus a ripple running up the fin. aRing is
  // (amplitude, seconds since the strike). The normal is tilted by the same
  // slope, which is what makes the refraction shiver.
  const RING_VERT_PARS = 'attribute vec2 aRing;\nvarying vec3 vRing;\n';
  const RING_NORMAL = `#include <beginnormal_vertex>
    float rA = aRing.x, rT = aRing.y;
    float hy = clamp(position.y, 0.0, 1.2);
    float w1 = 6.2831853 * 4.2, w2 = 6.2831853 * 11.0;
    float ringDisp = rA * (0.07 * hy * hy * sin(w1 * rT) + 0.012 * sin(w2 * rT - hy * 44.0) * hy);
    float ringSlope = rA * (0.14 * hy * sin(w1 * rT) - 0.012 * 44.0 * cos(w2 * rT - hy * 44.0) * hy
                           + 0.012 * sin(w2 * rT - hy * 44.0));
    objectNormal = normalize(objectNormal + objectNormal.x * vec3(0.0, -ringSlope, 0.0));`;
  const RING_BEGIN = '#include <begin_vertex>\n    transformed.x += ringDisp;\n    vRing = vec3(rA, rT, hy);';

  // The strike is also seen: a band of light caught in the glass runs up
  // the fin, brightest on its edges, as the ripple does. Kept under the
  // bloom threshold, so it is light in the glass, not a neon tube.
  const RING_FRAG = `#include <emissivemap_fragment>
    {
      float front = vRing.y * 1.7 - 0.05;
      float bd = (vRing.z - front) / 0.07;
      float band = exp(-bd * bd);   // not pow(): a negative base is NaN on Metal
      float edge = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
      totalEmissiveRadiance += ringTint * vRing.x * (band * (0.5 + 2.2 * edge) * 2.2 + 0.25 * exp(-vRing.y * 5.0));
    }`;

  function patchRing(sh) {
    sh.vertexShader = RING_VERT_PARS + sh.vertexShader
      .replace('#include <beginnormal_vertex>', RING_NORMAL)
      .replace('#include <begin_vertex>', RING_BEGIN);
    sh.fragmentShader = 'varying vec3 vRing;\n' + sh.fragmentShader
      .replace('#include <emissivemap_fragment>', RING_FRAG);
    if (sh.fragmentShader.indexOf('vec3 ringTint') < 0) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  vec3 ringTint = diffuseColor.rgb;');
    }
  }

  // ---------------------------------------------------------------- sand
  const SAND_FRAG_PARS = `
    uniform vec4 finA[${NF}];   // centre x, z (world); plate direction x, z
    uniform vec4 finB[${NF}];   // half length, height (0 = none), ring amp, ring age
    uniform vec4 finC[${NF}];   // tint rgb, top slant
    uniform vec3 uSunDir;
    uniform float uScroll, uCausT, uCaus, uSparkle, uSparkT;
    varying vec3 vGW;

    float gcHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }

    // Wind ripples on low dunes. Ripples fade with distance, where they would
    // only alias into shimmer.
    float sandH(vec2 g, float rip) {
      float w = dot(g, vec2(0.8, 0.6));
      float bend = 1.6 * sin(dot(g, vec2(0.13, -0.07))) + 1.1 * sin(dot(g, vec2(-0.05, 0.09)) + 1.7)
                 + 0.35 * sin(dot(g, vec2(0.41, 0.23)));
      float r = 0.5 + 0.5 * sin((w + bend) * 12.0);
      float ripple = 0.012 * r * r;
      float dune = 0.30 * sin(g.x * 0.23 + 0.6 * sin(g.y * 0.09)) * sin(g.y * 0.14 + 1.1);
      return ripple * rip + dune;
    }

    // Caustic filaments: a few rounds of domain warping whose inverse
    // distance to the warped grid gives thin bright lines that drift.
    float caustic(vec2 uv, float t) {
      vec2 p = uv * 6.2831853 + vec2(-250.0);
      vec2 i = p;
      float c = 1.0;
      for (int n = 0; n < 4; n++) {
        float tn = t * (1.0 - 3.5 / float(n + 1));
        i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + tn) / 0.005), p.y / (cos(i.y + tn) / 0.005)));
      }
      c /= 4.0;
      c = 1.17 - pow(c, 1.4);
      return pow(abs(c), 7.0);
    }

    // Sunlight at a ground point after passing the fins: white in the open,
    // tinted and gathered into filaments where a fin stands in the way.
    vec3 glassLight(vec3 p) {
      vec3 L = vec3(1.0);
      vec3 s = uSunDir;
      for (int i = 0; i < ${NF}; i++) {
        vec4 B = finB[i];
        if (B.y <= 0.0) continue;
        vec4 A = finA[i];
        vec2 b = A.xy - p.xz;
        float det = s.z * A.z - s.x * A.w;
        if (abs(det) < 1e-4) continue;
        float t = (A.z * b.y - b.x * A.w) / det;
        float u = (s.x * b.y - s.z * b.x) / det;
        if (t <= 0.0 || abs(u) > B.x + 0.3) continue;
        float y = t * s.y;
        vec4 C = finC[i];
        float top = B.y * (1.0 + C.w * u / (2.0 * B.x));
        if (y > top + 0.5) continue;
        float soft = 0.06 + t * 0.012;
        float m = smoothstep(B.x + soft, B.x - soft, abs(u)) * smoothstep(top + soft * 2.0, top - soft * 2.0, y);
        if (m <= 0.0) continue;
        // In the fin's own frame: along the plate, and up it. A ringing fin
        // shakes its own caustic.
        float ring = B.z, rt = B.w;
        vec2 q = vec2(u * 0.45, y * 0.3);
        q += ring * vec2(0.05 * sin(26.4 * rt + y * 0.8), 0.08 * sin(69.1 * rt - y * 3.0));
        float tt = uCausT + float(i) * 1.37;
        // Dispersion: the filaments split into colour with distance behind the glass.
        float spread = 0.0015 + 0.0009 * t;
        // Two evaluations, not three: green is their mean, which on thin
        // filaments reads the same and saves a third of the sand's cost.
        float cr = caustic(q + vec2(spread, 0.0), tt);
        float cb = caustic(q - vec2(spread, 0.0), tt);
        vec3 fil = vec3(cr, 0.5 * (cr + cb), cb);
        vec3 tint = C.rgb;
        // The spread light keeps only a little of the glass's colour (full
        // tint on warm sand went olive); the gathered filaments carry it.
        vec3 through = mix(vec3(1.0), tint, 0.55) * 0.62 + tint * uCaus * (1.0 + 1.6 * ring) * 1.8 * fil;
        // A bright seam where the rounded edge sends light sideways.
        float sd = (abs(u) - B.x + 0.08) / (0.05 + 0.01 * t);
        float seam = exp(-sd * sd);
        through += tint * seam * 0.6 * uCaus;
        L *= mix(vec3(1.0), through, m);
      }
      return L;
    }`;

  function sandMaterial(T, U) {
    const mat = new T.MeshStandardMaterial({ color: 0xd9c6a4, roughness: 0.93, metalness: 0, envMapIntensity: 0.85 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SAND_FRAG_PARS)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 gc = vec2(vGW.x, vGW.z - uScroll);
            float sPatch = 0.5 * sin(gc.x * 0.31 + sin(gc.y * 0.17) * 2.0) * sin(gc.y * 0.27 + 0.4) + 0.5;
            diffuseColor.rgb *= mix(0.9, 1.06, sPatch);
          }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec3 gLight;
          float gSpark = 0.0;
          {
            vec2 g = vec2(vGW.x, vGW.z - uScroll);
            float dist = length(vViewPosition);
            float rip = clamp(1.0 - dist / 45.0, 0.0, 1.0);
            float e = 0.03;
            float h0 = sandH(g, rip);
            float hx = sandH(g + vec2(e, 0.0), rip);
            float hz = sandH(g + vec2(0.0, e), rip);
            vec3 nW = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e));
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
            gLight = glassLight(vGW);
            // Mica: sparse cells that catch the sun, on the hats.
            vec2 cell = floor(g * 16.0);
            float hc = gcHash(cell);
            float tw = gcHash(cell + floor(uSparkT * 9.0 + hc * 7.0));
            float near = clamp(1.0 - dist / 22.0, 0.0, 1.0);
            vec2 f = fract(g * 16.0) - 0.5;
            gSpark = step(0.985, hc) * step(0.55, tw) * near * uSparkle * smoothstep(0.3, 0.1, length(f));
          }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.93, 0.8) * 9.0 * gSpark * dot(gLight, vec3(0.33));`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          reflectedLight.directDiffuse *= gLight;
          reflectedLight.directSpecular *= gLight;`);
    };
    return mat;
  }

  // Far fins: opaque, so the true glass in front can refract them. They
  // reflect the environment (Fresnel) and, through themselves, show the sky
  // PMREM along a refracted ray, tinted by the instance colour.
  function fakeGlassMaterial(T) {
    const mat = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, ior: 1.5, specularIntensity: 1, envMapIntensity: 1 });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n  vec3 glassTint = diffuseColor.rgb;\n  vec3 ringTint = glassTint;\n  diffuseColor.rgb *= 0.025;')
        .replace('#include <opaque_fragment>', `
          #ifdef USE_ENVMAP
          {
            vec3 nW = inverseTransformDirection(normal, viewMatrix);
            vec3 vW = inverseTransformDirection(-normalize(vViewPosition), viewMatrix);
            vec3 r1 = refract(vW, nW, 1.0 / 1.5);
            // Two surfaces' worth of bending, so the edges swing far round.
            vec3 dirT = normalize(vW + 1.1 * (r1 - vW));
            vec3 tr = textureCubeUV(envMap, envMapRotation * dirT, 0.04).rgb * envMapIntensity;
            float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
            float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
            // Longer path through the middle of the lens: deeper colour.
            vec3 absorb = pow(glassTint, vec3(0.5 + 1.0 * ndv));
            outgoingLight += tr * absorb * (1.0 - F) * 0.92;
          }
          #endif
          #include <opaque_fragment>`);
      patchRing(sh);   // after the tint lines above, which define ringTint
    };
    return mat;
  }

  // ------------------------------------------------------------ build
  function build(kit) {
    const T = kit.THREE;
    const scene = new T.Scene();
    scene.fog = new T.FogExp2(new T.Color(0.6, 0.66, 0.74), 0.0042);

    const camera = new T.PerspectiveCamera(55, kit.aspect, 0.1, 420);
    const hall = new T.Group();
    scene.add(hall);

    // Sky, and its environment bake.
    const skyU = {
      uSun: { value: new T.Vector3(0, 1, 0) }, uSunCol: { value: new T.Vector3(1, 1, 1) },
      uZenith: { value: new T.Vector3() }, uHorizon: { value: new T.Vector3() }, uGround: { value: new T.Vector3() },
    };
    const skyMat = skyMaterial(T, skyU);
    const sky = new T.Mesh(new T.SphereGeometry(380, 48, 24), skyMat);
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    scene.add(sky);
    // The environment is a stand-in canyon, not only sky: the fins are
    // vertical, so refraction through them only bends sideways, and a bare
    // sky is the same colour at every azimuth; the first pass's far fins
    // showed nothing through themselves and read as painted panels. With
    // walls of tinted slabs, sand and mesas in the bake, every fin reflects
    // and refracts a canyon.
    const envScene = new T.Scene();
    envScene.add(new T.Mesh(new T.SphereGeometry(50, 48, 24), skyMat));
    const envSand = new T.MeshBasicMaterial({ color: 0xffffff });
    const envFloor = new T.Mesh(new T.CircleGeometry(49, 48), envSand);
    envFloor.rotation.x = -Math.PI / 2;
    envFloor.position.y = -1.9;
    envScene.add(envFloor);
    const envSlabs = [];
    const slabGeo = new T.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 44; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -44 + (i >> 1) * 4.2 + hash(i * 1.3) * 2;
      const h = 6 + hash(i * 2.7) * 16;
      const r = hash(i * 4.9);
      const ink = r < 0.55 ? AQUA : r < 0.8 ? AMBER : CLEAR;
      const m = new T.MeshBasicMaterial({ color: 0xffffff });
      const slab = new T.Mesh(slabGeo, m);
      slab.scale.set(0.6, h, 2 + hash(i * 3.1) * 3);
      slab.position.set(side * (4.5 + hash(i * 6.1) * 8), h / 2 - 1.9, z);
      slab.rotation.y = side * (0.3 + hash(i * 7.3) * 0.6);
      envScene.add(slab);
      envSlabs.push({ m, ink, k: 0.8 + 0.35 * hash(i * 8.7) });
    }
    const envRock = new T.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 9; i++) {
      const a = -1.3 + i * 0.33;
      const g = new T.Mesh(new T.CylinderGeometry(5, 7, 5 + hash(i * 3.3) * 6, 7), envRock);
      g.position.set(Math.sin(a) * 45, 0, -Math.cos(a) * 45);
      envScene.add(g);
    }
    const pmrem = new T.PMREMGenerator(kit.renderer);

    const sun = new T.DirectionalLight(0xffffff, 6);
    scene.add(sun, sun.target);

    // Sand: a large static plane; its pattern scrolls in the shader.
    const finA = [], finB = [], finC = [];
    for (let i = 0; i < NF; i++) { finA.push(new T.Vector4()); finB.push(new T.Vector4()); finC.push(new T.Vector4()); }
    const sandU = {
      finA: { value: finA }, finB: { value: finB }, finC: { value: finC },
      uSunDir: { value: new T.Vector3(0, 1, 0) },
      uScroll: { value: 0 }, uCausT: { value: 0 }, uCaus: { value: 1 }, uSparkle: { value: 0 }, uSparkT: { value: 0 },
    };
    const sand = new T.Mesh(new T.PlaneGeometry(900, 900), sandMaterial(T, sandU));
    sand.rotation.x = -Math.PI / 2;
    scene.add(sand);

    // Mesas in the haze: far enough that they need not scroll. Tapered,
    // with a talus skirt and a jittered rim, so they do not read as boxes
    // (the first ones, plain cylinders, looked like buildings).
    const mesaMat = new T.MeshStandardMaterial({ color: 0x8a4c34, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 11; i++) {
      const a = -1.35 + i * 0.27 + (hash(i * 3.3) - 0.5) * 0.2;
      const r = 280 + hash(i * 5.1) * 90;
      const h = 18 + hash(i * 7.7) * 28;
      const w = 30 + hash(i * 2.9) * 45;
      const g = new T.CylinderGeometry(w * 0.55, w, h, 11, 4);
      const gp = g.attributes.position;
      for (let v = 0; v < gp.count; v++) {
        const y = gp.getY(v) / h + 0.5;          // 0 at the foot, 1 at the rim
        const ang = Math.atan2(gp.getZ(v), gp.getX(v));
        const skirt = 1 + 0.5 * Math.pow(1 - y, 3);
        const jit = 1 + 0.12 * (hash(i * 31 + Math.round(ang * 3) * 7.1) - 0.5);
        gp.setX(v, gp.getX(v) * skirt * jit);
        gp.setZ(v, gp.getZ(v) * skirt * jit);
      }
      g.computeVertexNormals();
      g.translate(0, h / 2 - 1, 0);
      const m = new T.Mesh(g, mesaMat);
      m.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r);
      m.rotation.y = hash(i * 1.9) * 6;
      m.scale.set(1, 1, 0.6 + hash(i * 4.4) * 0.8);
      scene.add(m);
    }

    // Fins, two tiers.
    const base = finGeometry(T);
    const nearMat = new T.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.035, metalness: 0, transmission: 1, thickness: 1.2, ior: 1.5,
      dispersion: 0.35, specularIntensity: 1, envMapIntensity: 1,
    });
    nearMat.onBeforeCompile = patchRing;
    const farMat = fakeGlassMaterial(T);
    const mkInst = (mat, count) => {
      const g = base.clone();
      const ring = new T.InstancedBufferAttribute(new Float32Array(count * 2), 2);
      ring.setUsage(T.DynamicDrawUsage);
      g.setAttribute('aRing', ring);
      const m = new T.InstancedMesh(g, mat, count);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      m.instanceColor.setUsage(T.DynamicDrawUsage);
      m.frustumCulled = false;
      hall.add(m);
      return m;
    };
    const nearFins = mkInst(nearMat, NEAR * 4);
    const farFins = mkInst(farMat, SLOTS * 4 - NEAR * 4);

    // Blown sand in the air: the foreground layer. Placed by hash so it never
    // shifts with three's own use of Math.random.
    const GRAINS = 700;
    const gPos = new Float32Array(GRAINS * 3);
    for (let i = 0; i < GRAINS; i++) {
      gPos[i * 3] = (hash(i * 3.17 + 0.5) * 2 - 1) * 7;
      gPos[i * 3 + 1] = 0.05 + Math.pow(hash(i * 5.31 + 1.7), 2.2) * 3.5;
      gPos[i * 3 + 2] = -hash(i * 7.73 + 2.9) * 34 + 3;
    }
    const gGeo = new T.BufferGeometry();
    gGeo.setAttribute('position', new T.BufferAttribute(gPos, 3));
    const grainMat = new T.PointsMaterial({ color: new T.Color(2.4, 2.0, 1.5), size: 0.03, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: true });
    // A grain by the lens would otherwise grow into a flat square.
    const grainMax = { value: 4 };
    grainMat.onBeforeCompile = (sh) => {
      sh.uniforms.grainMax = grainMax;
      sh.vertexShader = 'uniform float grainMax;\n' + sh.vertexShader.replace(
        '#include <fog_vertex>', '#include <fog_vertex>\n  gl_PointSize = min(gl_PointSize, grainMax);');
    };
    const grains = new T.Points(gGeo, grainMat);
    grains.frustumCulled = false;
    scene.add(grains);

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 10, dofSamples: 32 });
    // AgX greys out saturated daylight (a deep blue sky came out lavender in
    // the first pass); a little saturation and contrast in HDR, before the
    // tone map, gives the colour back without clipping.
    lens.insertPass(kit.shaderPass([
      'uniform sampler2D tDiffuse;',
      'uniform float sat, contrast;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
      '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
      '  c = max(mix(vec3(l), c, sat), 0.0);',
      '  c = pow(c / 0.18, vec3(contrast)) * 0.18;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'), { tDiffuse: { value: null }, sat: { value: 1.35 }, contrast: { value: 1.12 } }));
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.94, 0.98, 1.06);
    lens.grade.lift.value.set(0.002, 0.0025, 0.004);
    lens.grade.vignette.value = 0.35;
    lens.grade.grain.value = 0.035;
    lens.grade.aberration.value = 0.0018;
    lens.maxVelocity = 0.045;
    lens.farBlur = 0.4;
    lens.bloom.threshold = 4.0;

    return {
      T, scene, camera, hall, sky, skyU, envScene, envSand, envSlabs, envRock, pmrem, envRT: null, bakedSun: -1, sun, sand, sandU,
      nearFins, farFins, grains, grainMat, grainMax, lens,
      M: new T.Matrix4(), Q: new T.Quaternion(), S: new T.Vector3(), V: new T.Vector3(), Y: new T.Vector3(0, 1, 0),
      col: new T.Color(), col2: new T.Color(),
    };
  }

  // Sun, sky and haze for a sun setting 0 (high, white) .. 1 (low, golden).
  function skyState(R, k) {
    const el = lerp(52, 15, k) * Math.PI / 180;
    const az = lerp(58, 28, k) * Math.PI / 180;   // right of straight ahead
    const s = R.skyU;
    s.uSun.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const mix3 = (v, a, b) => v.set(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k));
    mix3(s.uSunCol.value, [1.0, 0.95, 0.88], [1.0, 0.56, 0.24]);
    mix3(s.uZenith.value, [0.025, 0.1, 0.42], [0.15, 0.16, 0.32]);
    mix3(s.uHorizon.value, [0.42, 0.56, 0.75], [1.1, 0.56, 0.24]);
    mix3(s.uGround.value, [0.5, 0.44, 0.34], [0.42, 0.26, 0.15]);
  }

  // Rebake the image-based light from the sky (cheap at 256 px), so glass
  // reflections follow the sun down to the golden hour.
  function bake(R, k) {
    skyState(R, k);
    // Stand-in colours follow the sun: sand as the real sand is lit, slabs
    // as tinted glass against the horizon, rock in shade.
    const s = R.skyU, sc = s.uSunCol.value, hz = s.uHorizon.value, su = s.uSun.value;
    const lit = Math.max(0, su.y) * 7 / Math.PI + 0.25;
    R.envSand.color.setRGB(0.66 * (sc.x * lit), 0.55 * (sc.y * lit), 0.4 * (sc.z * lit));
    // Mostly the horizon they stand against, a little of their own colour.
    for (const e of R.envSlabs) {
      const c = (j) => lerp(1, e.ink[j], 0.45) * [hz.x, hz.y, hz.z][j] * e.k * 1.2;
      e.m.color.setRGB(c(0), c(1), c(2));
    }
    R.envRock.color.setRGB(0.28 * sc.x * lit * 0.5, 0.14 * sc.y * lit * 0.5, 0.09 * sc.z * lit * 0.5);
    const rt = R.pmrem.fromScene(R.envScene, 0, 0.1, 100);
    if (R.envRT) R.envRT.dispose();
    R.envRT = rt;
    R.scene.environment = rt.texture;
    R.bakedSun = k;
  }

  // ------------------------------------------------------------ scene
  VIZ.register({
    id: 'glasscanyon',
    name: 'Glass Canyon',
    order: 1003,
    requires: 'three',
    params: [
      { key: 'speed', label: 'Flight speed', type: 'range', min: 0, max: 3, default: 0.8, step: 0.01 },
      { key: 'weave', label: 'Bank and weave', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'sun', label: 'Sun: noon to golden hour', type: 'range', min: 0, max: 1, default: 0.25, step: 0.01 },
      { key: 'tint', label: 'Glass: clear to coloured', type: 'range', min: 0, max: 1, default: 0.45, step: 0.01 },
      { key: 'caustics', label: 'Caustic light', type: 'range', min: 0, max: 1, default: 0.65, step: 0.01 },
      { key: 'glitter', label: 'Blown sand', type: 'range', min: 0, max: 1, default: 0.15, step: 0.01 },
      { key: 'focus', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,
    // The kit's lens chain is this scene's finish.
    finish: false,

    gallery: {
      title: 'Glass Canyon',
      technique: 'three.js 0.186.1 on the shared kit: fins of lens-section extruded glass in two InstancedMesh tiers, the nearest true MeshPhysicalMaterial transmission (IOR 1.5, dispersion, tint from the instance colour) and the rest an opaque "fake glass" that looks through itself into a PMREM of the sky and a stand-in canyon along a refracted ray, so the real glass refracts the far glass; vertex shaders patched to ring a fin (a bending mode plus a ripple, normals tilted to match, a band of emission running up it); an analytic HDR sky rebaked to a PMREM as the sun moves; sand whose shader follows each point\'s ray to the sun through the fins and gathers the light into dispersed caustic filaments in each fin\'s own frame, with wind ripples and mica glints; mesas in exponential haze; hashed blown-sand points; the kit lens: MSAA HDR, camera motion blur with the world\'s travel folded in, depth of field, a saturation and contrast pass in HDR to undo AgX\'s greying of daylight, bloom above 4 on the sun and its glints only, split grade, AgX.',
      brief: 'A low daylight flight down a canyon of tall glass fins standing in pale sand, backlit by a sun ahead: sea-glass aqua, amber and clear shards bend the sky, the sand and each other, and throw tinted shadows full of moving caustic filaments across the floor; mesas stand far off in the haze. The kick rings one fin near the camera like a bell: a band of light runs up it, its refraction shivers and its caustic dances; claps swing the near fins a few degrees and every refraction slides; hats glint the mica in the sand; bass speeds the flight and the caustics. On the drop the sun comes down to a golden hour into the frame, the glass deepens, blown sand glitters in the air and the kick rings fins in pairs.',
      lineage: 'Batch 07, Rendered (2026-09-29), entry 3. After glass architecture in desert light (the glass fins of museum atria, sea glass, the caustics under a water glass on a table) and the canyon flights of architectural visualisation; built on the kit and reference scene of the three.js spike.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
      // Bake before the first compile, so the programs are built with an
      // environment map and the first live frame does not recompile.
      bake(this.R, 0.25);
    },

    enter(p, ctx) {
      this.lastMs = null;
      this.t = 0;
      this.dist = 0;
      this.prevDist = null;
      this.causT = 0;
      this.focus = null;
      this.env = { prevK: 0, b4: 0, prevS: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9 };
      this.rings = [];         // { key, age, amp }: fins ringing, by identity
      this.kickN = 0;
      this.swing = 0; this.swingPos = 0;
      this.glints = 0;
      this.smSpeed = 0.8;
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    leave() {},

    listen(s, dt, push, chord) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        if (push > 0.02) this.strike((0.6 + 0.4 * kRaw) * Math.min(1.6, push), chord);
      }
      e.prevK = kRaw;

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        if (push > 0.05) this.swing = this.swing > 0 ? -1 : 1;
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        this.glints = Math.min(1.5, this.glints + 0.9 * hRaw * push);
      }
      e.prevH = hRaw;
      this.glints *= Math.exp(-dt / 0.12);

      e.bass = ease(e.bass, clamp01((s[1] + s[2]) / 170), 2.5, dt);
      e.low = ease(e.low, s[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
    },

    // Ring a present inner fin in the first few slots ahead, alternating
    // sides; on the drop, both sides at once.
    strike(amp, chord) {
      const k = Math.floor(this.dist / P);
      this.kickN++;
      const sides = chord ? [0, 1] : [this.kickN % 2];
      for (const side of sides) {
        for (let s = BEHIND + 1; s < BEHIND + 5; s++) {
          const seg = k + s - BEHIND;
          const f = this.fin(seg, side);
          if (!f) continue;
          if ((s + this.kickN) % 3 === 0 && s < BEHIND + 4) continue;   // vary which slot rings
          const key = seg * 4 + side;
          this.rings = this.rings.filter((r) => r.key !== key);
          this.rings.push({ key, age: 0, amp });
          break;
        }
      }
      if (this.rings.length > 8) this.rings.splice(0, this.rings.length - 8);
    },

    // One fin's shape from its identity (seg, row), or null for a gap.
    // row: 0 inner left, 1 inner right, 2 outer left, 3 outer right.
    fin(seg, row) {
      const h = (n) => hash(seg * 13.37 + row * 3.71 + n * 0.917);
      const inner = row < 2;
      if (h(1) > (inner ? 0.72 : 0.62)) return null;
      const side = row % 2 ? 1 : -1;
      const half = inner ? 0.9 + h(3) * 1.0 : 1.4 + h(3) * 1.6;
      const x = side * (inner ? 3.3 + half * 0.8 + h(2) * 1.6 : 9 + h(2) * 5);
      const height = inner ? 6 + h(4) * 8 : 11 + h(4) * 12;
      // Face turned toward the flight, so the sky and sand bend through it.
      const theta = side * (0.35 + h(5) * 0.55) + (h(6) < 0.5 ? Math.PI : 0);
      const r = h(7);
      const ink = r < 0.55 ? AQUA : r < 0.8 ? AMBER : CLEAR;
      return { x, dz: (h(8) - 0.5) * P * 0.5, half, height, theta, ink, sign: h(9) < 0.5 ? 1 : -1 };
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three;
      const R = this.R;
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : Math.min(0.1, Math.max(0, (ms - this.lastMs) / 1000));
      this.lastMs = ms;
      const push = params.push;
      const e = this.env;
      const follow = Math.round(params.follow) === 1;
      this.listen(signals, dt, push, e.auto > 0.5);

      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 1.0 : 0.4, dt);
      const Pm = {};
      for (const key of DRIVE) Pm[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? e.auto : 0);

      this.t += dt;
      const target = Pm.speed * (0.55 + 0.9 * e.bass * push) * 6;
      this.smSpeed = ease(this.smSpeed, target, 1.5, dt);
      this.dist += this.smSpeed * dt;
      this.causT += dt * (0.35 + 0.9 * e.bass * push);
      for (const r of this.rings) r.age += dt;
      this.rings = this.rings.filter((r) => r.age < 2.5);
      this.swingPos = ease(this.swingPos, this.swing, 4, dt);

      // ------------------------------------------------ sun, sky, environment
      skyState(R, Pm.sun);
      const sunV = R.skyU.uSun.value;
      if (Math.abs(Pm.sun - R.bakedSun) > 0.015) bake(R, Pm.sun);
      const sc = R.skyU.uSunCol.value;
      R.sun.color.setRGB(sc.x, sc.y, sc.z);
      R.sun.intensity = lerp(7.5, 6.5, Pm.sun);
      R.sun.position.copy(sunV).multiplyScalar(100);
      R.scene.fog.color.setRGB(R.skyU.uHorizon.value.x * 0.92, R.skyU.uHorizon.value.y * 0.92, R.skyU.uHorizon.value.z * 0.92);
      R.scene.environmentIntensity = lerp(1.0, 0.8, Pm.sun);

      // ------------------------------------------------------------- fins
      const k = Math.floor(this.dist / P);
      const shift = this.dist - k * P;
      R.hall.position.z = shift;
      const ringOf = new Map();
      for (const r of this.rings) ringOf.set(r.key, [r.amp * Math.exp(-r.age * 2.0), r.age]);
      const M = R.M, Q = R.Q, S = R.S, V = R.V, col = R.col;
      const nearRing = R.nearFins.geometry.attributes.aRing, farRing = R.farFins.geometry.attributes.aRing;
      const tintK = 0.12 + 0.88 * Pm.tint;
      const U = R.sandU;
      let ni = 0, fi = 0;
      for (let s = 0; s < SLOTS; s++) {
        const seg = k + s - BEHIND;
        const zc = -(s - BEHIND) * P;
        for (let row = 0; row < 4; row++) {
          const f = this.fin(seg, row);
          const near = s < NEAR;
          const mesh = near ? R.nearFins : R.farFins;
          const idx = near ? ni++ : fi++;
          const ci = s < CAUSTIC_SLOTS ? s * 4 + row : -1;
          if (!f) {
            M.makeScale(0, 0, 0);
            mesh.setMatrixAt(idx, M);
            if (ci >= 0) U.finB.value[ci].set(0, 0, 0, 0);
            continue;
          }
          // Claps swing the near fins, alternate ones the other way.
          const swingW = clamp01(1 - (s - BEHIND) / 6) * (row < 2 ? 1 : 0.5);
          const theta = f.theta + this.swingPos * 0.2 * f.sign * swingW;
          const z = zc + f.dz;
          Q.setFromAxisAngle(R.Y, theta);
          M.compose(V.set(f.x, -0.25, z), Q, S.set(f.half * 2, f.height, f.half * 2));
          mesh.setMatrixAt(idx, M);
          const c0 = f.ink;
          col.setRGB(lerp(CLEAR[0], c0[0], tintK), lerp(CLEAR[1], c0[1], tintK), lerp(CLEAR[2], c0[2], tintK));
          // Real glass passes the diffuse colour once; square it so the near
          // fins carry as much colour as the far ones' absorption gives.
          if (near) mesh.setColorAt(idx, R.col2.setRGB(col.r * col.r, col.g * col.g, col.b * col.b));
          else {
            // The far fins look through themselves only into the stand-in
            // canyon, so they carry less colour or they read as painted.
            const w = 0.85;
            mesh.setColorAt(idx, R.col2.setRGB(lerp(1, col.r, w), lerp(1, col.g, w), lerp(1, col.b, w)));
          }
          const rg = ringOf.get(seg * 4 + row);
          const rA = rg ? rg[0] : 0, rT = rg ? rg[1] : 0;
          (near ? nearRing : farRing).setXY(idx, rA, rT);
          if (ci >= 0) {
            U.finA.value[ci].set(f.x, z + shift, Math.sin(theta), Math.cos(theta));
            U.finB.value[ci].set(f.half, f.height - 0.25, rA, rT);
            U.finC.value[ci].set(col.r, col.g, col.b, SLANT);
          }
        }
      }
      for (const m of [R.nearFins, R.farFins]) {
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
        m.geometry.attributes.aRing.needsUpdate = true;
      }
      U.uSunDir.value.copy(sunV);
      U.uScroll.value = this.dist % 16384;
      U.uCausT.value = this.causT;
      U.uCaus.value = 0.25 + 0.75 * Pm.caustics * (0.85 + 0.3 * e.bass * push);
      U.uSparkle.value = clamp01(0.15 + 1.2 * this.glints);
      U.uSparkT.value = this.t;

      // Blown sand drifts across and toward the camera, and wraps.
      const gp = R.grains.geometry.attributes.position.array;
      const adv = this.smSpeed * dt * 0.4, wind = dt * (0.8 + 2.5 * Pm.glitter);
      for (let i = 0; i < gp.length; i += 3) {
        gp[i] -= wind * (0.6 + 0.4 * hash(i));
        if (gp[i] < -7) gp[i] += 14;
        gp[i + 2] += adv;
        if (gp[i + 2] > 3) gp[i + 2] -= 37;
      }
      R.grains.geometry.attributes.position.needsUpdate = true;
      R.grainMat.opacity = clamp01(Pm.glitter * 0.9 + 0.6 * this.glints * Pm.glitter);
      R.grainMat.size = 0.025 + 0.02 * this.glints;
      R.grainMax.value = (2.5 + 2.5 * this.glints) * kit.height / 720;

      // ----------------------------------------------------------- camera
      const t = this.t, wv = Pm.weave;
      const cam = R.camera;
      const x = wv * (1.2 * Math.sin(t * 0.19) + 0.4 * Math.sin(t * 0.43 + 1.3));
      const vx = wv * (1.2 * 0.19 * Math.cos(t * 0.19) + 0.4 * 0.43 * Math.cos(t * 0.43 + 1.3));
      const y = 1.9 + 0.55 * Math.sin(t * 0.11 + 0.4) + 0.3 * wv * Math.sin(t * 0.31);
      cam.position.set(x, y, 0);
      const yaw = -0.3 * vx + 0.07 * Math.sin(t * 0.07) - 0.05;
      const pitch = 0.1 + 0.05 * Math.sin(t * 0.15) + 0.04 * Pm.sun;
      const roll = -wv * (0.16 * Math.sin(t * 0.19 + 0.6) + 0.5 * vx);
      cam.rotation.set(pitch, yaw, roll, 'YXZ');
      cam.updateMatrixWorld();
      R.sky.position.copy(cam.position);

      // Focus: the nearest inner fin ahead, else 12 m.
      let focus = 12;
      for (let s = BEHIND; s < BEHIND + 4; s++) {
        const seg = k + s - BEHIND;
        let best = Infinity;
        for (let row = 0; row < 2; row++) {
          const f = this.fin(seg, row);
          if (!f) continue;
          const z = (s - BEHIND) * P - shift - f.dz;
          if (z > 3) best = Math.min(best, Math.hypot(z, f.x - x));
        }
        if (best < Infinity) { focus = best; break; }
      }
      this.focus = this.focus == null ? focus : ease(this.focus, focus, 1.5, dt);

      // ----------------------------------------------------------- render
      const L = R.lens;
      const moved = this.prevDist == null ? 0 : this.dist - this.prevDist;
      this.prevDist = this.dist;
      L.shutter = 0.9;
      L.focus = this.focus;
      L.blur = Pm.focus > 0.02 ? 0.008 * (0.3 + Pm.focus) : 0;
      L.bloom.strength = 0.1 + 0.14 * Pm.sun;
      L.bloom.radius = 0.35;
      L.exposure = lerp(1.0, 1.15, Pm.sun);
      L.grade.highlightTint.value.set(lerp(1.0, 1.08, Pm.sun), 1.0, lerp(0.98, 0.86, Pm.sun));
      // The shared renderer: transmission at half size is plenty behind
      // rough-free glass after the lens blur; put it back for other scenes.
      const r = kit.renderer;
      r.transmissionResolutionScale = 0.5;
      L.render(R.scene, cam, { worldMove: [0, 0, moved] });
      r.transmissionResolutionScale = 1;
      kit.composite();
    },
  });
})();
