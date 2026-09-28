// Jags — port of ../../Jags.pde.
//
// Parallel zigzag lines across a rotating stage; the zigzag height follows one
// band and the line weight another.
(function () {
  const shared = window.VIZ_PALETTES || [];
  const MAX_LINES = 60; // maxSize0: lineColorIndex is sized for the most lines
  const MIN_WEIGHT = 1; // minSize1: the weight at a silent band
  const LINE_SPACING = 20;
  const SEGMENT_LENGTH = 40;

  VIZ.register({
    id: 'jags',
    name: 'Jags',
    order: 4,

    params: [
      { key: 'size0', legacy: 'SIZE0', label: 'Line count', type: 'range',
        min: 1, max: MAX_LINES, default: 10 },
      { key: 'size1', legacy: 'SIZE1', label: 'Max line weight', type: 'range',
        min: MIN_WEIGHT, max: 60, default: 10 },
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
        palettes: shared.map((pal) => ({ name: pal.name, colors: pal.colors.slice() })),
        default: 0 },
      { key: 'speed', legacy: 'SPEED', label: 'Rotation speed', type: 'range',
        min: -10, max: 10, default: 0 },
      // The original hard-coded signals[5] for the height and left size1Signal
      // (0) unwired from its panel dropdown; both are choosable here, with the
      // original values as defaults.
      { key: 'heightBand', legacy: 'signals[5]', label: 'Zigzag height band',
        type: 'band', default: 5 },
      { key: 'size1Signal', legacy: 'SIZE1 SIGNAL', label: 'Line weight band',
        type: 'band', default: 0 },
    ],

    actions: [
      {
        id: 'shuffle',
        label: 'Shuffle palette',
        // Original shuffleCurrentColors: Fisher–Yates over the whole row,
        // background included, in place.
        run(params) {
          const ar = this.palettes && this.palettes[Math.round(params.colorPalette)];
          if (!ar) return;
          for (let i = ar.length - 1; i > 0; i--) {
            const index = Math.floor(Math.random() * (i + 1));
            const a = ar[index];
            ar[index] = ar[i];
            ar[i] = a;
          }
        },
      },
    ],

    setup(p) {
      // Own copies so shuffling never reorders another visual's palette.
      this.palettes = shared.map((pal) => pal.colors.map((hex) => p.color(hex)));

      this.lineColorIndex = new Array(MAX_LINES);
      for (let i = 0; i < MAX_LINES; i++) {
        this.lineColorIndex[i] = Math.floor(p.random(3)) + 1;
      }

      this.rot = 0;
    },

    draw(p, signals, params, ctx) {
      const palette = this.palettes[Math.round(params.colorPalette)] || this.palettes[0];

      p.colorMode(p.RGB, 255);
      p.angleMode(p.RADIANS);
      p.strokeCap(p.ROUND);
      p.strokeJoin(p.MITER);

      p.background(palette[0]);
      p.noFill();

      // The original computed width * 1.5 once in init(); taking it per frame
      // keeps the lines reaching the corners after the stage is resized.
      const lineWidth = ctx.width * 1.5;
      const segments = Math.trunc(lineWidth / SEGMENT_LENGTH);

      p.translate(ctx.width / 2, ctx.height / 2);
      p.rotate(this.rot);
      this.rot += params.speed / 1000;

      const numLines = Math.min(Math.round(params.size0), MAX_LINES);
      const heightBand = Math.round(params.heightBand);
      const weightBand = Math.round(params.size1Signal);

      for (let l = 0; l < numLines; l++) {
        const lineY = l * LINE_SPACING - (numLines * LINE_SPACING) / 2;
        p.stroke(palette[this.lineColorIndex[l]]);

        const yoff = p.map(signals[heightBand], 0, 100, 0, SEGMENT_LENGTH * 1.5);
        p.strokeWeight(p.map(signals[weightBand], 0, 100, MIN_WEIGHT, params.size1));

        p.beginShape();
        for (let i = 0; i <= segments; i++) {
          if (i % 2 === 0) {
            p.vertex(i * SEGMENT_LENGTH - lineWidth / 2, lineY + yoff);
          } else {
            p.vertex(i * SEGMENT_LENGTH - lineWidth / 2, lineY - yoff);
          }
        }
        p.endShape();
      }
    },
  });
})();
