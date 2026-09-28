// Marionette — batch 06, "Stage and strings" (harness/briefs/batch-06-ideas.md).
//
// A Czech wooden marionette theatre seen from the front row: a painted
// proscenium, a red pelmet lettered MARIONETY, velvet curtains, footlights, the
// heads of the children in the audience along the bottom, and above the arch
// the puppeteer's two hands working the control. On the stage a Kašpárek-style
// wooden jester (red cap, bobble, rosy cheeks) hangs from visible strings in
// front of a painted panorama cloth that rolls slowly past behind him, so he
// is always travelling somewhere.
//
// The puppet is a real little rig: a pendulum from the control bar, effectors
// for pelvis, hands and feet chasing their pose on springs (stiff when he is
// held, loose and overshooting when he dances), two-bone IK for arms and legs,
// and a floppy cap tip on its own spring. So every move follows through the
// way only a puppet's does.
//
// Music, each in its own place:
//   kick   one string is jerked: the next limb in turn (left hand, right knee,
//          right hand, left knee) flies up on it, and that one string catches
//          the light. Nothing else moves with it.
//   snare  the whole puppet swings on its strings like a pendulum
//   bass   the painted cloth breathes (a slow ripple) and the props hanging on
//          wires (sun, clouds, moon) bob; the panorama runs faster
//   hats   the footlights twinkle bulb by bulb
//   build  the hands gather the strings: he is lifted onto his toes, arms out,
//          held and trembling slightly, and the footlights come up
//   drop   the strings slacken and he dances loose (a jig, knees out, arms
//          flying), the cloth flies out and a new painted set drops in (forest,
//          town, night in turn), the stage light opens up, confetti falls from
//          the flies and the children bob
//   breakdown  he folds gently into a sit, like a doll put down, the curtains
//          half-draw and the light narrows to one warm pool
// Matte Canvas 2D: flat gouache fills, dark outlines, a paper grain multiplied
// over everything. The stage light is a multiplied pool, not a glow.

