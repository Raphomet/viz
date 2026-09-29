// Night Market — a slow tram ride down a night-market street.
//
// Batch 06, idea 17 (the Floor and the Psychonaut): Expressway, Diner and
// Night Train, with the Psychonaut's Vein City (Physarum) as the alternative.
// This is the Floor's tram ride. Vein City is a different scene (an aerial
// slime map) and would repeat Physarum, where the tram ride carries the
// panel's single strongest finding: Expressway's drop is a *place* you can
// see coming and then enter. Here that place is a covered market arcade, lit
// in tungsten instead of Expressway's rainbow neon, as the Floor asked.
//
// Layers, back to front: night sky with a low moon and a far skyline at the
// end of the street; the wet street (setts, tram rails, the tram's headlight
// pool, and the mirrored streaks of every lit sign and lantern); facades on
// both sides with lit shopfronts, awnings and upper windows; food stalls with
// canopies, bare bulbs, customers and steam; blade signs (flat lightboxes and
// neon tubes on dark panels) projecting over the pavement; strings of paper
// lanterns across the street; the tram's overhead wire. On the drop the tram
// runs through a gate into a covered arcade: a vaulted roof on ribs traced
// with bare bulbs, lanterns hanging on long cords, cloth banners.
//
// The music:
//   kick   swings ONE lantern (the nearest good one on alternating sides): a
//          real pendulum with its own cord length, and a brief warm flare of
//          that lantern's light. Its reflection in the wet street swings too.
//          Nothing else moves on the kick.
//   clap   a stall's wok flares and throws up a burst of steam, on the
//          pavement a little way ahead.
//   hats   a few neon tubes stutter.
//   bass   the tram's speed.
//   build  (Follow) the arcade gate appears at the end of the street and the
//          street begins to light; if the drop is late the tram slows at the
//          gate and waits.
//   drop   the tram surges through the gate into the arcade; every lantern
//          lights, the teal and pink neon comes on, the steam thickens. The
//          breakdown rolls out through the far gate into the open street and
//          the lights go down one by one.
//
// Craft notes:
// - Plain Canvas 2D in one-point perspective: the street is an endless run of
//   3 m slots whose content is a pure hash of the slot index, drawn far to
//   near, so nothing is ever sorted. Signs, lanterns and glows are sprites
//   drawn once at setup (lit and unlit), so a frame is a few hundred
//   drawImage and path fills.
// - Light is structured, not a wash: lightboxes are flat colour, neon has a
//   tight baked halo, and the only additive light is small (bulbs, lantern
//   cores). No full-frame bloom, no global flash.
// - The arcade is a list of ranges along the street. A new range fades in
//   over a second at 50 m, in fog, so the gate never pops.

