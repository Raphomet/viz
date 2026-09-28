// Arcs — port of ../../Arcs.pde.
//
// A square grid of cells, each holding concentric arcs that sweep closed and
// then open again on a millis() clock. The three first palette slots were
// "dummy" rows in the original whose indices switched on generated colour
// schemes; they are kept at 0–2 so every palette formula lines up.
(function () {
  const GENERATED = [
    { name: 'White', colors: [] },
    { name: 'Ring gradient', colors: [] },
    { name: 'Cell gradient', colors: [] },
  ];

  const shared = window.VIZ_PALETTES || [];

  // Processing's arc() and p5's arc() disagree at the edges, and this sketch
  // lives at the edges: the sweep passes through 0 and TWO_PI every second, and
  // a negative "Arc stagger" makes the phase negative. Processing draws nothing
  // when stop <= start, lifts negative starts by TWO_PI, and clamps anything
  // wider than a full turn to a full circle. p5 instead normalizes both angles
  // mod TWO_PI and draws a *full ellipse* when they land on the same point, so
  // a zero-length sweep would flash a whole ring. Reproduce Processing here.
  function processingArc(p, d, start, stop) {
    if (!isFinite(start) || !isFinite(stop) || !(stop > start)) return;
    const TWO_PI = p.TWO_PI;
    while (start < 0) {
      start += TWO_PI;
      stop += TWO_PI;
    }
    const span = stop - start;
    if (span >= TWO_PI - 1e-4) {
      p.ellipse(0, 0, d, d);
    } else if (span > 1e-4) {
      p.arc(0, 0, d, d, start, stop);
    }
  }

  VIZ.register({
    id: 'arcs',
    name: 'Arcs',
    order: 2,

    params: [
      { key: 'size0', legacy: 'SIZE0', label: 'Arc count', type: 'range',
        min: 1, max: 40, default: 1 },
      { key: 'size1', legacy: 'SIZE1', label: 'Line weight', type: 'range',
        min: 0.1, max: 10, default: 4 },
      { key: 'sensitivity', legacy: 'SENSITIVITY', label: 'Sensitivity', type: 'range',
        min: 0, max: 1, default: 0.5 },
      { key: 'colorAdjustment', legacy: 'COLOR ADJUSTMENT', label: 'Gradient hue',
        type: 'range', min: 0, max: 255, default: 0 },
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Palette', type: 'palette',
        palettes: GENERATED.concat(shared.map((pal) => ({ name: pal.name, colors: pal.colors.slice() }))),
        default: 0 },
      { key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
        options: ['Colour per cell', 'Colour per arc'], default: 0 },
      { key: 'speed', legacy: 'SPEED', label: 'Sweep speed', type: 'range',
        min: 0.01, max: 2, default: 1 },
      { key: 'x0', legacy: 'X0', label: 'Grid size', type: 'range',
        min: 1, max: 8, default: 1 },
      { key: 'x1', legacy: 'X1', label: 'Arc stagger (ms)', type: 'range',
        min: -500, max: 500, default: 0 },
      { key: 'y0', legacy: 'Y0', label: 'Arc spacing', type: 'range',
        min: 5, max: 100, default: 50 },
      { key: 'y1', legacy: 'Y1', label: 'Cell spacing', type: 'range',
        min: 0, max: 400, default: 100 },
      { key: 'z0', legacy: 'Z0', label: 'Row stagger (ms)', type: 'range',
        min: 0, max: 1000, default: 100 },
      { key: 'z1', legacy: 'Z1', label: 'Column stagger (ms)', type: 'range',
        min: 0, max: 1000, default: 100 },
    ],

    actions: [
      {
        id: 'shuffle',
        label: 'Shuffle palette',
        // Original shuffleCurrentColors: Fisher–Yates over the whole row,
        // background included, in place — so it persists for this palette.
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
      // Own copies, as p5.Color objects (parsed once rather than per stroke),
      // so shuffling here never reorders another visual's palette.
      this.palettes = [[], [], []].concat(
        shared.map((pal) => pal.colors.map((hex) => p.color(hex)))
      );
    },

    draw(p, signals, params, ctx) {
      const palettes = this.palettes;
      const colorPalette = Math.round(params.colorPalette);
      const mode = Math.round(params.mode);
      const { size0, size1, sensitivity, colorAdjustment, speed,
        x0, x1, y0, y1, z0, z1 } = params;
      const gridSize = Math.trunc(x0);
      const TWO_PI = p.TWO_PI;

      p.colorMode(p.HSB, 255);
      p.angleMode(p.RADIANS);
      p.ellipseMode(p.CENTER);
      p.strokeCap(p.ROUND);
      p.noFill();

      if (colorPalette > 2 && palettes[colorPalette]) {
        p.background(palettes[colorPalette][0]);
      } else {
        p.background(0);
      }

      const now = p.millis();

      p.push();
      p.translate(ctx.width / 2 - ((gridSize - 1) * y1) / 2,
        ctx.height / 2 - ((gridSize - 1) * y1) / 2);

      for (let j = 0; j < gridSize; j++) {
        const y = j * y1;
        for (let i = 0; i < gridSize; i++) {
          const x = i * y1;
          p.push();
          p.translate(x, y);
          // The original built arcSetGrid[j][i] = ArcSet(i, j) but read
          // arcSetGrid.get(i).get(j), so the cell drawn at column i, row j
          // carries ArcSet.i = j and ArcSet.j = i. That transposition decides
          // which axis Z0/Z1 stagger and which way the cell gradient runs.
          this.displayArcSet(p, signals, j, i, colorPalette, mode, size0, size1,
            sensitivity, colorAdjustment, speed, x0, x1, y0, z0, z1, now, TWO_PI);
          p.pop();
        }
      }

      p.pop();
    },

    // ArcSet.display(): ci / cj are the ArcSet's own i / j fields.
    displayArcSet(p, signals, ci, cj, colorPalette, mode, size0, size1,
      sensitivity, colorAdjustment, speed, x0, x1, y0, z0, z1, now, TWO_PI) {
      const pal = this.palettes[colorPalette];

      p.push();
      p.rotate(3 * p.HALF_PI);

      if (colorPalette === 0) {
        p.stroke(255);
      } else if (colorPalette === 2) {
        p.stroke(colorAdjustment, 255, 255 * ((x0 - ci) / x0));
      }

      if (mode === 0 && colorPalette > 2 && pal) {
        p.stroke(pal[(ci * 141 + cj) % 4 + 1]);
      }

      // size0 is a float and the loop compares against it directly, so 1.5
      // arcs draws two — kept as the original behaved.
      for (let k = 0; k < size0; k++) {
        p.noFill();
        p.strokeWeight(size1 + signals[k % 9] * sensitivity / 5.0);

        if (colorPalette === 1) {
          p.stroke(colorAdjustment, 255, 255 * ((size0 - k) / size0));
        } else if (mode === 1 && colorPalette > 2 && pal) {
          p.stroke(pal[(ci * 141 + cj + k * k) % 4 + 1]);
        }

        const t = now * speed + x1 * k + z0 * ci + z1 * cj;
        const d = y0 * (k + 1);
        // Java: (int)(t) / 1000 % 2 — integer division and remainder both
        // truncate toward zero, so negative phases land in the else branch.
        if (Math.trunc(Math.trunc(t) / 1000) % 2 === 0) {
          processingArc(p, d, 0, TWO_PI * (t % 1000) / 1000.0);
        } else {
          processingArc(p, d, TWO_PI * (t % 1000) / 1000.0, TWO_PI);
        }
      }

      p.pop();
    },
  });
})();
