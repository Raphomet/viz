// Scene collections for the browser (browser.js): how each scene was made.
// Membership lives here, not in the scene files, so a hundred and sixty
// scenes can be regrouped without touching them. An id listed in `ids` wins;
// otherwise the scene's `order` range decides (every brief assigns its batch
// an order block); a scene that fits neither lands in New, so nothing that
// registers is ever hidden.
window.VIZ_COLLECTIONS = (function () {
  'use strict';

  var list = [
    { id: 'originals', name: '2016 originals', about: 'The Processing set, ported' },
    { id: 'batch01', name: 'Batch 01', about: 'A technique plus a constraint' },
    { id: 'batch02', name: 'Batch 02', about: 'Spread wide: figurative and abstract' },
    { id: 'batch03', name: 'Batch 03', about: 'New directions, most of them travel' },
    { id: 'batch04', name: 'Batch 04', about: 'Daylight, matte, printed, made of a material' },
    { id: 'posters', name: 'Posters', about: 'Graphic design posters come to life' },
    { id: 'sketches', name: 'Raph’s sketches', about: 'Scenes Raph described himself' },
    { id: 'ideas', name: 'The panel’s ideas', about: 'Batch 06: the six judges’ 25 proposals' },
    { id: 'lexsan', name: 'LEXSAN studies', about: 'After the LEXSAN set' },
    { id: 'rendered', name: 'Rendered', about: 'Batch 07: three.js, light decides colour' },
    {
      id: 'libraries', name: 'Library experiments', about: 'Batch 08: working with the medium',
      // Five sketches per library (harness/briefs/batch-08-libraries.md).
      parts: [
        { from: 1101, to: 1105, name: 'Rough.js' },
        { from: 1106, to: 1110, name: 'GSAP' },
        { from: 1111, to: 1115, name: 'Lottie' },
        { from: 1116, to: 1120, name: 'WebGPU compute' },
        { from: 1121, to: 1125, name: 'MediaPipe' }
      ]
    },
    { id: 'spikes', name: 'Spikes', about: 'Technical probes, not finished scenes' },
    { id: 'new', name: 'New', about: 'Not yet filed in web/collections.js' }
  ];

  // Scenes whose order block says one thing and whose making says another.
  var ids = {
    // Thresholds was brief 11 of batch 03, but it is Raph's own sketch.
    thresholds: 'sketches',
    cube: 'sketches', isocity: 'sketches', chomper: 'sketches', stamps: 'sketches',
    ophanim: 'sketches', solids: 'sketches', evadash: 'sketches', fourd: 'sketches', eyes: 'sketches',
    pinwheel: 'lexsan', tear: 'lexsan', graphicobjects: 'lexsan', swarmpattern: 'lexsan', collage: 'lexsan',
    rendered: 'spikes', typegeo: 'spikes', _selftest: 'spikes'
  };

  // A V2 files under its family, so its own id and order never decide. Only
  // when its original failed to load does it stand alone; then it files where
  // the original would have, not under New.
  function viaFamily(def) {
    return def && typeof def.versionOf === 'string' && def.versionOf !== def.id ? def.versionOf : null;
  }

  // The originals' orders, for a V2 whose original did not load this time.
  var v1Orders = {
    text: 1, arcs: 2, rings: 3, jags: 4, parametric: 5, toph: 6, planets: 7, flyover: 8, dotmatrix: 9,
    current: 102, attractor: 104, interference: 106, murmuration: 208, sumi: 302, scanlines: 304,
    chladni: 305, physarum: 306, zen: 405, koi: 404, grunge: 503, vorticism: 506, lowpoly: 520
  };

  var ranges = [
    { from: 1, to: 99, id: 'originals' },
    { from: 100, to: 199, id: 'batch01' },
    { from: 200, to: 299, id: 'batch02' },
    { from: 300, to: 399, id: 'batch03' },
    { from: 400, to: 499, id: 'batch04' },
    { from: 500, to: 599, id: 'posters' },
    { from: 600, to: 699, id: 'sketches' },
    // 700s are V2 redesigns, which file under their original's family.
    { from: 800, to: 829, id: 'ideas' },
    { from: 830, to: 899, id: 'lexsan' },
    { from: 900, to: 999, id: 'spikes' },
    { from: 1001, to: 1099, id: 'rendered' },
    { from: 1101, to: 1199, id: 'libraries' }
  ];

  // `order` is passed separately because a scene may reuse this.order for its
  // own state once running (Abyss does); the browser records it at register.
  function of(def, order, originalOrder) {
    if (def && Object.prototype.hasOwnProperty.call(ids, def.id)) return ids[def.id];
    var fam = viaFamily(def);
    if (fam) {
      if (Object.prototype.hasOwnProperty.call(ids, fam)) return ids[fam];
      if (originalOrder !== undefined) return of({ id: fam }, originalOrder);
      if (Object.prototype.hasOwnProperty.call(v1Orders, fam)) return of({ id: fam }, v1Orders[fam]);
    }
    var o = Number(order !== undefined ? order : def && def.order);
    for (var i = 0; i < ranges.length; i++) if (o >= ranges[i].from && o <= ranges[i].to) return ranges[i].id;
    return 'new';
  }

  function partOf(def, collectionId, order) {
    var c = list.filter(function (x) { return x.id === collectionId; })[0];
    var o = Number(order !== undefined ? order : def && def.order);
    return c && c.parts ? c.parts.filter(function (p) { return o >= p.from && o <= p.to; })[0] || null : null;
  }

  return { list: list, ids: ids, ranges: ranges, of: of, partOf: partOf };
})();
