// The signature eye (harness/briefs/eyes.md): a registry of eye styles that any
// scene can draw with VIZ_EYES.get(id).draw(p, x, y, r, t, a, state, look).
// Styles live in web/motifs/eyes/<id>.js and are listed in eyes/manifest.js,
// which this file loads, so the app page and the render harness pick up a new
// style from one list instead of two sets of script tags.
(function () {
  var styles = [];
  var byId = {};
  var base = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/eyes\.js(\?.*)?$/, 'eyes/') : 'motifs/eyes/';
  })();

  function load(src) {
    var el = document.createElement('script');
    el.src = base + src;
    el.async = false;   // keep manifest order, so the gallery's grid is stable
    document.head.appendChild(el);
  }

  window.VIZ_EYES = {
    register: function (def) {
      if (!def || !def.id || byId[def.id]) return;
      byId[def.id] = def;
      styles.push(def);
    },
    list: function () { return styles.slice(); },
    get: function (id) { return byId[id] || null; },
    // Called by manifest.js with the style ids, in gallery order.
    manifest: function (ids) { ids.forEach(function (id) { load(id + '.js'); }); },
    // Shared blink: 0 open .. 1 shut. Each eye blinks on its own schedule
    // (state.nextBlink), roughly every 3-7 s, a 0.16 s close-and-open.
    blink: function (state, t) {
      if (state.nextBlink == null) state.nextBlink = t + 1 + Math.random() * 5;
      if (t > state.nextBlink + 0.16) state.nextBlink = t + 3 + Math.random() * 4;
      var u = (t - state.nextBlink) / 0.16;
      return u < 0 || u > 1 ? 0 : Math.sin(u * Math.PI);
    }
  };

  load('manifest.js');
})();
