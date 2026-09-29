// Clockwork: a macro lens drifting over an open watch movement on a
// watchmaker's bench. Brass wheels with circular graining, rhodium bridges
// with Côtes de Genève and polished chamfers, a perlage mainplate, blued
// screws, ruby jewels in gold chatons, and a balance wheel breathing on its
// hairspring, all under one warm lamp that casts real shadows.
//
// Music, each reaction in its own place (harness/TASTE.md):
//   kick    the escapement ticks: the escape wheel jumps a tooth, the pallet
//           fork snaps over (its two ruby stones catch the lamp) and the
//           balance swings through; the gear train steps with it
//   clap    every other clap the lens racks focus to another plane of the
//           movement (bridge top, wheel train, mainplate), slowly
//   hats    single jewels glint, a star on one stone at a time
//   bass    the balance swings wider and the train runs faster
//   drop    with Follow the track: the lens pulls up and out to the whole
//           movement in its case, the train races, the ratchet winds and
//           the lamp swings round so the shadows sweep
//
// How it is made (web/three-kit.js; CONTRACT.md, "three.js scenes"):
//   Every wheel, pinion, bridge and lever is an ExtrudeGeometry from a 2D
//   profile (cycloid-ish teeth, club-tooth escape wheel, convex-hull bridges)
//   with a chamfer bevel; caps and walls carry different materials, so the
//   bevels read as polished anglage. The finishes are anisotropic
//   MeshPhysicalMaterial driven by generated direction maps (circular grain
//   for wheels, sunburst for the ratchet, overlapping swirls for perlage,
//   arced stripes for the côtes), so the highlights sweep the way brushed
//   metal does. One shadow-casting spot (the lamp) plus a PMREM of a studio
//   with soft boxes; the kit lens racks shallow depth of field.

