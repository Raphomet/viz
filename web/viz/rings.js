// Rings — port of ../../Rings.pde.
// Concentric rings of radial dashes; each dash's length follows one of the
// nine bands, cycling through them around the ring.

(function () {
  // The original randomised for maxSize0 rings regardless of how many were
  // showing, so raising the ring count later reveals already-decided rings.
  const MAX_RINGS = 20;
  const SPEEDS = [1, -1, 2, -2, 4, -4];

  VIZ.register({
    id: 'rings',
    name: 'Rings',
    order: 3,

    params: [
      { key: 'size0', legacy: 'SIZE0', label: 'Ring count', type: 'range',
        min: 1, max: 20, default: 5 },
      { key: 'size1', legacy: 'SIZE1', label: 'Dash length', type: 'range',
        min: 0.1, max: 10, default: 1 },
      // Generated colourings, not swatch palettes, so a select rather than
      // the palette type. Index 2 was a TODO in the original that left the
      // fill at white.
      { key: 'colorPalette', legacy: 'COLOR PALETTE', label: 'Colouring', type: 'select',
        options: ['Static hues', 'Cycling hues', 'White'], default: 0 },
      // Saturation of the ring hues; at the default 0 both hue modes are white.
      { key: 'colorAdjustment', legacy: 'COLOR ADJUSTMENT', label: 'Saturation', type: 'range',
        min: 0, max: 255, default: 0 },
      { key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
        options: ['Together', 'Own speeds', 'Partial arcs', 'Missing rings'], default: 0 },
      // x0 multiplies the angular step between dashes, so higher is sparser.
      { key: 'x0', legacy: 'X0', label: 'Dash spacing', type: 'range',
        min: 0.1, max: 3, default: 1 },
      { key: 'z0', legacy: 'Z0', label: 'Zoom', type: 'range',
        min: 0.1, max: 3, default: 1 },
      { key: 'speed', legacy: 'SPEED', label: 'Spin speed', type: 'range',
        min: 0.1, max: 3, default: 1 },
    ],

    actions: [
      // New in the port: the original only randomised once, at startup.
      { id: 'reshuffle', label: 'Reshuffle rings', run() { this.randomizeRingSettings(); } },
    ],

    ringRotationSpeed: null,
    ringDisabled: null,

    randomizeRingSettings() {
      this.ringRotationSpeed = new Float32Array(MAX_RINGS);
      this.ringDisabled = new Array(MAX_RINGS);
      for (let i = 0; i < MAX_RINGS; i++) {
        this.ringRotationSpeed[i] = SPEEDS[Math.floor(Math.random() * 6)];
        this.ringDisabled[i] = Math.floor(Math.random() * 4) === 0;
      }
    },

    setup() {
      this.randomizeRingSettings();
    },

    draw(p, signals, params, ctx) {
      if (!this.ringRotationSpeed) this.randomizeRingSettings();

      const numSignals = signals.length;
      const size0 = params.size0;
      const size1 = params.size1;
      const colorPalette = Math.round(params.colorPalette);
      const colorAdjustment = params.colorAdjustment;
      const mode = Math.round(params.mode);
      const x0 = params.x0;
      const speed = params.speed;
      const TWO_PI = p.TWO_PI;
      const t = p.millis() / 400.0;

      p.colorMode(p.HSB, 255);
      p.background(0);
      p.rectMode(p.CENTER);
      p.noStroke();
      p.fill(255);

      p.push();
      p.translate(ctx.width / 2, ctx.height / 2);
      p.scale(params.z0);

      // One p5 push/rotate/rect per dash is tens of thousands of calls at 20
      // rings and low spacing, and filling those dashes as one path of
      // overlapping rectangles cost 200 ms a frame (nonzero-winding fill of
      // 42k subpaths). A radial segment stroked 3 wide with butt caps covers
      // exactly the same rectangle — centred at radius r, dash long along
      // the rotated x axis, 3 across — and strokes once per ring cheaply.
      const g = p.drawingContext;
      g.lineWidth = 3;
      g.lineCap = 'butt';

      // Float compare against size0, as the original: 5.5 rings draws 6.
      for (let ringCount = 0; ringCount < size0 && ringCount < MAX_RINGS; ringCount++) {
        let fillColor;
        if (colorPalette === 0) {
          fillColor = p.color(ringCount % 5 / 5.0 * 255, colorAdjustment, 255);
        } else if (colorPalette === 1) {
          fillColor = p.color((ringCount % 5 / 5.0 * 255 + p.millis() / 20.0) % 255, colorAdjustment, 255);
        } else {
          fillColor = p.color(255);
        }

        const hidden = mode === 3 && this.ringDisabled[ringCount];
        const ringSpeed = this.ringRotationSpeed[ringCount];
        const r = 20 * (ringCount + 1);
        const step = TWO_PI / (20 * (ringCount + 1) / x0);

        g.beginPath();
        let rectId = 0;
        // Math.fround keeps the Java float accumulation, so each ring gets
        // the same dash count (and so the same band per dash) as the original.
        for (let i = 0; i < TWO_PI; i = Math.fround(i + step)) {
          let rot;
          if (mode === 1) {
            rot = i + t / ringSpeed * speed;
          } else if (mode === 2) {
            rot = (i / ringSpeed) + t * speed;
          } else {
            rot = i + t * speed;
          }

          if (!hidden) {
            const w = signals[rectId % numSignals] / 10.0 * size1;
            if (w > 0) {
              const c = Math.cos(rot), s = Math.sin(rot);
              const r0 = r - w / 2, r1 = r + w / 2;
              g.moveTo(c * r0, s * r0);
              g.lineTo(c * r1, s * r1);
            }
          }
          rectId++;
        }
        g.strokeStyle = fillColor.toString();
        g.stroke();
      }

      p.pop();
    },
  });
})();
