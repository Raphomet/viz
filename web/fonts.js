// Poster-series typefaces. The Google Fonts stylesheet in index.html only
// declares them; browsers fetch a web font the first time something uses it,
// and canvas text drawn before then silently falls back to a system face. So
// this asks for every family up front, and exposes a promise the render
// harness waits on so its frames are deterministic.
(function () {
  var families = [
    'Anton', 'Archivo Black', 'Bebas Neue', 'Abril Fatface', 'Playfair Display',
    'Rye', 'Special Elite', 'Monoton', 'Yellowtail', 'Russo One', 'Bungee',
    'Rubik Mono One', 'Major Mono Display', 'Unica One', 'Oswald',
    'Libre Baskerville', 'Space Mono', 'Syne', 'Alfa Slab One', 'Josefin Sans'
  ];
  var loads = [];
  if (document.fonts && document.fonts.load) {
    families.forEach(function (f) {
      // Bold and regular are separate files for the families that have both.
      loads.push(document.fonts.load('400 40px "' + f + '"').catch(function () {}));
      loads.push(document.fonts.load('700 40px "' + f + '"').catch(function () {}));
    });
  }
  // Never hold the page hostage to the network: after 6 s, go with what we have.
  var timeout = new Promise(function (r) { setTimeout(r, 6000); });
  window.VIZ_FONTS = {
    families: families,
    ready: Promise.race([Promise.all(loads), timeout]),
    // True once a family can draw; scenes can use it to avoid a fallback flash.
    has: function (f) { return !!(document.fonts && document.fonts.check('40px "' + f + '"')); }
  };
})();