(function () {
  const SLOT = 3;          // metres of street per slot
  const ZMAX = 78;         // draw distance
  const NEAR = 0.7;        // near clip
  const EYE = 2.3;         // tram driver's eye height
  const WALL = 7;          // facade plane
  const CURB = 5;
  const GAUGE = 0.72;      // half the rail gauge
  const SPRING = 6.2;      // arcade rib springing height at the walls
  const CROWN = 9.0;       // arcade rib crown
  const RIB_N = 14;        // points along a rib
  const PPM = 80;          // sign sprite pixels per metre
  const SIGN_W = 1.3;      // blade sign width, metres

  const PRESETS = {
    calm: { speed: 0.45, arcade: 0, lanterns: 0.45, neon: 0.35, steam: 0.8, wet: 0.6 },
    drop: { speed: 0.95, arcade: 1, lanterns: 1, neon: 1, steam: 1.3, wet: 0.7 },
    // The arcade at walking pace: a slow drift under the bulbs.
    arcade: { speed: 0.3, arcade: 1, lanterns: 0.85, neon: 0.7, steam: 1.1, wet: 0.5, follow: 0 },
    // The last tram home: nearly everything shut, steam and puddles.
    lasttram: { speed: 0.22, arcade: 0, lanterns: 0.18, neon: 0.1, steam: 1.5, wet: 0.95, follow: 0 },
  };
  // What the drop changes, and so what "Follow the track" eases.
  const DRIVE = ['speed', 'arcade', 'lanterns', 'neon', 'steam', 'wet'];

  // Colours. One night blue, one tungsten, lantern red, and two neon accents
  // (teal, pink) that only the drop fully lights.
  const C = {
    skyTop: [7, 9, 26], skyLow: [30, 24, 52], haze: [58, 36, 52],
    fogOpen: [24, 19, 40], fogArc: [44, 28, 20],
    ground: [14, 11, 17], pave: [30, 25, 30],
    roof: [56, 36, 26], rib: [22, 14, 11], gate: [70, 22, 20],
    moon: [238, 226, 196],
    bulb: [255, 214, 150],
  };
  const FACADES = [[58, 42, 44], [46, 42, 52], [68, 48, 40], [42, 48, 48], [62, 50, 48], [52, 36, 40]];
  const SHOPS = [[233, 176, 97], [242, 201, 138], [217, 138, 74], [234, 215, 176], [226, 160, 90]];
  const AWNINGS = [[168, 44, 36], [40, 110, 100], [196, 140, 52], [120, 40, 60], [214, 196, 160]];
  const WINDOWS = [[217, 164, 94], [217, 164, 94], [125, 149, 184], [181, 82, 62]];
  const WORDS = ['NOODLES', 'DUMPLING', 'HOT POT', 'TEA', 'GRILL', 'LUCKY', 'BAO', 'SOUP', 'RAMEN', 'OPEN',
    'KARAOKE', 'FORTUNE', 'CANDY', 'LOTUS', 'JADE', 'ROAST', 'BARBER', 'HOTEL', 'FISH', 'RICE', 'MOON',
    'LATE', 'PEARL', 'CLAY POT'];
  const GATES = [['LANTERN ROW', 'COVERED MARKET · OPEN ALL NIGHT'], ['MOON GATE ARCADE', 'SIXTY STALLS UNDER ONE ROOF'],
    ['RED THREAD MARKET', 'NOODLES · TEA · GAMES · LUCK'], ['SEVEN LUCKS ARCADE', 'EST. LONG AGO · NEVER CLOSED']];
  const BANNER_WORDS = ['FEAST', 'LUCK', 'NIGHT', 'JOY', 'TEA', 'SPRING'];
  // Sign kinds. 0–4 are warm and light first; 5–7 are the drop's colours.
  //   0 cream box, red letters · 1 red box, cream · 2 amber box, dark
  //   3 tungsten neon · 4 red neon · 5 teal neon · 6 pink neon · 7 teal box
  const KINDS = 8;
  const SIGN_H = [2.6, 3.4, 4.2];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
  function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function hash(i, k) { const x = Math.sin(i * 127.1 + k * 311.7 + 17.3) * 43758.5453; return x - Math.floor(x); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) {
    return a === undefined ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
      : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
  }
  function face(fam, fallback) {
    const ok = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has(fam);
    return (ok ? '"' + fam + '", ' : '') + fallback;
  }

  // ---------------------------------------------------------------- sprites
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

  function glowSprite(col, soft) {
    const n = 96, c = canvas(n, n), g = c.getContext('2d');
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, css(col, 1));
    gr.addColorStop(soft ? 0.35 : 0.18, css(col, soft ? 0.45 : 0.55));
    gr.addColorStop(0.6, css(col, 0.1));
    gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    return c;
  }

  function steamSprite() {
    const n = 64, c = canvas(n, n), g = c.getContext('2d');
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(246,232,214,0.55)');
    gr.addColorStop(0.5, 'rgba(236,220,204,0.25)');
    gr.addColorStop(1, 'rgba(230,214,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    return c;
  }

  // A paper lantern: ribbed body, dark caps, a tassel. Lit or unlit.
  function lanternSprite(cream, lit) {
    const s = 120, w = 0.7 * s, h = 0.95 * s, pad = 10;
    const c = canvas(w + pad * 2, h + pad * 2 + 30), g = c.getContext('2d');
    const cx = pad + w / 2, cy = pad + h / 2;
    const bodyR = w / 2, bodyH = h / 2 - 8;
    const core = cream ? (lit ? [255, 244, 214] : [120, 104, 86]) : (lit ? [255, 186, 96] : [96, 30, 26]);
    const mid = cream ? (lit ? [246, 214, 160] : [96, 82, 68]) : (lit ? [226, 70, 44] : [70, 22, 20]);
    const edge = cream ? (lit ? [190, 140, 92] : [60, 50, 42]) : (lit ? [140, 28, 22] : [44, 14, 14]);
    g.save();
    g.beginPath(); g.ellipse(cx, cy, bodyR, bodyH, 0, 0, Math.PI * 2); g.clip();
    const gr = g.createRadialGradient(cx, cy + 4, 2, cx, cy, bodyR * 1.15);
    gr.addColorStop(0, css(core)); gr.addColorStop(0.55, css(mid)); gr.addColorStop(1, css(edge));
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    // ribs: horizontal bamboo hoops, curved like the lantern's surface
    g.strokeStyle = css(mix(edge, [0, 0, 0], 0.35), 0.6); g.lineWidth = 1.3;
    for (let k = -3; k <= 3; k++) {
      const y = cy + k * bodyH / 3.6;
      g.beginPath(); g.ellipse(cx, y, bodyR, 3.5, 0, 0, Math.PI); g.stroke();
    }
    if (cream) {
      // a red stamp, an invented seal mark
      g.fillStyle = lit ? 'rgba(196,40,30,0.85)' : 'rgba(80,24,20,0.8)';
      g.beginPath(); g.arc(cx, cy, bodyR * 0.36, 0, Math.PI * 2); g.fill();
      g.strokeStyle = lit ? 'rgba(255,236,200,0.9)' : 'rgba(110,96,80,0.8)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(cx - 8, cy - 6); g.lineTo(cx + 8, cy - 6); g.moveTo(cx, cy - 12); g.lineTo(cx, cy + 12);
      g.moveTo(cx - 7, cy + 6); g.lineTo(cx + 7, cy + 6); g.stroke();
    }
    g.restore();
    // caps
    g.fillStyle = '#20150e';
    g.fillRect(cx - bodyR * 0.52, pad - 1, bodyR * 1.04, 12);
    g.fillRect(cx - bodyR * 0.52, pad + h - 11, bodyR * 1.04, 12);
    // tassel
    g.strokeStyle = cream ? '#9a2a20' : '#b8332a'; g.lineWidth = 1.4;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(cx + k * 1.4, pad + h + 1); g.lineTo(cx + k * 2.2, pad + h + 26); g.stroke(); }
    return { c, w: c.width / s, h: c.height / s, ox: cx / s, oy: pad / s };  // metres; (ox, oy) is the hanging point
  }

  // Tube icons for the neon signs.
  function neonIcon(g, kind, x, y, r) {
    g.beginPath();
    if (kind === 0) {        // a bowl with chopsticks and steam
      g.moveTo(x - r, y); g.lineTo(x + r, y); g.arc(x, y, r, 0, Math.PI, false);
      g.moveTo(x + r * 0.2, y - r * 0.2); g.lineTo(x + r * 1.1, y - r * 1.1);
      g.moveTo(x + r * 0.45, y - r * 0.1); g.lineTo(x + r * 1.3, y - r * 0.85);
      g.moveTo(x - r * 0.4, y - r * 0.3); g.bezierCurveTo(x - r * 0.1, y - r * 0.6, x - r * 0.7, y - r * 0.9, x - r * 0.4, y - r * 1.3);
    } else if (kind === 1) { // a carp
      g.ellipse(x - r * 0.15, y, r * 0.75, r * 0.42, 0, 0, Math.PI * 2);
      g.moveTo(x + r * 0.6, y); g.lineTo(x + r * 1.1, y - r * 0.45); g.lineTo(x + r * 1.1, y + r * 0.45); g.closePath();
      g.moveTo(x - r * 0.55 + 3, y - r * 0.08); g.arc(x - r * 0.55, y - r * 0.08, 3, 0, Math.PI * 2);
    } else if (kind === 2) { // a teacup
      g.moveTo(x - r * 0.8, y - r * 0.5); g.lineTo(x + r * 0.6, y - r * 0.5); g.lineTo(x + r * 0.4, y + r * 0.5); g.lineTo(x - r * 0.6, y + r * 0.5); g.closePath();
      g.moveTo(x + r * 0.55, y - r * 0.25); g.arc(x + r * 0.72, y - r * 0.02, r * 0.26, -Math.PI / 2, Math.PI / 2);
      g.moveTo(x - r * 1.0, y + r * 0.72); g.lineTo(x + r * 0.8, y + r * 0.72);
    } else {                 // a crescent moon and a star
      g.arc(x - r * 0.2, y, r * 0.8, Math.PI * 0.35, Math.PI * 1.65, false);
      g.arc(x + r * 0.1, y, r * 0.62, Math.PI * 1.55, Math.PI * 0.45, true);
      const sx = x + r * 0.55, sy = y - r * 0.5, sr = r * 0.28;
      g.moveTo(sx, sy - sr); g.lineTo(sx, sy + sr); g.moveTo(sx - sr, sy); g.lineTo(sx + sr, sy);
    }
  }

  // A blade sign, lit and unlit. Returns sprite canvases at PPM px/m with a
  // halo pad; (pad, pad) is the sign's top-left.
  function signSprite(kind, hM, word, seed) {
    const w = SIGN_W * PPM, h = hM * PPM, pad = 14;
    const out = {};
    const neon = kind >= 3 && kind <= 6;
    const TUBE = { 3: [255, 206, 138], 4: [255, 84, 64], 5: [70, 228, 204], 6: [255, 108, 160] };
    const BOX = { 0: [[240, 226, 194], [168, 34, 27]], 1: [[200, 48, 42], [252, 234, 200]], 2: [[238, 164, 52], [42, 21, 18]], 7: [[46, 178, 160], [12, 24, 26]] };
    const letters = word.replace(/ /g, '').split('');
    for (const lit of [0, 1]) {
      const c = canvas(w + pad * 2, h + pad * 2), g = c.getContext('2d');
      g.translate(pad, pad);
      // metal frame
      g.fillStyle = lit ? '#2a2226' : '#161216';
      g.fillRect(-3, -3, w + 6, h + 6);
      const iconH = neon ? w * 0.9 : 0;
      const top = neon ? iconH + 6 : 10, bot = h - 10;
      const step = (bot - top) / letters.length;
      const fs = Math.min(step * 0.92, w * 0.78);
      if (!neon) {
        const [bc, tc] = BOX[kind];
        g.fillStyle = css(lit ? bc : mix(bc, [10, 8, 10], 0.78));
        g.fillRect(0, 0, w, h);
        if (lit) {
          const gr = g.createLinearGradient(0, 0, w, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
        }
        g.strokeStyle = css(lit ? tc : mix(tc, [10, 8, 10], 0.75)); g.lineWidth = 3;
        g.strokeRect(6, 6, w - 12, h - 12);
        g.fillStyle = css(lit ? tc : mix(tc, [10, 8, 10], 0.75));
        g.font = '400 ' + fs.toFixed(1) + 'px ' + face('Bebas Neue', 'Impact, sans-serif');
        g.textAlign = 'center'; g.textBaseline = 'middle';
        letters.forEach((ch, k) => g.fillText(ch, w / 2, top + step * (k + 0.5) + fs * 0.04));
      } else {
        g.fillStyle = lit ? '#1b1318' : '#110d10';
        g.fillRect(0, 0, w, h);
        const tube = TUBE[kind];
        // The halo is two wide faint strokes rather than shadowBlur, which is
        // slow enough on a software canvas to stall the first frame.
        const passes = lit ? [[11, css(tube, 0.1)], [7, css(tube, 0.2)], [4.2, css(tube)], [1.6, css(mix(tube, [255, 255, 255], 0.55))]] : [[3.2, '#34292e']];
        for (const [lw, col] of passes) {
          g.save();
          g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round';
          g.strokeRect(7, 7, w - 14, h - 14);
          neonIcon(g, Math.floor(seed * 4), w / 2 - 4, iconH * 0.62, w * 0.26);
          g.stroke();
          g.font = '400 ' + fs.toFixed(1) + 'px ' + face('Oswald', 'Arial Narrow, sans-serif');
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = lw * 0.8;
          letters.forEach((ch, k) => g.strokeText(ch, w / 2, top + step * (k + 0.5)));
          g.restore();
        }
      }
      out[lit ? 'on' : 'off'] = c;
    }
    out.pad = pad / PPM;
    out.h = hM;
    out.neon = neon;
    out.kind = kind;
    out.tube = neon ? TUBE[kind] : BOX[kind][0];
    return out;
  }

  // The arcade's name board: a long lightbox with a tube border.
  function gateSprite(name, sub, lit) {
    const ppm = 70, w = 9 * ppm, h = 1.6 * ppm, pad = 12;
    const c = canvas(w + pad * 2, h + pad * 2), g = c.getContext('2d');
    g.translate(pad, pad);
    g.fillStyle = '#1a1012'; g.fillRect(-4, -4, w + 8, h + 8);
    g.fillStyle = lit ? '#efe0bd' : '#3a3228'; g.fillRect(0, 0, w, h);
    g.fillStyle = lit ? '#a8221b' : '#40201c';
    g.font = '400 ' + (h * 0.62).toFixed(0) + 'px ' + face('Bebas Neue', 'Impact, sans-serif');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name.split('').join(String.fromCharCode(8202)), w / 2, h * 0.42);
    g.font = '400 ' + (h * 0.16).toFixed(0) + 'px ' + face('Oswald', 'Arial Narrow, sans-serif');
    g.fillStyle = lit ? '#3a2a24' : '#2a221e';
    g.fillText(sub, w / 2, h * 0.82);
    g.save();
    if (lit) { g.strokeStyle = 'rgba(70,228,204,0.18)'; g.lineWidth = 9; g.strokeRect(-7, -7, w + 14, h + 14); }
    g.strokeStyle = lit ? 'rgb(70,228,204)' : '#2e3432'; g.lineWidth = 3;
    g.strokeRect(-7, -7, w + 14, h + 14);
    g.restore();
    return { c, pad: pad / ppm, w: 9, h: 1.6 };
  }

  function bannerSprite(word, col) {
    const ppm = 60, w = 0.7 * ppm, h = 2.2 * ppm;
    const c = canvas(w, h + 8), g = c.getContext('2d');
    g.fillStyle = '#20150e'; g.fillRect(-2, 0, w + 4, 5);
    g.fillStyle = css(col);
    g.beginPath(); g.moveTo(0, 4); g.lineTo(w, 4); g.lineTo(w, h); g.lineTo(w / 2, h - 10); g.lineTo(0, h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(250,236,210,0.92)';
    const letters = word.split(''), step = (h - 30) / letters.length, fs = Math.min(step * 0.9, w * 0.8);
    g.font = '400 ' + fs.toFixed(1) + 'px ' + face('Bebas Neue', 'Impact, sans-serif');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    letters.forEach((ch, k) => g.fillText(ch, w / 2, 14 + step * (k + 0.5)));
    return c;
  }

  // ---------------------------------------------------------------- scene
  let F = 372, CX = 0, HY = 0, CAMZ = 0, CAMX = 0, FOG = C.fogOpen, G = null, ALPHA = 1;

  function sx(x, z) { return CX + (x - CAMX) * F / (z - CAMZ); }
  function sy(y, z) { return HY - (y - EYE) * F / (z - CAMZ); }
  function fogAt(d) { return 1 - Math.exp(-d / 40); }
  function lightFog(d) { return Math.exp(-d / 70); }
  function poly(pts, fill) {
    G.beginPath();
    G.moveTo(sx(pts[0][0], pts[0][2]), sy(pts[0][1], pts[0][2]));
    for (let k = 1; k < pts.length; k++) G.lineTo(sx(pts[k][0], pts[k][2]), sy(pts[k][1], pts[k][2]));
    G.closePath();
    G.fillStyle = fill; G.fill();
  }
  // A rectangle in the plane x = X, spanning z1..z2 and y1..y2.
  function wallRect(X, z1, z2, y1, y2, fill) { poly([[X, y1, z1], [X, y1, z2], [X, y2, z2], [X, y2, z1]], fill); }
  // A rectangle facing the camera at depth z.
  function faceRect(x1, x2, y1, y2, z, fill) {
    const a = sx(x1, z), b = sx(x2, z), c = sy(y2, z), d = sy(y1, z);
    G.fillStyle = fill; G.fillRect(Math.min(a, b), c, Math.abs(b - a), d - c);
  }
  function sprite(img, x1, x2, y1, y2, z, alpha) {
    if (alpha <= 0.004) return;
    const a = sx(x1, z), b = sx(x2, z), c = sy(y2, z), d = sy(y1, z);
    G.globalAlpha = alpha * ALPHA;
    G.drawImage(img, Math.min(a, b), c, Math.abs(b - a), d - c);
    G.globalAlpha = ALPHA;
  }
  function glowAt(img, x, y, z, rM, alpha) {
    if (alpha <= 0.004) return;
    const d = z - CAMZ; if (d < NEAR) return;
    const r = rM * F / d, X = sx(x, z), Y = sy(y, z);
    G.globalAlpha = alpha * ALPHA;
    G.drawImage(img, X - r, Y - r, r * 2, r * 2);
    G.globalAlpha = ALPHA;
  }
  function ribY(x) { const u = clamp(Math.abs(x) / WALL, 0, 1); return SPRING + (CROWN - SPRING) * Math.sqrt(1 - u * u); }
  function ribPts(z) {
    const pts = [];
    for (let k = 0; k <= RIB_N; k++) {
      const a = Math.PI * k / RIB_N;
      pts.push([-WALL * Math.cos(a), SPRING + (CROWN - SPRING) * Math.sin(a), z]);
    }
    return pts;
  }

  VIZ.register({
    id: 'nightmarket',
    name: 'Night Market',
    order: 817,

    params: [
      { key: 'speed', label: 'Tram speed', type: 'range', min: 0, max: 2, default: PRESETS.calm.speed, step: 0.01 },
      { key: 'arcade', label: 'Covered arcade (¼: gate ahead · ½: ride in)', type: 'range', min: 0, max: 1, default: PRESETS.calm.arcade, step: 0.01 },
      { key: 'lanterns', label: 'Lanterns lit', type: 'range', min: 0, max: 1, default: PRESETS.calm.lanterns, step: 0.01 },
      { key: 'neon', label: 'Signs lit (teal and pink last)', type: 'range', min: 0, max: 1, default: PRESETS.calm.neon, step: 0.01 },
      { key: 'steam', label: 'Steam', type: 'range', min: 0, max: 2, default: PRESETS.calm.steam, step: 0.01 },
      { key: 'wet', label: 'Wet street', type: 'range', min: 0, max: 1, default: PRESETS.calm.wet, step: 0.01 },
      { key: 'react', label: 'Lantern swing (kick)', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Night Market',
      technique: 'Canvas 2D in one-point perspective: an endless street of 3 m slots hashed from their index and drawn far to near (facades, shopfronts, awnings, stalls with canopies and customers, blade signs, lantern strings on catenaries, the tram wire), sprites baked once at setup for lit and unlit lightboxes, neon tube signs with a tight halo, paper lanterns and glows; wet-street reflections as mirrored sprites; lanterns are damped pendulums; steam is a small world-space particle system; the arcade is a list of ranges along the street with an arched gate, bulb-traced ribs and roof panels; onset detection and a section follower in JS',
      brief: 'A slow tram ride at night down a market street of lightbox and neon blade signs, food stalls breathing steam and strings of red and cream paper lanterns, all mirrored in the wet setts. Kick: one lantern swings on its cord and flares, alternating sides, and its reflection swings with it. Clap: a stall\'s wok flares and throws up a burst of steam. Hats: a few neon tubes stutter. Bass: the tram\'s speed. Build: the gate of a covered arcade appears at the end of the street and the lights begin to come on. Drop: the tram surges through the gate into a vaulted arcade whose ribs are traced with bare bulbs, every lantern lit and the teal and pink neon on. Breakdown: out through the far gate into the open street as the lights go down one by one.',
      lineage: [
        'Batch 06, idea 17 (the Floor and the Psychonaut): Expressway, Diner and Night Train; Physarum for the Psychonaut\'s Vein City.',
        'Of the two proposals, the Floor\'s tram ride over the Psychonaut\'s Vein City: the panel\'s strongest finding was that Expressway\'s drop is a place you see coming and then enter, and a gate into a lit arcade is that, in tungsten instead of Expressway\'s rainbow tunnel; Vein City would largely repeat Physarum from the air.',
        'Expressway (web/scenes/expressway.js): the tunnel mouth seen before the drop, entered on it and left at the breakdown.',
        'Diner (web/scenes/diner.js): neon over a wet ground; here the neon is one accent among flat lightboxes, and the drop changes the place, not only the saturation.',
        'Night Train (web/scenes/nighttrain.js): the tracking shot from a vehicle, and a kick that is one local event (a lantern) rather than the frame.',
        'Night markets and covered shopping arcades (shotengai) of East Asian cities; the signage wording is invented.',
      ],
    },

    setup() {},
    enter() { this.reset(); },

    reset() {
      this.lastMs = null;
      this.clock = 0;
      this.camZ = 0;
      this.v = 2.5;
      this.slots = new Map();
      this.ranges = [];
      this.gateN = 0;
      this.inside = 0;
      this.swing = new Map();
      this.cands = [];
      this.lastSide = 1;
      this.puffs = [];
      this.emit = [];
      this.flames = [];
      this.env = { kf: 0, ks: 0, kArm: true, cf: 0, cs: 0, cArm: true, bass: 0, hat: 0, rise: 0,
        low: 0, dropOn: false, buildOn: false, auto: 0, lastK: -9, lastC: -9 };
    },

    makeSprites() {
      const fontsOk = typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has('Bebas Neue') && VIZ_FONTS.has('Oswald');
      this.signs = [];
      let n = 0;
      for (let hI = 0; hI < SIGN_H.length; hI++) {
        for (let k = 0; k < KINDS; k++) {
          this.signs.push(signSprite(k, SIGN_H[hI], WORDS[n % WORDS.length], hash(n, 5)));
          n++;
        }
      }
      this.lant = { red: [lanternSprite(false, 0), lanternSprite(false, 1)], cream: [lanternSprite(true, 0), lanternSprite(true, 1)] };
      this.glowWarm = glowSprite([255, 180, 100], true);
      this.glowRed = glowSprite([255, 110, 60], true);
      this.glowBulb = glowSprite(C.bulb, false);
      this.glowFlame = glowSprite([255, 140, 50], false);
      this.steamImg = steamSprite();
      this.streak = [];
      for (let k = 0; k < KINDS; k++) this.streak.push(glowSprite(this.signs[k].tube, true));
      this.gates = GATES.map(([a, b]) => [gateSprite(a, b, 0), gateSprite(a, b, 1)]);
      this.banners = BANNER_WORDS.map((w, k) => bannerSprite(w, AWNINGS[k % 4]));
      this.spritesFonted = fontsOk;
    },

    // The content of one slot: a pure function of its index.
    slot(i) {
      let s = this.slots.get(i);
      if (s) return s;
      s = { i, side: [] };
      for (let q = 0; q < 2; q++) {
        const sg = q ? 1 : -1;
        const b = Math.floor((i + q * 1.5) / 3);
        const hb = hash(b, 11 + q);
        const side = {
          s: sg,
          h: 6.5 + 9 * hb * hb,
          col: FACADES[Math.floor(hash(b, 13 + q) * FACADES.length)],
          shop: hash(i, 20 + q) < 0.82 ? SHOPS[Math.floor(hash(i, 22 + q) * SHOPS.length)] : null,
          fascia: AWNINGS[Math.floor(hash(i, 24 + q) * AWNINGS.length)],
          awning: hash(i, 26 + q) < 0.45 ? AWNINGS[Math.floor(hash(i, 28 + q) * AWNINGS.length)] : null,
          stall: hash(i, 30 + q) < 0.42,
          person: hash(i, 32 + q) < 0.6,
          personH: 1.55 + 0.25 * hash(i, 34 + q),
          sign: null, win: [],
          steamer: hash(i, 38 + q) < 0.5,
        };
        if (hash(i, 40 + q) < 0.62) {
          const kind = Math.floor(hash(i, 42 + q) * KINDS);
          const hi = Math.floor(hash(i, 44 + q) * 3);
          const cool = kind >= 5;
          side.sign = {
            spr: this.signs[hi * KINDS + kind],
            y0: 3.7 + 1.6 * hash(i, 46 + q),
            th: cool ? 0.5 + 0.45 * hash(i, 48 + q) : 0.04 + 0.62 * hash(i, 48 + q),
            id: i * 2 + q,
          };
        }
        const floors = Math.max(0, Math.floor((side.h - 3.9) / 2.8));
        for (let f = 0; f < floors; f++) {
          for (let w = 0; w < 2; w++) {
            const r = hash(i * 7 + f, 50 + q * 2 + w);
            side.win.push({ y: 3.9 + f * 2.8 + 0.5, z: 0.35 + w * 1.4, lit: r < 0.34, col: WINDOWS[Math.floor(hash(i + f, 60 + w) * WINDOWS.length)] });
          }
        }
        s.side.push(side);
      }
      if (hash(i, 70) < 0.55) {
        const n = 6 + Math.floor(hash(i, 71) * 3);
        const style = hash(i, 72);
        s.str = { n, sag: 0.7 + 0.5 * hash(i, 73), y: 6.3 + 0.6 * hash(i, 74), z: 2.0, lan: [] };
        for (let k = 0; k < n; k++) {
          s.str.lan.push({ cream: style < 0.3 ? true : style < 0.6 ? k % 2 === 1 : false, th: 0.05 + 0.9 * hash(i * 9 + k, 75), id: 'o' + i + ':' + k });
        }
      }
      s.span = hash(i, 76) < 0.2;
      s.alan = [0, 1].map((q) => ({ cream: hash(i, 77 + q) < 0.25, th: 0.03 + 0.85 * hash(i, 79 + q), id: 'a' + i + ':' + q }));
      s.banner = i % 4 === 0 ? Math.floor(hash(i, 81) * BANNER_WORDS.length) : -1;
      this.slots.set(i, s);
      return s;
    },

    listen(signals, dt, T) {
      const e = this.env;
      const k = signals[0] / 100;
      e.kf = ease(e.kf, k, 40, dt);
      e.ks = ease(e.ks, k, 3, dt);
      const kOn = clamp((e.kf - e.ks) * 2.2, 0, 1);
      let kick = 0;
      if (e.kArm && kOn > 0.22 && T - e.lastK > 0.22) { kick = kOn; e.kArm = false; e.lastK = T; }
      if (kOn < 0.1) e.kArm = true;
      const cl = (signals[3] + signals[4] + signals[5]) / 300;
      e.cf = ease(e.cf, cl, 30, dt);
      e.cs = ease(e.cs, cl, 2.5, dt);
      const cOn = clamp((e.cf - e.cs) * 3, 0, 1);
      let clap = 0;
      if (e.cArm && cOn > 0.25 && T - e.lastC > 0.3) { clap = cOn; e.cArm = false; e.lastC = T; }
      if (cOn < 0.1) e.cArm = true;
      e.bass = ease(e.bass, (signals[0] + signals[1]) / 200, 1.2, dt);
      e.hat = ease(e.hat, (signals[6] + signals[7] + signals[8]) / 300, 8, dt);
      e.rise = ease(e.rise, (signals[5] + signals[6] + signals[7]) / 300, 0.8, dt);
      // Section follower on the sidechained bass line (band 1), with
      // hysteresis so a stray kick does not flip it; the build is the riser
      // and hats climbing in the top bands before any bass line.
      e.low = ease(e.low, signals[1], 1.2, dt);
      if (!e.dropOn && e.low > 27) e.dropOn = true;
      else if (e.dropOn && e.low < 19) e.dropOn = false;
      // The build is the top bands *climbing*: fast envelope over a slow one,
      // so a breakdown's steady hats never read as a build.
      e.riseSlow = ease(e.riseSlow || 0, (signals[5] + signals[6] + signals[7]) / 300, 0.15, dt);
      if (!e.buildOn && e.rise > 0.07 && e.rise > e.riseSlow * 1.15) e.buildOn = true;
      else if (e.buildOn && e.rise < e.riseSlow) e.buildOn = false;
      return { kick, clap };
    },

    // The arcade ranges: schedule a gate ahead, or an exit, from the arcade
    // param. Boundaries sit on slot edges.
    arcadeLogic(A, T) {
      const ceilSlot = (x) => Math.ceil(x / SLOT) * SLOT;
      this.ranges = this.ranges.filter((r) => r.z1 > CAMZ - 6);
      const cur = this.ranges.find((r) => r.z1 > CAMZ);
      if (!cur) {
        if (A >= 0.25) this.ranges.push({ z0: ceilSlot(CAMZ + (A >= 0.5 ? 36 : 42)), z1: Infinity, t0: T, t1: 0, gate: this.gateN++ % GATES.length });
      } else if (CAMZ < cur.z0) {
        if (A < 0.2 && cur.z0 - CAMZ > 30) this.ranges.splice(this.ranges.indexOf(cur), 1);
      } else if (cur.z1 === Infinity && A < 0.5) {
        cur.z1 = ceilSlot(CAMZ + 24); cur.t1 = T;
      }
      return this.ranges.find((r) => r.z1 > CAMZ) || null;
    },

    weights(zc, T) {
      let w = { open: 1, arc: 0 };
      const rv = (t) => smooth(0, 1, (T - t) / 0.9);
      for (const r of this.ranges) {
        if (zc >= r.z0 && zc < r.z1) { const a = rv(r.t0); w = { open: 1 - a, arc: a }; }
        else if (zc >= r.z1) { const a = rv(r.t1); w = { open: a, arc: 1 - a }; }
      }
      return w;
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      if (this.clock === undefined) this.reset();
      if (!this.signs || (!this.spritesFonted && p.frameCount % 30 === 0 && typeof VIZ_FONTS !== 'undefined' && VIZ_FONTS.has('Bebas Neue') && VIZ_FONTS.has('Oswald'))) this.makeSprites();
      const ms = p.millis();
      const dt = this.lastMs === null ? 1 / 60 : clamp((ms - this.lastMs) / 1000, 0, 0.1);
      this.lastMs = ms;
      this.clock += dt;
      const T = this.clock;
      const e = this.env;
      const hit = this.listen(signals, dt, T);

      const follow = Math.round(params.follow) === 1;
      const target = follow ? (e.dropOn ? 1 : e.buildOn ? 0.3 : 0) : 0;
      e.auto = ease(e.auto, target, target > e.auto ? 1.6 : 0.4, dt);
      const P = {};
      for (const k of DRIVE) P[k] = params[k] + (PRESETS.drop[k] - params[k]) * (follow ? e.auto : 0);
      const react = params.react;

      const W = ctx.width, H = ctx.height;
      F = 0.62 * Math.min(W, H);
      G = p.drawingContext;
      G.save();
      G.globalCompositeOperation = 'source-over';
      G.globalAlpha = 1;
      ALPHA = 1;

      // ---- travel
      CAMZ = this.camZ;
      const cur = this.arcadeLogic(P.arcade, T);
      let vT = (1.0 + 4.6 * P.speed) * (0.8 + 0.45 * e.bass);
      if (cur && CAMZ < cur.z0) {
        const dist = cur.z0 - CAMZ;
        if (P.arcade >= 0.5) vT *= 1.8;
        else vT = Math.min(vT, Math.max(0, (dist - 7) * 0.5));
      }
      this.v = ease(this.v, vT, 1.4, dt);
      this.camZ += this.v * dt;
      CAMZ = this.camZ;
      const inNow = cur && CAMZ >= cur.z0 && CAMZ < cur.z1 ? 1 : 0;
      this.inside = ease(this.inside, inNow, 1.2, dt);
      FOG = mix(C.fogOpen, C.fogArc, this.inside);
      CAMX = 0.1 * Math.sin(T * 0.6) + 0.04 * Math.sin(T * 1.7);
      CX = W / 2;
      HY = H * 0.47 + 0.6 * Math.sin(T * 9.1) * clamp(this.v / 12, 0, 1);
      for (const [k, sl] of this.slots) if ((k + 1) * SLOT < CAMZ - 2) this.slots.delete(k);

      // ---- lanterns: the kick swings one
      for (const [id, sw] of this.swing) {
        sw.om += (-9.8 / sw.L * Math.sin(sw.th) - 0.55 * sw.om) * dt;
        sw.th += sw.om * dt;
        sw.fl = ease(sw.fl, 0, 3, dt);
        if (Math.abs(sw.th) < 0.002 && Math.abs(sw.om) < 0.01 && sw.fl < 0.01) this.swing.delete(id);
      }
      if (hit.kick && react > 0) {
        let best = null, bestS = 1e9;
        for (const c of this.cands) {
          if (c.d < 6 || c.d > 16) continue;
          const sc = Math.abs(c.d - 8.5) + (c.side === this.lastSide ? 4 : 0) + (this.swing.has(c.id) ? 2 : 0) + hash(c.d * 13, T) * 1.5;
          if (sc < bestS) { bestS = sc; best = c; }
        }
        if (best) {
          const sw = this.swing.get(best.id) || { th: 0, om: 0, fl: 0, L: best.L };
          const w0 = Math.sqrt(9.8 / sw.L);
          const dir = best.side;   // swing out toward the pavement first
          sw.om += dir * 0.75 * react * w0 * (0.7 + 0.3 * hit.kick);
          sw.fl = Math.min(1.5, sw.fl + react);
          this.swing.set(best.id, sw);
          this.lastSide = best.side;
        }
      }
      this.cands = [];

      // ---- steam: stalls breathe; the clap throws one burst
      const nextEmit = [];
      if (hit.clap) {
        let best = null, bestS = 1e9;
        for (const em of this.emit) { const sc = Math.abs(em.z - CAMZ - 12) + hash(em.z, T) * 3; if (em.z - CAMZ > 8 && em.z - CAMZ < 20 && sc < bestS) { bestS = sc; best = em; } }
        if (best) {
          for (let k = 0; k < 16; k++) {
            this.puffs.push({ x: best.x + (Math.random() - 0.5) * 0.5, y: best.y + Math.random() * 0.3, z: best.z + (Math.random() - 0.5) * 0.8,
              vx: (Math.random() - 0.5) * 0.5 - best.s * 0.25, vy: 1.3 + Math.random() * 1.0, r: 0.2 + Math.random() * 0.2, gr: 0.6 + Math.random() * 0.3,
              age: 0, life: 1.6 + Math.random() * 1.0, a: 0.5 });
          }
          this.flames.push({ x: best.x, y: best.y + 0.25, z: best.z, age: 0 });
        }
      }
      for (const em of this.emit) {
        const d = em.z - CAMZ;
        if (d < 1.5 || d > 45) continue;
        if (Math.random() < dt * P.steam * 1.6 * em.w) {
          this.puffs.push({ x: em.x + (Math.random() - 0.5) * 0.4, y: em.y, z: em.z + (Math.random() - 0.5) * 0.6,
            vx: (Math.random() - 0.5) * 0.25 - em.s * 0.12, vy: 0.45 + Math.random() * 0.35, r: 0.22 + Math.random() * 0.15, gr: 0.45,
            age: 0, life: 2.8 + Math.random() * 1.6, a: 0.42 });
        }
      }
      for (const f of this.puffs) { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy *= Math.exp(-0.5 * dt); f.r += f.gr * dt; }
      this.puffs = this.puffs.filter((f) => f.age < f.life && f.z > CAMZ + NEAR);
      if (this.puffs.length > 220) this.puffs.splice(0, this.puffs.length - 220);
      this.puffs.sort((a, b) => b.z - a.z);
      for (const f of this.flames) f.age += dt;
      this.flames = this.flames.filter((f) => f.age < 0.6);

      const flickerT = Math.floor(T * 7);
      const signLit = (sg) => {
        let l = smooth(sg.th - 0.07, sg.th + 0.07, P.neon);
        if (sg.spr.neon && l > 0 && hash(sg.id, flickerT) < 0.16 * clamp(e.hat * 2.2, 0, 1)) l *= 0.3;
        return l;
      };
      const lanLit = (ln) => smooth(ln.th - 0.08, ln.th + 0.08, P.lanterns);

      // ---------------------------------------------------------- sky
      const sky = G.createLinearGradient(0, 0, 0, HY);
      sky.addColorStop(0, css(C.skyTop)); sky.addColorStop(0.75, css(C.skyLow)); sky.addColorStop(1, css(C.haze));
      G.fillStyle = sky; G.fillRect(-2, -2, W + 4, HY + 3);
      // the moon, low over the street
      const mx = CX + 0.1 * W, my = H * 0.13, mr = 0.035 * Math.min(W, H);
      G.fillStyle = css(C.moon, 0.06); G.beginPath(); G.arc(mx, my, mr * 2.4, 0, 7); G.fill();
      G.fillStyle = css(C.moon); G.beginPath(); G.arc(mx, my, mr, 0, 7); G.fill();
      G.fillStyle = css(C.skyTop, 0.9); G.beginPath(); G.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, 7); G.fill();
      // far skyline at the end of the street
      G.fillStyle = css(mix([14, 12, 28], C.skyLow, 0.25));
      for (let k = 0; k < 26; k++) {
        const bw = 0.03 * W + 0.03 * W * hash(k, 90), bx = (k / 26) * W * 1.1 - 0.05 * W;
        const bh = 8 + 55 * Math.pow(hash(k, 91), 1.8);
        G.fillRect(bx, HY - bh, bw, bh + 2);
      }
      G.fillStyle = css([220, 170, 100], 0.55);
      for (let k = 0; k < 40; k++) {
        const bx = hash(k, 92) * W, by = HY - 3 - hash(k, 93) * 40;
        if (hash(k, 94) < 0.5) G.fillRect(bx, by, 1.2, 1.2);
      }

      // ---------------------------------------------------------- ground
      const zF = CAMZ + ZMAX, zN = CAMZ + NEAR;
      const gy = G.createLinearGradient(0, HY, 0, H);
      gy.addColorStop(0, css(FOG)); gy.addColorStop(0.12, css(mix(C.ground, FOG, 0.5))); gy.addColorStop(1, css(C.ground));
      G.fillStyle = gy; G.fillRect(-2, HY, W + 4, H - HY + 2);
      for (const sg of [-1, 1]) {
        poly([[sg * CURB, 0, zN], [sg * WALL, 0, zN], [sg * WALL, 0, zF], [sg * CURB, 0, zF]], css(mix(C.pave, FOG, 0.25)));
        G.strokeStyle = css(mix([90, 76, 70], FOG, 0.3)); G.lineWidth = 1;
        G.beginPath(); G.moveTo(sx(sg * CURB, zN), sy(0, zN)); G.lineTo(sx(sg * CURB, zF), sy(0, zF)); G.stroke();
      }
      // setts: rows across the road, the strongest cue of travel
      for (let z = Math.ceil(zN); z < CAMZ + 34; z += 1) {
        const d = z - CAMZ;
        const gap = EYE * F / (d * d);
        const a = clamp((gap - 2) / 8, 0, 1) * 0.35 * (1 - fogAt(d));
        if (a < 0.01) continue;
        G.strokeStyle = css([60, 52, 58], a); G.lineWidth = Math.max(0.6, gap * 0.08);
        G.beginPath(); G.moveTo(sx(-CURB, z), sy(0, z)); G.lineTo(sx(CURB, z), sy(0, z)); G.stroke();
      }
      // the tram's headlight on the track ahead
      {
        const z0 = CAMZ + 7, rx = 2.6 * F / 7, y0 = sy(0, z0), ry = (sy(0, CAMZ + 4.5) - sy(0, CAMZ + 11)) / 2;
        G.globalCompositeOperation = 'lighter';
        G.save(); G.translate(sx(0, z0), y0); G.scale(rx / 48, ry / 48);
        G.globalAlpha = 0.14; G.drawImage(this.glowWarm, -48, -48, 96, 96);
        G.restore();
        G.globalCompositeOperation = 'source-over';
        G.globalAlpha = 1;
      }
      // rails
      for (const x of [-GAUGE, GAUGE]) {
        for (const [lw, col] of [[0.09, css([20, 16, 20])], [0.035, css([150, 128, 118], 0.7)]]) {
          G.strokeStyle = col;
          for (let z = zN; z < zF; z += 12) {
            const z2 = Math.min(zF, z + 12), d = (z + z2) / 2 - CAMZ;
            G.lineWidth = Math.max(0.5, lw * F / d);
            G.beginPath(); G.moveTo(sx(x, z), sy(0, z)); G.lineTo(sx(x, z2), sy(0, z2)); G.stroke();
          }
        }
      }

      // Reflections in the wet street: every lit sign and lantern, mirrored.
      const wet = P.wet;
      const iFar = Math.floor(zF / SLOT), iNear = Math.floor(zN / SLOT);
      if (wet > 0.01) {
        G.globalCompositeOperation = 'lighter';
        for (let i = iFar; i >= iNear; i--) {
          const sd = this.slot(i), zi = i * SLOT, w = this.weights(zi + SLOT / 2, T);
          for (const side of sd.side) {
            const sg = side.sign;
            if (!sg) continue;
            const z = zi + 1.2, d = z - CAMZ;
            if (d < NEAR) continue;
            const l = signLit(sg);
            const yy0 = w.arc > 0.5 ? 3.1 : sg.y0, hh = w.arc > 0.5 ? 2.6 : sg.spr.h;
            const xo = side.s * 6.85, xi = side.s * (6.85 - SIGN_W);
            const a = 0.3 * wet * l * lightFog(d);
            if (a < 0.01) continue;
            // a streak of the sign's colour, stretched down the wet setts
            const img = this.streak[sg.spr.kind];
            const Xc = sx((xo + xi) / 2, z), rx = 0.45 * SIGN_W * F / d;
            const Y1 = sy(-yy0, z), Y2 = sy(-(yy0 + hh * 1.5), z);
            G.globalAlpha = a;
            G.drawImage(img, Xc - rx, Y1 - (Y2 - Y1) * 0.15, rx * 2, (Y2 - Y1) * 1.15);
          }
          if (sd.str && w.open > 0.5) {
            for (let k = 0; k < sd.str.n; k++) {
              const ln = sd.str.lan[k], l = lanLit(ln);
              if (l < 0.02) continue;
              const X = -5.4 + k * 10.8 / (sd.str.n - 1), z = zi + sd.str.z, d = z - CAMZ;
              if (d < NEAR) continue;
              const sw = this.swing.get(ln.id), th = sw ? sw.th : 0;
              const py = sd.str.y - sd.str.sag * (1 - (X / 6.8) * (X / 6.8));
              const cxW = X + Math.sin(th) * 0.72, cyW = py - Math.cos(th) * 0.72;
              const rx = 0.5 * F / d, ry = 1.6 * F / d, Xs = sx(cxW, z), Ys = sy(-cyW, z);
              G.globalAlpha = 0.3 * wet * l * lightFog(d) * (1 + (sw ? sw.fl : 0) * 0.6);
              G.drawImage(ln.cream ? this.glowWarm : this.glowRed, Xs - rx, Ys - ry, rx * 2, ry * 2);
            }
          }
          if (w.arc > 0.5) {
            for (let q = 0; q < 2; q++) {
              const ln = sd.alan[q], l = lanLit(ln), z = zi + 1.5, d = z - CAMZ;
              if (l < 0.02 || d < NEAR) continue;
              const sw = this.swing.get(ln.id), th = sw ? sw.th : 0, sgn = q ? 1 : -1;
              const pyv = ribY(4.9), L = pyv - 5.9;
              const cxW = sgn * 4.9 + Math.sin(th) * L, cyW = pyv - Math.cos(th) * L;
              const rx = 0.45 * F / d, ry = 1.4 * F / d, Xs = sx(cxW, z), Ys = sy(-cyW, z);
              G.globalAlpha = 0.3 * wet * l * lightFog(d) * (1 + (sw ? sw.fl : 0) * 0.6);
              G.drawImage(ln.cream ? this.glowWarm : this.glowRed, Xs - rx, Ys - ry, rx * 2, ry * 2);
            }
          }
        }
        G.globalCompositeOperation = 'source-over';
        G.globalAlpha = 1;
      }

      // ---------------------------------------------------------- the street
      // Far cap: the arcade's own haze at the end of the draw distance.
      {
        const w = this.weights(zF, T);
        if (w.arc > 0.01) {
          G.globalAlpha = w.arc;
          const pts = ribPts(zF); pts.push([WALL, 0, zF], [-WALL, 0, zF]);
          poly(pts, css(mix(FOG, C.fogArc, 0.6)));
          G.globalAlpha = 1;
        }
      }
      let pf = 0;   // puff pointer (puffs sorted far to near)
      for (let i = iFar; i >= iNear; i--) {
        const sd = this.slot(i), zi = i * SLOT, w = this.weights(zi + SLOT / 2, T);
        if (w.arc > 0.004) { ALPHA = w.arc; G.globalAlpha = ALPHA; this.drawArcade(sd, zi, P, signLit, lanLit, nextEmit, w.arc); }
        if (w.open > 0.004) { ALPHA = w.open; G.globalAlpha = ALPHA; this.drawOpen(sd, zi, P, signLit, lanLit, nextEmit, w.open); }
        ALPHA = 1; G.globalAlpha = 1;
        // the tram wire and its span wires
        {
          const z1 = Math.max(zi, zN), z2 = zi + SLOT + 0.02;
          if (z2 > z1) {
            const d = (z1 + z2) / 2 - CAMZ;
            G.strokeStyle = css(mix([8, 6, 10], FOG, fogAt(d) * 0.8)); G.lineWidth = Math.max(0.5, 0.03 * F / d);
            G.beginPath(); G.moveTo(sx(0.15, z1), sy(5.5, z1)); G.lineTo(sx(0.15, z2), sy(5.5, z2)); G.stroke();
            if (sd.span && w.open > 0.5 && zi + 1 > zN) {
              G.lineWidth = Math.max(0.4, 0.02 * F / (zi + 1 - CAMZ));
              G.beginPath(); G.moveTo(sx(-WALL, zi + 1), sy(6.6, zi + 1)); G.lineTo(sx(0.15, zi + 1), sy(5.55, zi + 1)); G.lineTo(sx(WALL, zi + 1), sy(6.6, zi + 1)); G.stroke();
            }
          }
        }
        // steam in this slot
        G.globalCompositeOperation = 'source-over';
        while (pf < this.puffs.length && this.puffs[pf].z >= zi) {
          const f = this.puffs[pf++];
          const d = f.z - CAMZ;
          if (d < NEAR) continue;
          const u = f.age / f.life;
          const a = f.a * Math.min(1, f.age * 4) * Math.pow(1 - u, 1.3) * (0.35 + 0.65 * lightFog(d)) * smooth(1.5, 6, d);
          const r = f.r * F / d;
          G.globalAlpha = a;
          G.drawImage(this.steamImg, sx(f.x, f.z) - r, sy(f.y, f.z) - r, r * 2, r * 2);
        }
        G.globalAlpha = 1;
        for (const fl of this.flames) {
          if (fl.z < zi || fl.z >= zi + SLOT) continue;
          G.globalCompositeOperation = 'lighter';
          glowAt(this.glowFlame, fl.x, fl.y, fl.z, 0.9, 0.9 * (1 - fl.age / 0.6));
          G.globalCompositeOperation = 'source-over';
        }
        // gates: the entry face (seen from outside) and the exit face (from inside)
        for (const r of this.ranges) {
          if (r.z0 === zi && CAMZ < zi - NEAR) this.drawGate(r, zi, smooth(0, 1, (T - r.t0) / 0.9), false);
          if (r.z1 === zi && CAMZ < zi - NEAR) this.drawGate(r, zi, smooth(0, 1, (T - r.t1) / 0.9), true);
        }
      }
      this.emit = nextEmit;

      G.restore();
      G.globalAlpha = 1;
      G.globalCompositeOperation = 'source-over';
    },

    // One lantern hanging from (X, py, z) on a cord to its centre of length L.
    lantern(ln, X, py, z, L, size, lit, side) {
      const d = z - CAMZ;
      if (d < NEAR) return;
      const sw = this.swing.get(ln.id);
      const breeze = 0.03 * Math.sin(this.clock * 0.9 + X * 1.7 + z * 0.3);
      const th = (sw ? sw.th : 0) + breeze;
      const fl = sw ? sw.fl : 0;
      this.cands.push({ id: ln.id, d, side, L });
      const spr = ln.cream ? this.lant.cream : this.lant.red;
      const k = size / 0.7;                       // sprites are drawn for a 0.7 m lantern
      const sc = F / d * k;
      const px = sx(X, z), pyS = sy(py, z);
      const hang = L - spr[0].oy * k - 0.95 * k / 2;    // cord above the lantern's top
      const fog = fogAt(d);
      G.save();
      G.translate(px, pyS);
      G.rotate(-th);
      G.strokeStyle = css(mix([20, 14, 12], FOG, fog)); G.lineWidth = Math.max(0.5, 0.02 * F / d);
      G.beginPath(); G.moveTo(0, 0); G.lineTo(0, hang * F / d); G.stroke();
      G.translate(-spr[0].ox * sc, hang * F / d);
      const wS = spr[0].w * sc, hS = spr[0].h * sc;
      G.globalAlpha = ALPHA;
      G.drawImage(spr[0].c, 0, 0, wS, hS);
      const la = clamp(lit * (1 - fog * 0.4), 0, 1);
      if (la > 0.01) { G.globalAlpha = ALPHA * la; G.drawImage(spr[1].c, 0, 0, wS, hS); }
      if (fog > 0.05) {
        // haze over the unlit body so far lanterns sink into the night
        G.globalAlpha = ALPHA * fog * (1 - la) * 0.8;
        G.fillStyle = css(FOG);
        G.beginPath(); G.ellipse(spr[0].ox * sc, (spr[0].oy + 0.475) * sc, 0.36 * sc, 0.5 * sc, 0, 0, 7); G.fill();
      }
      G.restore();
      G.globalAlpha = ALPHA;
      // a tight glow, and the kick's flare
      const cy = py - Math.cos(th) * (L), cxW = X + Math.sin(th) * L;
      if (lit > 0.02) {
        G.globalCompositeOperation = 'lighter';
        glowAt(ln.cream ? this.glowWarm : this.glowRed, cxW, cy, z, size * 1.1 * (1 + 0.5 * fl), (0.28 + 0.5 * fl) * lit * lightFog(d));
        G.globalCompositeOperation = 'source-over';
      }
      if (fl > 0.02) {
        // the flared lantern also warms its own paper, lit or not
        G.globalCompositeOperation = 'lighter';
        glowAt(this.glowBulb, cxW, cy, z, size * 0.75, 1.0 * Math.min(1, fl) * lightFog(d));
        G.globalCompositeOperation = 'source-over';
      }
    },

    blade(side, sg, zi, y0, hM, lit) {
      const z = zi + 1.2, d = z - CAMZ;
      if (d < NEAR) return;
      const xo = side.s * 6.85, xi = side.s * (6.85 - SIGN_W);
      const x1 = Math.min(xo, xi), x2 = Math.max(xo, xi);
      const pad = sg.spr.pad, fog = fogAt(d);
      // bracket
      G.strokeStyle = css(mix([30, 24, 26], FOG, fog)); G.lineWidth = Math.max(0.5, 0.05 * F / d);
      G.beginPath(); G.moveTo(sx(side.s * 7, z), sy(y0 + hM + 0.15, z)); G.lineTo(sx(xi, z), sy(y0 + hM + 0.15, z)); G.stroke();
      const sx1 = x1 - pad, sx2 = x2 + pad;
      sprite(sg.spr.off, sx1, sx2, y0 - pad, y0 + hM + pad, z, 1);
      if (fog > 0.05) {
        // unlit panels fade into the haze
        G.globalAlpha = ALPHA * fog * (1 - lit) * 0.85;
        faceRect(x1, x2, y0, y0 + hM, z, css(FOG));
        G.globalAlpha = ALPHA;
      }
      sprite(sg.spr.on, sx1, sx2, y0 - pad, y0 + hM + pad, z, lit * (1 - fog * 0.35));
    },

    drawOpen(sd, zi, P, signLit, lanLit, nextEmit, weight) {
      const zN = CAMZ + NEAR;
      for (const side of sd.side) {
        const s = side.s, X = s * WALL;
        const z1 = Math.max(zi, zN), z2 = zi + SLOT + 0.04;
        if (z2 - z1 < 0.05) continue;
        const d = (z1 + z2) / 2 - CAMZ, fog = fogAt(d);
        const far = SLOT * F / d < 4;
        // facade
        wallRect(X, z1, z2, 0, side.h, css(mix(side.col, FOG, fog)));
        wallRect(X, z1, z2, side.h - 0.35, side.h, css(mix(mix(side.col, [0, 0, 0], 0.35), FOG, fog)));
        // shopfront
        const s1 = Math.max(zi + 0.15, zN), s2 = zi + SLOT - 0.15;
        if (s2 > s1) {
          if (side.shop) {
            wallRect(X, s1, s2, 0.05, 2.85, css(mix(side.shop, FOG, fog * 0.6)));
            if (!far) {
              // mullions and a darker counter line
              G.fillStyle = css(mix([40, 28, 24], FOG, fog), 0.9);
              for (let m = 1; m < 3; m++) { const zm = zi + 0.15 + m * (SLOT - 0.3) / 3; if (zm > zN) wallRect(X, zm - 0.04, zm + 0.04, 0.05, 2.85, G.fillStyle); }
              wallRect(X, s1, s2, 0.05, 0.95, css(mix(mix(side.shop, [30, 18, 14], 0.55), FOG, fog)));
            }
          } else {
            wallRect(X, s1, s2, 0.05, 2.85, css(mix([66, 62, 66], FOG, fog)));
          }
          wallRect(X, s1, s2, 2.9, 3.4, css(mix(side.fascia, FOG, fog)));
        }
        // upper windows
        if (!far) {
          for (const wn of side.win) {
            const w1 = Math.max(zi + wn.z, zN), w2 = zi + wn.z + 0.95;
            if (w2 <= w1) continue;
            const col = wn.lit ? mix(wn.col, FOG, fog * 0.5) : mix([22, 18, 24], FOG, fog);
            wallRect(X, w1, w2, wn.y, wn.y + 1.35, css(col));
          }
        }
        // awning over the shopfront, seen from below
        if (side.awning) {
          const a1 = Math.max(zi + 0.1, zN), a2 = zi + SLOT - 0.1;
          if (a2 > a1) {
            const xo = s * 5.85;
            poly([[X, 3.35, a1], [X, 3.35, a2], [xo, 2.85, a2], [xo, 2.85, a1]], css(mix(mix(side.awning, [255, 200, 130], 0.18), FOG, fog)));
            wallRect(xo, a1, a2, 2.55, 2.85, css(mix(mix(side.awning, [0, 0, 0], 0.25), FOG, fog)));
          }
        }
        // a food stall on the pavement
        if (side.stall) {
          const c1 = zi + 0.6, c2 = zi + 2.3;
          if (c2 > zN) {
            const k1 = Math.max(c1, zN);
            const xi = s * 5.35, xo = s * 6.55;
            const wood = mix([84, 54, 38], FOG, fog), top = mix([226, 158, 88], FOG, fog * 0.7);
            // canopy underside, lit by its bulb
            poly([[s * 5.05, 2.95, Math.max(zi + 0.35, zN)], [s * 5.05, 2.95, zi + 2.55], [s * 6.95, 3.05, zi + 2.55], [s * 6.95, 3.05, Math.max(zi + 0.35, zN)]], css(mix([240, 196, 130], FOG, fog * 0.7)));
            wallRect(s * 5.05, Math.max(zi + 0.35, zN), zi + 2.55, 2.7, 2.95, css(mix(side.fascia, FOG, fog)));
            // posts
            if (zi + 0.4 > zN) faceRect(s * 5.1, s * 5.18, 0, 2.95, zi + 0.4, css(mix([30, 22, 20], FOG, fog)));
            // counter: top, street side, near end
            poly([[xi, 1.0, k1], [xi, 1.0, c2], [xo, 1.0, c2], [xo, 1.0, k1]], css(top));
            wallRect(xi, k1, c2, 0, 1.0, css(wood));
            if (c1 > zN) faceRect(xi, xo, 0, 1.0, c1, css(mix(wood, [0, 0, 0], 0.2)));
            // the bulb
            G.globalCompositeOperation = 'lighter';
            glowAt(this.glowBulb, s * 5.9, 2.6, zi + 1.45, 0.45, 0.55 * lightFog(d));
            G.globalCompositeOperation = 'source-over';
            nextEmit.push({ x: s * 5.95, y: 1.1, z: zi + 1.45, s, w: weight });
            // a customer at the counter, backlit
            if (side.person && zi + 1.4 > zN) {
              const z = zi + 1.4, hP = side.personH, xp = s * 4.85 + 0.05 * Math.sin(this.clock * 0.7 + zi);
              const col = css(mix([12, 9, 13], FOG, fog * 0.8));
              faceRect(xp - 0.22, xp + 0.22, 0, hP - 0.3, z, col);
              faceRect(xp - 0.27, xp + 0.27, hP - 0.75, hP - 0.3, z, col);
              G.beginPath(); G.arc(sx(xp, z), sy(hP - 0.15, z), 0.13 * F / (z - CAMZ), 0, 7); G.fillStyle = col; G.fill();
            }
          }
        }
        // blade sign
        if (side.sign) this.blade(side, side.sign, zi, side.sign.y0, side.sign.spr.h, signLit(side.sign));
      }
      // lantern string across the street
      const st = sd.str;
      if (st) {
        const z = zi + st.z, d = z - CAMZ;
        if (d > NEAR) {
          const fog = fogAt(d);
          G.strokeStyle = css(mix([16, 12, 12], FOG, fog)); G.lineWidth = Math.max(0.5, 0.025 * F / d);
          G.beginPath();
          for (let k = 0; k <= 16; k++) {
            const X = -6.9 + 13.8 * k / 16, Y = st.y - st.sag * (1 - (X / 6.8) * (X / 6.8));
            if (k) G.lineTo(sx(X, z), sy(Y, z)); else G.moveTo(sx(X, z), sy(Y, z));
          }
          G.stroke();
          for (let k = 0; k < st.n; k++) {
            const ln = st.lan[k], X = -5.4 + k * 10.8 / (st.n - 1);
            const py = st.y - st.sag * (1 - (X / 6.8) * (X / 6.8));
            this.lantern(ln, X, py, z, 0.72, 0.7, lanLit(ln), X < 0 ? -1 : 1);
          }
        }
      }
    },

    drawArcade(sd, zi, P, signLit, lanLit, nextEmit, weight) {
      const zN = CAMZ + NEAR;
      const z1 = Math.max(zi, zN), z2 = zi + SLOT + 0.04;
      if (z2 - z1 < 0.05) return;
      const d = (z1 + z2) / 2 - CAMZ, fog = fogAt(d);
      const aFog = mix(FOG, C.fogArc, 0.5);
      // roof panel between this slot's two ribs
      {
        const a = ribPts(z1), b = ribPts(z2).reverse();
        const roof = mix(C.roof, aFog, fog);
        poly(a.concat(b), css(roof));
        // a lighter purlin along the crown
        const c1 = Math.max(z1, zN);
        poly([[-0.5, ribY(0.5) - 0.02, c1], [0.5, ribY(0.5) - 0.02, c1], [0.5, ribY(0.5) - 0.02, z2], [-0.5, ribY(0.5) - 0.02, z2]], css(mix([92, 64, 44], aFog, fog)));
      }
      for (const side of sd.side) {
        const s = side.s, X = s * WALL;
        wallRect(X, z1, z2, 0, SPRING + 0.1, css(mix(mix(side.col, [30, 20, 14], 0.3), aFog, fog)));
        const s1 = Math.max(zi + 0.12, zN), s2 = zi + SLOT - 0.12;
        if (s2 > s1) {
          const shop = side.shop || SHOPS[1];
          wallRect(X, s1, s2, 0.05, 3.1, css(mix(mix(shop, [60, 36, 24], 0.3), aFog, fog * 0.6)));
          if (SLOT * F / d > 4) {
            const mc = css(mix([34, 22, 16], aFog, fog));
            for (let m = 1; m < 4; m++) { const zm = zi + 0.12 + m * (SLOT - 0.24) / 4; if (zm > zN) wallRect(X, zm - 0.03, zm + 0.03, 1.0, 3.1, mc); }
          }
          wallRect(X, s1, s2, 0.05, 1.0, css(mix(mix(shop, [30, 18, 14], 0.55), aFog, fog)));
          // a continuous fascia band of shop names
          wallRect(X, s1, s2, 3.2, 3.9, css(mix(mix(side.fascia, [20, 12, 10], 0.25), aFog, fog * 0.8)));
          wallRect(X, s1, s2, 3.9, 4.0, css(mix([255, 214, 150], aFog, fog * 0.6)));
        }
        if (side.steamer) nextEmit.push({ x: s * 6.4, y: 1.1, z: zi + 1.5, s, w: weight });
        if (side.sign) this.blade(side, side.sign, zi, 4.3, 1.7, signLit(side.sign));
      }
      // pillars and the rib at the near edge of this slot, traced in bulbs
      if (zi > zN) {
        const dr = zi - CAMZ, fr = fogAt(dr);
        for (const s of [-1, 1]) faceRect(s * 6.72, s * 6.98, 0, SPRING, zi, css(mix(C.rib, aFog, fr)));
        const pts = ribPts(zi);
        G.strokeStyle = css(mix(C.rib, aFog, fr)); G.lineWidth = Math.max(0.6, 0.22 * F / dr);
        G.beginPath();
        pts.forEach((q, k) => (k ? G.lineTo(sx(q[0], q[2]), sy(q[1], q[2])) : G.moveTo(sx(q[0], q[2]), sy(q[1], q[2]))));
        G.stroke();
        const lf = lightFog(dr);
        const rpx = 0.07 * F / dr;
        G.fillStyle = css(mix([255, 238, 205], aFog, fr * 0.5));
        for (let k = 1; k < RIB_N; k++) {
          const q = pts[k];
          const X = sx(q[0], q[2]), Y = sy(q[1] - 0.12, q[2]);
          G.beginPath(); G.arc(X, Y, Math.max(0.5, rpx), 0, 7); G.fill();
        }
        if (dr < 55) {
          G.globalCompositeOperation = 'lighter';
          for (let k = 1; k < RIB_N; k++) glowAt(this.glowBulb, pts[k][0], pts[k][1] - 0.12, zi, 0.38, 0.42 * lf);
          G.globalCompositeOperation = 'source-over';
        }
      }
      // cloth banners from the roof
      if (sd.banner >= 0) {
        const z = zi + 1.5;
        if (z - CAMZ > NEAR) {
          const img = this.banners[sd.banner], f2 = fogAt(z - CAMZ);
          for (const bx of [-2.3, 2.3]) {
            const top = ribY(bx) - 0.1;
            sprite(img, bx - 0.35, bx + 0.35, top - 2.25, top, z, 1);
            if (f2 > 0.05) { G.globalAlpha = ALPHA * f2 * 0.85; faceRect(bx - 0.35, bx + 0.35, top - 2.25, top, z, css(aFog)); G.globalAlpha = ALPHA; }
          }
        }
      }
      // lanterns on long cords down both sides
      for (let q = 0; q < 2; q++) {
        const ln = sd.alan[q], sgn = q ? 1 : -1;
        const X = sgn * 4.9, py = ribY(4.9);
        this.lantern(ln, X, py, zi + 1.5, py - 5.9, 0.6, lanLit(ln), sgn);
      }
    },

    drawGate(r, z, alpha, exit) {
      const d = z - CAMZ;
      if (d < NEAR || alpha <= 0.004) return;
      const fog = fogAt(d);
      ALPHA = alpha; G.globalAlpha = alpha;
      const hole = [];
      hole.push([-6.2, 0, z], [-6.2, 5.6, z]);
      for (let k = 1; k < 16; k++) { const a = Math.PI - Math.PI * k / 16; hole.push([6.2 * Math.cos(a), 5.6 + 2.6 * Math.sin(a), z]); }
      hole.push([6.2, 5.6, z], [6.2, 0, z]);
      const wallC = mix(exit ? mix(C.gate, [0, 0, 0], 0.45) : C.gate, FOG, fog);
      G.beginPath();
      const outer = [[-7.8, 0], [-7.8, 11.4], [7.8, 11.4], [7.8, 0]];
      outer.forEach((q, k) => (k ? G.lineTo(sx(q[0], z), sy(q[1], z)) : G.moveTo(sx(q[0], z), sy(q[1], z))));
      G.closePath();
      hole.forEach((q, k) => (k ? G.lineTo(sx(q[0], z), sy(q[1], z)) : G.moveTo(sx(q[0], z), sy(q[1], z))));
      G.closePath();
      G.fillStyle = css(wallC); G.fill('evenodd');
      // a roof cap and cornice
      faceRect(-8.3, 8.3, 11.4, 11.9, z, css(mix([24, 16, 14], FOG, fog)));
      faceRect(-7.8, 7.8, 8.55, 8.75, z, css(mix([24, 16, 14], FOG, fog)));
      // the name board (lit from the entry side only)
      const gs = this.gates[r.gate][exit ? 0 : 1];
      sprite(gs.c, -4.5 - gs.pad, 4.5 + gs.pad, 9.0 - gs.pad, 10.6 + gs.pad, z, 1);
      // bulbs tracing the arch
      const lf = lightFog(d);
      G.fillStyle = css([255, 238, 205]);
      const rpx = Math.max(0.6, 0.08 * F / d);
      const bulbs = [];
      for (let k = 0; k <= 22; k++) {
        const a = Math.PI - Math.PI * k / 22;
        bulbs.push([6.55 * Math.cos(a), 5.6 + 2.95 * Math.sin(a)]);
      }
      for (let k = 0; k < 6; k++) { bulbs.push([-6.55, 5.6 - k * 0.95]); bulbs.push([6.55, 5.6 - k * 0.95]); }
      for (const [bx, by] of bulbs) { G.beginPath(); G.arc(sx(bx, z), sy(by, z), rpx, 0, 7); G.fill(); }
      G.globalCompositeOperation = 'lighter';
      for (const [bx, by] of bulbs) glowAt(this.glowBulb, bx, by, z, 0.42, 0.5 * lf);
      G.globalCompositeOperation = 'source-over';
      ALPHA = 1; G.globalAlpha = 1;
    },
  });
})();
