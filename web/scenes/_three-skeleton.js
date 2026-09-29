// three.js scene skeleton: copy to web/scenes/<id>.js, rename, and build the
// scene. Everything the kit gives is in CONTRACT.md, "three.js scenes";
// web/scenes/rendered.js is the full reference. Not listed in index.html.
//   node harness/render.mjs web/scenes/_three-skeleton.js --gpu
(function () {
  'use strict';

  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  VIZ.register({
    id: '_three-skeleton',
    name: 'three.js skeleton',
    order: 9999,
    requires: 'three',                       // core loads the kit before setup/enter
    three: { addons: [] },                   // extra addons by name, e.g. ['RoundedBoxGeometry']
    finish: false,                           // the lens below is this scene's finish
    params: [
      { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 2, default: 0.5, step: 0.01 },
    ],

    // Once, the first time the scene is picked, with ctx.three ready.
    setup(p, ctx) {
      const kit = ctx.three, T = kit.THREE;
      const scene = new T.Scene();
      scene.background = new T.Color(0.01, 0.01, 0.015);
      scene.environment = kit.environment('room');      // image-based light
      const camera = new T.PerspectiveCamera(45, kit.aspect, 0.1, 100);
      camera.position.set(0, 0.4, 5);
      const knot = new T.Mesh(new T.TorusKnotGeometry(1, 0.32, 256, 48),
        new T.MeshPhysicalMaterial({ color: 0x202028, metalness: 1, roughness: 0.18 }));
      // An emitter brighter than 1 is what the bloom picks up.
      const ring = new T.Mesh(new T.TorusGeometry(2.2, 0.02, 16, 200),
        new T.MeshBasicMaterial({ color: new T.Color(4, 1.6, 0.5), toneMapped: false }));
      scene.add(knot, ring);
      const lens = kit.lens({ dof: true, motionBlur: true });
      lens.bloom.threshold = 1.2;
      this.R = { scene, camera, knot, ring, lens };
    },

    // Each time the scene is picked. Return the compile promise: core holds a
    // loading line until it resolves, so the first frame never hitches.
    enter(p, ctx) {
      this.last = null; this.kick = 0; this.angle = 0;
      return this.R.lens.compile(this.R.scene, this.R.camera);
    },

    draw(p, signals, params, ctx) {
      const kit = ctx.three, R = this.R;
      const ms = p.millis();
      const dt = this.last == null ? 1 / 60 : Math.min(0.1, (ms - this.last) / 1000);
      this.last = ms;
      this.kick = ease(this.kick, signals[0] / 100, signals[0] / 100 > this.kick ? 30 : 4, dt);
      this.angle += dt * params.spin;
      R.knot.rotation.set(this.angle * 0.7, this.angle, 0);
      R.ring.scale.setScalar(1 + 0.08 * this.kick);
      R.lens.focus = R.camera.position.length();       // metres to the sharp plane
      R.lens.blur = 0.006;                              // max blur, fraction of short side
      R.lens.bloom.strength = 0.25 + 0.5 * this.kick;
      R.lens.render(R.scene, R.camera);                 // HDR -> lens -> AgX, into the kit canvas
      kit.composite();                                  // into the p5 canvas (the stage)
    },

    leave() {},   // the kit frees render targets itself; stop anything of your own here
  });
})();
