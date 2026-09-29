// three.js kit: what every three.js scene in viz shares. See CONTRACT.md,
// "three.js scenes"; web/scenes/rendered.js is the reference scene and
// web/scenes/_three-skeleton.js the one to copy.
//
// Why a kit rather than each scene importing three itself: the Rendered spike
// (2026-09-28) found that the rendered look only holds 60 fps when the chain
// renders at about 1080p's pixel count and is scaled up (16 fps at native
// 3024x1890), that the first frame hitches ~130 ms compiling shaders unless
// they are compiled asynchronously first, and that its render targets hold
// ~300 MB of GPU memory at full size. Ten scenes each solving that alone would
// be ten copies of three, ten WebGL contexts and ten different answers.
//
// What it owns:
//   - one pinned three (0.186.1) and its addons, loaded with dynamic import()
//     from jsDelivr's +esm endpoint, never at page start-up
//   - one WebGLRenderer on its own canvas, shared by every three.js scene;
//     each frame is composited into the p5 canvas (a drawImage the spike
//     measured as free), so the Finish, the rack and the harness see it
//   - the render-scale policy (a pixel budget, and a global override)
//   - a standard lens chain: HDR, motion blur, depth of field, bloom above a
//     threshold, grade, AgX tone mapping
//   - procedural environment maps, resize handling, async shader compiles,
//     and freeing render targets when a scene leaves the stage
//
// Core (web/core.js) and the harness (harness/stage.js) drive the lifecycle
// through prepare / frame / enter / leave; a scene only sees `ctx.three`.
(function () {
  'use strict';

  var VERSION = '0.186.1';
  var BASE = 'https://cdn.jsdelivr.net/npm/three@' + VERSION;
  // jsDelivr rewrites every addon's bare `import 'three'` to exactly this URL
  // (checked for all the addons below, 2026-09-29), so the page holds one copy
  // of three however many addons load. An addon from another package would
  // bring its own copy and its objects would fail three's instanceof checks.
  var CORE_URL = BASE + '/+esm';
  var addonUrl = function (path) { return BASE + '/examples/jsm/' + path + '/+esm'; };

  // Addons by export name. Anything else under examples/jsm can be asked for
  // by path ('postprocessing/HalftonePass.js'); it is then keyed by that path
  // and its value is the whole module.
  var ADDONS = {
    EffectComposer: 'postprocessing/EffectComposer.js',
    RenderPass: 'postprocessing/RenderPass.js',
    ShaderPass: 'postprocessing/ShaderPass.js',
    UnrealBloomPass: 'postprocessing/UnrealBloomPass.js',
    OutputPass: 'postprocessing/OutputPass.js',
    BokehPass: 'postprocessing/BokehPass.js',
    AfterimagePass: 'postprocessing/AfterimagePass.js',
    SMAAPass: 'postprocessing/SMAAPass.js',
    FXAAPass: 'postprocessing/FXAAPass.js',
    GTAOPass: 'postprocessing/GTAOPass.js',
    SAOPass: 'postprocessing/SAOPass.js',
    HalftonePass: 'postprocessing/HalftonePass.js',
    FilmPass: 'postprocessing/FilmPass.js',
    TexturePass: 'postprocessing/TexturePass.js',
    RoomEnvironment: 'environments/RoomEnvironment.js',
    RectAreaLightUniformsLib: 'lights/RectAreaLightUniformsLib.js',
    RectAreaLightHelper: 'helpers/RectAreaLightHelper.js',
    Reflector: 'objects/Reflector.js',
    Sky: 'objects/Sky.js',
    Water: 'objects/Water.js',
    MarchingCubes: 'objects/MarchingCubes.js',
    Lensflare: 'objects/Lensflare.js',
    RoundedBoxGeometry: 'geometries/RoundedBoxGeometry.js',
    ParametricGeometry: 'geometries/ParametricGeometry.js',
    TextGeometry: 'geometries/TextGeometry.js',
    ConvexGeometry: 'geometries/ConvexGeometry.js',
    FontLoader: 'loaders/FontLoader.js',
    GLTFLoader: 'loaders/GLTFLoader.js',
    HDRLoader: 'loaders/HDRLoader.js',
    SimplexNoise: 'math/SimplexNoise.js',
    ImprovedNoise: 'math/ImprovedNoise.js',
    MeshSurfaceSampler: 'math/MeshSurfaceSampler.js',
    BufferGeometryUtils: 'utils/BufferGeometryUtils.js',   // the whole module
    Line2: 'lines/Line2.js',
    LineMaterial: 'lines/LineMaterial.js',
    LineGeometry: 'lines/LineGeometry.js',
    LineSegments2: 'lines/LineSegments2.js',
    LineSegmentsGeometry: 'lines/LineSegmentsGeometry.js',
    GPUComputationRenderer: 'misc/GPUComputationRenderer.js'
  };
  // What the lens chain and environment helpers need; always loaded.
  var BASE_ADDONS = ['EffectComposer', 'ShaderPass', 'UnrealBloomPass', 'OutputPass', 'RoomEnvironment'];

  // 1080p's pixel count. The spike's full chain held 60 fps at this budget on
  // the M4 Pro at 3024x1890 and 16 fps at native; after depth of field, motion
  // blur and grain the upscale does not show.
  var DEFAULT_PIXEL_BUDGET = 2.3e6;

  var THREE = null;
  var addons = {};
  var modules = {};      // url -> Promise of the module
  var loads = {};        // sorted name list -> Promise of { THREE, addons }
  var rectLightsReady = false;
  var renderer = null;
  var policy = { pixelBudget: DEFAULT_PIXEL_BUDGET, scale: null };
  var handles = {};      // def id -> Handle

  // ---------------------------------------------------------------- loading
  function importOnce(url) {
    if (!modules[url]) {
      // A failed import is forgotten, so the next scene switch can retry
      // (a flaky venue network must not need a page reload).
      modules[url] = import(url).catch(function (e) { delete modules[url]; throw e; });
    }
    return modules[url];
  }

  function load(names) {
    var list = BASE_ADDONS.concat(names || []).filter(function (n, i, a) { return a.indexOf(n) === i; });
    for (var i = 0; i < list.length; i++) {
      if (!ADDONS[list[i]] && list[i].indexOf('/') < 0) {
        return Promise.reject(new Error('three-kit: unknown addon "' + list[i] + '"; name one in ADDONS or pass its path under examples/jsm'));
      }
    }
    var key = list.slice().sort().join(',');
    if (loads[key]) return loads[key];
    var urls = [CORE_URL].concat(list.map(function (n) { return addonUrl(ADDONS[n] || n); }));
    var p = loads[key] = Promise.all(urls.map(importOnce)).then(function (mods) {
      THREE = mods[0];
      list.forEach(function (n, i) {
        var m = mods[i + 1];
        addons[n] = ADDONS[n] && m[n] ? m[n] : m;
      });
      if (addons.RectAreaLightUniformsLib && !rectLightsReady) {
        addons.RectAreaLightUniformsLib.init();
        rectLightsReady = true;
      }
      return { THREE: THREE, addons: addons };
    });
    p.catch(function () { delete loads[key]; });
    return p;
  }

  function addonsFor(def) {
    var t = def && def.three;
    return (t && Array.isArray(t.addons)) ? t.addons : [];
  }

  // Warm the download while the performer is on another scene. Never awaited
  // by anything at start-up.
  function prefetch(defs) {
    var names = [];
    (defs || []).forEach(function (d) { names = names.concat(addonsFor(d)); });
    load(names).catch(function () { /* reported when a scene actually asks */ });
  }

  // --------------------------------------------------------------- renderer
  function getRenderer() {
    if (renderer) return renderer;
    var canvas = document.createElement('canvas');
    canvas.className = 'three-kit-canvas';
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: false, alpha: false, stencil: false, depth: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(1);
    resetRenderer(renderer);
    return renderer;
  }

  // Every scene starts from the same renderer state, so one scene's shadow map
  // or exposure never leaks into the next.
  function resetRenderer(r) {
    r.setRenderTarget(null);
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = false;
    r.autoClear = true;
    r.setClearColor(0x000000, 1);
  }

  function renderSize(dw, dh, budget) {
    var s = policy.scale != null ? policy.scale : Math.min(1, Math.sqrt((budget || policy.pixelBudget) / Math.max(1, dw * dh)));
    return { w: Math.max(2, Math.round(dw * s)), h: Math.max(2, Math.round(dh * s)), scale: s };
  }

  // ------------------------------------------------------------ lens shaders
  var FS_VERT = [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  ].join('\n');

  // Camera motion blur by reprojecting depth against last frame's view-
  // projection, plus signed circle of confusion (px) into alpha for the DOF.
  var LENS_FRAG = [
    'uniform sampler2D tColor;',
    'uniform sampler2D tDepth;',
    'uniform mat4 invViewProj;',
    'uniform mat4 prevViewProj;',
    'uniform vec2 resolution;',
    'uniform float cameraNear, cameraFar, shutter, maxVel, focusDist, cocScale, maxCoc, farScale;',
    'varying vec2 vUv;',
    'float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }',
    'void main() {',
    '  float d = texture2D(tDepth, vUv).x;',
    '  vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);',
    '  vec4 world = invViewProj * clip; world /= world.w;',
    '  vec4 prev = prevViewProj * world;',
    '  vec2 prevUv = prev.xy / prev.w * 0.5 + 0.5;',
    '  vec2 vel = (vUv - prevUv) * shutter;',
    '  float vl = length(vel * resolution);',
    '  float vmax = maxVel * resolution.y;',
    '  if (vl > vmax) vel *= vmax / vl;',
    '  vec3 col = vec3(0.0);',
    '  const int N = MB_N;',
    '  float j = ign(gl_FragCoord.xy);',
    '  for (int i = 0; i < N; i++) {',
    '    float t = N == 1 ? 0.0 : (float(i) + j) / float(N) - 0.5;',
    '    col += texture2D(tColor, vUv + vel * t).rgb;',
    '  }',
    '  col /= float(N);',
    '  float z = (cameraNear * cameraFar) / (cameraFar - d * (cameraFar - cameraNear));',
    '  float coc = cocScale * (1.0 - focusDist / z);',
    // Background blurs less than foreground, as a long lens focused near does.
    '  coc = clamp(coc > 0.0 ? coc * farScale : coc, -maxCoc, maxCoc);',
    '  gl_FragColor = vec4(col, coc);',
    '}'
  ].join('\n');

  var DOF_FRAG = [
    'uniform sampler2D tDiffuse;',
    'uniform vec2 resolution;',
    'uniform float maxCoc;',
    'varying vec2 vUv;',
    'float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }',
    'void main() {',
    '  vec4 c0 = texture2D(tDiffuse, vUv);',
    '  float r0 = abs(c0.a);',
    '  vec3 acc = c0.rgb; float wsum = 1.0;',
    '  const int N = DOF_N;',
    '  float rot = ign(gl_FragCoord.xy) * 6.2831853;',
    '  for (int i = 0; i < N; i++) {',
    '    float t = (float(i) + 0.5) / float(N);',
    '    float rr = sqrt(t) * maxCoc;',
    '    float a = float(i) * 2.39996323 + rot;',
    '    vec4 s = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr / resolution);',
    '    float sr = abs(s.a);',
    // A sample farther than this pixel may not spread over it by more than
    // this pixel's own blur: a sharp foreground keeps its edge.
    '    if (s.a > c0.a) sr = min(sr, r0);',
    '    float w = clamp(sr - rr + 1.0, 0.0, 1.0);',
    '    acc += s.rgb * w; wsum += w;',
    '  }',
    '  gl_FragColor = vec4(acc / wsum, 1.0);',
    '}'
  ].join('\n');

  // Split tone, edge aberration, vignette and grain, in linear light before
  // the tone map.
  var GRADE_FRAG = [
    'uniform sampler2D tDiffuse;',
    'uniform vec2 resolution;',
    'uniform vec3 shadowTint, highlightTint, lift;',
    'uniform float split, vignette, grain, aberration, seed;',
    'varying vec2 vUv;',
    'float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'void main() {',
    '  vec2 dc = vUv - 0.5;',
    '  vec2 off = dc * aberration;',
    '  vec3 c;',
    '  c.r = texture2D(tDiffuse, vUv - off).r;',
    '  c.g = texture2D(tDiffuse, vUv).g;',
    '  c.b = texture2D(tDiffuse, vUv + off).b;',
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  float tone = smoothstep(0.0, 1.0, l / (l + 0.35));',
    '  vec3 tint = mix(mix(vec3(1.0), shadowTint, split), mix(vec3(1.0), highlightTint, split), tone);',
    '  c *= tint;',
    '  c += lift * split;',
    '  float asp = resolution.x / resolution.y;',
    '  float v = length(dc * vec2(asp, 1.0));',
    '  c *= mix(1.0, smoothstep(1.25, 0.25, v), vignette);',
    '  float n = h12(gl_FragCoord.xy + seed * 917.0) - 0.5;',
    '  c *= 1.0 + n * grain;',
    '  gl_FragColor = vec4(max(c, 0.0), 1.0);',
    '}'
  ].join('\n');

  // textureId 'none' makes a pass that reads its own inputs, not the
  // previous pass's output.
  function fullscreen(frag, uniforms, defines, textureId) {
    return new addons.ShaderPass(new THREE.ShaderMaterial({
      uniforms: uniforms, defines: defines || {}, vertexShader: FS_VERT, fragmentShader: frag,
      depthTest: false, depthWrite: false
    }), textureId);
  }

  // Every Material reachable from a pass's own fields, for compileAsync.
  function passMaterials(pass) {
    var out = [];
    Object.keys(pass).forEach(function (k) {
      var v = pass[k];
      if (v && v.isMaterial) out.push(v);
      else if (Array.isArray(v)) v.forEach(function (x) { if (x && x.isMaterial) out.push(x); });
    });
    return out;
  }

  // --------------------------------------------------------------- the lens
  // The standard chain, in the spike's order:
  //   scene -> MSAA half-float target with a depth texture
  //   lens:  camera motion blur (reprojection) + circle of confusion
  //   dof:   scatter-as-gather disc blur
  //   bloom: UnrealBloomPass, threshold above 1 so only HDR emitters bloom
  //   grade: split tone, aberration, vignette, grain
  //   output: AgX tone mapping and sRGB, to the kit's canvas
  function Lens(handle, opts) {
    opts = opts || {};
    var T = THREE, r = handle.renderer;
    var w = handle.width, h = handle.height;
    this.handle = handle;
    this.opts = opts;
    var mbN = opts.motionBlur === false ? 1 : Math.max(1, (opts.motionBlurSamples || 12) | 0);
    var dofN = Math.max(1, (opts.dofSamples || 36) | 0);

    this.sceneTarget = new T.WebGLRenderTarget(w, h, {
      type: T.HalfFloatType, samples: opts.msaa == null ? 4 : opts.msaa, depthBuffer: true
    });
    this.sceneTarget.depthTexture = new T.DepthTexture(w, h);
    this.sceneTarget.depthTexture.type = T.FloatType;

    var composer = this.composer = new addons.EffectComposer(r, new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, depthBuffer: false }));
    composer.setPixelRatio(1);
    composer.setSize(w, h);

    this.lensPass = fullscreen(LENS_FRAG, {
      tColor: { value: this.sceneTarget.texture }, tDepth: { value: this.sceneTarget.depthTexture },
      invViewProj: { value: new T.Matrix4() }, prevViewProj: { value: new T.Matrix4() },
      resolution: { value: new T.Vector2(w, h) },
      cameraNear: { value: 0.1 }, cameraFar: { value: 100 },
      shutter: { value: 0 }, maxVel: { value: 0.05 },
      focusDist: { value: 6 }, cocScale: { value: 0 }, maxCoc: { value: 0 }, farScale: { value: 0.45 }
    }, { MB_N: mbN }, 'none');
    this.dofPass = fullscreen(DOF_FRAG, {
      tDiffuse: { value: null }, resolution: { value: new T.Vector2(w, h) }, maxCoc: { value: 0 }
    }, { DOF_N: dofN });
    this.bloom = new addons.UnrealBloomPass(new T.Vector2(w, h), 0.3, 0.35, 1.5);
    this.gradePass = fullscreen(GRADE_FRAG, {
      tDiffuse: { value: null }, resolution: { value: new T.Vector2(w, h) },
      shadowTint: { value: new T.Vector3(1, 1, 1) }, highlightTint: { value: new T.Vector3(1, 1, 1) },
      lift: { value: new T.Vector3(0, 0, 0) },
      split: { value: 0 }, vignette: { value: 0.45 }, grain: { value: 0.05 }, aberration: { value: 0.002 }, seed: { value: 0 }
    });
    this.outputPass = new addons.OutputPass();
    composer.addPass(this.lensPass);
    composer.addPass(this.dofPass);
    composer.addPass(this.bloom);
    composer.addPass(this.gradePass);
    composer.addPass(this.outputPass);
    this.dofPass.enabled = opts.dof !== false;
    this.bloom.enabled = opts.bloom !== false;
    this.gradePass.enabled = opts.grade !== false;

    // Per-frame settings a scene changes directly (all in plain units).
    this.focus = 6;          // metres from the camera to the sharp plane
    this.blur = opts.dof === false ? 0 : 0.01;   // largest blur radius, as a fraction of the short side (0 = sharp)
    this.farBlur = 0.45;     // background blur relative to foreground at the same defocus
    this.shutter = opts.motionBlur === false ? 0 : 0.5;   // fraction of a frame the shutter is open (may exceed 1)
    this.maxVelocity = 0.05; // longest streak, as a fraction of the frame height
    this.exposure = 1;
    this.grade = this.gradePass.uniforms;   // .split, .shadowTint, .highlightTint, .lift, .vignette, .grain, .aberration

    this._prevVP = null;
    this._vp = new T.Matrix4();
    this._m = new T.Matrix4();
    this.w = w; this.h = h;
    handle._lenses.push(this);
  }

  Lens.prototype.setSize = function (w, h) {
    this.w = w; this.h = h;
    this.sceneTarget.setSize(w, h);
    this.composer.setSize(w, h);
    this.lensPass.uniforms.resolution.value.set(w, h);
    this.dofPass.uniforms.resolution.value.set(w, h);
    this.gradePass.uniforms.resolution.value.set(w, h);
    this._prevVP = null;
  };

  // Insert a pass of the scene's own (a ShaderPass, say) before the grade, so
  // it still works in HDR and is still tone mapped.
  Lens.prototype.insertPass = function (pass) {
    this.composer.insertPass(pass, this.composer.passes.indexOf(this.gradePass));
    if (pass.setSize) pass.setSize(this.w, this.h);
    return pass;
  };

  // Forget last frame's camera, so the next frame has no motion blur. Call on
  // a cut (a camera jump would otherwise smear the whole frame).
  Lens.prototype.cut = function () { this._prevVP = null; };

  // Render `scene` through the chain into the kit's canvas.
  //   opts.worldMove  [x, y, z]: how far the world moved this frame, for a
  //                   scene that scrolls the world past a still camera (the
  //                   motion blur then streaks the world, not only the camera)
  //   opts.before     function(renderer): runs before the main pass, e.g. to
  //                   render a mirror into a kit target
  Lens.prototype.render = function (scene, camera, opts) {
    var r = this.handle.renderer, T = THREE;
    this.handle.fitCamera(camera);
    if (opts && opts.before) opts.before(r);
    r.setRenderTarget(this.sceneTarget);
    r.clear();
    r.render(scene, camera);

    var L = this.lensPass.uniforms;
    var vp = this._vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    L.invViewProj.value.copy(vp).invert();
    var mv = opts && opts.worldMove;
    if (this._prevVP) {
      L.prevViewProj.value.copy(this._prevVP);
      if (mv) L.prevViewProj.value.multiply(this._m.makeTranslation(-(mv[0] || 0), -(mv[1] || 0), -(mv[2] || 0)));
    } else L.prevViewProj.value.copy(vp);
    this._prevVP = (this._prevVP || new T.Matrix4()).copy(vp);
    L.cameraNear.value = camera.near;
    L.cameraFar.value = camera.far;
    L.shutter.value = this.shutter;
    L.maxVel.value = this.maxVelocity;
    L.focusDist.value = this.focus;
    var maxCoc = Math.min(this.w, this.h) * Math.max(0, this.blur);
    L.cocScale.value = maxCoc * 0.9;
    L.maxCoc.value = maxCoc;
    L.farScale.value = this.farBlur;
    this.dofPass.uniforms.maxCoc.value = maxCoc;
    this.dofPass.enabled = this.opts.dof !== false && maxCoc > 0.25;
    this.gradePass.uniforms.seed.value = (this.handle.p ? this.handle.p.frameCount : 0) % 97;
    r.toneMappingExposure = this.exposure;
    this.composer.render(1 / 60);
  };

  // Compile the scene's programs as the main pass will use them (into an HDR
  // target: no tone mapping, linear output) and the chain's own, without
  // blocking. Resolves when every program is ready.
  Lens.prototype.compile = function (scene, camera) {
    var r = this.handle.renderer, T = THREE;
    this.handle.fitCamera(camera);
    var prev = r.getRenderTarget();
    var quads = new T.Scene(), out = new T.Scene();
    var cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var geo = new T.PlaneGeometry(2, 2);
    var self = this;
    this.composer.passes.forEach(function (pass) {
      if (pass === self.outputPass) return;
      passMaterials(pass).forEach(function (m) { quads.add(new T.Mesh(geo, m)); });
    });
    // OutputPass picks its defines on its first render; set them as it would
    // (the kit always outputs AgX to sRGB) so the program compiled here is the
    // one it will use.
    var op = this.outputPass;
    if (r.toneMapping === T.AgXToneMapping && r.outputColorSpace === T.SRGBColorSpace && op._toneMapping !== r.toneMapping) {
      op._outputColorSpace = r.outputColorSpace;
      op._toneMapping = r.toneMapping;
      op.material.defines = { SRGB_TRANSFER: '', AGX_TONE_MAPPING: '' };
      op.material.needsUpdate = true;
    }
    out.add(new T.Mesh(geo, op.material));
    r.setRenderTarget(this.sceneTarget);
    var a = r.compileAsync(scene, camera);
    var b = r.compileAsync(quads, cam);
    r.setRenderTarget(null);
    var c = r.compileAsync(out, cam);
    r.setRenderTarget(prev);
    return Promise.all([a, b, c]).then(function () { geo.dispose(); });
  };

  // Free the chain's GPU memory (at 3024x1890 the MSAA HDR targets alone are
  // ~300 MB) but keep the compiled programs; the next render reallocates.
  Lens.prototype.release = function () {
    var b = this.bloom;
    this.sceneTarget.dispose();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    if (b.renderTargetBright) b.renderTargetBright.dispose();
    (b.renderTargetsHorizontal || []).forEach(function (t) { t.dispose(); });
    (b.renderTargetsVertical || []).forEach(function (t) { t.dispose(); });
    this._prevVP = null;
  };

  // ----------------------------------------------------------------- handle
  // One per three.js scene; what the scene sees as ctx.three.
  function Handle(def) {
    this.def = def;
    this.THREE = THREE;
    this.addons = addons;
    this.renderer = getRenderer();
    this.canvas = this.renderer.domElement;
    this.width = 2; this.height = 2; this.aspect = 1; this.scale = 1;
    this.p = null; this.ctx = null;
    this._lenses = [];
    this._targets = [];   // { target, scale }
    this._fitted = [];
  }

  // Core calls this before every setup / enter / draw of the scene: the
  // render size follows the p5 canvas and the policy, and everything the kit
  // made for this scene follows the render size.
  Handle.prototype.frame = function (p, ctx) {
    this.p = p; this.ctx = ctx;
    var d = p.pixelDensity();
    var budget = this.def.three && this.def.three.pixelBudget;
    var s = renderSize(Math.round(p.width * d), Math.round(p.height * d), budget);
    this.scale = s.scale;
    var c = this.renderer.domElement;
    if (c.width !== s.w || c.height !== s.h) this.renderer.setSize(s.w, s.h, false);
    if (s.w === this.width && s.h === this.height) return;
    this.width = s.w; this.height = s.h; this.aspect = s.w / s.h;
    this._lenses.forEach(function (l) { l.setSize(s.w, s.h); });
    this._targets.forEach(function (t) { t.target.setSize(Math.max(1, Math.round(s.w * t.scale)), Math.max(1, Math.round(s.h * t.scale))); });
  };

  Handle.prototype.enter = function () {
    resetRenderer(this.renderer);
    this._lenses.forEach(function (l) { l.cut(); });
  };

  Handle.prototype.leave = function () {
    this._lenses.forEach(function (l) { l.release(); });
    this._targets.forEach(function (t) { t.target.dispose(); });
    this.renderer.setRenderTarget(null);
    this.renderer.renderLists.dispose();
    // The drawing buffer too (~23 MB at native size); the next frame() of
    // any three.js scene sizes it again.
    this.renderer.setSize(1, 1, false);
  };

  Handle.prototype.lens = function (opts) { return new Lens(this, opts); };

  // A render target that follows the render size (times `scale`) and is
  // freed when the scene leaves. `options` are WebGLRenderTarget's.
  Handle.prototype.target = function (scale, options) {
    var s = scale || 1;
    var t = new THREE.WebGLRenderTarget(Math.max(1, Math.round(this.width * s)), Math.max(1, Math.round(this.height * s)), options);
    this._targets.push({ target: t, scale: s });
    return t;
  };

  // Keep a perspective camera's aspect on the render size.
  Handle.prototype.fitCamera = function (camera) {
    if (camera && camera.isPerspectiveCamera && camera.aspect !== this.aspect) {
      camera.aspect = this.aspect;
      camera.updateProjectionMatrix();
    }
  };

  // Render straight to the kit's canvas (AgX, sRGB), no lens chain.
  Handle.prototype.render = function (scene, camera) {
    this.fitCamera(camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(scene, camera);
  };

  // Compile for Handle.render (to the screen). A scene using a lens calls
  // lens.compile instead.
  Handle.prototype.compile = function (scene, camera) {
    this.fitCamera(camera);
    this.renderer.setRenderTarget(null);
    return this.renderer.compileAsync(scene, camera);
  };

  // Draw the kit's canvas over the whole stage. Call from draw(), after
  // rendering: core's virtual-stage transform is in place, so ctx.width x
  // ctx.height covers the canvas.
  Handle.prototype.composite = function () {
    var g = this.p.drawingContext;
    g.save();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = true;
    g.drawImage(this.renderer.domElement, 0, 0, this.ctx.width, this.ctx.height);
    g.restore();
  };

  // A PMREM environment for image-based light, baked once:
  //   'room'                 three's RoomEnvironment (neutral studio)
  //   function (THREE, scene) that fills an empty scene with emitters
  //   { background, room: [w, h, d], panels: [{ size: [w, h], position: [x, y, z],
  //     rotation: [x, y, z], color: [r, g, b], intensity }] }
  //                           a dark box with glowing panels, the spike's kind
  // Returns the texture, for scene.environment.
  Handle.prototype.environment = function (spec, sigma) {
    var T = THREE, env;
    if (spec === 'room' || spec == null) { env = new addons.RoomEnvironment(); sigma = sigma == null ? 0.04 : sigma; }
    else if (typeof spec === 'function') { env = new T.Scene(); spec(T, env); }
    else {
      env = new T.Scene();
      var room = spec.room || [20, 10, 40];
      env.add(new T.Mesh(new T.BoxGeometry(room[0], room[1], room[2]),
        new T.MeshBasicMaterial({ color: spec.background == null ? 0x050409 : spec.background, side: T.BackSide })));
      (spec.panels || []).forEach(function (pn) {
        var k = pn.intensity == null ? 1 : pn.intensity, c = pn.color || [1, 1, 1];
        var m = new T.Mesh(new T.PlaneGeometry(pn.size[0], pn.size[1]),
          new T.MeshBasicMaterial({ color: new T.Color(c[0] * k, c[1] * k, c[2] * k), side: T.DoubleSide }));
        if (pn.position) m.position.set(pn.position[0], pn.position[1], pn.position[2]);
        if (pn.rotation) m.rotation.set(pn.rotation[0], pn.rotation[1], pn.rotation[2]);
        env.add(m);
      });
    }
    var pm = new T.PMREMGenerator(this.renderer);
    var rt = pm.fromScene(env, sigma == null ? 0.02 : sigma);
    pm.dispose();
    env.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    return rt.texture;
  };

  // A fullscreen ShaderPass from a fragment shader (vUv in, gl_FragColor
  // out; the default input texture is tDiffuse), for lens.insertPass.
  Handle.prototype.shaderPass = function (frag, uniforms, defines) {
    return fullscreen(frag, uniforms, defines);
  };

  // Load this scene's addons, then give it its handle. Core and the harness
  // call this; it resolves once, and is retried after a failure.
  function prepare(def) {
    return load(addonsFor(def)).then(function () {
      return handles[def.id] || (handles[def.id] = new Handle(def));
    });
  }

  window.VIZ_THREE = {
    version: VERSION,
    url: CORE_URL,
    addonPaths: ADDONS,
    load: load,
    prefetch: prefetch,
    prepare: prepare,
    get THREE() { return THREE; },
    get renderer() { return THREE ? getRenderer() : null; },
    // Render scale: null (the default) sizes by the pixel budget; a number
    // (0.25-1) forces that fraction of the device-pixel canvas for every
    // three.js scene. The budget applies to scenes that do not set their own.
    setRenderScale: function (s) { policy.scale = s == null ? null : Math.max(0.1, Math.min(1, Number(s) || 1)); },
    setPixelBudget: function (px) { policy.pixelBudget = px == null ? DEFAULT_PIXEL_BUDGET : Math.max(1e5, Number(px) || DEFAULT_PIXEL_BUDGET); },
    get policy() { return { pixelBudget: policy.pixelBudget, scale: policy.scale }; },
    DEFAULT_PIXEL_BUDGET: DEFAULT_PIXEL_BUDGET
  };
})();
