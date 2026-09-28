// The harness's scripted test track: 24 seconds of a 124 BPM arrangement,
// expressed directly as the nine FINAL band values (0-100) a scene receives,
// i.e. what core.js hands to draw() after getAdjustedFftSignals()-style boost
// and clamping. Scripted rather than recorded so every render of every scene
// sees exactly the same music, and so a reader of a contact sheet knows what
// was playing at each tile without listening to anything.
//
//   0-4 s    intro      near-silence, a soft pad in bands 2-4
//   4-10 s   build      eighth-note hats in 6-8, kick fading in, a riser
//   10-18 s  drop       kick on every beat (0-1), clap on 2 and 4 (3-5),
//                       hats, a sidechained bass line (1-2)
//   18-24 s  breakdown  kick out, sustained pad, sparse hats
//
// Envelopes are fast-attack / exponential-decay like real percussion through an
// FFT, not gates, so scenes that key off transients get transients. There is
// no randomness: the small "room noise" is a hash of the time, so the same t
// always gives the same values.
//
// Classic script (no modules) so stage.html can load it with a <script> tag;
// it defines globalThis.VIZ_TRACK = { BPM, DURATION, SECTIONS, bands, section }.
(function (root) {
  'use strict';

  var BPM = 124;
  var BEAT = 60 / BPM;          // 0.4839 s
  var DURATION = 24;
  var DROP = 10;                // the beat grid is anchored so the drop lands on a downbeat

  var SECTIONS = [
    { name: 'intro', start: 0, end: 4 },
    { name: 'build', start: 4, end: 10 },
    { name: 'drop', start: 10, end: 18 },
    { name: 'breakdown', start: 18, end: 24 }
  ];

  // Past the end the arrangement loops, so --seconds > 24 still has music.
  function wrap(t) {
    if (t < 0) return 0;
    return t > DURATION ? t % DURATION : t;
  }

  function section(t) {
    t = wrap(t);
    for (var i = 0; i < SECTIONS.length; i++) if (t < SECTIONS[i].end) return SECTIONS[i].name;
    return SECTIONS[SECTIONS.length - 1].name;
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ramp(t, a, b) { return clamp01((t - a) / (b - a)); }

  // A percussive hit `since` seconds ago: exponential decay from a peak AT the
  // onset. No attack ramp: an FFT frame (~11 ms at 512 samples) already smears
  // the attack, and a ramp made a tile sampled exactly on the drop's downbeat
  // (t = 10.0 s) show silence under a label saying "drop".
  function hit(since, tau) {
    if (since < 0) return 0;
    return Math.exp(-since / tau);
  }

  // Deterministic value noise in [-1, 1]: smooth enough to read as the bed of
  // a mix rather than per-frame static.
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }
  function vnoise(t, rate, seed) {
    var x = t * rate + seed * 17.13;
    var i = Math.floor(x), f = x - i;
    f = f * f * (3 - 2 * f);
    return hash(i + seed * 101) * (1 - f) + hash(i + 1 + seed * 101) * f;
  }

  // Position on the beat grid (beats since the drop; negative before it).
  function beatInfo(t, division) {
    var len = BEAT / division;
    var pos = (t - DROP) / len;
    var idx = Math.floor(pos);
    return { idx: idx, since: (pos - idx) * len };
  }

  // Bass line: one note per eighth, pitch pattern over two bars. Only the
  // level matters to a band analyser, so "pitch" moves energy between bands 1
  // and 2 (low notes sit in 1, higher ones in 2).
  var BASS_PATTERN = [0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 2, 1, 0, 1];
  var BASS_REST = [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]; // offbeat gaps, ducked by the kick anyway

  function bands(t, out) {
    out = out || new Float32Array(9);
    t = wrap(t);
    var s = section(t);

    var q = beatInfo(t, 1);    // quarters
    var e = beatInfo(t, 2);    // eighths
    var beatInBar = ((q.idx % 4) + 4) % 4;

    // ---- pad: slow swell, present from the intro, biggest in the breakdown
    var padLevel;
    if (s === 'intro') padLevel = 0.18 + 0.22 * ramp(t, 0, 3.5);
    else if (s === 'build') padLevel = 0.40 - 0.15 * ramp(t, 4, 10);
    else if (s === 'drop') padLevel = 0.30;
    else padLevel = 0.35 + 0.35 * ramp(t, 18, 19.5);
    var padWobble = 0.8 + 0.2 * Math.sin(t * 2 * Math.PI / (BEAT * 8));
    var pad = padLevel * padWobble;

    // ---- kick
    var kickGain = 0;
    if (s === 'build') kickGain = 0.85 * ramp(t, 5, 9.6);
    else if (s === 'drop') kickGain = 1;
    var kick = kickGain * hit(q.since, 0.12);

    // ---- clap / snare on beats 2 and 4 of the drop; a roll at the end of the build
    var clap = 0;
    if (s === 'drop' && (beatInBar === 1 || beatInBar === 3)) clap = hit(q.since, 0.09);
    if (s === 'build' && t > 8.06) {
      var sx = beatInfo(t, 4);   // sixteenths, crescendo into the drop
      clap = (0.35 + 0.6 * ramp(t, 8.06, 10)) * hit(sx.since, 0.05);
    }

    // ---- hats on eighths; offbeats (open hats) louder
    var hatGain = 0;
    if (s === 'build') hatGain = 0.35 + 0.55 * ramp(t, 4, 10);
    else if (s === 'drop') hatGain = 0.9;
    else if (s === 'breakdown') {
      // Sparse: only the offbeat of beats 2 and 4, and only every other bar.
      var bar = Math.floor(q.idx / 4);
      var offbeat = ((e.idx % 2) + 2) % 2 === 1;
      hatGain = (bar % 2 === 0 && offbeat && (beatInBar === 1 || beatInBar === 3)) ? 0.6 : 0;
    }
    var open = ((e.idx % 2) + 2) % 2 === 1;
    var hat = hatGain * hit(e.since, open ? 0.06 : 0.03) * (open ? 1 : 0.7);

    // ---- riser: filtered noise climbing through the top bands over the build
    var riser = s === 'build' ? Math.pow(ramp(t, 6, 10), 2) : 0;

    // ---- bass line in the drop, ducked by the kick (sidechain)
    var bassLow = 0, bassHigh = 0;
    if (s === 'drop') {
      var step = ((e.idx % 16) + 16) % 16;
      var note = BASS_REST[step] ? 0 : hit(e.since, 0.16);
      var duck = 1 - 0.7 * hit(q.since, 0.1);
      var lvl = note * duck;
      var pitch = BASS_PATTERN[step];
      bassLow = lvl * (pitch === 0 ? 1 : 0.55);
      bassHigh = lvl * (pitch === 0 ? 0.45 : 1);
    }

    // ---- room: the noise floor every real recording has
    function room(b, base) { return base * (1 + 0.5 * vnoise(t, 9, b)); }

    var v = [
      room(0, 3) + 95 * kick + 45 * bassLow,
      room(1, 3) + 80 * kick + 70 * bassLow + 30 * bassHigh + 6 * pad,
      room(2, 3) + 55 * pad + 25 * kick + 55 * bassHigh + 10 * clap,
      room(3, 3) + 60 * pad + 70 * clap,
      room(4, 3) + 45 * pad + 85 * clap + 8 * hat,
      room(5, 3) + 15 * pad + 65 * clap + 20 * hat + 25 * riser,
      room(6, 2) + 20 * clap + 70 * hat + 45 * riser,
      room(7, 2) + 8 * clap + 85 * hat + 60 * riser,
      room(8, 2) + 95 * hat + 70 * riser
    ];
    for (var i = 0; i < 9; i++) {
      // A little per-band shimmer so held sounds are not perfectly flat lines.
      var x = v[i] * (1 + 0.06 * vnoise(t, 23, i + 40));
      out[i] = x < 0 ? 0 : x > 100 ? 100 : x;
    }
    return out;
  }

  root.VIZ_TRACK = { BPM: BPM, DURATION: DURATION, SECTIONS: SECTIONS, bands: bands, section: section };
})(typeof globalThis !== 'undefined' ? globalThis : this);
