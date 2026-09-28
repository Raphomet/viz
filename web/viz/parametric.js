// Parametric Lines — port of ../../ParametricLines.pde.
// Pairs of points on two parametric curves, joined by a trail of lines (or
// dots, or a triangle strip) that walks forward with frameCount.

(function () {
  // Curve radius in virtual units; tuned for the original 600x600 window.
  const SCALE = 250;

  VIZ.register({
    id: 'parametric',
    name: 'Parametric Lines',
    order: 5,

    params: [
      { key: 'size0', legacy: 'SIZE0', label: 'Trail length', type: 'range',
        min: 1, max: 255, default: 50 },
      // The original read size0Signal for the trail length but its dropdown
      // was never wired, so it was always band 0.
      { key: 'size0Signal', legacy: 'SIZE0 CHANNEL', label: 'Trail band', type: 'band',
        default: 0 },
      // Line thickness in Lines and Triangle strip; dot diameter in Dots.
      { key: 'size1', legacy: 'SIZE1', label: 'Line weight', type: 'range',
        min: 1, max: 255, default: 50 },
      // Hard-coded to signals[5] in the original.
      { key: 'weightBand', legacy: 'SIZE1 CHANNEL', label: 'Weight band', type: 'band',
        default: 5 },
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Ground', type: 'select',
        options: ['Black ground', 'White ground'], default: 0 },
      { key: 'colorAdjustment', legacy: 'COLOR ADJUSTMENT', label: 'Saturation', type: 'range',
        min: 0, max: 255, default: 255 },
      { key: 'alpha', legacy: 'ALPHA', label: 'Min opacity', type: 'range',
        min: 0, max: 255, default: 100 },
      { key: 'alphaSignal', legacy: 'ALPHA CHANNEL', label: 'Opacity band', type: 'band',
        default: 0 },
      { key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
        options: ['Lines', 'Dots', 'Triangle strip', 'Full figure'], default: 0 },
      { key: 'x0', legacy: 'X0', label: 'Curve ratio', type: 'range',
        min: 1, max: 30, default: 13 },
      { key: 'z0', legacy: 'Z0', label: 'Zoom', type: 'range',
        min: 0.1, max: 3, default: 1 },
    ],

    draw(p, signals, params, ctx) {
      const size0 = params.size0;
      const size1 = params.size1;
      const colorPalette = Math.round(params.colorPalette);
      const colorAdjustment = params.colorAdjustment;
      const alpha = params.alpha;
      const alphaSignal = Math.round(params.alphaSignal);
      const size0Signal = Math.round(params.size0Signal);
      const weightBand = Math.round(params.weightBand);
      const mode = Math.round(params.mode);
      const x0 = params.x0;

      const cos = Math.cos, sin = Math.sin;
      const x1 = (t) => cos(t / x0) * SCALE + sin(t / 80) * 30;
      const y1 = (t) => sin(t / 10) * SCALE;
      const x2 = (t) => cos(t / 5) * SCALE + cos(t / 7) * 2;
      const y2 = (t) => sin(t / 20) * SCALE + cos(t / 9) * 30;

      p.colorMode(p.HSB, 256);
      p.ellipseMode(p.CENTER);
      p.strokeCap(p.SQUARE);
      p.strokeJoin(p.MITER);

      p.push();
      p.translate(ctx.width / 2, ctx.height / 2);
      p.scale(params.z0);

      p.background(colorPalette === 0 ? 0 : 255);

      if (mode === 2) {
        p.beginShape(p.TRIANGLE_STRIP);
      }

      if (mode === 3) {
        p.beginShape();
        p.noFill();
        p.strokeWeight(5);

        // Both strokes are set, but a single shape draws in whichever is
        // current at endShape, so the whole figure comes out in hue 64.
        p.stroke(255, 255, 255);
        // Math.fround keeps the Java float accumulation and vertex count.
        const end = p.TWO_PI * 100, step = p.PI / 10;
        for (let i = 0; i < end; i = Math.fround(i + step)) {
          p.vertex(x1(i), y1(i));
        }

        p.stroke(64, 255, 255);
        for (let i = 0; i < end; i = Math.fround(i + step)) {
          p.vertex(x2(i), y2(i));
        }

        p.endShape();
      } else {
        const count = Math.trunc(p.map(signals[size0Signal], 0, 100, 0, size0));
        const opacity = p.map(signals[alphaSignal], 0, 100, alpha, 255);
        const weight = Math.pow(p.map(signals[weightBand], 0, 100, 0, Math.sqrt(size1)), 2);
        const fc = p.frameCount;

        for (let i = 0; i < count; i++) {
          const t = fc + i;
          const hue = t % 256;
          if (mode === 0) {
            p.noFill();
            p.strokeWeight(weight);
            p.stroke(hue, colorAdjustment, 256, opacity);
            p.line(x1(t), y1(t), x2(t), y2(t));
          } else if (mode === 1) {
            p.noStroke();
            p.fill(hue, colorAdjustment, 256, opacity);
            p.ellipse(x1(t), y1(t), size1, size1);
            p.ellipse(x2(t), y2(t), size1, size1);
          } else if (mode === 2) {
            p.noFill();
            p.strokeWeight(weight);
            p.stroke(hue, colorAdjustment, 256, opacity);
            p.vertex(x1(t), y1(t));
            p.vertex(x2(t), y2(t));
          }
        }
      }

      if (mode === 2) {
        p.endShape();
      }

      p.pop();
    },
  });
})();
