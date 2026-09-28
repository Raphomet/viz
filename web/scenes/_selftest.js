// Harness self-test — the example scene for harness/README.md, and the render
// that proves the harness works. Everything on screen is chosen to be easy to
// check on a contact sheet:
//   - a WebGL2 (GLSL ES 3.00) plasma layer fills the stage; its hue drifts with
//     time and it brightens with the bass (bands 0-1). If WebGL2 is missing the
//     stage says so in red instead.
//   - a ring of nine 2D bars, one per band, in the band strip's colours, so a
//     tile's bars can be compared with the strip under it;
//   - a clock hand that turns once every 4 s of p.millis(), and the frame
//     number, so tiles are visibly in time order.

(function () {
  const BAND_COLORS = ['#ff4d4d', '#ff7a3d', '#ffb13b', '#f2dd4a', '#9be15d', '#3fd6a0', '#36c2e8', '#5a8cff', '#a47bff'];

  const VERT = `#version 300 es
in vec2 pos;
out vec2 uv;
void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
uniform float time;
uniform float bass;
uniform float treble;
uniform vec2 res;
out vec4 color;
void main() {
  vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0) * 6.0;
  float v = sin(p.x + time) + sin(p.y * 1.3 - time * 0.7)
          + sin(length(p) * 2.0 - time * 1.5) + sin((p.x + p.y) * 0.8 + time * 0.4);
  vec3 c = 0.5 + 0.5 * cos(v * 1.4 + time * 0.3 + vec3(0.0, 2.1, 4.2));
  float glow = 0.18 + 0.7 * bass;
  c *= glow;
  c += treble * 0.25 * smoothstep(0.8, 1.0, sin(v * 6.0));
  color = vec4(c, 1.0);
}`;

  VIZ.register({
    id: '_selftest',
    name: 'Harness self-test',
    order: 100,
    gallery: {
      title: 'Harness self-test',
      technique: 'Canvas 2D band ring over a WebGL2 fragment-shader layer composited with drawImage',
      brief: 'Proves the render harness: time, bands, WebGL2 and determinism are all visible on the contact sheet.',
      lineage: 'harness/README.md example; not part of the 2016 set'
    },

    params: [
      { key: 'ringSize', label: 'Ring size', type: 'range', min: 50, max: 280, default: 200 },
      { key: 'glLayer', label: 'Shader layer', type: 'select', options: ['On', 'Off'], default: 0 },
    ],

    gl: null,
    glCanvas: null,
    glFailed: false,

    initGL(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
      this.gl = gl;
      this.glCanvas = c;
      this.u = {
        time: gl.getUniformLocation(prog, 'time'),
        bass: gl.getUniformLocation(prog, 'bass'),
        treble: gl.getUniformLocation(prog, 'treble'),
        res: gl.getUniformLocation(prog, 'res'),
      };
    },

    drawGL(p, signals, ctx) {
      // Device-pixel size, so the layer is as sharp as the p5 canvas.
      const w = Math.round(p.width * p.pixelDensity());
      const h = Math.round(p.height * p.pixelDensity());
      if (!this.gl && !this.glFailed) this.initGL(w, h);
      if (!this.gl) return false;
      const gl = this.gl;
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(this.u.time, p.millis() / 1000);
      gl.uniform1f(this.u.bass, (signals[0] + signals[1]) / 200);
      gl.uniform1f(this.u.treble, (signals[7] + signals[8]) / 200);
      gl.uniform2f(this.u.res, w, h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // The virtual-stage scale is already applied, so this covers the canvas.
      p.drawingContext.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
      return true;
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      p.background(0);

      if (params.glLayer === 0 && !this.drawGL(p, signals, ctx)) {
        p.noStroke();
        p.fill(255, 60, 60);
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(28);
        p.text('NO WEBGL2', ctx.width / 2, 20);
      }

      const cx = ctx.width / 2, cy = ctx.height / 2;
      const r0 = params.ringSize * 0.35;

      // A dark disc so the bars read against any plasma colour.
      p.noStroke();
      p.fill(0, 0, 0, 170);
      p.ellipseMode(p.CENTER);
      p.circle(cx, cy, (r0 + params.ringSize) * 2 + 20);

      p.strokeCap(p.SQUARE);
      for (let b = 0; b < 9; b++) {
        const a = -p.HALF_PI + (b / 9) * p.TWO_PI;
        const len = (params.ringSize - r0) * signals[b] / 100;
        p.stroke(BAND_COLORS[b]);
        p.strokeWeight(22);
        p.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0,
               cx + Math.cos(a) * (r0 + Math.max(2, len)), cy + Math.sin(a) * (r0 + Math.max(2, len)));
      }

      // The clock hand: one turn per 4 s.
      const ha = -p.HALF_PI + (p.millis() / 4000) * p.TWO_PI;
      p.stroke(255);
      p.strokeWeight(4);
      p.line(cx, cy, cx + Math.cos(ha) * (r0 - 8), cy + Math.sin(ha) * (r0 - 8));

      p.noStroke();
      p.fill(255);
      p.textAlign(p.LEFT, p.BOTTOM);
      p.textSize(22);
      p.text('frame ' + p.frameCount + '  ·  ' + (p.millis() / 1000).toFixed(2) + 's', 16, ctx.height - 14);
    },
  });
})();