(function () {
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const TAU = Math.PI * 2;

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Stage geometry, in stage units (the block is 600 tall, x centred).
  const OY0 = 128;           // top of the opening (behind the pelmet)
  const FB = 462;            // back edge of the stage floor = foot of the cloth
  const FF = 505;            // front lip of the stage
  const FY = 493;            // where his feet stand
  const BH = FB - OY0 + 6;   // painted cloth height

  const SCENES = [
    {
      name: 'Forest',
      sky: ['#EFD9A6', '#F6EBCB'], wall: '#2C1F1A',
      gel: [255, 236, 196], conf: ['#D8412F', '#F2C24B', '#3E7C4A', '#F4ECD8', '#2F5B9A'],
    },
    {
      name: 'Town',
      sky: ['#E58F74', '#F4CF9C'], wall: '#2C1E1C',
      gel: [255, 222, 200], conf: ['#F2C24B', '#F4ECD8', '#6E9BC8', '#D8412F', '#8FB37A'],
    },
    {
      name: 'Night',
      sky: ['#18214A', '#34457A'], wall: '#1B1822',
      gel: [214, 222, 255], conf: ['#F4DC8A', '#F4ECD8', '#E07A8C', '#8FC2E8', '#F2C24B'],
    },
  ];

  const PRESETS = {
    calm: { lift: 0.5, dance: 0.15, scroll: 0.35, lights: 0.3, curtain: 0.92 },
    drop: { lift: 0.3, dance: 1, scroll: 1.3, lights: 1, curtain: 1 },
    tiptoe: { lift: 1, dance: 0, scroll: 0.12, lights: 0.6, curtain: 1 },
    interval: { lift: 0, dance: 0, scroll: 0.06, lights: 0.1, curtain: 0.5 },
  };
  const DRIVE = ['lift', 'dance', 'scroll', 'lights', 'curtain'];

  // Two-bone IK. The elbow/knee goes to whichever side is further out from
  // the body (and a little lower), so limbs always bend like a doll's.
  function ik(ax, ay, tx, ty, l1, l2, out) {
    let dx = tx - ax, dy = ty - ay;
    let d = Math.hypot(dx, dy) || 1e-3;
    const dm = clamp(d, Math.abs(l1 - l2) + 1, l1 + l2 - 0.5);
    const ux = dx / d, uy = dy / d;
    const ex = ax + ux * dm, ey = ay + uy * dm;
    const a = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const mx = ax + ux * a, my = ay + uy * a;
    const k1x = mx - uy * h, k1y = my + ux * h;
    const k2x = mx + uy * h, k2y = my - ux * h;
    const s1 = (k1x - ax) * out + 0.4 * (k1y - ay);
    const s2 = (k2x - ax) * out + 0.4 * (k2y - ay);
    return s1 >= s2 ? [k1x, k1y, ex, ey] : [k2x, k2y, ex, ey];
  }

  function spring(o, tx, ty, k, zeta, dt) {
    const c = 2 * Math.sqrt(k) * zeta;
    o.vx += (k * (tx - o.x) - c * o.vx) * dt;
    o.vy += (k * (ty - o.y) - c * o.vy) * dt;
    o.x += o.vx * dt; o.y += o.vy * dt;
  }

  VIZ.register({
    id: 'marionette',
    name: 'Marionette',
    order: 819,

    params: [
      { key: 'scene', label: 'Backdrop', type: 'select', options: SCENES.map((s) => s.name), default: 0 },
      { key: 'lift', label: 'String lift (sit → toes)', type: 'range', min: 0, max: 1, default: PRESETS.calm.lift, step: 0.01 },
      { key: 'dance', label: 'Dance', type: 'range', min: 0, max: 1, default: PRESETS.calm.dance, step: 0.01 },
      { key: 'scroll', label: 'Panorama speed', type: 'range', min: 0, max: 2, default: PRESETS.calm.scroll, step: 0.01 },
      { key: 'lights', label: 'Show lights', type: 'range', min: 0, max: 1, default: PRESETS.calm.lights, step: 0.01 },
      { key: 'curtain', label: 'Curtain open', type: 'range', min: 0, max: 1, default: PRESETS.calm.curtain, step: 0.01 },
      { key: 'reaction', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'follow', label: 'Follow the track', type: 'select', options: ['Off', 'On'], default: 1 },
    ],
    presets: PRESETS,

    gallery: {
      title: 'Marionette',
      technique: 'Canvas 2D: a spring-and-IK puppet rig (pendulum swing from the control bar, sprung effectors for pelvis, hands, feet and cap tip, two-bone IK with outward-bending joints), strings drawn as bowed quadratic curves whose slack follows the lift, a panorama cloth painted once per set into wrapped offscreen tiles and scrolled in rippling strips, a multiplied stage-light pool, onset detection against the previous frame, a section follower that blends the params toward tiptoe, drop and interval presets',
      brief: 'A Czech wooden marionette theatre from the front row: painted proscenium, a red pelmet lettered MARIONETY, velvet curtains, footlights, children\'s heads along the bottom and the puppeteer\'s hands above the arch. A Kašpárek-style jester hangs on visible strings in front of a painted panorama that rolls slowly past. Each kick jerks one string, and that one limb flies up while its string catches the light; each snare swings the whole puppet like a pendulum; the bass makes the cloth breathe and the props on wires bob; hats twinkle the footlights. Through the build the hands gather the strings and lift him onto his toes, arms out, held; on the drop the strings slacken and he dances a loose jig while a new painted set flies in (forest, town, night), the light opens up and confetti falls; in the breakdown he folds gently into a sit and the curtains half-draw.',
      lineage: [
        'Batch 06 idea 19, "Stage and strings" (Director). The marionette alternative, with the woodcut theatre\'s best parts folded in: a character whose pose changes with the section is what the Director ranks highest, and the marionette gives build (lifted onto the toes), drop (strings slacken, loose dance) and breakdown (folded into a sit) three unmistakable poses, while the kick gets one string and one limb, the most confined legible beat available. From the theatre alternative it takes the set that changes per drop and the curtain that draws in the breakdown.',
        'Paper (flat painted cut-outs on a stage), Zagreb (a protagonist dancing pose to pose, a town panning behind him in planes), Penny Dreadful (theatre as the frame), Thresholds.',
        'Czech marionette theatre (Kašpárek, the Spejbl and Hurvínek stage), painted panorama cloths, folk-painted proscenia.',
        'Presets: calm (standing, strolling), drop (loose jig, full lights), tiptoe (held on his toes, arms out), interval (sitting, curtains half drawn, one warm pool).',
      ].join(' '),
    },

    setup() { this.init(); },
    enter() { if (!this.env) this.init(); },

    init() {
      this.rng = mulberry(Math.floor(Math.random() * 1e9) + 7);
      this.lastT = null;
      this.prev = new Float32Array(9);
      this.env = {
        low: 0, dropOn: false, hadDrop: false, drops: 0,
        auto: 0, bld: 0, rest: 0, hat: 0, hatLvl: 0, bass: 0,
        lastKick: -10, lastSnare: -10, lastHat: -10,
        period: 60 / 124, phase: 0, phaseErr: 0, kicks: 0, snares: 0,
      };
      const E = () => ({ x: 0, y: 0, vx: 0, vy: 0 });
      this.rig = null;
      this.pv = { pel: E(), hL: E(), hR: E(), fL: E(), fR: E(), cap: E(), sw: 0, sww: 0, lean: 0, leanV: 0, tilt: 0, tiltV: 0 };
      this.jerk = [0, 0, 0, 0];     // hand L, knee R, hand R, knee L
      this.bulbs = new Float32Array(11).fill(0.5);
      this.scroll = 0;
      this.shown = -1;
      this.fly = null;
      this.tiles = {};
      this.confetti = [];
      this.grain = null;
      this.pxs = 0;
      this.crowd = null;
      this.blinkAt = 3;
    },

    // ---------------------------------------------------------------- audio

    listen(s, t, dt, P, react, follow) {
      const e = this.env;
      let kick = false, snare = false;
      if (s[0] > 45 && s[0] - this.prev[0] > 14 && t - e.lastKick > 0.22) {
        const iv = t - e.lastKick;
        if (iv > 0.3 && iv < 0.9) e.period = lerp(e.period, iv, 0.3);
        e.lastKick = t; kick = true;
      }
      if (s[4] > 40 && s[4] - this.prev[4] > 16 && t - e.lastSnare > 0.26) { e.lastSnare = t; snare = true; }
      let hat = false;
      if (s[8] - this.prev[8] > 8 && s[8] > 18 && t - e.lastHat > 0.07) { e.lastHat = t; hat = true; }
      this.prev.set(s);

      const hatNow = (s[6] + s[7] + s[8]) / 300;
      e.hat = ease(e.hat, hatNow, 1.5, dt);
      e.hatLvl = ease(e.hatLvl, hatNow, hatNow > e.hatLvl ? 25 : 5, dt);
      e.bass = ease(e.bass, Math.max(s[0], s[1]) / 100, 1.6, dt);
      e.low = ease(e.low, s[1], 1.1, dt);
      if (!e.dropOn && (e.low > 27 || (s[0] > 90 && s[1] > 90))) {
        e.dropOn = true; e.hadDrop = true; e.drops++;
      } else if (e.dropOn && e.low < 19) e.dropOn = false;

      // Section weights for Follow: the build lifts him onto his toes, the
      // drop sets him dancing, and a kick-less stretch after a drop sits him
      // down. The rest weight eases slowly so he folds rather than drops.
      const bTarget = e.dropOn ? 0 : smooth(0.025, 0.16, e.hat);
      e.bld = ease(e.bld, bTarget, bTarget > e.bld ? 1.2 : 2.5, dt);
      const rTarget = e.hadDrop && !e.dropOn && t - e.lastKick > 1.0 && e.bld < 0.4 ? 1 : 0;
      e.rest = ease(e.rest, rTarget, rTarget ? 0.9 : 1.6, dt);
      e.auto = ease(e.auto, e.dropOn ? 1 : 0, e.dropOn ? 3 : 1.0, dt);

      if (kick) {
        const err = Math.round(e.phase) - e.phase;
        e.phaseErr = err;
        const i = e.kicks++ % 4;
        this.jerk[i] = 1;
        const pv = this.pv;
        const amp = react * (0.55 + 0.45 * P.dance) * (0.4 + 0.6 * smooth(0.05, 0.35, P.lift));
        const o = [pv.hL, pv.fR, pv.hR, pv.fL][i];
        const out = i === 0 || i === 3 ? -1 : 1;
        if (i % 2 === 0) { o.vy -= 520 * amp; o.vx += out * 150 * amp; }
        else { o.vy -= 430 * amp; o.vx += out * 150 * amp; }
      }
      if (snare) {
        const dir = e.snares++ % 2 ? 1 : -1;
        this.pv.sww += dir * 0.75 * react * (0.5 + 0.5 * smooth(0.05, 0.35, P.lift));
      }
      if (hat) {
        for (let i = 0; i < this.bulbs.length; i++) if (this.rng() < 0.45) this.bulbs[i] = 0.3 + this.rng() * 0.9;
      }
    },

    // ---------------------------------------------------------------- rig

    pose(t, dt, P, px) {
      const e = this.env, pv = this.pv;
      const D = P.dance, lift = P.lift;
      const tp = smooth(0.6, 1, lift);          // on his toes
      const sa = 1 - smooth(0.04, 0.42, lift);  // sitting
      const st = 1 - sa;
      const Dn = D * st * (1 - 0.75 * tp);

      // pelvis height above the floor
      const Hh = lift < 0.5 ? lerp(19, 99, smooth(0, 1, lift / 0.5)) : lerp(99, 113, (lift - 0.5) / 0.5);

      // swing: a damped pendulum hanging from the bar
      const w0 = TAU * 0.55;
      pv.sww += (-w0 * w0 * pv.sw - 2 * 0.22 * w0 * pv.sww) * dt;
      pv.sw += pv.sww * dt;
      const Ls = 250 * st + 40;
      const swx = Ls * Math.sin(pv.sw), swy = Ls * (1 - Math.cos(pv.sw));

      const ph = e.phase, b = Math.floor(ph), f = ph - b;
      const side = b % 2 ? 1 : -1;
      const s1 = Math.sin(Math.PI * f);
      const sway = Math.sin(Math.PI * ph);
      const breathe = Math.sin(t * 1.7);

      const k = lerp(120, 42, D), z = lerp(0.8, 0.3, D);
      const pelTx = px + swx + Dn * 10 * sway;
      const pelTy = FY - Hh - swy + Dn * 11 * Math.cos(TAU * f) + 1.2 * breathe;
      spring(pv.pel, pelTx, pelTy, k * 1.6, lerp(0.85, 0.45, D), dt);
      const P0x = pv.pel.x, P0y = pv.pel.y;

      // torso lean and head tilt, each on its own spring
      const leanT = Dn * 0.13 * sway - pv.sww * 0.08 + sa * 0.06 * Math.sin(t * 0.4);
      pv.leanV += (60 * (leanT - pv.lean) - 2 * Math.sqrt(60) * 0.5 * pv.leanV) * dt; pv.lean += pv.leanV * dt;
      const tiltT = Dn * 0.2 * Math.sin(Math.PI * ph + 0.9) + sa * 0.26 + 0.05 * Math.sin(t * 0.53) - pv.sww * 0.12 - tp * 0.04;
      pv.tiltV += (50 * (tiltT - pv.tilt) - 2 * Math.sqrt(50) * lerp(0.6, 0.3, D) * pv.tiltV) * dt; pv.tilt += pv.tiltV * dt;

      const a = pv.lean, ca = Math.cos(a), sn = Math.sin(a);
      const rot = (x, y) => [x * ca - y * sn, x * sn + y * ca];
      const [nx, ny] = rot(0, -66);
      const N = [P0x + nx, P0y + ny];
      const shL = [N[0] + rot(-21, 9)[0], N[1] + rot(-21, 9)[1]];
      const shR = [N[0] + rot(21, 9)[0], N[1] + rot(21, 9)[1]];

      // hands: hanging / arms out on the toes / resting on the floor / dancing
      const hTarget = (sgn, sh) => {
        let x = sh[0] + sgn * 12, y = sh[1] + 72;
        x = lerp(x, sh[0] + sgn * 64, tp); y = lerp(y, sh[1] - 22, tp);
        x = lerp(x, P0x + sgn * 44, sa); y = lerp(y, FY - 6, sa);
        const up = (side === sgn ? 0 : 1) * s1;          // opposite hand to the lifted leg
        x += sgn * Dn * (26 * up + 10);
        y -= Dn * (86 * up + 12 * s1);
        y += tp * 2.2 * Math.sin(t * 23 + sgn) * e.hatLvl * 4; // held, trembling
        return [x + 0.6 * swx * 0, y];
      };
      const hl = hTarget(-1, shL), hr = hTarget(1, shR);
      spring(pv.hL, hl[0], hl[1], k, z, dt);
      spring(pv.hR, hr[0], hr[1], k, z, dt);

      // feet
      const fTarget = (sgn) => {
        let x = P0x + sgn * 19, y = FY;
        x = lerp(x, P0x + sgn * 80, sa);
        const up = side === sgn ? s1 : 0;
        x += sgn * Dn * 26 * up;
        y -= Dn * 58 * up;
        // a stroll in place when he is standing and the cloth is moving
        const walk = st * (1 - tp) * (1 - D) * smooth(0.05, 0.4, P.scroll);
        y -= walk * 9 * Math.max(0, Math.sin(Math.PI * ph + (sgn > 0 ? 0 : Math.PI)));
        return [x, y];
      };
      const fl = fTarget(-1), fr = fTarget(1);
      spring(pv.fL, fl[0], fl[1], k * 1.2, z, dt);
      spring(pv.fR, fr[0], fr[1], k * 1.2, z, dt);
      for (const o of [pv.fL, pv.fR]) if (o.y > FY) { o.y = FY; if (o.vy > 0) o.vy = 0; o.vx *= Math.exp(-12 * dt); }

      // joints
      const hipL = [P0x - 12, P0y + 4], hipR = [P0x + 12, P0y + 4];
      const legL = ik(hipL[0], hipL[1], pv.fL.x, pv.fL.y, 51, 50, -1);
      const legR = ik(hipR[0], hipR[1], pv.fR.x, pv.fR.y, 51, 50, 1);
      const armL = ik(shL[0], shL[1], pv.hL.x, pv.hL.y, 38, 38, -1);
      const armR = ik(shR[0], shR[1], pv.hR.x, pv.hR.y, 38, 38, 1);
      const ht = a + pv.tilt;
      const Hc = [N[0] + Math.sin(ht) * 31, N[1] - Math.cos(ht) * 31];

      // the cap tip: a floppy point trailing the head
      const capBase = [Hc[0] + Math.sin(ht) * 24, Hc[1] - Math.cos(ht) * 24];
      spring(pv.cap, capBase[0] + 30 + 8 * Math.cos(ht), capBase[1] + 8, 70, 0.28, dt);
      const cdx = pv.cap.x - capBase[0], cdy = pv.cap.y - capBase[1], cd = Math.hypot(cdx, cdy) || 1;
      if (cd > 42) { pv.cap.x = capBase[0] + cdx / cd * 42; pv.cap.y = capBase[1] + cdy / cd * 42; }

      const toe = Math.max(tp, smooth(4, 20, FY - Math.max(legL[3], legR[3])) * 0.8);
      return { P: [P0x, P0y], N, shL, shR, hipL, hipR, legL, legR, armL, armR, Hc, ht, lean: a, capBase, cap: [pv.cap.x, pv.cap.y], toe, sa, tp, Hh };
    },

    // ---------------------------------------------------------------- painting

    makeGrain(pxs) {
      const n = 256, rng = mulberry(31);
      const cv = canvas(n, n), g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, n, n);
      const img = g.getImageData(0, 0, n, n);
      for (let i = 0; i < n * n; i++) {
        const r = rng();
        const v = r < 0.06 ? 200 + rng() * 30 : r < 0.3 ? 236 + rng() * 14 : 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      }
      g.putImageData(img, 0, 0);
      g.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = 'rgba(150,130,110,' + (0.08 + rng() * 0.1).toFixed(3) + ')';
        g.lineWidth = 0.7;
        const x = rng() * n, y = rng() * n, l = 4 + rng() * 10, an = rng() * Math.PI;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
      }
      return cv;
    },

    // One painted set: a far and a near tile, each wrapping every TW units and
    // padded by one opening width so any window of the cloth is contiguous.
    paintSet(si, OW, pxs) {
      const TW = Math.round(OW * 1.6);
      const mk = () => { const cv = canvas((TW + OW) * pxs, BH * pxs); const g = cv.getContext('2d'); g.setTransform(pxs, 0, 0, pxs, 0, 0); return [cv, g]; };
      const [farC, far] = mk();
      const [nearC, near] = mk();
      const rng = mulberry(101 + si * 17);
      const wrap = (fn, x) => { fn(x); fn(x + TW); fn(x - TW); };
      const ink = '#3A2418';
      const hill = (g, y0, amps, col, edge) => {
        g.beginPath(); g.moveTo(0, BH);
        for (let x = 0; x <= TW + OW; x += 6) {
          let y = y0;
          for (const [amp, n, ph] of amps) y -= amp * Math.sin(TAU * n * x / TW + ph);
          g.lineTo(x, y);
        }
        g.lineTo(TW + OW, BH); g.closePath();
        g.fillStyle = col; g.fill();
        if (edge) { g.strokeStyle = edge; g.lineWidth = 1.6; g.stroke(); }
      };
      const hillY = (y0, amps, x) => { let y = y0; for (const [amp, n, ph] of amps) y -= amp * Math.sin(TAU * n * x / TW + ph); return y; };
      const fir = (g, x, base, h, col, lineCol) => {
        g.fillStyle = col; g.strokeStyle = lineCol; g.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) {
          const y1 = base - h * (0.22 + i * 0.28), w = h * (0.36 - i * 0.08);
          g.beginPath(); g.moveTo(x, y1 - h * 0.42); g.lineTo(x + w, y1 + h * 0.08); g.lineTo(x - w, y1 + h * 0.08); g.closePath();
          g.fill(); if (lineCol) g.stroke();
        }
      };

      if (si === 0) {
        // Forest: rolling hills with little firs, then folk trees and toadstools.
        const A1 = [[14, 2, 0.4], [9, 5, 1.3]], A2 = [[10, 3, 2.1], [6, 7, 0.2]];
        hill(far, 190, A1, '#B7CD9E', null);
        for (let i = 0; i < 22; i++) {
          const x = rng() * TW;
          wrap((xx) => fir(far, xx, hillY(190, A1, ((xx % TW) + TW) % TW) + 6, 22 + rng() * 10, '#86A983', null), x);
        }
        hill(far, 240, A2, '#93B68A', '#6E9471');
        for (let i = 0; i < 16; i++) {
          const x = rng() * TW, h = 34 + rng() * 16;
          wrap((xx) => fir(far, xx, hillY(240, A2, ((xx % TW) + TW) % TW) + 8, h, '#5E8C68', '#40684D'), x);
        }
        near.fillStyle = '#76A15A'; near.fillRect(0, BH - 26, TW + OW, 26);
        near.strokeStyle = '#4E7A3E'; near.lineWidth = 1.6;
        near.beginPath(); near.moveTo(0, BH - 26); near.lineTo(TW + OW, BH - 26); near.stroke();
        let x = 20;
        while (x < TW - 40) {
          const kind = rng();
          const h = 110 + rng() * 80;
          const cx = x;
          if (kind < 0.5) {
            const r = 34 + rng() * 16, col = rng() < 0.5 ? '#3E7C4A' : '#5B9A4F';
            const dots = []; for (let i = 0; i < 9; i++) dots.push([(rng() - 0.5) * r * 1.3, (rng() - 0.5) * r * 1.3]);
            wrap((xx) => {
              near.fillStyle = '#8A5A32'; near.strokeStyle = ink; near.lineWidth = 1.6;
              near.beginPath(); near.rect(xx - 5, BH - 26 - h + r, 10, h - r + 4); near.fill(); near.stroke();
              near.fillStyle = col; near.beginPath(); near.arc(xx, BH - 26 - h + r * 0.4, r, 0, TAU); near.fill(); near.stroke();
              near.fillStyle = 'rgba(255,248,210,0.28)';
              for (const [dx, dy] of dots) { near.beginPath(); near.ellipse(xx + dx, BH - 26 - h + r * 0.4 + dy, 4, 7, 0.5, 0, TAU); near.fill(); }
            }, cx);
          } else if (kind < 0.85) {
            wrap((xx) => {
              near.fillStyle = '#6B4428'; near.fillRect(xx - 3, BH - 36, 6, 12);
              fir(near, xx, BH - 30, h * 0.9, '#2F6048', ink);
            }, cx);
          } else {
            wrap((xx) => {
              for (let j = 0; j < 3; j++) {
                const tx = xx + j * 16 - 16, s = 0.7 + ((j * 37) % 5) * 0.12;
                near.fillStyle = '#F4ECD8'; near.strokeStyle = ink; near.lineWidth = 1.3;
                near.beginPath(); near.rect(tx - 3 * s, BH - 26 - 14 * s, 6 * s, 14 * s); near.fill(); near.stroke();
                near.fillStyle = '#D8412F'; near.beginPath(); near.ellipse(tx, BH - 26 - 14 * s, 11 * s, 7 * s, 0, Math.PI, TAU); near.closePath(); near.fill(); near.stroke();
                near.fillStyle = '#F4ECD8';
                near.beginPath(); near.arc(tx - 4 * s, BH - 26 - 17 * s, 1.6 * s, 0, TAU); near.arc(tx + 3 * s, BH - 26 - 19 * s, 1.4 * s, 0, TAU); near.fill();
              }
            }, cx);
          }
          x += 70 + rng() * 70;
        }
        // flowers in the grass
        for (let i = 0; i < 50; i++) {
          const fx = rng() * TW, fy = BH - 20 + rng() * 16, col = ['#F2C24B', '#F4ECD8', '#D8412F'][i % 3];
          wrap((xx) => { near.fillStyle = col; near.beginPath(); near.arc(xx, fy, 2.2, 0, TAU); near.fill(); }, fx);
        }
      } else if (si === 1) {
        // Town: a skyline of spires and domes, then a row of gabled houses.
        const sil = '#B46B72', sil2 = '#9A5566';
        far.fillStyle = sil; far.fillRect(0, 250, TW + OW, BH - 250);
        let x = 0;
        while (x < TW) {
          const w = 30 + rng() * 40, h = 40 + rng() * 70, kind = rng();
          wrap((xx) => {
            far.fillStyle = sil;
            far.fillRect(xx, 252 - h, w, h);
            if (kind < 0.35) { far.beginPath(); far.moveTo(xx + w * 0.3, 252 - h); far.lineTo(xx + w * 0.5, 252 - h - 60); far.lineTo(xx + w * 0.7, 252 - h); far.fill(); }
            else if (kind < 0.6) { far.beginPath(); far.arc(xx + w / 2, 252 - h, w * 0.42, Math.PI, TAU); far.fill(); far.fillRect(xx + w / 2 - 2, 252 - h - w * 0.42 - 14, 4, 16); }
            else { far.beginPath(); far.moveTo(xx - 2, 252 - h); far.lineTo(xx + w / 2, 252 - h - 22); far.lineTo(xx + w + 2, 252 - h); far.fill(); }
          }, x);
          x += w + rng() * 20;
        }
        far.fillStyle = sil2; far.fillRect(0, 262, TW + OW, BH - 262);
        const walls = ['#F1DDB4', '#E9B98A', '#F4E6CF', '#D99A86', '#C7D1A9', '#EAC77A'];
        x = 0;
        while (x < TW) {
          const w = 62 + rng() * 34, h = 90 + rng() * 70, wall = walls[Math.floor(rng() * walls.length)];
          const roof = rng() < 0.5 ? '#B8452F' : '#8E3A2E', rows = Math.max(2, Math.floor(h / 42)), cols = w > 80 ? 3 : 2;
          const lit = []; for (let i = 0; i < rows * cols; i++) lit.push(rng() < 0.55);
          const chim = rng() < 0.6;
          const base = BH - 4;
          wrap((xx) => {
            near.strokeStyle = ink; near.lineWidth = 1.6;
            near.fillStyle = wall; near.beginPath(); near.rect(xx, base - h, w, h); near.fill(); near.stroke();
            if (chim) { near.fillStyle = '#7A3A2C'; near.beginPath(); near.rect(xx + w * 0.7, base - h - 38, 9, 26); near.fill(); near.stroke(); }
            near.fillStyle = roof; near.beginPath(); near.moveTo(xx - 5, base - h); near.lineTo(xx + w / 2, base - h - 34 - w * 0.12); near.lineTo(xx + w + 5, base - h); near.closePath(); near.fill(); near.stroke();
            for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
              const wx = xx + (q + 0.5) * w / cols - 6, wy = base - h + 14 + r * 38;
              if (wy + 18 > base - 4) continue;
              near.fillStyle = lit[r * cols + q] ? '#FFD76A' : '#5B4A5E';
              near.beginPath(); near.rect(wx, wy, 12, 17); near.fill(); near.stroke();
            }
          }, x);
          x += w + 4 + rng() * 26;
        }
      } else {
        // Night: blue hills with a few lit windows, then firs and a cottage.
        const A1 = [[16, 2, 1.1], [7, 6, 0.3]];
        hill(far, 215, A1, '#2C3C66', null);
        for (let i = 0; i < 14; i++) {
          const x = rng() * TW;
          wrap((xx) => { far.fillStyle = '#F4D27A'; far.fillRect(xx, hillY(215, A1, ((xx % TW) + TW) % TW) + 14 + rng() * 20, 3, 4); }, x);
        }
        hill(far, 262, [[9, 3, 0.7], [5, 8, 2]], '#223156', '#18244A');
        let x = 20;
        let cottage = false;
        while (x < TW - 40) {
          if (!cottage && x > TW * 0.4) {
            cottage = true;
            wrap((xx) => {
              const base = BH - 4;
              near.strokeStyle = '#0E1530'; near.lineWidth = 1.6;
              near.fillStyle = '#3A3F66'; near.beginPath(); near.rect(xx, base - 70, 90, 70); near.fill(); near.stroke();
              near.fillStyle = '#1C2446'; near.beginPath(); near.moveTo(xx - 8, base - 70); near.lineTo(xx + 45, base - 118); near.lineTo(xx + 98, base - 70); near.closePath(); near.fill(); near.stroke();
              near.fillStyle = '#FFD06A'; near.beginPath(); near.rect(xx + 16, base - 52, 18, 18); near.rect(xx + 56, base - 52, 18, 18); near.fill(); near.stroke();
              near.fillStyle = '#2A2F52'; near.beginPath(); near.rect(xx + 64, base - 118, 10, 30); near.fill(); near.stroke();
              near.fillStyle = 'rgba(200,210,240,0.5)';
              for (let j = 0; j < 4; j++) { near.beginPath(); near.arc(xx + 72 + j * 9, base - 128 - j * 13, 5 + j * 2, 0, TAU); near.fill(); }
            }, x);
            x += 120;
            continue;
          }
          const h = 70 + rng() * 110;
          wrap((xx) => fir(near, xx, BH - 2, h, '#15213F', '#0B1128'), x);
          x += 34 + rng() * 60;
        }
        near.fillStyle = '#131B36'; near.fillRect(0, BH - 8, TW + OW, 8);
      }
      return { far: farC, near: nearC, TW };
    },

    getSet(si, OW, pxs) {
      const key = si + ':' + OW.toFixed(1) + ':' + pxs.toFixed(3);
      if (!this.tiles[key]) {
        // keep at most two sets alive (the one leaving and the one arriving)
        const keys = Object.keys(this.tiles);
        if (keys.length >= 2) delete this.tiles[keys[0]];
        this.tiles[key] = this.paintSet(si, OW, pxs);
      }
      return this.tiles[key];
    },

    // The cloth: sky, props on wires, far and near tiles in rippling strips.
    drawCloth(c, si, OW, t, yOff, bass, react, pxs) {
      const S = SCENES[si];
      const x0 = -OW / 2;
      const g = c.createLinearGradient(0, OY0, 0, FB);
      g.addColorStop(0, S.sky[0]); g.addColorStop(1, S.sky[1]);
      c.fillStyle = g; c.fillRect(x0, OY0 + yOff, OW, BH);
      const bob = (i) => Math.sin(t * 1.3 + i * 2.1) * 3 + bass * react * 7 * Math.sin(t * 2.2 + i);
      const wire = (x, y) => { c.strokeStyle = 'rgba(40,25,20,0.45)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, OY0 + yOff); c.lineTo(x, y); c.stroke(); };
      c.strokeStyle = '#3A2418'; c.lineWidth = 1.6;
      if (si === 0) {
        const sx = x0 + OW * 0.2, sy = OY0 + 92 + bob(0) + yOff;
        wire(sx, sy - 30);
        c.save(); c.translate(sx, sy); c.rotate(t * 0.15);
        c.fillStyle = '#F0B64A';
        c.beginPath();
        for (let i = 0; i < 12; i++) {
          const a0 = i / 12 * TAU;
          c.moveTo(Math.cos(a0 - 0.12) * 32, Math.sin(a0 - 0.12) * 32);
          c.lineTo(Math.cos(a0) * 50, Math.sin(a0) * 50);
          c.lineTo(Math.cos(a0 + 0.12) * 32, Math.sin(a0 + 0.12) * 32);
        }
        c.fill(); c.strokeStyle = '#3A2418'; c.stroke();
        c.fillStyle = '#F6C85C'; c.beginPath(); c.arc(0, 0, 30, 0, TAU); c.fill(); c.stroke();
        c.restore();
        c.fillStyle = '#3A2418';
        c.beginPath(); c.arc(sx - 9, sy - 4, 2.2, 0, TAU); c.arc(sx + 9, sy - 4, 2.2, 0, TAU); c.fill();
        c.beginPath(); c.arc(sx, sy + 3, 10, 0.2, Math.PI - 0.2); c.stroke();
      } else if (si === 1) {
        for (let i = 0; i < 3; i++) {
          const cx = x0 + OW * (0.18 + i * 0.33), cy = OY0 + 70 + i * 22 + bob(i) + yOff;
          wire(cx - 20, cy - 16); wire(cx + 22, cy - 14);
          c.fillStyle = '#FBF1DC'; c.strokeStyle = '#3A2418'; c.lineWidth = 1.6;
          c.beginPath();
          c.arc(cx - 26, cy + 4, 14, Math.PI * 0.5, Math.PI * 1.5);
          c.arc(cx - 8, cy - 8, 18, Math.PI, TAU);
          c.arc(cx + 18, cy - 2, 16, Math.PI * 1.2, Math.PI * 0.5 + TAU);
          c.closePath(); c.fill(); c.stroke();
        }
        // birds on sticks
        c.strokeStyle = '#3A2418'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const bx = x0 + OW * (0.55 + i * 0.07) + Math.sin(t * 0.5 + i) * 10, by = OY0 + 60 + i * 9 + bob(i + 3) + yOff, fl = Math.sin(t * 5 + i * 2) * 4;
          c.beginPath(); c.moveTo(bx - 9, by - fl); c.quadraticCurveTo(bx - 4, by - 5, bx, by); c.quadraticCurveTo(bx + 4, by - 5, bx + 9, by - fl); c.stroke();
        }
      } else {
        const mx = x0 + OW * 0.76, my = OY0 + 80 + bob(0) + yOff;
        wire(mx, my - 34);
        c.fillStyle = '#F4DC8A'; c.strokeStyle = '#2A2240'; c.lineWidth = 1.6;
        c.beginPath(); c.arc(mx, my, 36, -Math.PI * 0.62, Math.PI * 0.62, false);
        c.arc(mx + 16, my - 4, 30, Math.PI * 0.52, -Math.PI * 0.62, true); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#2A2240'; c.beginPath(); c.arc(mx + 22, my - 2, 2, 0, TAU); c.fill();
        for (let i = 0; i < 7; i++) {
          const sx = x0 + OW * (0.08 + i * 0.12), sy = OY0 + 40 + ((i * 53) % 90) + bob(i + 1) * 0.6 + yOff;
          if (Math.abs(sx - mx) < 60 && Math.abs(sy - my) < 60) continue;
          if (i % 2) wire(sx, sy - 8);
          const r = 7 + (i % 3) * 2, tw = 1 + 0.15 * Math.sin(t * 2 + i);
          c.fillStyle = '#F4DC8A';
          c.beginPath();
          for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, rr = (j % 2 ? r * 0.45 : r) * tw; c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
          c.closePath(); c.fill(); c.stroke();
        }
      }

      const set = this.getSet(si, OW, pxs);
      const A = 1.2 + 5 * bass * react;
      const layer = (cv, scr) => {
        const off = ((scr % set.TW) + set.TW) % set.TW;
        const SW = 12;
        for (let x = 0; x < OW; x += SW) {
          const w = Math.min(SW, OW - x);
          const dy = A * Math.sin((x + scr * 0.2) * 0.016 - t * 1.6) + yOff;
          c.drawImage(cv, (off + x) * pxs, 0, w * pxs, BH * pxs, x0 + x - 0.25, OY0 + dy, w + 0.5, BH);
        }
      };
      layer(set.far, this.scroll * 0.35);
      layer(set.near, this.scroll);
    },

    drawPuppet(c, J, blink) {
      const ink = '#3A2218';
      const cap = (x1, y1, x2, y2, w, col) => {
        c.lineCap = 'round';
        c.strokeStyle = ink; c.lineWidth = w + 3.2;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.strokeStyle = col; c.lineWidth = w;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      };
      const peg = (x, y, r) => { c.fillStyle = '#C9975E'; c.strokeStyle = ink; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke(); };

      // legs
      for (const [hip, leg, sgn] of [[J.hipL, J.legL, -1], [J.hipR, J.legR, 1]]) {
        cap(hip[0], hip[1], leg[0], leg[1], 15, '#2F5B9A');
        cap(leg[0], leg[1], leg[2], leg[3], 13, '#2F5B9A');
        // yellow stripe down the trouser
        c.strokeStyle = '#F2C24B'; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(leg[0], leg[1]); c.lineTo(lerp(leg[0], leg[2], 0.8), lerp(leg[1], leg[3], 0.8)); c.stroke();
        peg(leg[0], leg[1], 5.5);
        // shoe: flat on the floor, pointing down on the toes
        const dx = leg[2] - leg[0], dy = leg[3] - leg[1], dl = Math.hypot(dx, dy) || 1;
        const flatA = sgn > 0 ? 0 : Math.PI;
        const downA = Math.atan2(dy, dx);
        let an = flatA + (downA - flatA + (sgn > 0 ? 0 : 0)) * 0;
        const pointA = sgn > 0 ? lerp(0.15, 1.2, J.toe) : Math.PI - lerp(0.15, 1.2, J.toe);
        an = lerp(pointA, sgn > 0 ? -1.0 : Math.PI + 1.0, J.sa);
        c.save(); c.translate(leg[2], leg[3] + 2); c.rotate(an);
        c.fillStyle = '#2B1A14'; c.strokeStyle = ink; c.lineWidth = 1.4;
        c.beginPath(); c.ellipse(7, 0, 14, 7.5, 0, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,230,190,0.35)'; c.beginPath(); c.ellipse(10, -3, 5, 1.8, 0, 0, TAU); c.fill();
        c.restore();
        void dl;
      }

      // torso: a red jacket on a wooden body
      const [Px, Py] = J.P, [Nx, Ny] = J.N;
      const a = J.lean, ca = Math.cos(a), sa = Math.sin(a);
      const T = (x, y) => [Nx + x * ca - y * sa, Ny + x * sa + y * ca];
      c.fillStyle = '#C73A2E'; c.strokeStyle = ink; c.lineWidth = 1.7;
      c.beginPath();
      let q = T(-24, 4); c.moveTo(q[0], q[1]);
      q = T(24, 4); c.lineTo(q[0], q[1]);
      q = T(19, 70); c.lineTo(q[0], q[1]);
      q = T(-19, 70); c.lineTo(q[0], q[1]);
      c.closePath(); c.fill(); c.stroke();
      // belt and buttons
      c.fillStyle = '#3B2418';
      c.beginPath(); q = T(-20, 56); c.moveTo(q[0], q[1]); q = T(20, 56); c.lineTo(q[0], q[1]); q = T(19.5, 63); c.lineTo(q[0], q[1]); q = T(-19.5, 63); c.lineTo(q[0], q[1]); c.closePath(); c.fill();
      c.fillStyle = '#F2C24B';
      for (const yy of [22, 34, 46]) { q = T(0, yy); c.beginPath(); c.arc(q[0], q[1], 2.6, 0, TAU); c.fill(); }
      q = T(0, 59.5); c.fillRect(q[0] - 3.5, q[1] - 3.5, 7, 7);
      // ruff collar
      c.fillStyle = '#F4ECD8'; c.strokeStyle = ink; c.lineWidth = 1.3;
      c.beginPath();
      for (let i = 0; i <= 8; i++) { const u = i / 8; const pt = T(lerp(-22, 22, u), i % 2 ? 13 : 3); if (i === 0) c.moveTo(pt[0], pt[1]); else c.lineTo(pt[0], pt[1]); }
      q = T(22, 0); c.lineTo(q[0], q[1]); q = T(-22, 0); c.lineTo(q[0], q[1]);
      c.closePath(); c.fill(); c.stroke();

      // arms
      for (const [sh, arm] of [[J.shL, J.armL], [J.shR, J.armR]]) {
        cap(sh[0], sh[1], arm[0], arm[1], 12, '#C73A2E');
        cap(arm[0], arm[1], arm[2], arm[3], 11, '#C73A2E');
        peg(arm[0], arm[1], 4.5);
        const dx = arm[2] - arm[0], dy = arm[3] - arm[1], dl = Math.hypot(dx, dy) || 1;
        const cx = arm[2] - dx / dl * 5, cy = arm[3] - dy / dl * 5;
        c.strokeStyle = '#F2C24B'; c.lineWidth = 11; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(cx - dx / dl * 2, cy - dy / dl * 2); c.lineTo(cx + dx / dl * 2, cy + dy / dl * 2); c.stroke();
        c.fillStyle = '#E9C49A'; c.strokeStyle = ink; c.lineWidth = 1.5;
        c.beginPath(); c.arc(arm[2] + dx / dl * 4, arm[3] + dy / dl * 4, 8, 0, TAU); c.fill(); c.stroke();
        peg(sh[0], sh[1], 4.5);
      }

      // neck and head
      const [Hx, Hy] = J.Hc, ht = J.ht;
      peg(Nx, Ny - 2, 5);
      c.save(); c.translate(Hx, Hy); c.rotate(ht);
      // hair tufts
      c.fillStyle = '#7A4A2A'; c.strokeStyle = ink; c.lineWidth = 1.3;
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 22, -6, 7, 10, s * 0.4, 0, TAU); c.fill(); c.stroke(); }
      c.fillStyle = '#F1D3B3'; c.lineWidth = 1.7;
      c.beginPath(); c.ellipse(0, 0, 24, 26, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(233,120,108,0.55)';
      c.beginPath(); c.arc(-13, 8, 5.5, 0, TAU); c.arc(13, 8, 5.5, 0, TAU); c.fill();
      c.fillStyle = '#2A1A14';
      if (blink) {
        c.strokeStyle = '#2A1A14'; c.lineWidth = 1.8; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-12, -1); c.quadraticCurveTo(-8.5, 1.5, -5, -1); c.moveTo(5, -1); c.quadraticCurveTo(8.5, 1.5, 12, -1); c.stroke();
      } else {
        c.beginPath(); c.ellipse(-8.5, -2, 3.2, 4.2, 0, 0, TAU); c.ellipse(8.5, -2, 3.2, 4.2, 0, 0, TAU); c.fill();
        c.fillStyle = '#FFF';
        c.beginPath(); c.arc(-7.5, -3.5, 1.2, 0, TAU); c.arc(9.5, -3.5, 1.2, 0, TAU); c.fill();
      }
      c.strokeStyle = '#5A3222'; c.lineWidth = 1.5; c.lineCap = 'round';
      c.beginPath(); c.arc(-8.5, -9, 5, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
      c.beginPath(); c.arc(8.5, -9, 5, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
      c.fillStyle = '#E6A58D'; c.strokeStyle = ink; c.lineWidth = 1.3;
      c.beginPath(); c.arc(0, 5, 4.5, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#9C3A2E';
      c.beginPath(); c.moveTo(-8, 12); c.quadraticCurveTo(0, 22, 8, 12); c.quadraticCurveTo(0, 15, -8, 12); c.fill();
      c.strokeStyle = ink; c.lineWidth = 1.3; c.stroke();
      c.restore();

      // the cap: a floppy red cone whose tip trails on its spring
      const [bx, by] = J.capBase, [tx, ty] = J.cap;
      const nx = Math.cos(ht), ny = Math.sin(ht);
      const l1 = [Hx - nx * 23 + Math.sin(ht) * 8, Hy - ny * 23 - Math.cos(ht) * 8];
      const r1 = [Hx + nx * 23 + Math.sin(ht) * 8, Hy + ny * 23 - Math.cos(ht) * 8];
      c.fillStyle = '#C73A2E'; c.strokeStyle = ink; c.lineWidth = 1.7;
      c.beginPath();
      c.moveTo(l1[0], l1[1]);
      c.quadraticCurveTo(bx - nx * 10 + Math.sin(ht) * 18, by - ny * 10 - Math.cos(ht) * 18, tx, ty);
      c.quadraticCurveTo(bx + nx * 14, by + ny * 14, r1[0], r1[1]);
      c.quadraticCurveTo(Hx + Math.sin(ht) * 14, Hy - Math.cos(ht) * 14, l1[0], l1[1]);
      c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#F2C24B'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(l1[0] + nx * 2, l1[1] + ny * 2); c.quadraticCurveTo(Hx + Math.sin(ht) * 12, Hy - Math.cos(ht) * 12, r1[0] - nx * 2, r1[1] - ny * 2); c.stroke();
      c.fillStyle = '#F2C24B'; c.strokeStyle = ink; c.lineWidth = 1.4;
      c.beginPath(); c.arc(tx, ty, 6.5, 0, TAU); c.fill(); c.stroke();
    },

    // ---------------------------------------------------------------- frame

    draw(p, signals, params, ctx) {
      if (!this.env) this.init();
      const W = ctx.width, H = ctx.height;
      const t = p.millis() / 1000;
      const dt = this.lastT === null ? 1 / 60 : clamp(t - this.lastT, 0, 0.1);
      this.lastT = t;
      const e = this.env;
      const follow = Math.round(params.follow) === 1;
      const react = params.reaction;

      // Effective look: the params, pulled by Follow toward tiptoe in the
      // build, interval in the breakdown and drop in the drop.
      const P = {};
      for (const k of DRIVE) {
        let v = params[k];
        if (follow) {
          v = lerp(v, PRESETS.tiptoe[k], e.bld * (1 - e.auto));
          v = lerp(v, PRESETS.interval[k], e.rest * (1 - e.auto));
          v = lerp(v, PRESETS.drop[k], e.auto);
        }
        P[k] = v;
      }
      this.listen(signals, t, dt, P, react, follow);
      e.phase += dt / e.period;
      const corr = e.phaseErr * (1 - Math.exp(-8 * dt));
      e.phase += corr; e.phaseErr -= corr;
      for (let i = 0; i < 4; i++) this.jerk[i] *= Math.exp(-5 * dt);
      for (let i = 0; i < this.bulbs.length; i++) this.bulbs[i] = ease(this.bulbs[i], 0.65, 3, dt);

      const k = Math.min(W / 1.25, H) / 600;
      const y0 = (H - 600 * k) / 2;
      const SWd = W / k;                       // stage-unit width of the screen
      const OW = Math.min(760, SWd * 0.84);
      const OX0 = -OW / 2, OX1 = OW / 2;
      const pd = p.pixelDensity ? p.pixelDensity() : 1;
      const pxs = Math.min(2, (p.width * pd / W) * k);
      if (Math.abs(pxs - this.pxs) > 1e-3) { this.pxs = pxs; this.tiles = {}; this.grain = null; }

      // Which set: Follow moves one set on per drop.
      const want = ((Math.round(params.scene) + (follow ? e.drops : 0)) % SCENES.length + SCENES.length) % SCENES.length;
      if (this.shown < 0) this.shown = want;
      if (want !== this.shown && !this.fly) this.fly = { from: this.shown, to: want, t0: t };
      let flyU = 0;
      if (this.fly) {
        flyU = clamp((t - this.fly.t0) / 1.3, 0, 1);
        if (flyU >= 1) { this.shown = this.fly.to; this.fly = null; flyU = 0; }
      }
      const si = this.shown;
      const S = SCENES[this.fly ? this.fly.to : si];

      this.scroll += dt * P.scroll * (38 + 26 * e.bass * react);

      const c = p.drawingContext;
      c.save();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#1E1416'; c.fillRect(0, 0, W, H);
      c.translate(W / 2, y0); c.scale(k, k);
      const L = -SWd / 2, R = SWd / 2;
      const top = -y0 / k, bot = (H - y0) / k;
      this.topY = top;

      // ---- the opening: cloth, floor, puppet, light
      const px = 36 * Math.sin(t * 0.11) + 18 * Math.sin(t * 0.23 + 1);
      const J = this.pose(t, dt, P, px);

      c.save();
      c.beginPath(); c.rect(OX0, OY0, OW, FF - OY0); c.clip();
      c.fillStyle = S.wall; c.fillRect(OX0, OY0, OW, FF - OY0);
      // battens on the bare back wall, seen only while a cloth is flying
      c.strokeStyle = 'rgba(255,230,200,0.06)'; c.lineWidth = 3;
      for (let yy = OY0 + 40; yy < FB; yy += 70) { c.beginPath(); c.moveTo(OX0, yy); c.lineTo(OX1, yy); c.stroke(); }
      if (this.fly) {
        const u = flyU;
        const outY = -Math.pow(clamp(u / 0.55, 0, 1), 2) * (BH + 40);
        const v = clamp((u - 0.3) / 0.7, 0, 1);
        const inY = -(1 - v) * (BH + 40) + Math.sin(v * Math.PI * 2.2) * (1 - v) * 14 * (v > 0.55 ? 1 : 0);
        if (u < 0.55) this.drawCloth(c, this.fly.from, OW, t, outY, e.bass, react, pxs);
        if (v > 0) this.drawCloth(c, this.fly.to, OW, t, Math.min(0, inY), e.bass, react, pxs);
      } else {
        this.drawCloth(c, si, OW, t, 0, e.bass, react, pxs);
      }

      // stage floor: boards in perspective
      c.fillStyle = '#9A6A3E'; c.fillRect(OX0, FB, OW, FF - FB);
      c.strokeStyle = 'rgba(58,34,24,0.55)'; c.lineWidth = 1.2;
      for (let i = -10; i <= 10; i++) {
        const xb = i * OW / 16, xf = i * OW / 11;
        c.beginPath(); c.moveTo(xb, FB); c.lineTo(xf, FF); c.stroke();
      }
      c.strokeStyle = '#3A2418'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(OX0, FB); c.lineTo(OX1, FB); c.stroke();

      // the stage light: a multiplied pool around him, wider with the lights
      const Lt = P.lights;
      const gel = S.gel;
      const edgeK = lerp(0.3, 0.78, Lt);
      const pool = c.createRadialGradient(J.P[0], FY - 110, 40, J.P[0], FY - 110, lerp(230, 560, Lt));
      pool.addColorStop(0, `rgb(${gel[0]},${gel[1]},${gel[2]})`);
      pool.addColorStop(0.55, `rgb(${Math.round(gel[0] * lerp(edgeK, 1, 0.5))},${Math.round(gel[1] * lerp(edgeK, 1, 0.45))},${Math.round(gel[2] * lerp(edgeK, 1, 0.4))})`);
      pool.addColorStop(1, `rgb(${Math.round(gel[0] * edgeK * 0.95)},${Math.round(gel[1] * edgeK * 0.85)},${Math.round(gel[2] * edgeK * 0.9)})`);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = pool; c.fillRect(OX0, OY0, OW, FF - OY0);
      c.globalCompositeOperation = 'source-over';

      // shadows: a soft pool under him and his shape faint on the cloth
      const hAbove = FY - Math.max(J.legL[3], J.legR[3]);
      c.fillStyle = `rgba(40,20,15,${(0.32 - clamp(hAbove / 200, 0, 0.2)).toFixed(3)})`;
      c.beginPath(); c.ellipse(J.P[0], FY + 5, 46 + J.sa * 24, 7, 0, 0, TAU); c.fill();
      c.save();
      c.globalAlpha = 0.13;
      c.translate(26, -14);
      c.filter = 'none';
      this.shadowPuppet(c, J);
      c.restore();

      this.drawPuppet(c, J, t > this.blinkAt && t < this.blinkAt + 0.14);
      if (t > this.blinkAt + 0.14) this.blinkAt = t + 2.5 + this.rng() * 4;

      // confetti from the flies in the drop
      const cRate = smooth(0.75, 1, Lt) * 55;
      if (this.rng() < cRate * dt) {
        this.confetti.push({ x: OX0 + this.rng() * OW, y: OY0 - 8, vy: 50 + this.rng() * 35, ph: this.rng() * TAU, w: 1.2 + this.rng() * 2.5, col: S.conf[Math.floor(this.rng() * S.conf.length)], r: this.rng() * TAU });
      }
      for (const q of this.confetti) {
        q.y += q.vy * dt; q.ph += dt * q.w; q.x += Math.sin(q.ph * 1.3) * 18 * dt; q.r += dt * 2;
        c.save(); c.translate(q.x, q.y); c.rotate(q.r);
        c.scale(1, Math.cos(q.ph * 2.2));
        c.fillStyle = q.col; c.fillRect(-4, -2.5, 8, 5);
        c.restore();
      }
      this.confetti = this.confetti.filter((q) => q.y < FF);
      if (this.confetti.length > 180) this.confetti.splice(0, this.confetti.length - 180);

      // curtains
      const cw = lerp(OW * 0.5, OW * 0.085, P.curtain);
      this.curtain(c, OX0, cw, 1, t, e.bass);
      this.curtain(c, OX1, cw, -1, t, e.bass);
      c.restore();

      // ---- the house: wall, pillars, cornice, pelmet
      c.fillStyle = '#24181A';
      c.fillRect(L, OY0, OX0 - L, FF - OY0); c.fillRect(OX1, OY0, R - OX1, FF - OY0);
      c.strokeStyle = 'rgba(255,220,180,0.04)'; c.lineWidth = 6;
      for (let x = OX1 + 70; x < R; x += 26) { c.beginPath(); c.moveTo(x, OY0); c.lineTo(x, FF); c.stroke(); c.beginPath(); c.moveTo(-x, OY0); c.lineTo(-x, FF); c.stroke(); }
      // bridge: the puppeteers' gallery above the arch, lamp-lit
      const bg = c.createLinearGradient(0, top, 0, 96);
      bg.addColorStop(0, '#2A1C18'); bg.addColorStop(1, '#6A4A34');
      c.fillStyle = bg; c.fillRect(L, top, SWd, 96 - top);
      const lamp = c.createRadialGradient(0, 80, 10, 0, 80, 330);
      lamp.addColorStop(0, 'rgba(236,190,120,0.55)'); lamp.addColorStop(1, 'rgba(236,190,120,0)');
      c.fillStyle = lamp; c.fillRect(L, top, SWd, 96 - top);
      this.pillars(c, OX0, OX1);
      this.cornice(c, OX0, OX1);
      this.pelmet(c, OX0, OX1, t, e.bass);

      // ---- strings, control bar and the hands
      this.strings(c, J, P, t, e);

      // ---- apron, footlights, the audience
      c.fillStyle = '#6E2A24'; c.fillRect(L, FF, SWd, bot - FF);
      c.fillStyle = '#5A211D'; c.fillRect(OX0 - 50, FF, OW + 100, 58);
      c.strokeStyle = '#D6A23C'; c.lineWidth = 2.5;
      c.strokeRect(OX0 - 40, FF + 8, OW + 80, 42);
      c.fillStyle = '#D6A23C';
      for (let x = OX0 - 20; x < OX1 + 30; x += 44) { c.beginPath(); c.moveTo(x, FF + 29); c.lineTo(x + 7, FF + 22); c.lineTo(x + 14, FF + 29); c.lineTo(x + 7, FF + 36); c.closePath(); c.fill(); }
      this.footlights(c, OX0, OX1, Lt);
      this.audience(c, L, R, bot, e, P, t);

      // paper grain over everything
      if (!this.grain) this.grain = this.makeGrain(pxs);
      const pat = c.createPattern(this.grain, 'repeat');
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / pxs));
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = pat; c.fillRect(L, top, SWd, bot - top);
      c.globalCompositeOperation = 'source-over';
      c.restore();
    },

    shadowPuppet(c, J) {
      c.fillStyle = '#2A1810'; c.strokeStyle = '#2A1810'; c.lineCap = 'round';
      const seg = (a, b, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); };
      seg(J.hipL, [J.legL[0], J.legL[1]], 17); seg([J.legL[0], J.legL[1]], [J.legL[2], J.legL[3]], 15);
      seg(J.hipR, [J.legR[0], J.legR[1]], 17); seg([J.legR[0], J.legR[1]], [J.legR[2], J.legR[3]], 15);
      seg(J.P, J.N, 40);
      seg(J.shL, [J.armL[0], J.armL[1]], 14); seg([J.armL[0], J.armL[1]], [J.armL[2], J.armL[3]], 13);
      seg(J.shR, [J.armR[0], J.armR[1]], 14); seg([J.armR[0], J.armR[1]], [J.armR[2], J.armR[3]], 13);
      c.beginPath(); c.arc(J.Hc[0], J.Hc[1], 26, 0, TAU); c.fill();
      seg(J.capBase, J.cap, 12);
    },

    curtain(c, xEdge, w, dir, t, bass) {
      const x0 = xEdge, x1 = xEdge + dir * w;
      const flare = w * 0.1;
      const g = c.createLinearGradient(x0, 0, x1 + dir * flare, 0);
      const folds = Math.max(3, Math.round(w / 34));
      for (let i = 0; i <= folds * 2; i++) {
        const u = i / (folds * 2);
        g.addColorStop(u, i % 2 ? '#C23A35' : '#7E1C22');
      }
      c.fillStyle = g; c.strokeStyle = '#3A1414'; c.lineWidth = 1.6;
      const sway = Math.sin(t * 0.9) * 3 + bass * 4 * Math.sin(t * 1.7);
      c.beginPath();
      c.moveTo(x0, OY0);
      c.lineTo(x1, OY0);
      c.quadraticCurveTo(x1 + dir * (flare * 0.3) + sway, (OY0 + FF) / 2, x1 + dir * flare + sway * 1.4, FF);
      c.lineTo(x0, FF);
      c.closePath(); c.fill(); c.stroke();
      // hem
      c.fillStyle = '#D6A23C';
      c.fillRect(Math.min(x0, x1 + dir * flare + sway * 1.4), FF - 8, Math.abs(x1 + dir * flare + sway * 1.4 - x0), 5);
      // soft shade under the pelmet
      const sh = c.createLinearGradient(0, OY0, 0, OY0 + 90);
      sh.addColorStop(0, 'rgba(30,5,8,0.55)'); sh.addColorStop(1, 'rgba(30,5,8,0)');
      c.fillStyle = sh; c.fillRect(Math.min(x0, x1), OY0, Math.abs(x1 - x0) + flare, 90);
    },

    pillars(c, OX0, OX1) {
      for (const [xa, xb] of [[OX0 - 46, OX0], [OX1, OX1 + 46]]) {
        const g = c.createLinearGradient(xa, 0, xb, 0);
        g.addColorStop(0, '#8A5A2A'); g.addColorStop(0.45, '#D9A45A'); g.addColorStop(1, '#8A5A2A');
        c.fillStyle = g; c.strokeStyle = '#3A2418'; c.lineWidth = 1.8;
        c.beginPath(); c.rect(xa, 96, xb - xa, FF - 96); c.fill(); c.stroke();
        for (const yy of [150, 250, 350, 450]) {
          c.fillStyle = '#2F5B9A'; c.beginPath(); c.rect(xa - 2, yy, xb - xa + 4, 9); c.fill(); c.stroke();
          c.fillStyle = '#C73A2E'; c.beginPath();
          const mx = (xa + xb) / 2;
          c.moveTo(mx, yy + 22); c.lineTo(mx + 9, yy + 40); c.lineTo(mx, yy + 58); c.lineTo(mx - 9, yy + 40); c.closePath(); c.fill(); c.stroke();
        }
      }
    },

    cornice(c, OX0, OX1) {
      const xa = OX0 - 60, xb = OX1 + 60;
      c.fillStyle = '#C8904A'; c.strokeStyle = '#3A2418'; c.lineWidth = 2;
      c.beginPath(); c.rect(xa, 90, xb - xa, 40); c.fill(); c.stroke();
      c.fillStyle = '#A8733A'; c.fillRect(xa, 90, xb - xa, 6);
      // painted folk tulips and dots along the cornice
      for (let x = xa + 30; x < xb - 34; x += 52) {
        c.fillStyle = '#C73A2E'; c.strokeStyle = '#3A2418'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x - 7, 104); c.lineTo(x - 4, 112); c.lineTo(x, 106); c.lineTo(x + 4, 112); c.lineTo(x + 7, 104);
        c.quadraticCurveTo(x + 8, 122, x, 122); c.quadraticCurveTo(x - 8, 122, x - 7, 104); c.fill(); c.stroke();
        c.strokeStyle = '#3E7C4A'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - 10, 118); c.quadraticCurveTo(x - 16, 112, x - 20, 116); c.moveTo(x + 10, 118); c.quadraticCurveTo(x + 16, 112, x + 20, 116); c.stroke();
        c.fillStyle = '#2F5B9A'; c.beginPath(); c.arc(x + 26, 112, 3, 0, TAU); c.fill();
      }
    },

    pelmet(c, OX0, OX1, t, bass) {
      const xa = OX0 - 6, xb = OX1 + 6, y0 = 126, y1 = 162;
      c.fillStyle = '#A92A2C'; c.strokeStyle = '#3A1414'; c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(xa, y0); c.lineTo(xb, y0); c.lineTo(xb, y1);
      const n = Math.max(6, Math.round((xb - xa) / 44)), sw = (xb - xa) / n;
      for (let i = n - 1; i >= 0; i--) c.quadraticCurveTo(xa + (i + 0.5) * sw, y1 + 16, xa + i * sw, y1);
      c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#D6A23C'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(xa, y0 + 5); c.lineTo(xb, y0 + 5); c.stroke();
      c.beginPath();
      for (let i = 0; i < n; i++) { c.moveTo(xa + i * sw, y1 - 3); c.quadraticCurveTo(xa + (i + 0.5) * sw, y1 + 12, xa + (i + 1) * sw, y1 - 3); }
      c.stroke();
      // tassels between the scallops, swinging a touch with the bass
      for (let i = 1; i < n; i++) {
        const x = xa + i * sw, s = Math.sin(t * 1.4 + i) * (1 + bass * 3);
        c.strokeStyle = '#D6A23C'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x, y1); c.lineTo(x + s, y1 + 12); c.stroke();
        c.fillStyle = '#D6A23C'; c.beginPath(); c.moveTo(x + s - 4, y1 + 20); c.lineTo(x + s, y1 + 10); c.lineTo(x + s + 4, y1 + 20); c.closePath(); c.fill();
      }
      c.fillStyle = '#F2C866'; c.strokeStyle = '#5A1A14'; c.lineWidth = 1;
      c.font = 'bold 21px Georgia, "Times New Roman", serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const word = 'MARIONETY', sp = 24;
      for (let i = 0; i < word.length; i++) {
        const x = (i - (word.length - 1) / 2) * sp;
        c.fillText(word[i], x, 147); c.strokeText(word[i], x, 147);
      }
    },

    strings(c, J, P, t, e) {
      const pv = this.pv;
      const lift = P.lift, D = P.dance;
      // the control bar rides with his lift; it tips with the swing and dance
      const gx = pv.pel.x - Math.sin(pv.sw) * 190 * 0.25 + J.lean * 30;
      const gy = clamp(46 - (J.Hh - 99) * 0.9, 28, 76);
      const beta = -pv.sw * 0.5 + D * 0.12 * Math.sin(Math.PI * e.phase);
      const cb = Math.cos(beta), sb = Math.sin(beta);
      const B = (x, y) => [gx + x * cb - y * sb, gy + x * sb + y * cb];
      const legTilt = D * 0.2 * Math.sin(Math.PI * e.phase + Math.PI / 2) - pv.sw * 0.3;
      const lgx = gx - 62, lgy = gy + 18;
      const LB = (x) => [lgx + x * Math.cos(legTilt), lgy + x * Math.sin(legTilt)];

      const tBase = smooth(0.1, 0.9, lift) * (1 - 0.55 * D);
      const ht = J.ht, Hx = J.Hc[0], Hy = J.Hc[1];
      const list = [
        [B(-30, 0), [Hx - Math.cos(ht) * 22, Hy - Math.sin(ht) * 22], tBase, -1, -1],
        [B(30, 0), [Hx + Math.cos(ht) * 22, Hy + Math.sin(ht) * 22], tBase, 1, -1],
        [B(-66, 2), [J.armL[2], J.armL[3]], tBase * 0.5 + 0.5 * J.tp, -1, 0],
        [B(66, 2), [J.armR[2], J.armR[3]], tBase * 0.5 + 0.5 * J.tp, 1, 2],
        [LB(-30), [J.legL[0], J.legL[1]], tBase * 0.4, -1, 3],
        [LB(30), [J.legR[0], J.legR[1]], tBase * 0.4, 1, 1],
        [B(0, 0), J.N, tBase * 0.8, 1, -1],
      ];
      c.lineCap = 'round';
      for (const [b, a, ten, sgn, ji] of list) {
        const j = ji >= 0 ? this.jerk[ji] : 0;
        const tension = clamp(ten + j * 1.2, 0, 1);
        const dx = a[0] - b[0], dy = a[1] - b[1], len = Math.hypot(dx, dy) || 1;
        const bow = (1 - tension) * len * 0.07 * sgn + Math.sin(t * 1.1 + sgn) * (1 - tension) * 3;
        const mx = (a[0] + b[0]) / 2 - dy / len * bow, my = (a[1] + b[1]) / 2 + dx / len * bow;
        c.strokeStyle = `rgba(250,238,215,${(0.42 + 0.5 * j).toFixed(3)})`;
        c.lineWidth = 0.75 + 0.9 * j;
        c.beginPath(); c.moveTo(b[0], b[1]); c.quadraticCurveTo(mx, my, a[0], a[1]); c.stroke();
      }
      // bars
      c.strokeStyle = '#3A2418'; c.lineWidth = 7;
      let q1 = B(-72, 2), q2 = B(72, 2);
      c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke();
      c.strokeStyle = '#B98450'; c.lineWidth = 4.5; c.stroke();
      q1 = LB(-36); q2 = LB(36);
      c.strokeStyle = '#3A2418'; c.lineWidth = 6.5;
      c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke();
      c.strokeStyle = '#A8733A'; c.lineWidth = 4; c.stroke();

      // the puppeteer's hands: soft silhouettes in sleeves from above, the
      // lamp behind them catching their top edges
      const hand = (hx, hy, fromX, fromY, rot) => {
        const dx = fromX - hx, dy = fromY - hy, dl = Math.hypot(dx, dy) || 1;
        const ux = dx / dl, uy = dy / dl;
        const wx = hx + ux * 8, wy = hy - 16 + uy * 8;
        c.lineCap = 'round';
        c.strokeStyle = '#3A282C'; c.lineWidth = 27;
        c.beginPath(); c.moveTo(fromX, fromY); c.lineTo(wx + ux * 4, wy + uy * 4); c.stroke();
        c.strokeStyle = '#4A3438'; c.lineWidth = 29; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(wx + ux * 14, wy + uy * 14); c.lineTo(wx + ux * 4, wy + uy * 4); c.stroke();
        c.strokeStyle = 'rgba(240,190,130,0.22)'; c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(fromX - uy * 13, fromY + ux * 13); c.lineTo(wx + ux * 14 - uy * 13, wy + uy * 14 + ux * 13); c.stroke();
        c.save(); c.translate(hx, hy); c.rotate(rot);
        c.strokeStyle = '#2A1810'; c.lineWidth = 1.5;
        c.fillStyle = '#A8765A';
        c.beginPath(); c.ellipse(1, -11, 17, 13, 0, 0, TAU); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(-16, -3, 5, 9, -0.5, 0, TAU); c.fill(); c.stroke();
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-9 + i * 6.3, 2, 3.6, 6, 0, 0, TAU); c.fill(); c.stroke(); }
        c.fillStyle = 'rgba(255,220,170,0.35)';
        c.beginPath(); c.ellipse(3, -17, 9, 4, -0.1, 0, TAU); c.fill();
        c.restore();
      };
      const lh = LB(-4);
      hand(lh[0], lh[1] - 1, lh[0] - 60, this.topY - 30, legTilt);
      hand(gx + 30, gy - 1, gx + 100, this.topY - 30, beta);
    },

    footlights(c, OX0, OX1, Lt) {
      const n = this.bulbs.length;
      for (let i = 0; i < n; i++) {
        const x = lerp(OX0 + 30, OX1 - 30, i / (n - 1)), y = FF;
        const b = clamp(this.bulbs[i] * lerp(0.35, 1.1, Lt), 0, 1.2);
        // a warm fan of light on the curtain hem and floor front, matte
        c.fillStyle = `rgba(255,214,140,${(0.09 * b).toFixed(3)})`;
        c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x - 38, y - 40); c.lineTo(x + 38, y - 40); c.lineTo(x + 8, y); c.closePath(); c.fill();
        const r = Math.round(lerp(120, 255, clamp(b, 0, 1))), g = Math.round(lerp(80, 226, clamp(b, 0, 1))), bl = Math.round(lerp(50, 150, clamp(b, 0, 1)));
        c.fillStyle = `rgb(${r},${g},${bl})`;
        c.beginPath(); c.ellipse(x, y - 3, 7, 5, 0, 0, TAU); c.fill();
        c.fillStyle = '#7A5A2E'; c.strokeStyle = '#2A1810'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x - 14, y + 2); c.quadraticCurveTo(x, y - 12, x + 14, y + 2); c.lineTo(x + 14, y + 6); c.lineTo(x - 14, y + 6); c.closePath();
        c.save(); c.clip(); c.fillRect(x - 14, y - 2, 28, 10); c.restore();
        c.beginPath(); c.moveTo(x - 14, y + 6); c.lineTo(x - 14, y + 2); c.moveTo(x + 14, y + 2); c.lineTo(x + 14, y + 6); c.lineTo(x - 14, y + 6); c.stroke();
      }
    },

    audience(c, L, R, bot, e, P, t) {
      if (!this.crowd || this.crowd.L !== L) {
        const rng = mulberry(44);
        const heads = [];
        let x = L - 20;
        while (x < R + 30) {
          const r = 22 + rng() * 14;
          heads.push({ x, r, kind: Math.floor(rng() * 5), off: rng(), y: 598 + rng() * 14 });
          x += r * 1.6 + rng() * 22;
        }
        this.crowd = { L, heads };
      }
      const D = P.dance, Lt = P.lights;
      for (const h of this.crowd.heads) {
        const bobA = D * 7 * Math.max(0, Math.sin(Math.PI * (e.phase + h.off * 0.3)));
        const y = h.y - bobA + Math.sin(t * 0.7 + h.off * 9) * 1.2;
        c.fillStyle = '#150D0E';
        c.beginPath(); c.arc(h.x, y, h.r, 0, TAU); c.fill();
        c.fillRect(h.x - h.r * 1.3, y + h.r * 0.6, h.r * 2.6, 80);
        if (h.kind === 0) { c.beginPath(); c.arc(h.x, y - h.r * 0.2, h.r * 1.02, Math.PI, TAU); c.fill(); c.beginPath(); c.arc(h.x, y - h.r * 1.25, h.r * 0.28, 0, TAU); c.fill(); }
        if (h.kind === 1) { c.beginPath(); c.arc(h.x - h.r * 1.05, y + 2, h.r * 0.32, 0, TAU); c.arc(h.x + h.r * 1.05, y + 2, h.r * 0.32, 0, TAU); c.fill(); }
        if (h.kind === 2) { c.beginPath(); c.arc(h.x + h.r * 0.2, y - h.r * 0.95, h.r * 0.4, 0, TAU); c.fill(); }
        // the footlights catch the tops of their heads
        c.strokeStyle = `rgba(233,184,114,${(0.12 + 0.35 * Lt).toFixed(3)})`; c.lineWidth = 2;
        c.beginPath(); c.arc(h.x, y, h.r - 1, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
      }
    },
  });
})();
