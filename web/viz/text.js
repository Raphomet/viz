// Text — port of ../Text.pde.
//
// The original drew something at every point of the text outline, which
// geomerative sampled at a uniform 11-unit segment length. p5's textToPoints
// steps along each contour 1 / sampleFactor units at a time, so 1/11 gives
// the same spacing.
(function () {
  'use strict';

  const SEGMENT_LENGTH = 11;
  const SAMPLE_FACTOR = 1 / SEGMENT_LENGTH;

  VIZ.register({
    id: 'text',
    name: 'Text',
    order: 1,

    params: [
      // The original defaulted to empty, which left a black screen until
      // something was typed.
      { key: 'displayText', legacy: 'DISPLAYTEXT', label: 'Words', type: 'text',
        default: 'VIZ' },
      { key: 'size0', legacy: 'SIZE0', label: 'Font size', type: 'range',
        min: 10, max: 400, default: 200, step: 1 },
      { key: 'size1', legacy: 'SIZE1', label: 'Dot size', type: 'range',
        min: 1, max: 100, default: 5 },
      { key: 'sensitivity', legacy: 'SENSITIVITY', label: 'Sensitivity', type: 'range',
        min: 0, max: 1, default: 0.5 },
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
        palettes: window.VIZ_PALETTES || [], default: 0 },
      // Offsets which band each point reads, so the pulse travels round the outline.
      { key: 'speed', legacy: 'SPEED', label: 'Band drift', type: 'range',
        min: 0, max: 0.05, default: 0, step: 0.0005 },
      { key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
        options: ['White dots', 'Palette dots', 'White rings', 'Palette rings', 'Igor heads'],
        default: 0 },
    ],

    actions: [
      {
        id: 'shuffle',
        label: 'Shuffle palette',
        run(params) {
          // Fisher–Yates in place, as shuffleCurrentColors() did; only this
          // visual's copy of the palette is touched.
          const idx = Math.round(params.colorPalette) || 0;
          const ar = this.palettes[idx];
          if (!ar) return;
          for (let i = ar.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const a = ar[j];
            ar[j] = ar[i];
            ar[i] = a;
          }
        },
      },
      {
        id: 'resetSpeed',
        label: 'Reset band drift',
        run(params) {
          params.speed = 0;
        },
      },
    ],

    preload(p) {
      this.font = p.loadFont('assets/FreeSans.ttf');
      this.img = p.loadImage('assets/igor.png');
    },

    setup(p) {
      // Own copy: the shuffle action mutates it, and must not reach other visuals.
      this.palettes = (window.VIZ_PALETTES || []).map((pal) =>
        pal.colors.map((hex) => p.color(hex))
      );
      this.cacheKey = null;
      this.points = [];
    },

    // The original rebuilt the outline every frame (its main cost); rebuild
    // only when the words or the integer font size change.
    outline(text, fontSize) {
      const key = fontSize + '\u0000' + text;
      if (key === this.cacheKey) return this.points;

      const pts = [];
      const lines = text.split(/\r?\n|\r/);
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (!line.length) continue;
        // RFont.CENTER centred each line on its advance width; textToPoints
        // lays glyphs out by advance width too, so centre on the same measure.
        const width = this.advanceWidth(line, fontSize);
        const linePts = this.font.textToPoints(line, -width / 2, li * fontSize, fontSize, {
          sampleFactor: SAMPLE_FACTOR,
          simplifyThreshold: 0,
        });
        for (const pt of linePts) pts.push(pt);
      }

      this.cacheKey = key;
      this.points = pts;
      return pts;
    },

    advanceWidth(line, fontSize) {
      const ot = this.font && this.font.font;
      if (ot && ot.stringToGlyphs) {
        const scale = fontSize / ot.unitsPerEm;
        let w = 0;
        for (const g of ot.stringToGlyphs(line)) w += (g.advanceWidth || 0) * scale;
        return w;
      }
      const b = this.font.textBounds(line, 0, 0, fontSize);
      return b.x + b.w;
    },

    draw(p, signals, params, ctx) {
      const mode = Math.round(params.mode) || 0;
      const sensitivity = params.sensitivity;
      const size1 = params.size1;
      const speed = params.speed;

      if (mode === 4) {
        p.colorMode(p.HSB, 255);
        p.background((p.millis() / 10.0) % 255, 100, 200);
      }
      p.colorMode(p.RGB, 255);
      if (mode !== 4) p.background(0);

      p.ellipseMode(p.CENTER);
      p.imageMode(p.CORNER);

      const fontSize = Math.trunc(params.size0);
      // Integer division, as in the original (fontSize was an int).
      p.translate(ctx.width / 2, ctx.height / 2 + Math.trunc(fontSize / 3));

      let channelOffset = 0;
      if (speed !== 0) channelOffset = Math.trunc(p.millis() * speed);

      const text = params.displayText == null ? '' : String(params.displayText);
      if (!text.length || !this.font) return;

      const pnts = this.outline(text, fontSize);
      const palette = this.palettes[Math.round(params.colorPalette) || 0] || this.palettes[0];

      if (mode === 0) {
        p.fill(255);
        p.noStroke();
      }
      if (mode === 1) {
        p.noStroke();
      } else if (mode === 2) {
        p.noFill();
        p.stroke(255);
      } else if (mode === 3) {
        p.noFill();
      }

      // Java2D drew a zero-width stroke as the thinnest visible line, so silent
      // rings stayed on screen as hairlines; canvas would draw nothing.
      const hairline = ctx.width / p.width;

      for (let i = 0; i < pnts.length; i++) {
        const band = signals[(i + channelOffset) % 9];
        const diameter = band * sensitivity + size1;
        if (mode === 2 || mode === 3) {
          const weight = band / 10.0 * sensitivity;
          p.strokeWeight(weight > 0 ? weight : hairline);
        }
        if (mode === 1) p.fill(palette[i % 5]);
        if (mode === 3) p.stroke(palette[i % 5]);

        if (mode === 4) {
          p.image(this.img, pnts[i].x - diameter / 2, pnts[i].y - diameter / 2, diameter, diameter);
        } else {
          p.ellipse(pnts[i].x, pnts[i].y, diameter, diameter);
        }
      }
    },
  });
})();
