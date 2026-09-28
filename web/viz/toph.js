// Twinkle Toph — port of ../TwinkleToph.pde.
//
// One dot or stroke per pixel of a 100×117 photo: about 11,700 shapes a frame.
// p5's ellipse()/fill() per shape is too slow for that, so the loop draws
// straight into the 2D context (which inherits core's scale and our translate)
// with colour strings prepared once at setup.
(function () {
  'use strict';

  VIZ.register({
    id: 'toph',
    name: 'Twinkle Toph',
    order: 6,

    params: [
      { key: 'sensitivity', legacy: 'SENSITIVITY', label: 'Sensitivity', type: 'range',
        min: 0, max: 10, default: 1 },
      { key: 'mode', legacy: 'MODE', label: 'Mode', type: 'select',
        options: ['Twinkle', 'Halftone, colour', 'Halftone, inverted', 'Halftone, grey',
          'Hatching', 'Strokes'],
        default: 0 },
      // The original declared a 0–8 "channel" knob but hard-coded signals[0];
      // this is that knob, wired to the places that read band 0.
      { key: 'x0', legacy: 'X0', label: 'Pulse band', type: 'band', default: 0 },
    ],

    preload(p) {
      this.img = p.loadImage('assets/toph.jpg');
    },

    setup(p) {
      const img = this.img;
      img.loadPixels();
      const w = img.width;
      const h = img.height;
      const n = w * h;
      const px = img.pixels; // RGBA; loaded images are density 1
      this.w = w;
      this.h = h;
      this.grey = new Uint8Array(n);      // round(), as the main greyscale
      this.greyTrunc = new Uint8Array(n); // int(), as mode 4's neighbour greyscale
      this.colour = new Array(n);
      for (let i = 0; i < n; i++) {
        const r = px[i * 4];
        const g = px[i * 4 + 1];
        const b = px[i * 4 + 2];
        const lum = r * 0.222 + g * 0.707 + b * 0.071;
        this.grey[i] = Math.round(lum);
        this.greyTrunc[i] = Math.trunc(lum);
        this.colour[i] = 'rgb(' + r + ',' + g + ',' + b + ')';
      }
      this.greyStyle = new Array(256);
      for (let v = 0; v < 256; v++) this.greyStyle[v] = 'rgb(' + v + ',' + v + ',' + v + ')';
    },

    draw(p, signals, params, ctx) {
      const mode = Math.round(params.mode) || 0;
      if (mode === 0 && p.frameCount % 10 !== 0) return;

      const sensitivity = params.sensitivity;
      const pulse = signals[(Math.round(params.x0) || 0) % 9];

      p.colorMode(p.RGB, 255);
      p.background(255);

      const W = this.w;
      const H = this.h;
      // Height-constrained, square tiles.
      const tileWidth = ctx.height / H;
      p.translate(ctx.width / 2 - (W * tileWidth) / 2, 0);

      const c = p.drawingContext;
      const TAU = Math.PI * 2;
      const grey = this.grey;
      const colour = this.colour;
      const greyStyle = this.greyStyle;

      c.lineCap = 'round'; // Processing's default strokeCap
      c.lineJoin = 'miter';

      if (mode === 5) {
        // Every stroke shares one colour and one weight, so one path does it.
        const weight = (10 * pulse * sensitivity) / 100;
        if (weight > 0) {
          c.strokeStyle = '#000';
          c.lineWidth = weight;
          c.beginPath();
          for (let gx = 0; gx < W; gx++) {
            for (let gy = 0; gy < H; gy++) {
              const posX = tileWidth * gx;
              const posY = tileWidth * gy;
              // map(greyscale, 0, 255, 30, 0.1)
              let l3 = 30 + (grey[gy * W + gx] / 255) * (0.1 - 30);
              l3 = (l3 * pulse) / 100.0 * sensitivity;
              c.moveTo(posX, posY);
              c.lineTo(posX + l3, posY + l3);
            }
          }
          c.stroke();
        }
        return;
      }

      if (mode === 4) {
        const h5 = (5 * pulse) / 100.0;
        const greyTrunc = this.greyTrunc;
        for (let gx = 0; gx < W; gx++) {
          const nx = Math.min(gx + 1, W - 1);
          for (let gy = 0; gy < H; gy++) {
            const posX = tileWidth * gx;
            const posY = tileWidth * gy;
            const g = grey[gy * W + gx];
            const n = gy * W + nx;
            const w5 = 5 + (g / 255) * (0.2 - 5); // map(g, 0, 255, 5, 0.2)
            c.lineWidth = (w5 * pulse) / 100.0 * sensitivity + 0.1;
            c.strokeStyle = colour[n];
            const d1 = h5 - (g / 255) * h5;             // map(g, 0, 255, h5, 0)
            const d2 = h5 - (greyTrunc[n] / 255) * h5;
            c.beginPath();
            c.moveTo(posX - d1, posY + d1);
            c.lineTo(posX + tileWidth - d2, posY + d2);
            c.stroke();
          }
        }
        return;
      }

      // Modes 0–3: filled dots, no stroke, in the original's column-major
      // order (later pixels paint over earlier ones where dots overlap).
      for (let gx = 0; gx < W; gx++) {
        for (let gy = 0; gy < H; gy++) {
          const i = gy * W + gx;
          const g = grey[i];
          const w = 10 - (g / 255) * 10; // map(g, 0, 255, 10, 0)
          let d;
          let style;
          if (mode === 1) {
            d = (w * pulse) / 100.0 * sensitivity;
            style = colour[i];
          } else if (mode === 0) {
            d = w * Math.random();
            style = colour[i];
          } else if (mode === 2) {
            d = (w * signals[(gx + gy) % 9]) / 100.0 * sensitivity;
            style = greyStyle[255 - g];
          } else if (mode === 3) {
            d = (w * signals[(gx * gy) % 9]) / 100.0 * sensitivity;
            style = greyStyle[g];
          } else {
            continue;
          }
          if (!(d > 0)) continue;
          c.fillStyle = style;
          c.beginPath();
          c.arc(tileWidth * gx, tileWidth * gy, d / 2, 0, TAU);
          c.fill();
        }
      }
    },
  });
})();