(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => clamp(x, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = (t) => t * t * (3 - 2 * t);

  const PRESETS = {
    calm: { speed: 0.45, open: 0, rack: 0.75, amp: 0.5, lamp: 0.3, sweep: 0 },
    drop: { speed: 1.7, open: 1, rack: 0.45, amp: 1, lamp: 0.55, sweep: 1 },
  };
  const DRIVE = ['speed', 'open', 'rack', 'amp', 'lamp', 'sweep'];

  // ---------------------------------------------------- direction textures
  // Anisotropy maps: RG is the brushing direction in UV space (encoded to
  // 0..1), B its strength. Roughness maps carry the same grain in G so the
  // lines show even where the anisotropic lobe does not.
  function dataTex(T, n, fill, linear) {
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        fill((x + 0.5) / n, (y + 0.5) / n, data, i);
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.colorSpace = linear ? T.NoColorSpace : T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }
  const enc = (v) => Math.round(clamp01(v * 0.5 + 0.5) * 255);

  // Circular graining around the centre (wheels): tangent direction, with a
  // fine ring pattern in strength and roughness.
  function circularMaps(T, radial) {
    const ring = (r) => 0.5 + 0.5 * Math.sin(r * 900 + hash(Math.floor(r * 140)) * 6) * hash(Math.floor(r * 60) + 3);
    const aniso = dataTex(T, 512, (u, v, d, i) => {
      const x = u - 0.5, y = v - 0.5, r = Math.hypot(x, y) + 1e-5;
      const dx = radial ? x / r : -y / r, dy = radial ? y / r : x / r;
      d[i] = enc(dx); d[i + 1] = enc(dy); d[i + 2] = Math.round(255 * (0.7 + 0.3 * ring(r))); d[i + 3] = 255;
    }, true);
    const rough = dataTex(T, 512, (u, v, d, i) => {
      const x = u - 0.5, y = v - 0.5, r = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const g = radial ? 0.5 + 0.5 * Math.sin(a * 180 + hash(Math.floor(a * 40)) * 5) : ring(r);
      d[i] = 255; d[i + 1] = Math.round(255 * (0.16 + 0.14 * g)); d[i + 2] = 0; d[i + 3] = 255;
    }, true);
    return { aniso, rough };
  }

  // Perlage: overlapping circular swirls laid in rows, each over the last.
  function perlageMaps(T) {
    const N = 8, sp = 1 / N, R = sp * 1.3;
    const top = (u, v) => {
      // The spot laid last (highest row, then column) that covers the pixel.
      let best = null, bo = -1;
      const cy = Math.floor(v / sp);
      for (let j = cy - 2; j <= cy + 2; j++) {
        const off = (j & 1) ? sp / 2 : 0;
        const cx = Math.floor((u - off) / sp);
        for (let k = cx - 2; k <= cx + 2; k++) {
          const px = k * sp + off + sp / 2, py = j * sp + sp / 2;
          const dx = u - px, dy = v - py, r = Math.hypot(dx, dy);
          const order = j * 64 + k;
          if (r < R && order > bo) { bo = order; best = { dx, dy, r, j, k }; }
        }
      }
      return best;
    };
    const cache = new Float32Array(256 * 256 * 4);
    const n = 256;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const b = top((x + 0.5) / n, (y + 0.5) / n);
        const i = (y * n + x) * 4;
        cache[i] = b.dx; cache[i + 1] = b.dy; cache[i + 2] = b.r; cache[i + 3] = hash(((b.j % N) + N) % N * 13 + ((b.k % N) + N) % N);
      }
    }
    const at = (u, v) => ((Math.min(n - 1, Math.floor(v * n)) * n + Math.min(n - 1, Math.floor(u * n))) * 4);
    const aniso = dataTex(T, n, (u, v, d, i) => {
      const j = at(u, v), dx = cache[j], dy = cache[j + 1], r = cache[j + 2] + 1e-5;
      d[i] = enc(-dy / r); d[i + 1] = enc(dx / r);
      d[i + 2] = Math.round(255 * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(r * 700 + cache[j + 3] * 9)))); d[i + 3] = 255;
    }, true);
    const rough = dataTex(T, n, (u, v, d, i) => {
      const j = at(u, v), r = cache[j + 2];
      const edge = smooth(clamp01((r / R - 0.86) / 0.14));
      d[i] = 255; d[i + 1] = Math.round(255 * (0.3 + 0.08 * cache[j + 3] + 0.12 * edge)); d[i + 2] = 0; d[i + 3] = 255;
    }, true);
    return { aniso, rough };
  }

  // Côtes de Genève: parallel stripes, each brushed in wide arcs across its
  // width, with a crisp seam between stripes.
  function cotesMaps(T) {
    const W = 0.25, AR = 0.34;
    const aniso = dataTex(T, 256, (u, v, d, i) => {
      const s = Math.floor(u / W), cx = s * W + W / 2;
      // Arc centred below: the brushing is tangent to it.
      const dx = u - cx, dy = AR;
      const r = Math.hypot(dx, dy);
      d[i] = enc(dy / r); d[i + 1] = enc(-dx / r);
      const seam = Math.abs(u - cx) > W * 0.47 ? 0 : 1;
      d[i + 2] = Math.round(255 * seam * (0.8 + 0.2 * hash(s * 7.1 + Math.floor(v * 90)))); d[i + 3] = 255;
    }, true);
    const rough = dataTex(T, 256, (u, v, d, i) => {
      const s = Math.floor(u / W), cx = s * W + W / 2;
      const e = Math.abs(u - cx) / (W / 2);
      const seam = e > 0.94 ? 1 : 0;
      d[i] = 255; d[i + 1] = Math.round(255 * (seam ? 0.6 : 0.3 + 0.12 * e * e)); d[i + 2] = 0; d[i + 3] = 255;
    }, true);
    return { aniso, rough };
  }

  // A soft four-point star for the jewel glints.
  function starTexture(T) {
    return dataTex(T, 64, (u, v, d, i) => {
      const x = (u - 0.5) * 2, y = (v - 0.5) * 2, r = Math.hypot(x, y);
      const core = Math.exp(-r * r * 60);
      const rays = Math.exp(-Math.abs(x) * 40) * Math.exp(-y * y * 3) + Math.exp(-Math.abs(y) * 40) * Math.exp(-x * x * 3);
      const halo = Math.exp(-r * r * 8) * 0.15;
      const k = clamp01(core + rays * 0.6 + halo) * clamp01(1 - r);
      d[i] = d[i + 1] = d[i + 2] = Math.round(255 * k); d[i + 3] = 255;
    }, true);
  }

  // ------------------------------------------------------------ geometry
  // Profiles are drawn in shape space (x, y) = world (x, -z); every extrusion
  // is turned so its thickness runs up +y from 0.
  function layFlat(geo) { geo.rotateX(-Math.PI / 2); return geo; }

  // Cap UVs from shape space: `fn(x, y) -> [u, v]`.
  function planarUV(geo, fn) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const q = fn(pos.getX(i), pos.getY(i));
      uv.setXY(i, q[0], q[1]);
    }
    uv.needsUpdate = true;
    return geo;
  }

  function extrude(T, shape, depth, bevel, curveSegs) {
    return new T.ExtrudeGeometry(shape, {
      depth, curveSegments: curveSegs || 24, steps: 1,
      bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1,
    });
  }

  // Tooth outline as (fraction of pitch, radius) points. Ogival watch teeth:
  // centred at s = 0.25, the gap at s = 0.75.
  function toothPoints(kind, r, m) {
    const ra = r + m * 0.95, rf = r - m * 1.25;
    if (kind === 'escape') {
      const h = ra - rf;
      return [[0.0, rf], [0.12, rf + h * 0.25], [0.52, ra - h * 0.06], [0.58, ra], [0.64, ra - h * 0.1], [0.68, rf + h * 0.45], [0.72, rf], [0.86, rf]];
    }
    return [[0.02, rf], [0.06, r - m * 0.5], [0.1, r + m * 0.25], [0.15, ra - m * 0.18], [0.2, ra], [0.3, ra], [0.35, ra - m * 0.18],
      [0.4, r + m * 0.25], [0.44, r - m * 0.5], [0.48, rf], [0.6, rf], [0.75, rf], [0.9, rf]];
  }

  function gearShape(T, o) {
    const shape = new T.Shape();
    let R;
    if (o.teeth > 0) {
      const r = o.m * o.teeth / 2, tp = toothPoints(o.kind, r, o.m), p = TAU / o.teeth;
      R = r + o.m;
      let first = true;
      for (let i = 0; i < o.teeth; i++) {
        for (const [s, rad] of tp) {
          const a = (i + s) * p;
          if (first) { shape.moveTo(rad * Math.cos(a), rad * Math.sin(a)); first = false; }
          else shape.lineTo(rad * Math.cos(a), rad * Math.sin(a));
        }
      }
      shape.closePath();
    } else {
      R = o.r;
      shape.absarc(0, 0, R, 0, TAU, false);
    }
    const rf = o.teeth > 0 ? o.m * o.teeth / 2 - o.m * 1.25 : R;
    if (o.spokes) {
      const ri = rf - o.rimW, rh = o.hub, w = o.spokeW / 2;
      for (let k = 0; k < o.spokes; k++) {
        const a0 = (k / o.spokes) * TAU + (o.spokeRot || 0), a1 = ((k + 1) / o.spokes) * TAU + (o.spokeRot || 0);
        const oi = Math.asin(w / ri), ih = Math.asin(Math.min(0.99, w / rh));
        if (a1 - a0 - 2 * ih < 0.05) continue;
        const hole = new T.Path();
        hole.absarc(0, 0, ri, a0 + oi, a1 - oi, false);
        hole.absarc(0, 0, rh, a1 - ih, a0 + ih, true);
        hole.closePath();
        shape.holes.push(hole);
      }
    }
    return { shape, R };
  }

  // A wheel or pinion, flat, centred on its arbor, caps in UV 0..1 across it.
  function gearGeo(T, o) {
    const { shape, R } = gearShape(T, o);
    const geo = extrude(T, shape, o.thick, o.bevel == null ? 0.012 : o.bevel, 32);
    planarUV(geo, (x, y) => [x / R * 0.5 + 0.5, y / R * 0.5 + 0.5]);
    return layFlat(geo);
  }

  // Convex hull of circles (world x, z, radius): the outline of a bridge.
  function hullShape(T, circles) {
    const pts = [];
    for (const [x, z, r] of circles) for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; pts.push([x + r * Math.cos(a), -z + r * Math.sin(a)]); }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    const h = lo.slice(0, -1).concat(hi.slice(0, -1));
    const s = new T.Shape();
    h.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
    s.closePath();
    return s;
  }

  // ------------------------------------------------------------ layout
  // Units are millimetres-ish of a ~25 mm movement, scaled up: the movement
  // is about 25 units across. Each arbor: position, the level of its wheel,
  // the wheel (teeth, module) and the pinion (leaves) that the previous
  // wheel drives.
  function layout() {
    const A = {};
    A.center = { x: -2.5, z: 0, wheel: { teeth: 80, m: 0.07, y: 1.85, t: 0.2, spokes: 4 }, pinion: { leaves: 12, m: 0.1, y: 0.72, t: 0.4 } };
    const at = (from, dist, deg) => ({ x: from.x + dist * Math.cos(deg * Math.PI / 180), z: from.z - dist * Math.sin(deg * Math.PI / 180) });
    // The barrel's wheel drives the centre pinion.
    const bp = at(A.center, 0.1 * 84 / 2 + 0.1 * 12 / 2, 148);
    A.barrel = { ...bp, wheel: { teeth: 84, m: 0.1, y: 0.75, t: 0.3, spokes: 0 } };
    const tp = at(A.center, 0.07 * 80 / 2 + 0.07 * 10 / 2, -22);
    A.third = { ...tp, wheel: { teeth: 75, m: 0.06, y: 1.25, t: 0.18, spokes: 5 }, pinion: { leaves: 10, m: 0.07, y: 1.78, t: 0.34 } };
    const fp = at(A.third, 0.06 * 75 / 2 + 0.06 * 10 / 2, 38);
    A.fourth = { ...fp, wheel: { teeth: 70, m: 0.055, y: 2.2, t: 0.17, spokes: 5 }, pinion: { leaves: 10, m: 0.06, y: 1.18, t: 0.32 } };
    const ep = at(A.fourth, 0.055 * 70 / 2 + 0.055 * 8 / 2, -32);
    A.escape = { ...ep, wheel: { teeth: 15, m: 0.14, y: 1.55, t: 0.16, spokes: 3, kind: 'escape' }, pinion: { leaves: 8, m: 0.055, y: 2.14, t: 0.3 } };
    A.pallet = at(A.escape, 1.55, 0);
    A.balance = at(A.pallet, 1.78, 0);
    return A;
  }

  // ------------------------------------------------------------ build
  function build(kit) {
    const T = kit.THREE;
    const A = layout();

    const scene = new T.Scene();
    scene.background = new T.Color(0.012, 0.008, 0.006);
    scene.fog = new T.FogExp2(new T.Color(0.012, 0.008, 0.006), 0.0085);
    // A studio: a big warm soft box overhead-left, a cool window strip on the
    // right, a dim warm bounce from the bench. Polished steel shows these as
    // shapes, not as a flat grey.
    scene.environment = kit.environment({
      background: 0x16110c, room: [60, 24, 60],
      panels: [
        { size: [26, 16], position: [-6, 11.9, -2], rotation: [Math.PI / 2, 0, 0], color: [1, 0.86, 0.68], intensity: 2.2 },
        { size: [6, 18], position: [29.9, 6, 2], rotation: [0, -Math.PI / 2, 0], color: [0.74, 0.86, 1], intensity: 2.4 },
        { size: [40, 5], position: [0, 4, -29.9], color: [1, 0.9, 0.78], intensity: 1.1 },
        { size: [2, 20], position: [-29.9, 7, 10], rotation: [0, Math.PI / 2, 0], color: [1, 0.7, 0.45], intensity: 3 },
        { size: [30, 3], position: [0, 2, 29.9], rotation: [0, Math.PI, 0], color: [0.9, 0.85, 0.8], intensity: 0.8 },
      ],
    }, 0.03);
    scene.environmentIntensity = 1.0;

    const camera = new T.PerspectiveCamera(36, kit.aspect, 0.05, 260);

    const circ = circularMaps(T, false), sun = circularMaps(T, true), perl = perlageMaps(T), cotes = cotesMaps(T);
    const phys = (o) => new T.MeshPhysicalMaterial(o);
    const brass = phys({ color: 0xe0b66a, metalness: 1, roughness: 1, roughnessMap: circ.rough, anisotropy: 0.75, anisotropyMap: circ.aniso, envMapIntensity: 1 });
    const brassEdge = phys({ color: 0xf0c985, metalness: 1, roughness: 0.12 });
    const gilt = phys({ color: 0xf2c878, metalness: 1, roughness: 0.18, clearcoat: 0.3 });
    const steel = phys({ color: 0xd8dade, metalness: 1, roughness: 0.08 });
    const steelSun = phys({ color: 0xb4b8c0, metalness: 1, roughness: 1, roughnessMap: sun.rough, anisotropy: 0.85, anisotropyMap: sun.aniso });
    const plateMat = phys({ color: 0xbfbcb6, metalness: 1, roughness: 1, roughnessMap: perl.rough, anisotropy: 0.5, anisotropyMap: perl.aniso, envMapIntensity: 0.9 });
    const bridgeMat = phys({ color: 0xcdcbc6, metalness: 1, roughness: 1, roughnessMap: cotes.rough, anisotropy: 0.85, anisotropyMap: cotes.aniso });
    const anglage = phys({ color: 0xe4e4e6, metalness: 1, roughness: 0.06 });
    // Heat-blued steel: a deep blue with a violet sheen at grazing angles.
    const blued = phys({ color: 0x1a2f8a, metalness: 1, roughness: 0.2, iridescence: 0.5, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 420] });
    // Ruby: no transmission pass (a whole extra render); a saturated, sharp
    // dielectric with a little self-light standing in for the light it lets in.
    const ruby = phys({ color: 0xc0122c, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.76, specularIntensity: 1, emissive: 0x8a0414, emissiveIntensity: 0.55 });
    const slotMat = new T.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, metalness: 0 });
    const leather = new T.MeshStandardMaterial({ color: 0x2b140d, roughness: 0.62, metalness: 0 });
    const caseMat = phys({ color: 0xd6d6da, metalness: 1, roughness: 0.26, envMapIntensity: 1.1 });

    const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    const world = new T.Group();
    scene.add(world);

    // Bench, case band, mainplate.
    const bench = new T.Mesh(new T.PlaneGeometry(400, 400), leather);
    bench.rotation.x = -Math.PI / 2;
    bench.position.y = -0.9;
    bench.receiveShadow = true;
    world.add(bench);
    const caseBand = new T.Mesh(new T.LatheGeometry([
      new T.Vector2(12.9, -0.9), new T.Vector2(14.6, -0.9), new T.Vector2(15.0, -0.4), new T.Vector2(14.9, 0.5),
      new T.Vector2(14.3, 1.05), new T.Vector2(13.3, 1.05), new T.Vector2(12.9, 0.7), new T.Vector2(12.9, -0.9),
    ], 160), caseMat);
    world.add(shadowed(caseBand));
    const plateShape = new T.Shape();
    plateShape.absarc(0, 0, 12.8, 0, TAU, false);
    const plateGeo = extrude(T, plateShape, 0.6, 0.05, 160);
    planarUV(plateGeo, (x, y) => [x * 0.95, y * 0.95]);
    layFlat(plateGeo);
    const plate = new T.Mesh(plateGeo, [plateMat, anglage]);
    plate.position.y = -0.05;
    world.add(shadowed(plate));

    // Arbors: a wheel, its pinion, a steel staff from plate to bridge.
    const staffGeo = new T.CylinderGeometry(0.075, 0.075, 1, 16);
    const arbors = {};
    const wheelMats = [brass, brassEdge];
    for (const key of ['center', 'third', 'fourth', 'escape']) {
      const a = A[key], g = new T.Group();
      g.position.set(a.x, 0, a.z);
      const w = a.wheel, r = w.m * w.teeth / 2;
      const wheel = new T.Mesh(gearGeo(T, { teeth: w.teeth, m: w.m, thick: w.t, spokes: w.spokes, rimW: w.kind === 'escape' ? 0.16 : 0.22 * r / 2.8 + 0.08, hub: w.kind === 'escape' ? 0.26 : 0.34, spokeW: w.kind === 'escape' ? 0.12 : 0.16, kind: w.kind }),
        w.kind === 'escape' ? [steelSun, steel] : wheelMats);
      wheel.position.y = w.y;
      const pn = a.pinion;
      const pinion = new T.Mesh(gearGeo(T, { teeth: pn.leaves, m: pn.m, thick: pn.t, bevel: 0.01 }), [steel, steel]);
      pinion.position.y = pn.y;
      const staff = new T.Mesh(staffGeo, steel);
      staff.scale.y = 2.75; staff.position.y = 0.55 + 2.75 / 2;
      g.add(shadowed(wheel), shadowed(pinion), shadowed(staff));
      world.add(g);
      arbors[key] = { g, wheel, pinion, a };
    }
    // The barrel: a toothed drum with a lid, driving the centre pinion.
    {
      const a = A.barrel, g = new T.Group();
      g.position.set(a.x, 0, a.z);
      const w = a.wheel;
      const teeth = new T.Mesh(gearGeo(T, { teeth: w.teeth, m: w.m, thick: w.t }), wheelMats);
      teeth.position.y = w.y;
      const drum = new T.Mesh(new T.CylinderGeometry(3.85, 3.85, 1.35, 96), brassEdge);
      drum.position.y = 0.6 + 1.35 / 2;
      const lid = new T.Mesh(gearGeo(T, { teeth: 0, r: 3.7, thick: 0.08 }), [brass, brassEdge]);
      lid.position.y = 1.96;
      g.add(shadowed(teeth), shadowed(drum), shadowed(lid));
      world.add(g);
      arbors.barrel = { g, a };
    }

    // Phases so every mesh starts tooth-in-gap: the wheel's tooth centre on
    // the line to the next arbor, the pinion's gap centre facing back.
    const chain = [['barrel', 'center'], ['center', 'third'], ['third', 'fourth'], ['fourth', 'escape']];
    const phase = { barrel: { wheel: 0 }, center: {}, third: {}, fourth: {}, escape: { wheel: 0 } };
    for (const [ka, kb] of chain) {
      const a = A[ka], b = A[kb];
      const phi = Math.atan2(-(b.z - a.z), b.x - a.x);
      const pw = TAU / a.wheel.teeth, pp = TAU / b.pinion.leaves;
      phase[ka].wheel = phi - 0.25 * pw;
      phase[kb].pinion = phi + Math.PI - 0.75 * pp;
    }

    // Pallet fork: two arms reaching the escape wheel with ruby stones, and a
    // lever out to the balance roller. Rocks about its own staff.
    const pal = new T.Group();
    pal.position.set(A.pallet.x, 1.56, A.pallet.z);
    const palletStones = [];
    {
      const piv = [0, 0, 0.2];
      const arm = (ang, len) => [len * Math.cos(ang), -len * Math.sin(ang)];
      const e1 = arm(Math.PI * 0.75, 1.12), e2 = arm(-Math.PI * 0.75, 1.12);
      const parts = [
        [hullShape(T, [piv, [e1[0], -e1[1], 0.1]]), 0.14, 0],
        [hullShape(T, [piv, [e2[0], -e2[1], 0.1]]), 0.14, 0],
        [hullShape(T, [[0, 0, 0.22], [1.3, 0, 0.09]]), 0.15, 0.004],
      ];
      for (const [s, t, dy] of parts) {
        const geo = layFlat(extrude(T, s, t, 0.02));
        const m = new T.Mesh(geo, [steel, anglage]);
        m.position.y = dy;
        pal.add(shadowed(m));
      }
      // Fork horns at the lever's tip.
      for (const sz of [-1, 1]) {
        const h = new T.Mesh(new T.BoxGeometry(0.32, 0.15, 0.07), steel);
        h.position.set(1.42, 0.075, sz * 0.1);
        pal.add(shadowed(h));
      }
      for (const e of [e1, e2]) {
        const st = new T.Mesh(new T.BoxGeometry(0.34, 0.26, 0.12), ruby);
        st.position.set(e[0] * 0.98, 0.08, -e[1] * 0.98);
        st.rotation.y = Math.atan2(e[1], e[0]) + Math.PI / 2;
        pal.add(shadowed(st));
        palletStones.push(st);
      }
      const staff = new T.Mesh(staffGeo, steel);
      staff.scale.y = 1.6; staff.position.y = 0.1;
      pal.add(staff);
    }
    world.add(pal);

    // Balance: a gilded rim on three arms, timing screws round the rim, a
    // roller with the impulse jewel, and a hairspring beneath.
    const bal = new T.Group();
    bal.position.set(A.balance.x, 2.55, A.balance.z);
    {
      const rimGeo = gearGeo(T, { teeth: 0, r: 2.35, thick: 0.24, spokes: 3, rimW: 0.26, hub: 0.3, spokeW: 0.2, spokeRot: 0.5 });
      bal.add(shadowed(new T.Mesh(rimGeo, [brass, gilt])));
      const screwGeo = new T.LatheGeometry([new T.Vector2(0, 0), new T.Vector2(0.13, 0), new T.Vector2(0.13, 0.08), new T.Vector2(0.09, 0.14), new T.Vector2(0, 0.16)], 20);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + 0.11;
        const s = new T.Mesh(screwGeo, gilt);
        s.position.set(2.22 * Math.cos(a), 0.24, 2.22 * Math.sin(a));
        bal.add(shadowed(s));
      }
      const roller = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.12, 32), steel);
      roller.position.y = -0.9;
      const imp = new T.Mesh(new T.BoxGeometry(0.08, 0.3, 0.08), ruby);
      imp.position.set(-0.3, -1.0, 0);
      const staff = new T.Mesh(staffGeo, steel);
      staff.scale.y = 2.0; staff.position.y = -0.4;
      bal.add(shadowed(roller), imp, shadowed(staff));
    }
    world.add(bal);
    const spring = new T.Group();
    spring.position.set(A.balance.x, 2.34, A.balance.z);
    {
      const pts = [];
      const turns = 12, N = 1400;
      for (let i = 0; i <= N; i++) {
        const t = i / N, a = t * turns * TAU, r = 0.32 + t * 1.3;
        pts.push(new T.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
      }
      const curve = new T.CatmullRomCurve3(pts);
      const geo = new T.TubeGeometry(curve, N, 0.018, 4, false);
      geo.scale(1, 5, 1);   // a flat ribbon, taller than thick
      spring.add(shadowed(new T.Mesh(geo, phys({ color: 0xe8e2d6, metalness: 1, roughness: 0.14 }))));
    }
    world.add(spring);

    // Bridges: convex hulls of circles round the pivots, côtes on top,
    // polished anglage on the bevels, held on steel pillars, fixed with blued
    // screws; each pivot gets a ruby in a gold chaton.
    const jewels = [];
    const jewelGeo = new T.LatheGeometry([new T.Vector2(0.05, 0), new T.Vector2(0.05, 0.05), new T.Vector2(0.11, 0.085), new T.Vector2(0.19, 0.08), new T.Vector2(0.23, 0.045), new T.Vector2(0.23, 0)], 40);
    const chatonGeo = new T.LatheGeometry([new T.Vector2(0.22, 0), new T.Vector2(0.4, 0), new T.Vector2(0.43, 0.05), new T.Vector2(0.39, 0.1), new T.Vector2(0.24, 0.1), new T.Vector2(0.22, 0.02)], 48);
    const screwHead = new T.LatheGeometry([new T.Vector2(0, 0), new T.Vector2(0.3, 0), new T.Vector2(0.3, 0.07), new T.Vector2(0.24, 0.15), new T.Vector2(0, 0.18)], 32);
    const slotGeo = new T.BoxGeometry(0.62, 0.06, 0.07);
    const pillarGeo = new T.CylinderGeometry(0.3, 0.3, 1, 24);
    const addJewel = (x, y, z) => {
      const c = new T.Mesh(chatonGeo, gilt); c.position.set(x, y, z);
      const j = new T.Mesh(jewelGeo, ruby); j.position.set(x, y + 0.03, z);
      world.add(shadowed(c), shadowed(j));
      jewels.push(new T.Vector3(x, y + 0.12, z));
    };
    const addScrew = (x, y, z, rot) => {
      const h = new T.Mesh(screwHead, blued); h.position.set(x, y, z);
      const s = new T.Mesh(slotGeo, slotMat); s.position.set(x, y + 0.16, z); s.rotation.y = rot;
      world.add(shadowed(h), s);
    };
    const bridges = [];
    const bridge = (circles, pivots, anchors, y0, t) => {
      const geo = extrude(T, hullShape(T, circles), t, 0.07);
      planarUV(geo, (x, y) => [x * 0.16 + 0.37, y * 0.16]);
      layFlat(geo);
      const m = new T.Mesh(geo, [bridgeMat, anglage]);
      m.position.y = y0;
      world.add(shadowed(m));
      bridges.push(m);
      const top = y0 + t + 0.07;
      for (const p of pivots) addJewel(p.x, top, p.z);
      for (const q of anchors) {
        const pl = new T.Mesh(pillarGeo, steel);
        pl.scale.y = y0 - 0.55; pl.position.set(q.x, 0.55 + (y0 - 0.55) / 2, q.z);
        world.add(shadowed(pl));
        addScrew(q.x, top, q.z, hash(q.x * 3.1 + q.z) * Math.PI);
      }
      return top;
    };
    const P = (x, z) => ({ x, z });
    const B = A.barrel, C = A.center, T3 = A.third, F4 = A.fourth, E = A.escape, PL = A.pallet, BW = A.balance;
    const barrelAnchor = P(B.x - 3.0, B.z - 3.4), barrelAnchor2 = P(B.x - 1.2, B.z + 4.2);
    const barrelTop = bridge([[B.x, B.z, 2.3], [barrelAnchor.x, barrelAnchor.z, 1.2], [barrelAnchor2.x, barrelAnchor2.z, 1.1]], [], [barrelAnchor, barrelAnchor2], 2.6, 0.5);
    const cAnchor = P(C.x - 1.4, C.z - 3.9);
    bridge([[C.x, C.z, 0.95], [cAnchor.x, cAnchor.z, 0.85]], [C], [cAnchor], 2.6, 0.5);
    const tfAnchor = P((T3.x + F4.x) / 2 + 0.6, (T3.z + F4.z) / 2 + 2.4);
    bridge([[T3.x, T3.z, 0.75], [F4.x, F4.z, 0.75], [tfAnchor.x, tfAnchor.z, 0.8]], [T3, F4], [tfAnchor], 2.6, 0.45);
    const eAnchor = P(E.x - 0.6, E.z - 2.6);
    bridge([[E.x, E.z, 0.62], [eAnchor.x, eAnchor.z, 0.72]], [E], [eAnchor], 2.6, 0.42);
    const pAnchor = P(PL.x - 0.3, PL.z + 2.3);
    bridge([[PL.x, PL.z, 0.5], [pAnchor.x, pAnchor.z, 0.62]], [PL], [pAnchor], 2.0, 0.3);
    const cockAnchor = P(BW.x + 1.4, BW.z + 3.9);
    bridge([[BW.x, BW.z, 0.85], [cockAnchor.x, cockAnchor.z, 1.25]], [BW], [cockAnchor], 3.2, 0.42);
    // Jewels set straight in the plate at the lower pivots show between wheels.
    addJewel(A.balance.x + 2.9, 0.62, A.balance.z - 0.6);

    // Ratchet wheel on the barrel bridge, sunburst steel, with its click.
    const ratchet = new T.Mesh(gearGeo(T, { teeth: 36, m: 0.12, thick: 0.18, kind: 'escape', bevel: 0.01 }), [steelSun, steel]);
    ratchet.position.set(B.x, barrelTop, B.z);
    world.add(shadowed(ratchet));
    addScrew(B.x, barrelTop + 0.19, B.z, 0.4);
    const crown = new T.Mesh(gearGeo(T, { teeth: 24, m: 0.1, thick: 0.16, bevel: 0.01 }), [steelSun, steel]);
    const crownPos = P(B.x + 0.12 * 18 + 0.1 * 12 + 0.02, B.z - 0.4);
    crown.position.set(crownPos.x, barrelTop, crownPos.z);
    world.add(shadowed(crown));
    addScrew(crownPos.x, barrelTop + 0.17, crownPos.z, 1.1);

    // Two further trains of wheels wind across the open plate, the way a
    // skeletonised complication fills it: wheel meshes wheel, each on a
    // jewelled bar. They run off the fourth wheel, so they tick with it.
    // Pitch radii follow the module, so each pair meshes; the phase carries
    // along the chain so every tooth sits in its neighbour's gap.
    const trains = [];
    const makeTrain = (start, specs, level, ratio) => {
      const m = 0.085;
      const list = [];
      let prev = null, pos = { x: start.x, z: start.z };
      for (const sp of specs) {
        const r = m * sp.teeth / 2;
        if (prev) {
          const d = prev.r + r, a = sp.dir * Math.PI / 180;
          pos = { x: prev.x + d * Math.cos(a), z: prev.z - d * Math.sin(a) };
        }
        const steelWheel = sp.steel;
        const mesh = new T.Mesh(gearGeo(T, { teeth: sp.teeth, m, thick: 0.17, spokes: sp.spokes || 0, rimW: 0.16 + r * 0.06, hub: 0.26, spokeW: 0.13, spokeRot: sp.teeth * 0.1 }),
          steelWheel ? [steelSun, steel] : wheelMats);
        mesh.position.set(pos.x, level, pos.z);
        world.add(shadowed(mesh));
        const staff = new T.Mesh(staffGeo, steel);
        staff.scale.y = 0.8; staff.position.set(pos.x, 0.55 + 0.4, pos.z);
        world.add(staff);
        const w = { mesh, x: pos.x, z: pos.z, r, teeth: sp.teeth, ratio: 1, phase: 0 };
        if (prev) {
          const phi = Math.atan2(-(w.z - prev.z), w.x - prev.x);
          const pp = TAU / prev.teeth, pw = TAU / w.teeth;
          let dlt = ((prev.phase + 0.25 * pp - phi) % pp + pp * 1.5) % pp - pp / 2;
          w.ratio = -prev.ratio * prev.teeth / w.teeth;
          w.phase = phi + Math.PI - 0.75 * pw - dlt * prev.teeth / w.teeth;
        } else w.ratio = ratio;
        list.push(w);
        prev = w;
      }
      // Bars over pairs of wheels, each pivot jewelled.
      for (let i = 0; i + 1 < list.length; i += 2) {
        const a = list[i], b = list[i + 1];
        bridge([[a.x, a.z, 0.42], [b.x, b.z, 0.42]], [a, b], [], 1.25, 0.2);
      }
      if (list.length % 2) { const a = list[list.length - 1]; bridge([[a.x, a.z, 0.42]], [a], [], 1.25, 0.2); }
      trains.push(list);
    };
    makeTrain({ x: -7.0, z: 4.5 }, [
      { teeth: 44, spokes: 5 }, { teeth: 28, dir: -8, steel: true }, { teeth: 60, dir: 12, spokes: 6 }, { teeth: 24, dir: -30, steel: true },
      { teeth: 52, dir: 5, spokes: 5 }, { teeth: 32, dir: 40, spokes: 4 },
    ], 0.62, 0.9);
    makeTrain({ x: 1.2, z: -5.6 }, [
      { teeth: 56, spokes: 5 }, { teeth: 26, dir: -10, steel: true }, { teeth: 48, dir: 8, spokes: 5 }, { teeth: 30, dir: -35, spokes: 4 },
    ], 0.62, -0.7);

    // The lamp: a warm spot high to one side, the only shadow caster.
    const lamp = new T.SpotLight(0xffffff, 1.9, 0, 0.62, 0.55, 0);
    lamp.position.set(-16, 26, 12);
    lamp.target.position.set(1, 0, 0);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0004;
    lamp.shadow.normalBias = 0.02;
    lamp.shadow.radius = 3;
    lamp.shadow.camera.near = 10;
    lamp.shadow.camera.far = 70;
    // Redrawn every other frame (see draw): the wheels creep, and the
    // shadow pass is the scene's second most expensive after the shading.
    lamp.shadow.autoUpdate = false;
    scene.add(lamp, lamp.target);
    // A dim cool fill from the window side so shadows are not empty.
    const fill = new T.DirectionalLight(0xa9c1ff, 0.25);
    fill.position.set(20, 8, -6);
    scene.add(fill);

    // Glints: one star per jewel (plus the pallet stones), brightness per
    // point, additive and above the bloom threshold.
    const pts = jewels.concat([new T.Vector3(), new T.Vector3()]);
    const gPos = new Float32Array(pts.length * 3), gCol = new Float32Array(pts.length * 3);
    pts.forEach((v, i) => { gPos[i * 3] = v.x; gPos[i * 3 + 1] = v.y; gPos[i * 3 + 2] = v.z; });
    const gGeo = new T.BufferGeometry();
    gGeo.setAttribute('position', new T.BufferAttribute(gPos, 3));
    gGeo.setAttribute('color', new T.BufferAttribute(gCol, 3));
    const glintMat = new T.PointsMaterial({ size: 1.6, map: starTexture(T), vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, toneMapped: false, fog: false });
    const glints = new T.Points(gGeo, glintMat);
    glints.frustumCulled = false;
    glints.renderOrder = 10;
    scene.add(glints);

    const lens = kit.lens({ msaa: 4, motionBlurSamples: 6, dofSamples: 32 });
    lens.grade.split.value = 1;
    lens.grade.shadowTint.value.set(0.9, 0.95, 1.1);
    lens.grade.lift.value.set(0.003, 0.0022, 0.0018);
    lens.grade.vignette.value = 0.6;
    lens.grade.grain.value = 0.05;
    lens.grade.aberration.value = 0.003;
    lens.maxVelocity = 0.03;
    lens.farBlur = 0.85;
    lens.bloom.threshold = 4;

    // Where the macro lens goes: points of interest on the movement, visited
    // in a loop.
    const stations = [
      new T.Vector3(E.x + 0.4, 1.9, E.z - 0.1),
      new T.Vector3(BW.x - 0.3, 2.9, BW.z + 0.2),
      new T.Vector3((T3.x + F4.x) / 2, 2.1, (T3.z + F4.z) / 2),
      new T.Vector3(C.x - 0.8, 2.4, C.z + 1.4),
      new T.Vector3(B.x + 0.9, 3.0, B.z - 0.4),
      new T.Vector3((E.x + PL.x) / 2, 1.9, E.z + 0.3),
    ];

    return {
      T, scene, camera, lens, lamp, arbors, trains, phase, pal, bal, spring, ratchet, crown, glints, gCol, gPos,
      palletStones, jewelCount: jewels.length, stations, raycaster: new T.Raycaster(), world,
      v: new T.Vector3(), v2: new T.Vector3(), v3: new T.Vector3(), look: new T.Vector3(), up: new T.Vector3(0, 1, 0),
    };
  }

  // Catmull-Rom through the station loop, for a path with no corners.
  function loopPoint(out, pts, u) {
    const n = pts.length, i = Math.floor(u), f = u - i;
    const p0 = pts[((i - 1) % n + n) % n], p1 = pts[(i % n + n) % n], p2 = pts[((i + 1) % n + n) % n], p3 = pts[((i + 2) % n + n) % n];
    const f2 = f * f, f3 = f2 * f;
    for (const k of ['x', 'y', 'z']) {
      out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3);
    }
    return out;
  }

  // ------------------------------------------------------------------ scene
  VIZ.register({
    id: 'clockwork',
    name: 'Clockwork',
    order: 1007,
    requires: 'three',
    three: { addons: [] },
    finish: false,

    params: [
      { key: 'speed', label: 'Train speed', type: 'range', min: 0, max: 2, default: 0.6, step: 0.01 },
      { key: 'open', label: 'View: macro to whole movement', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'rack', label: 'Depth of field', type: 'range', min: 0, max: 1, default: 0.7, step: 0.01 },
      { key: 'amp', label: 'Balance swing', type: 'range', min: 0, max: 1, default: 0.6, step: 0.01 },
      { key: 'lamp', label: 'Lamp: tungsten to daylight', type: 'range', min: 0, max: 1, default: 0.3, step: 0.01 },
      { key: 'sweep', label: 'Lamp sweep', type: 'range', min: 0, max: 1, default: 0, step: 0.01 },
      { key: 'push', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Clockwork',
      technique: 'three.js 0.186.1 on the shared kit (web/three-kit.js). Wheels, pinions, bridges and the pallet fork are ExtrudeGeometry from generated 2D profiles (ogival teeth, a club-tooth escape wheel, convex-hull bridges) with chamfer bevels carrying a separate polished material; phases computed so every mesh runs tooth-in-gap off one escape-wheel angle. Finishes are anisotropic MeshPhysicalMaterial driven by generated direction maps: circular graining, sunburst, perlage and Côtes de Genève; heat-blued screws with iridescence, clearcoated ruby jewels on a leather bench. One shadow-casting spot lamp (PCF soft, redrawn every other frame) and a PMREM studio of soft boxes. The kit lens: 4x MSAA HDR, depth of field racked by raycast to real surfaces, bloom only on the jewel glints, split-tone grade, AgX.',
      brief: 'A macro lens drifting over an open watch movement on a leather bench: brass wheels, rhodium bridges with Geneva stripes and polished bevels, blued screws, rubies, the balance breathing on its hairspring under a warm lamp. The kick ticks the escapement (the escape wheel jumps a tooth, the pallet fork snaps over, the balance swings through); every other clap racks focus to another plane; hats glint single jewels; bass swings the balance wider and runs the train faster. On the drop the lens pulls up to the whole movement in its case, the train races, the ratchet winds and the lamp swings round so the shadows sweep.',
      lineage: 'Batch 07, "Rendered" (2026-09-29): the brief\'s Clockwork, a brass and steel mechanism with the depth of field racking between planes. After macro watch photography and the finishing vocabulary of Swiss haute horlogerie.',
    },

    setup(p, ctx) {
      this.R = build(ctx.three);
    },

    enter(p, ctx) {
      const r = ctx.three.renderer;
      r.shadowMap.enabled = true;
      r.shadowMap.type = ctx.three.THREE.PCFSoftShadowMap;
      this.lastMs = null;
      this.t = 0;
      this.env = { prevK: 0, b4: 0, prevS: 0, b8: 0, prevH: 0, bass: 0, low: 0, dropOn: false, auto: 0 };
      this.since = { kick: 9, snare: 9, hat: 9, tick: 0 };
      this.esc = 0; this.escTarget = 0;
      this.palSide = 1; this.palAng = 0.2;
      this.balPhase = 0; this.balTarget = 0; this.balAmp = 3.2;
      this.snares = 0; this.rackIdx = 0; this.focus = null; this.focusHit = 6; this.rayAge = 99;
      this.path = 2; this.azi = 0;
      this.hatN = 0;
      this.glint = new Float32Array(this.R.jewelCount + 2);
      this.palGlint = 0;
      this.ratchetAng = 0;
      this.lampAng = 0;
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    // One beat of the escapement: the escape wheel advances half a tooth,
    // the fork snaps to its other side, the balance gets its half swing.
    tick(size) {
      this.escTarget -= (TAU / 15) * 0.5 * size;
      this.palSide = -this.palSide;
      this.balTarget += Math.PI;
      this.palGlint = Math.min(1.4, this.palGlint + 0.9);
      this.since.tick = 0;
    },

    listen(s, dt, push, drop) {
      const e = this.env, since = this.since;
      since.kick += dt; since.snare += dt; since.hat += dt; since.tick += dt;
      const kRaw = clamp01(Math.max(0, s[0] - 0.45 * s[1]) / 50);
      if (kRaw > 0.3 && kRaw - e.prevK > 0.15 && since.kick > 0.2) {
        since.kick = 0;
        if (push > 0.05) this.tick(1 + 1.5 * drop);
      }
      e.prevK = kRaw;
      // No kick for a while: the watch keeps its own slower beat.
      if (since.tick > 0.9 && since.kick > 0.9) this.tick(1);

      e.b4 = s[4] > e.b4 ? ease(e.b4, s[4], 1.2, dt) : ease(e.b4, s[4], 8, dt);
      const sRaw = clamp01((s[4] - e.b4 - 12) / 55);
      if (sRaw > 0.4 && sRaw - e.prevS > 0.15 && since.snare > 0.22) {
        since.snare = 0;
        this.snares++;
        if (this.snares % 2 === 0 && push > 0.05) { this.rackIdx++; this.rayAge = 99; }
      }
      e.prevS = sRaw;

      e.b8 = s[8] > e.b8 ? ease(e.b8, s[8], 1.5, dt) : ease(e.b8, s[8], 8, dt);
      const hRaw = clamp01((s[8] - e.b8 - 6) / 55);
      if (hRaw > 0.25 && hRaw - e.prevH > 0.12 && since.hat > 0.07) {
        since.hat = 0;
        // A jewel the lens can see, so the sparkle always lands in frame.
        const R = this.R, seen = [];
        for (let i = 0; i < R.jewelCount; i++) {
          R.v.set(R.gPos[i * 3], R.gPos[i * 3 + 1], R.gPos[i * 3 + 2]).project(R.camera);
          if (R.v.z < 1 && Math.abs(R.v.x) < 0.85 && Math.abs(R.v.y) < 0.85) seen.push(i);
        }
        if (seen.length) {
          const j = seen[Math.floor(hash(++this.hatN * 1.618) * seen.length)];
          this.glint[j] = Math.min(1.5, this.glint[j] + (0.5 + 0.8 * hRaw) * push);
        }
      }
      e.prevH = hRaw;

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
      kit.renderer.shadowMap.enabled = true;
      this.frameN = (this.frameN || 0) + 1;
      this.R.lamp.shadow.needsUpdate = (this.frameN & 1) === 0 || this.frameN < 3;
      const push = params.push;
      const follow = Math.round(params.follow) === 1;
      const e = this.env;
      this.listen(signals, dt, push, e.auto);
      e.auto = ease(e.auto, follow && e.dropOn ? 1 : 0, e.dropOn ? 0.9 : 0.4, dt);
      const Pm = {};
      for (const key of DRIVE) Pm[key] = params[key] + (PRESETS.drop[key] - params[key]) * (follow ? e.auto : 0);
      this.t += dt;
      const t = this.t;

      // ---------------------------------------------------- the mechanism
      // The escape wheel leads; the train follows by its tooth counts.
      this.escTarget -= dt * Pm.speed * (0.35 + 1.2 * e.bass * push) * (1 + 2.5 * Pm.open);
      this.esc = ease(this.esc, this.escTarget, 38, dt);
      const A = R.arbors, ph = R.phase;
      const th = { escape: this.esc };
      th.fourth = -th.escape * 8 / 70;
      th.third = -th.fourth * 10 / 75;
      th.center = -th.third * 10 / 80;
      th.barrel = -th.center * 12 / 84;
      for (const key of ['center', 'third', 'fourth', 'escape']) {
        A[key].wheel.rotation.y = th[key] + ph[key].wheel;
        A[key].pinion.rotation.y = th[key] + ph[key].pinion;
      }
      A.barrel.g.rotation.y = th.barrel + ph.barrel.wheel;
      for (const list of R.trains) for (const w of list) w.mesh.rotation.y = th.escape * 0.35 * w.ratio + w.phase;
      this.palAng = ease(this.palAng, 0.17 * this.palSide, 30, dt);
      R.pal.rotation.y = this.palAng;
      const ampTarget = (0.55 + 0.55 * Pm.amp) * Math.PI * (0.8 + 0.5 * e.bass * push);
      this.balAmp = ease(this.balAmp, ampTarget, 2, dt);
      this.balPhase = ease(this.balPhase, this.balTarget, 7, dt);
      const bAng = this.balAmp * Math.cos(this.balPhase);
      R.bal.rotation.y = bAng;
      // The hairspring coils and uncoils with the swing.
      R.spring.rotation.y = bAng * 0.55;
      const breathe = 1 + 0.035 * Math.sin(this.balPhase) * Math.cos(this.balPhase) * this.balAmp / Math.PI;
      R.spring.scale.set(breathe, 1, breathe);
      // Winding: the ratchet turns while the rotor would be swinging (drop).
      this.ratchetAng += dt * (0.05 + 0.9 * Pm.open * (0.4 + e.bass * push));
      R.ratchet.rotation.y = this.ratchetAng;
      R.crown.rotation.y = -this.ratchetAng * 36 / 24 * 1.5;

      // --------------------------------------------------------- the lamp
      this.lampAng += dt * 0.25 * Pm.sweep;
      const la = -2.5 + 0.9 * Math.sin(this.lampAng) * Pm.sweep + this.lampAng * 0.25;
      R.lamp.position.set(29 * Math.cos(la), 26 - 4 * Pm.sweep, -29 * Math.sin(la));
      const lk = Pm.lamp;
      R.lamp.color.setRGB(lerp(1.0, 0.92, lk), lerp(0.74, 0.96, lk), lerp(0.48, 1.04, lk));

      // -------------------------------------------------------- the camera
      // Macro: a slow loop over the stations, orbiting a little round each.
      const stay = 1 / 14;
      this.path += dt * stay * (1 + 0.6 * e.bass * push);
      const tgt = loopPoint(R.v, R.stations, this.path);
      this.azi += dt * 0.06;
      const az = -0.9 + 0.8 * Math.sin(this.azi) + 0.25 * Math.sin(t * 0.07);
      const el = 0.62 + 0.14 * Math.sin(t * 0.051 + 1);
      const dist = 6.2 + 1.3 * Math.sin(t * 0.043);
      const macroPos = R.v2.set(tgt.x + dist * Math.cos(el) * Math.cos(az), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(el) * Math.sin(az));
      // Whole movement: high and wide, turning slowly.
      const wa = -1.1 + t * 0.03;
      const wide = R.v3.set(27 * Math.cos(0.9) * Math.cos(wa), 27 * Math.sin(0.9), 27 * Math.cos(0.9) * Math.sin(wa));
      const o = smooth(clamp01(Pm.open));
      const cam = R.camera;
      cam.position.lerpVectors(macroPos, wide, o);
      R.look.set(lerp(tgt.x, 0.8, o), lerp(tgt.y, 0.3, o), lerp(tgt.z, 0.4, o));
      cam.up.set(0, 1, 0);
      cam.lookAt(R.look);
      // A slight dutch that drifts, as a hand-held macro rig would.
      cam.rotateZ(0.05 * Math.sin(t * 0.09) * (1 - o));
      cam.fov = lerp(34, 40, o);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();

      // ------------------------------------------------------------ focus
      // Rack between real surfaces: every other clap picks the next of three
      // screen points and a ray finds what is there.
      this.rayAge += dt;
      if (this.rayAge > 0.25) {
        this.rayAge = 0;
        const spots = [[0, 0], [-0.3, -0.35], [0.35, 0.3]];
        const sp = spots[this.rackIdx % 3];
        R.raycaster.setFromCamera({ x: sp[0], y: sp[1] }, cam);
        const hit = R.raycaster.intersectObject(R.world, true)[0];
        this.focusHit = hit ? hit.distance : cam.position.distanceTo(R.look);
      }
      this.focus = this.focus == null ? this.focusHit : ease(this.focus, this.focusHit, 2.2, dt);

      // ------------------------------------------------------------ glints
      const gc = R.gCol, n = R.jewelCount;
      const decay = Math.exp(-dt / 0.14);
      for (let i = 0; i < n; i++) {
        this.glint[i] *= decay;
        const k = this.glint[i] * 22;
        gc[i * 3] = k * 1.0; gc[i * 3 + 1] = k * 0.82; gc[i * 3 + 2] = k * 0.7;
      }
      this.palGlint *= Math.exp(-dt / 0.1);
      R.palletStones.forEach((st, j) => {
        st.getWorldPosition(R.v);
        const i = n + j;
        R.gPos[i * 3] = R.v.x; R.gPos[i * 3 + 1] = R.v.y + 0.14; R.gPos[i * 3 + 2] = R.v.z;
        const k = this.palGlint * 9 * push;
        gc[i * 3] = k * 1.0; gc[i * 3 + 1] = k * 0.45; gc[i * 3 + 2] = k * 0.4;
      });
      R.glints.geometry.attributes.color.needsUpdate = true;
      R.glints.geometry.attributes.position.needsUpdate = true;
      R.glints.material.size = lerp(1.5, 3.5, o);

      // ------------------------------------------------------------ render
      const L = R.lens;
      L.focus = this.focus;
      L.blur = Pm.rack > 0.02 ? lerp(0.022 * (0.25 + Pm.rack), 0.004 * Pm.rack, o) : 0;
      L.shutter = 0.6;
      L.bloom.strength = 0.35;
      L.bloom.radius = 0.35;
      L.grade.highlightTint.value.set(lerp(1.06, 1.0, lk), lerp(1.0, 1.0, lk), lerp(0.9, 1.02, lk));
      L.render(R.scene, cam);
      kit.composite();
    },
  });
})();
