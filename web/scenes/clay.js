// Clay — a plasticine meadow, animated on twos.
//
// A claymation diorama raymarched in one WebGL2 fragment shader: a lumpy green
// field in front of rows of hand-rolled hills, a terracotta volcano puffing
// clay smoke, a sun with a face stuck on a painted sky, and a snail making its
// way across it all. The camera trucks sideways with the snail, so the world
// scrolls past in parallax (near flowers fast, hills slower, volcano slowest).
//
// Craft notes:
// - Everything is matte: wrapped diffuse from one warm key light, a cool sky
//   fill, raymarched soft shadows, contact AO and a faint waxy sheen. No bloom,
//   no additive light; the drop gets "more" from characters and motion.
// - Every surface carries hand marks: low-frequency lumps plus sparse
//   fingerprint whorls, applied to the normal only (cheap, and it is the
//   shading that reads as touch). The lumps "boil" on twos like re-handled
//   plasticine.
// - Puppets (snail, flowers, critters, bees, sun, smoke) are posed on twos:
//   their clock is quantised to 12 poses a second. The camera is not, because
//   stepping the travel judders the whole frame (Paper found the same).
// - Music is handed to characters, not to the frame. Kick: the snail squashes
//   and stretches (a spring keyed to the kick time, so the squash lands on the
//   beat, not at the next twos step) and kicks up clay crumbs. Snare/clap:
//   something pops out of the ground ahead (flower, toadstool or a gumdrop
//   critter) with an overshooting spring. Hats: bees zip and their wings
//   flutter. Bass: the volcano's smoke puffs swell. The drop: everyone dances
//   (sway and hop that land on the beat, so they are still at the kick), the
//   sun wakes up and its rays turn, the walk speeds up, more bees. The
//   breakdown: the sun dozes, the dancing settles, the walk slows.

(function () {
  'use strict';

  // Palette slots (shader uPal[i]):
  // 0 sky top, 1 sky horizon, 2 ground, 3 hill A, 4 hill B, 5 volcano,
  // 6 lava, 7 cream (smoke, spiral, mushroom stems), 8 snail body, 9 shell,
  // 10 sun, 11 sun rays, 12 petal A, 13 petal B, 14 toadstool cap,
  // 15 critter, 16 stem, 17 dark (pupils, mouth), 18 key light, 19 fill light
  const PALETTES = [
    { name: 'Morning', c: ['#7fc0e6', '#f3e4c4', '#62ad3c', '#4a9a44', '#8cc24a', '#c0664a',
      '#f28a2e', '#f4ead6', '#f0c24e', '#d8513a', '#ffc83a', '#ff9a24', '#f2618e', '#8a6cf0',
      '#e23a3f', '#3f8ed8', '#3f8a38', '#2a2320', '#fff0dc', '#9cc4ec'] },
    { name: 'Dusk', c: ['#6c5aa8', '#f6b68a', '#5a8f4a', '#476f5a', '#7c9a52', '#9a4a48',
      '#ffb04a', '#f6e2d0', '#f2b050', '#b8445a', '#ff9e58', '#ff7650', '#ffd06a', '#62c0c8',
      '#d44a4a', '#5a7ad8', '#3e7a44', '#2a1e28', '#ffc8a0', '#8a7ad0'] },
    { name: 'Night', c: ['#101a3a', '#34406e', '#2f6a44', '#26504a', '#3f7048', '#6a3a44',
      '#ff8a3a', '#dcd6ca', '#d8b456', '#b0444a', '#f2ecc8', '#c8c2a0', '#e8709a', '#9a8af0',
      '#c8383e', '#4a8ad0', '#2c6a34', '#161218', '#b8c8ff', '#46508a'] },
  ];

  function hexRGB(h) {
    const n = parseInt(h.slice(1), 16);
    // sRGB -> linear, so the shader lights in linear space and re-encodes.
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
  }
  const PAL = PALETTES.map((p) => {
    const a = new Float32Array(60);
    p.c.forEach((h, i) => a.set(hexRGB(h), i * 3));
    return a;
  });

  const MAX_POPS = 20;
  const MAX_PIXELS = 0.95e6;
  const NBEES = 4;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;     // puppet clock, quantised to twos
uniform float uStep;     // twos frame index (clay boil)
uniform float uCamX;
uniform float uSnailX;
uniform float uKickAge;
uniform float uKickAmp;
uniform float uDance;
uniform float uWake;
uniform float uBass;
uniform float uDrive;
uniform float uBeat;
uniform float uBoil;
uniform float uLight;   // 0 overcast (quiet) .. 1 full sun (drop)
float gFoot;           // world size of one pixel at the hit, for texture fade
uniform vec4 uPops[${MAX_POPS}];
uniform int uPopCount;  // live pops, packed at the front and culled to the view in JS
uniform vec4 uBees[${NBEES}];
uniform vec3 uPal[20];
uniform vec3 uSunDir;

#define PI 3.14159265

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1,0)), f.x), mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), f.x), f.y);
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec2 U(vec2 a, float d, float m) { return d < a.x ? vec2(d, m) : a; }

float groundH(vec2 xz) {
  float h = 0.10 * sin(xz.x * 0.9 + sin(xz.y * 0.7)) + 0.07 * sin(xz.x * 0.37 + xz.y * 1.3);
  h += 0.07 * (vnoise2(xz * 1.6) - 0.5);
  // the snail's path is pressed flatter than the field
  return h * mix(0.35, 1.0, smoothstep(0.25, 0.7, abs(xz.y - 1.25)));
}

// Snail frame: squash about its foot on the kick. Shared by map and colouring.
#define SNAIL 1.3
vec3 snailBase() { return vec3(uSnailX, groundH(vec2(uSnailX, 1.25)) - 0.02, 1.25); }
float kickSpring() { float a = uKickAge; return uKickAmp * exp(-a * 5.5) * cos(a * 17.0); }
vec3 snailLocal(vec3 p, out float scl) {
  float k = kickSpring();
  float sy = 1.0 - 0.34 * k, sx = 1.0 + 0.22 * k;
  vec3 q = (p - snailBase()) / SNAIL;
  q.y /= sy; q.xz /= sx;
  scl = min(sy, sx) * SNAIL;
  return q;
}
vec3 shellC() { return vec3(-0.14, 0.56, 0.0); }

vec2 snail(vec3 p) {
  float scl;
  vec3 q = snailLocal(p, scl);
  vec2 r = vec2(1e9, 0.0);
  // crawl: a slow wave down the foot
  vec3 qf = q; qf.y -= 0.012 * sin(q.x * 9.0 - uTime * 7.0) * smoothstep(0.4, -0.6, q.x);
  float foot = sdCap(qf, vec3(-0.78, 0.07, 0.0), vec3(0.34, 0.12, 0.0), 0.05, 0.15);
  foot = max(foot, -q.y - 0.015);
  float neck = sdCap(q, vec3(0.28, 0.13, 0.0), vec3(0.56, 0.46, 0.0), 0.15, 0.125);
  float body = smin(foot, neck, 0.1);
  // eye stalks: sway, and bop with the dance
  float sw = 0.05 * sin(uTime * 1.3) + uDance * 0.09 * cos(uBeat * PI);
  vec3 tipA = vec3(0.68 + sw, 0.92, 0.13), tipB = vec3(0.72 + sw * 0.7, 0.88, -0.12);
  body = smin(body, sdCap(q, vec3(0.55, 0.52, 0.05), tipA, 0.03, 0.02), 0.04);
  body = smin(body, sdCap(q, vec3(0.57, 0.52, -0.05), tipB, 0.03, 0.02), 0.04);
  r = U(r, body * scl, 12.0);
  float eyes = min(length(q - tipA) - 0.07, length(q - tipB) - 0.065);
  r = U(r, eyes * scl, 10.0);
  float pup = min(length(q - tipA - vec3(0.04, 0.0, 0.05)) - 0.034, length(q - tipB - vec3(0.045, 0.0, 0.04)) - 0.03);
  r = U(r, pup * scl, 9.0);
  // shell with a pressed spiral groove
  vec3 s = q - shellC();
  float sh = sdEll(s, vec3(0.47, 0.46, 0.3));
  float rr = length(s.xy), an = atan(s.y, s.x);
  float spi = fract((log(rr + 0.02) / 0.19 - an) / (2.0 * PI));
  sh += 0.018 * smoothstep(0.18, 0.0, abs(spi - 0.5)) * smoothstep(0.03, 0.12, rr);
  r = U(r, sh * scl * 0.9, 13.0);
  // clay crumbs kicked up by the squash
  if (uKickAge < 0.5) {
    float a = uKickAge;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec3 dir = vec3(cos(fi * 1.9 + 0.4) * 0.9, 1.1 + 0.3 * sin(fi * 2.3), 0.5 + 0.4 * sin(fi * 3.1));
      vec3 c = vec3(-0.2 + 0.35 * fi - 0.3, 0.02, 0.0) + dir * a * 1.3 - vec3(0.0, 3.2 * a * a, 0.0);
      float rad = 0.055 * uKickAmp * (1.0 - a / 0.5);
      r = U(r, (length(q - c) - rad) * scl, 16.0);
    }
  }
  return r;
}

// A pop: flower, toadstool or critter, rising out of the ground.
vec2 pop(vec3 p, vec4 P, int idx, float best) {
  float fi = float(idx);
  float kind = floor(P.w / 4.0);
  float sc = (0.85 + 0.45 * hash12(vec2(fi, P.x))) * (kind < 0.5 ? 1.35 : 1.0);
  float bnd = length(p - vec3(P.x, 0.5 * sc, P.y)) - 1.0 * sc - 0.2;
  if (bnd > best) return vec2(bnd, 0.0);
  vec3 base = vec3(P.x, groundH(P.xy) - 0.03, P.y);
  float age = P.z;
  float g = 1.0 - exp(-age * 6.5) * cos(age * 15.0);
  float ph = hash12(vec2(fi * 3.1, 7.0)) * 6.28;
  vec3 q = (p - base) / sc;
  // rise out of the ground, overshooting like a spring
  q.y += (1.0 - clamp(g, 0.0, 1.0)) * 0.7;
  q.y /= max(g, 0.05);
  // dance: sway and hop, both at rest on the beat
  float sway = uDance * 0.28 * cos(uBeat * PI + (kind == 2.0 ? 0.0 : 0.0)) + 0.06 * sin(uTime * 1.1 + ph) * (0.4 + uBass);
  float hop = kind == 2.0 ? uDance * 0.16 * (0.5 - 0.5 * cos(uBeat * 2.0 * PI)) : 0.0;
  q.y -= hop;
  q.xy = rot(sway * clamp(q.y, 0.0, 1.0)) * q.xy;
  float m0 = 100.0 + fi * 8.0;
  vec2 r = vec2(1e9, 0.0);
  float s = sc * max(min(g, 1.0), 0.05);
  if (kind < 0.5) {
    float H = 0.58;
    r = U(r, sdCap(q, vec3(0.0), vec3(0.0, H, 0.0), 0.035, 0.025), m0);
    r = U(r, sdEll(q - vec3(0.07, 0.2, 0.0), vec3(0.1, 0.04, 0.05)), m0);
    vec3 h = q - vec3(0.0, H + 0.05, 0.03);
    float spin = uTime * 0.2 + ph;
    h.xy = rot(spin) * h.xy;
    float an = atan(h.y, h.x), sec = 2.0 * PI / 5.0;
    an = mod(an + sec * 0.5, sec) - sec * 0.5;
    vec3 hp = vec3(cos(an) * length(h.xy), sin(an) * length(h.xy), h.z);
    r = U(r, sdEll(hp - vec3(0.14, 0.0, 0.0), vec3(0.1, 0.065, 0.035)), m0 + 1.0);
    r = U(r, sdEll(h - vec3(0.0, 0.0, 0.03), vec3(0.07, 0.07, 0.05)), m0 + 2.0);
  } else if (kind < 1.5) {
    r = U(r, sdCap(q, vec3(0.0), vec3(0.0, 0.26, 0.0), 0.085, 0.07), m0 + 4.0);
    float cap = sdEll(q - vec3(0.0, 0.28, 0.0), vec3(0.27, 0.18, 0.27));
    cap = max(cap, 0.25 - q.y);
    r = U(r, cap, m0 + 3.0);
  } else {
    float sq = 1.0 + uDance * 0.12 * cos(uBeat * 2.0 * PI);
    vec3 qb = q - vec3(0.0, 0.2, 0.0); qb.y /= sq;
    r = U(r, sdEll(qb, vec3(0.2, 0.25, 0.18)) * min(sq, 1.0), m0 + 5.0);
    vec3 e1 = vec3(0.075, 0.3 * sq, 0.14), e2 = vec3(-0.075, 0.3 * sq, 0.14);
    r = U(r, min(length(q - e1) - 0.055, length(q - e2) - 0.055), m0 + 6.0);
    r = U(r, min(length(q - e1 - vec3(0.0, 0.0, 0.045)) - 0.028, length(q - e2 - vec3(0.0, 0.0, 0.045)) - 0.028), m0 + 7.0);
  }
  r.x *= s;
  return r;
}

vec2 sunMap(vec3 p) {
  vec3 S = vec3(uCamX + 3.3, 4.6, -7.0);
  vec3 q = p - S;
  float bnd = length(q) - 1.7;
  if (bnd > 0.3) return vec2(bnd, 0.0);
  vec2 r = vec2(sdEll(q, vec3(0.95, 0.95, 0.32)), 7.0);
  // rays turn slowly, and faster when the music is up
  vec2 rq = rot(uTime * (0.06 + 0.35 * uDrive)) * q.xy;
  float an = atan(rq.y, rq.x), sec = 2.0 * PI / 12.0;
  float id = floor((an + sec * 0.5) / sec);
  an = mod(an + sec * 0.5, sec) - sec * 0.5;
  vec3 rp = vec3(cos(an) * length(rq), sin(an) * length(rq), q.z);
  float len = mod(id, 2.0) < 0.5 ? 1.55 : 1.38;
  r = U(r, sdCap(rp, vec3(1.0, 0.0, 0.0), vec3(len, 0.0, 0.0), 0.12, 0.035), 8.0);
  // face: eyes close when the music sleeps
  float eo = mix(0.12, 0.02, 1.0 - uWake);
  float ey = min(sdEll(q - vec3(0.3, 0.2, 0.28), vec3(0.085, eo, 0.06)), sdEll(q - vec3(-0.3, 0.2, 0.28), vec3(0.085, eo, 0.06)));
  vec3 mq = q - vec3(0.0, 0.02 + 0.06 * uWake, 0.27);
  float mr = 0.3 + 0.05 * uWake;
  float mouth = length(vec2(length(mq.xy) - mr, mq.z)) - 0.04;
  mouth = max(mouth, mq.y + mr * mix(0.75, 0.45, uWake));
  r = U(r, min(ey, mouth), 9.0);
  float ch = min(sdEll(q - vec3(0.52, -0.08, 0.22), vec3(0.14, 0.09, 0.06)), sdEll(q - vec3(-0.52, -0.08, 0.22), vec3(0.14, 0.09, 0.06)));
  r = U(r, ch, 11.0);
  return r;
}

vec2 map(vec3 p) {
  vec2 r = vec2((p.y - groundH(p.xz)) * 0.9, 1.0);  // field slope stays under 0.25
  // Everything behind the field sits at z < -3.8. In front of that a
  // half-space bound stands in for it, so the near march never pays for it.
  if (p.z > -3.0) {
    r = U(r, p.z + 3.8, 0.0);
  } else {
  // near hills: one row of hand-rolled mounds
  {
    float per = 4.6; float c0 = floor(p.x / per - 0.5);
    for (int k = 0; k < 2; k++) {
      float c = c0 + float(k); float h = hash12(vec2(c, 3.0));
      vec3 q = p - vec3((c + 0.5) * per + (h - 0.5) * 1.2, -0.7 + 0.4 * h, -5.2 - 1.0 * h);
      r = U(r, sdEll(q, vec3(2.3 + 0.6 * h, 1.5 + 0.8 * h, 1.4)), h > 0.5 ? 3.0 : 4.0);
    }
  }
  // far hills
  {
    float per = 7.0; float c0 = floor(p.x / per - 0.5);
    for (int k = 0; k < 2; k++) {
      float c = c0 + float(k); float h = hash12(vec2(c, 11.0));
      vec3 q = p - vec3((c + 0.5) * per, -1.0 + 0.8 * h, -9.5);
      r = U(r, sdEll(q, vec3(3.8, 2.6 + 1.2 * h, 1.8)), h > 0.5 ? 4.0 : 3.0);
    }
  }
  // volcano with clay smoke
  {
    float per = 26.0; float c = floor((p.x + 8.0) / per);
    vec3 vc = vec3(c * per + 5.0, -0.4, -13.0);
    vec3 q = p - vc;
    float rr = length(q.xz);
    if (rr < 5.8 && p.y < 5.0) {
      float h = min(5.0 - 1.0 * rr, 4.4) - 0.45 * smoothstep(0.8, 0.3, rr);
      h += 0.1 * sin(atan(q.z, q.x) * 7.0 + rr * 2.0) * smoothstep(0.5, 2.0, rr);
      r = U(r, (q.y - h) * 0.55, 5.0);
    } else r = U(r, max(rr - 5.2, p.y - 4.5) * 0.55, 0.0);
    vec3 top = vc + vec3(0.0, 4.35, 0.0);
    // in the drop the volcano spits lumps of orange clay
    if (uDance > 0.05 && length(p - top - vec3(0.0, 1.0, 0.0)) < 3.0) {
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float ph = fract(uTime * 0.55 + fi / 3.0);
        vec3 c2 = top + vec3((fi - 1.0) * 1.6 * ph, 3.2 * ph - 3.4 * ph * ph, 0.4 * (fi - 1.0) * ph);
        r = U(r, length(p - c2) - 0.2 * uDance * smoothstep(0.0, 0.08, ph), 5.7);
      }
    }
    if (length(p.xz - top.xz) < 3.5 && p.y > top.y - 1.0) {
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float ph = fract(uTime * (0.16 + 0.12 * uDrive) + fi / 5.0);
        vec3 c2 = top + vec3(ph * 1.3 + 0.2 * sin(fi * 2.0), ph * 3.2, 0.3 * sin(fi * 3.0));
        float rad = (0.22 + 0.5 * ph) * (0.7 + 0.7 * uBass + 0.3 * uDrive) * smoothstep(0.0, 0.12, ph) * smoothstep(1.0, 0.75, ph);
        r = U(r, length(p - c2) - rad, 5.5);
      }
    } else r = U(r, max(length(p.xz - top.xz) - 3.0, top.y - 1.3 - p.y), 0.0);
  }
  // clouds on the backdrop
  {
    float per = 10.0; float xx = p.x - uTime * 0.12; float c = floor(xx / per);
    float h = hash12(vec2(c, 5.0));
    vec3 q = vec3(xx - (c + 0.5) * per, p.y - 5.4 - 0.8 * h, p.z + 11.0);
    if (length(q) < 3.0) {
      float d = sdEll(q, vec3(0.9, 0.45, 0.4));
      d = smin(d, sdEll(q - vec3(0.7, -0.12, 0.05), vec3(0.6, 0.35, 0.35)), 0.15);
      d = smin(d, sdEll(q - vec3(-0.75, -0.15, 0.0), vec3(0.55, 0.3, 0.35)), 0.15);
      d = smin(d, sdEll(q - vec3(0.15, 0.3, 0.0), vec3(0.5, 0.4, 0.35)), 0.15);
      r = U(r, d, 6.0);
    } else r = U(r, length(q) - 2.0, 0.0);
  }
  }
  vec2 sm = sunMap(p); if (sm.x <= r.x) r = sm;
  // the snail
  {
    vec3 sb = snailBase();
    float bnd = length(p - sb - vec3(0.0, 0.65, 0.0)) - 1.7;
    if (bnd < r.x) { vec2 s = snail(p); if (s.x < r.x) r = s; }
  }
  // foreground: tufts and pebbles close to the lens, the fastest parallax
  if (p.z > 2.95 && p.z < 4.4 && p.y < 0.75) {
    float per = 1.15; float id = floor(p.x / per);
    float h1 = hash12(vec2(id, 21.0)), h2 = hash12(vec2(id, 22.0));
    vec3 b = vec3((id + 0.2 + 0.6 * h1) * per, groundH(vec2((id + 0.5) * per, 3.6)) - 0.02, 3.3 + 0.5 * h2);
    vec3 q = p - b;
    if (h2 < 0.6) {
      float d = 1e9;
      for (int k = 0; k < 3; k++) {
        float fk = float(k) - 1.0;
        float lean = fk * 0.35 + 0.1 * sin(uTime * 1.3 + id) * (0.5 + uBass);
        vec3 tip = vec3(sin(lean) * 0.38, cos(lean) * (0.3 + 0.08 * abs(fk - h1)), fk * 0.04);
        d = min(d, sdCap(q, vec3(fk * 0.04, 0.0, 0.0), tip, 0.045, 0.012));
      }
      r = U(r, d, 4.0);
    } else {
      r = U(r, sdEll(q - vec3(0.0, 0.02, 0.0), vec3(0.16, 0.09, 0.13)), 17.0);
    }
  } else r = U(r, max(max(2.95 - p.z, p.z - 4.4), p.y - 0.75) + 0.12, 0.0);
  // the parade: gumdrops that come up out of the path to dance in the drop
  if (uDance > 0.02 && abs(p.x - uCamX) < 7.0 && p.z > -0.4 && p.z < 1.3 && p.y < 1.6) {
    float per = 1.25; float xx = p.x - uCamX + 0.4; float id = floor(xx / per + 0.5);
    float rise = clamp(uDance * 1.6 - hash12(vec2(id, 2.0)) * 0.6, 0.0, 1.0);
    float odd = mod(id, 2.0);
    float hop = rise * 0.2 * (0.5 - 0.5 * cos(uBeat * 2.0 * PI + odd * PI));
    float sq = 1.0 + 0.14 * rise * cos(uBeat * 2.0 * PI + odd * PI);
    vec3 q = vec3(xx - id * per, p.y - groundH(vec2(uCamX + id * per - 0.4, 0.45)) + (1.0 - rise) * 0.62 - hop, p.z - 0.45);
    q.xy = rot(0.12 * rise * cos(uBeat * PI + odd * PI)) * q.xy;
    vec3 qb = q - vec3(0.0, 0.24, 0.0); qb.y /= sq;
    r = U(r, sdEll(qb, vec3(0.21, 0.27, 0.19)) * min(sq, 1.0), 90.0);
    vec3 e1 = vec3(0.08, 0.33 * sq, 0.15), e2 = vec3(-0.08, 0.33 * sq, 0.15);
    r = U(r, min(length(q - e1) - 0.06, length(q - e2) - 0.06), 91.0);
    r = U(r, min(length(q - e1 - vec3(0.0, 0.0, 0.05)) - 0.03, length(q - e2 - vec3(0.0, 0.0, 0.05)) - 0.03), 92.0);
  } else if (uDance > 0.02) {
    // Bound by a box 0.3 inside the exact region, so a ray approaching it
    // crosses into the exact region instead of creeping up on the boundary.
    r = U(r, max(max(abs(p.x - uCamX) - 6.7, max(-0.1 - p.z, p.z - 1.0)), p.y - 1.3), 0.0);
  }
  float popOut = max(max(p.y - 2.3, -2.8 - p.z), p.z - 4.0);
  if (popOut > 0.0) r = U(r, popOut + 0.3, 0.0);
  else for (int i = 0; i < ${MAX_POPS}; i++) {
    if (i >= uPopCount) break;
    vec4 P = uPops[i];
    vec2 s = pop(p, P, i, r.x);
    if (s.y > 0.5 && s.x < r.x) r = s;
  }
  for (int i = 0; i < ${NBEES}; i++) {
    vec4 B = uBees[i];
    vec3 q = p - B.xyz;
    if (length(q) > 0.42) { r = U(r, length(q) - 0.22, 0.0); continue; }
    q /= 1.4;
    r = U(r, sdEll(q, vec3(0.09, 0.065, 0.065)) * 1.4, 60.0 + float(i));
    vec3 w = q - vec3(-0.01, 0.06, 0.0);
    w.yz = rot(B.w) * w.yz;
    float wing = min(sdEll(w - vec3(0.0, 0.03, 0.05), vec3(0.045, 0.012, 0.06)), sdEll(w - vec3(0.0, 0.03, -0.05), vec3(0.045, 0.012, 0.06)));
    r = U(r, wing * 1.4, 15.0);
  }
  return r;
}

// Hand marks: lumps that boil on twos, and sparse fingerprint whorls.
float detail(vec3 p) {
  float lump = (vnoise(p * 7.0 + vec3(uStep * 0.61 * uBoil, 0.0, 0.0)) - 0.5) * 0.006;
  if (gFoot > 0.012) return lump;   // whorls are sub-pixel here and faded to nothing
  vec3 c = floor(p * 2.5), f = fract(p * 2.5);
  vec3 o = 0.25 + 0.5 * vec3(hash13(c), hash13(c + 7.1), hash13(c + 3.3));
  float rr = length(f - o) / 2.5;
  float on = step(0.45, hash13(c + 1.7));
  float fp = sin(rr * 260.0 + vnoise(p * 18.0) * 5.0) * smoothstep(0.13, 0.03, rr) * on;
  return lump + fp * 0.0011 * smoothstep(0.012, 0.005, gFoot);
}

vec3 calcNormal(vec3 p, float t) {
  float e = 0.0015 + 0.0005 * t;
  vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * (map(p + k.xyy * e).x + detail(p + k.xyy * e)) +
                   k.yyx * (map(p + k.yyx * e).x + detail(p + k.yyx * e)) +
                   k.yxy * (map(p + k.yxy * e).x + detail(p + k.yxy * e)) +
                   k.xxx * (map(p + k.xxx * e).x + detail(p + k.xxx * e)));
}

float softShadow(vec3 ro, vec3 rd) {
  // A per-pixel jittered start: a fixed start bands the shadow into contour
  // lines on the gently curved field.
  // 12 steps reach the hills behind a pop (about 5 units); anything
  // farther casts nothing visible at this light angle.
  float res = 1.0, t = 0.03 + 0.05 * hash12(gl_FragCoord.xy);
  for (int i = 0; i < 12; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.06, 0.9);
    if (res < 0.01 || t > 5.5) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float o = 0.0, s = 1.0;
  for (int i = 1; i <= 2; i++) {
    float h = 0.06 + 0.14 * float(i);
    o += (h - map(p + n * h).x) * s; s *= 0.6;
  }
  return clamp(1.0 - 1.9 * o, 0.0, 1.0);
}

vec3 popColour(float ci) {
  if (ci < 0.5) return uPal[12];
  if (ci < 1.5) return uPal[13];
  if (ci < 2.5) return uPal[15];
  return uPal[7];
}

vec3 matColour(float m, vec3 p) {
  if (m < 1.5) {
    float v = vnoise2(p.xz * 2.3);
    float edge = abs(p.z - 1.25) - 0.42 - 0.08 * (vnoise2(p.xz * 4.0) - 0.5);
    vec3 path = mix(uPal[5], uPal[7], 0.55) * (0.9 + 0.15 * v);
    // the snail's trail: a darker, slightly wet stripe behind it
    float trail = smoothstep(0.09, 0.05, abs(p.z - 1.25 - 0.02 * sin(p.x * 2.0))) * smoothstep(uSnailX - 0.4, uSnailX - 1.0, p.x);
    path *= 1.0 - 0.22 * trail;
    return edge < 0.0 ? path : uPal[2] * (0.82 + 0.3 * v) * mix(1.0, 1.12, step(0.62, vnoise2(p.xz * 0.9)));
  }
  if (m < 3.5) return uPal[3] * (0.9 + 0.2 * vnoise2(p.xz * 1.5));
  if (m < 4.5) return uPal[4] * (0.9 + 0.2 * vnoise2(p.xz * 1.5));
  if (m < 5.25) {
    // volcano: terracotta with flat orange drips from the rim
    float per = 26.0; float c = floor((p.x + 8.0) / per);
    vec3 q = p - vec3(c * per + 5.0, -0.4, -13.0);
    float an = atan(q.z, q.x);
    float drip = 2.2 - 0.9 * (0.5 + 0.5 * sin(an * 6.0 + 1.3)) * (0.6 + 0.4 * sin(an * 13.0));
    return q.y > drip ? uPal[6] : uPal[5] * (0.9 + 0.2 * vnoise2(p.xy * 3.0));
  }
  if (m < 5.6) return uPal[7];
  if (m < 5.8) return uPal[6];
  if (m < 6.5) return uPal[7];
  if (m < 7.5) return uPal[10];
  if (m < 8.5) return uPal[11];
  if (m < 9.5) return uPal[17];
  if (m < 10.5) return vec3(0.92, 0.9, 0.86);
  if (m < 11.5) return mix(uPal[12], uPal[10], 0.35);
  if (m < 12.5) return uPal[8];
  if (m < 13.5) {
    float scl; vec3 q = snailLocal(p, scl) - shellC();
    float rr = length(q.xy), an = atan(q.y, q.x);
    float spi = fract((log(rr + 0.02) / 0.19 - an) / (2.0 * PI));
    return mix(uPal[9], uPal[7], step(abs(spi - 0.5), 0.12));
  }
  if (m < 15.5) return vec3(0.95, 0.95, 0.97);
  if (m < 16.5) return uPal[2] * 1.2;
  if (m < 17.5) return mix(uPal[5], uPal[7], 0.35) * 0.8;
  if (m > 89.5 && m < 92.5) {
    if (m > 91.5) return uPal[17];
    if (m > 90.5) return vec3(0.92, 0.9, 0.86);
    float id = floor((p.x - uCamX + 0.4) / 1.25 + 0.5);
    float c = mod(id, 4.0);
    return c < 0.5 ? uPal[12] : c < 1.5 ? uPal[15] : c < 2.5 ? uPal[13] : uPal[10];
  }
  if (m < 99.0) {
    vec4 B = uBees[int(m - 60.0 + 0.5)];
    float s = sin((p.x - B.x) * 40.0);
    return s > 0.2 ? uPal[17] : uPal[10];
  }
  float id = floor((m - 100.0) / 8.0 + 0.001);
  float part = m - 100.0 - id * 8.0;
  vec4 P = uPops[int(id)];
  float ci = mod(P.w, 4.0);
  if (part < 0.5) return uPal[16];
  if (part < 1.5) return popColour(ci);
  if (part < 2.5) return uPal[10];
  if (part < 3.5) return vnoise(p * 11.0) > 0.7 ? uPal[7] : uPal[14];
  if (part < 4.5) return uPal[7];
  if (part < 5.5) return popColour(3.0 - ci);
  if (part < 6.5) return vec3(0.92, 0.9, 0.86);
  return uPal[17];
}

vec3 sky(vec3 rd, vec2 fc) {
  float h = smoothstep(-0.05, 0.55, rd.y);
  vec3 c = mix(uPal[1], uPal[0], h);
  c = mix(mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), 0.35) * 0.9, c, uLight);
  // smeared plasticine backdrop: horizontal thumb strokes
  float n = vnoise2(vec2(rd.x * 5.0, rd.y * 22.0)) * 0.6 + vnoise2(rd.xy * 40.0) * 0.4;
  return c * (0.94 + 0.1 * n);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 ro = vec3(uCamX, 1.55, 6.2);
  vec3 ta = vec3(uCamX, 0.95, 0.0);
  vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.9 * ww);

  float t = 0.1; vec2 h = vec2(0.0);
  bool hit = false;
  // Sky rays: nothing stands above y = 7 (sun top 5.6, clouds 6.6, smoke 7),
  // so a rising ray can stop marching as soon as it clears that.
  float tEnd = rd.y > 0.0 ? min(34.0, (7.0 - ro.y) / rd.y) : 34.0;
  for (int i = 0; i < 90; i++) {
    h = map(ro + rd * t);
    if (h.x < 0.002 * t) { hit = h.y > 0.5; if (hit) break; }
    t += h.x;
    if (t > tEnd) break;
  }
  vec3 col;
  if (hit) {
    vec3 p = ro + rd * t;
    gFoot = t * 2.0 / (1.9 * uRes.y);
    vec3 n = calcNormal(p, t);
    vec3 alb = matColour(h.y, p);
    vec3 l = normalize(uSunDir);
    float ndl = dot(n, l);
    float wrap = clamp((ndl + 0.3) / 1.3, 0.0, 1.0);
    float shd = softShadow(p + n * 0.01, l);
    float ao = calcAO(p, n);
    float skyv = 0.5 + 0.5 * n.y;
    float key = mix(0.75, 1.35, uLight);
    shd = mix(0.35 + 0.65 * shd, shd, uLight);
    vec3 lin = uPal[18] * key * wrap * shd;
    lin += uPal[19] * mix(0.7, 0.5, uLight) * skyv * ao;
    lin += uPal[2] * 0.25 * (0.5 - 0.5 * n.y) * ao;
    col = alb * lin;
    // clay scatters a little warm light into its own shadow side
    col += alb * alb * uPal[18] * 0.22 * (1.0 - wrap) * ao;
    // faint waxy sheen, never a highlight
    vec3 hv = normalize(l - rd);
    col += uPal[18] * 0.05 * pow(clamp(dot(n, hv), 0.0, 1.0), 18.0) * shd;
    col = mix(mix(col, vec3(dot(col, vec3(0.3, 0.55, 0.15))), 0.25), col, uLight);
    float fog = 1.0 - exp(-max(t - 9.0, 0.0) * 0.035);
    col = mix(col, uPal[1] * 0.95, fog * 0.6);
  } else {
    col = sky(rd, gl_FragCoord.xy);
  }
  // gentle lens falloff and stop-motion film grain (changes on twos)
  vec2 q = gl_FragCoord.xy / uRes;
  col *= 0.82 + 0.18 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.2);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash12(gl_FragCoord.xy + uStep * 17.0) - 0.5) * 0.025;
  fragColor = vec4(col, 1.0);
}`;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function ease(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

  VIZ.register({
    id: 'clay',
    name: 'Clay',
    order: 403,
    gallery: {
      title: 'Clay',
      technique: 'WebGL2 raymarched SDF diorama with a matte clay shader: wrapped diffuse, soft shadows, AO, fingerprint and lump normal detail; puppets posed on twos',
      brief: 'A plasticine meadow in daylight: a snail crosses a lumpy green field past flowers, toadstools, gumdrop critters, a smoking terracotta volcano and a sun with a face. The kick squashes the snail, claps pop things out of the ground, hats send the bees zipping, the bass swells the smoke, and in the drop everyone dances and the sun wakes up.',
      lineage: 'Batch 04 brief 03 (claymation), after Aardman and Pingu-style plasticine sets and Inigo Quilez\'s SDF raymarching toolkit (smooth-min, ellipsoid bound, soft shadows, AO). ' +
        'Process: first pass raymarched the whole diorama; the contact sheet showed contour-line banding on the field (a fixed-start soft shadow on a gently curved heightfield), fixed with a per-pixel jittered start. ' +
        'Bounding proxies (half-spaces and spheres standing in for far groups) made the march affordable, but one proxy with no margin made rays creep up on its boundary and the parade region rendered as speckle; every proxy now sits inside a larger exact region. ' +
        'The drop originally differed from the breakdown only by leftover pops, so the drop gained the parade of dancing gumdrops out of the path, full sun (the quiet sections are overcast, desaturated, softer shadows), a volcano that spits clay, faster rays on the sun. ' +
        'The first jolt pass flagged the build kick at 30% of the frame, which was the parade proxy bug erasing the hills, not the kick. Dances are phrased so every sway and hop is at an extreme (zero velocity) on the kick, which keeps the squash of the snail the only thing the kick moves: jolt calm, kickArea about 0.1. ' +
        'The camera moves smoothly and only the puppets are on twos, following Paper\'s finding that a stepped travel judders the whole frame. ' +
        'Speed pass (fps.mjs, 3024x1890 on an M4 Pro): 23.9 fps at first. A pixel budget of 0.95 MP instead of a 1700 px width cap, pops culled to the view and packed so the loop breaks early, a 12-step shadow, 2-tap AO, 90 march steps with a sky early-out above y = 7, a tighter ground Lipschitz factor and fingerprints skipped where they are sub-pixel brought it to a steady 60 with the look unchanged.',
    },

    params: [
      { key: 'react', label: 'Reaction strength', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'speed', label: 'Walk speed', type: 'range', min: 0, max: 3, default: 1, step: 0.01 },
      { key: 'palette', label: 'Light', type: 'select', options: PALETTES.map((x) => x.name), default: 0 },
      { key: 'fps', label: 'Animation', type: 'select', options: ['On twos (12 poses/s)', 'On ones (24 poses/s)', 'Smooth'], default: 0 },
      { key: 'boil', label: 'Clay boil', type: 'range', min: 0, max: 2, default: 1, step: 0.01 },
      { key: 'crowd', label: 'Crowd', type: 'range', min: 0, max: 1, default: 0.5, step: 0.01 },
      { key: 'res', label: 'Render resolution', type: 'range', min: 0.35, max: 1, default: 0.7, step: 0.01 },
    ],

    actions: [
      { id: 'pop', label: 'Pop something up', run() { this.pendingPop = true; } },
      { id: 'clear', label: 'Clear the meadow', run() { this.pops = []; } },
    ],

    gl: null, glCanvas: null, glFailed: false,

    setup(p, ctx) { this.reset(); },
    enter(p, ctx) { if (!this.pops) this.reset(); },

    reset() {
      this.t = null;
      this.camX = 0;
      this.nextAmbient = 0;
      this.pops = [];
      this.prev = new Float32Array(9);
      this.kickT = -10; this.kickAmp = 0; this.kickRate = 0; this.lastKickT = -10;
      this.beatPeriod = 60 / 124; this.beat = 0;
      this.snareT = -10; this.hatT = -10;
      this.drive = 0; this.wake = 0; this.light = 0; this.bass = 0; this.hat = 0; this.dance = 0;
      this.bees = [];
      for (let i = 0; i < NBEES; i++) this.bees.push({ jx: 0, jy: 0, jz: 0, tx: 0, ty: 0, tz: 0 });
      this.popSeed = 1;
      this.seeded = false;
    },

    rand() {
      // Own PRNG so pop placement is repeatable run to run.
      this.popSeed = (this.popSeed * 16807) % 2147483647;
      return (this.popSeed - 1) / 2147483646;
    },

    spawn(t, halfW, grown, ahead) {
      const r = () => this.rand();
      // Pick the least crowded of a few candidate spots.
      let best = null, bestD = -1;
      for (let k = 0; k < 6; k++) {
        const front = r() < 0.25;
        const z = front ? 2.3 + r() * 0.6 : -1.9 + r() * 1.6;
        const zHalf = halfW * (6.2 - z) / 6.2;
        const x = ahead ? this.camX + zHalf + 0.8 + r() * 1.5 : this.camX + 0.1 + r() * zHalf * (front ? 0.7 : 0.8);
        let dmin = 9;
        for (const q of this.pops) dmin = Math.min(dmin, Math.hypot(q.x - x, (q.z - z) * 1.5));
        if (Math.abs(z - 1.25) < 0.6) dmin = 0;
        if (dmin > bestD) { bestD = dmin; best = { x, z }; }
      }
      const u = r();
      const critterBias = 0.15 + 0.35 * this.dance;
      const kind = u < critterBias ? 2 : u < critterBias + (1 - critterBias) * 0.35 ? 1 : 0;
      const col = Math.floor(r() * 3.999);
      this.pops.push({ x: best.x, z: best.z, born: grown ? t - 5 : t, kind, col });
      if (this.pops.length > MAX_POPS) {
        this.pops.sort((a, b) => a.x - b.x);
        this.pops.shift();
      }
    },

    listen(signals, t, dt, params) {
      const s = signals, pr = this.prev;
      const react = params.react;
      // Kick: a sharp rise in band 0 well above the bass line.
      if (s[0] > 55 && s[0] - pr[0] > 18 && t - this.kickT > 0.2) {
        const iv = t - this.kickT;
        if (iv > 0.3 && iv < 1.0) this.beatPeriod = this.beatPeriod * 0.7 + iv * 0.3;
        this.kickT = t; this.kickAmp = Math.min(1.2, s[0] / 90);
        this.kickRate += 0.25;
        this.beat = Math.round(this.beat) + 1;
      }
      this.kickRate *= Math.exp(-dt / 1.4);
      // Snare/clap: a rise in the mids.
      const mid = (s[3] + s[4] + s[5]) / 3, midPrev = (pr[3] + pr[4] + pr[5]) / 3;
      if (mid > 38 && mid - midPrev > 14 && t - this.snareT > 0.11) {
        this.snareT = t;
        if (react > 0.05) this.spawnNow = true;
      }
      // Hats: a rise in the top bands.
      const hi = (s[6] + s[7] + s[8]) / 3, hiPrev = (pr[6] + pr[7] + pr[8]) / 3;
      if (hi > 22 && hi - hiPrev > 10 && t - this.hatT > 0.08) {
        this.hatT = t;
        const amp = 0.14 * react * Math.min(1.3, hi / 60);
        for (const b of this.bees) {
          b.tx = (this.rand() - 0.5) * 2 * amp * 1.5;
          b.ty = (this.rand() - 0.5) * 2 * amp;
          b.tz = (this.rand() - 0.5) * 2 * amp;
        }
      }
      this.hat = Math.max(this.hat * Math.exp(-dt / 0.15), hi / 100);
      pr.set(s);

      this.drive = ease(this.drive, clamp01(this.kickRate * 1.1), 1.5, dt);
      this.dance = smooth(0.35, 0.8, this.drive) * Math.min(1, react);
      this.wake = ease(this.wake, smooth(0.15, 0.5, this.drive), 1.5, dt);
      this.light = ease(this.light, smooth(0.2, 0.7, this.drive), 0.8, dt);
      this.bass = ease(this.bass, (s[1] + s[2]) / 200, 6, dt);
      // beat clock for dancing: advances between kicks, stops when they do
      const since = t - this.kickT;
      const frac = Math.min(1, since / this.beatPeriod);
      this.beat = Math.floor(this.beat) + (since < 1.2 ? frac * 0.999 : 0);
    },

    initGL() {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 4;
      const gl = c.getContext('webgl2', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
      if (!gl) { this.glFailed = true; return; }
      const compile = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        return sh;
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
      const u = {};
      ['uRes', 'uTime', 'uStep', 'uCamX', 'uSnailX', 'uKickAge', 'uKickAmp', 'uDance', 'uWake', 'uBass',
        'uDrive', 'uBeat', 'uBoil', 'uLight', 'uPopCount', 'uPops', 'uBees', 'uPal', 'uSunDir'].forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });
      this.gl = gl; this.glCanvas = c; this.u = u;
      this.popBuf = new Float32Array(MAX_POPS * 4);
      this.beeBuf = new Float32Array(NBEES * 4);
    },

    draw(p, signals, params, ctx) {
      p.colorMode(p.RGB, 255);
      const t = p.millis() / 1000;
      if (this.t === null) this.t = t;
      const dt = Math.min(0.1, Math.max(0, t - this.t)) || 1 / 60;
      this.t = t;
      const aspect = ctx.width / ctx.height;
      const halfW = Math.max(1, aspect) * 6.2 / 1.9;

      this.listen(signals, t, dt, params);

      // travel: smooth, the music changes its speed
      this.camX += dt * params.speed * (0.22 + 0.5 * this.drive + 0.1 * this.bass);

      // keep the meadow populated off-screen right, fully grown
      if (!this.seeded) {
        this.seeded = true;
        for (let i = 0; i < 7; i++) this.spawn(t, halfW, true, false);
      }
      if (this.camX > this.nextAmbient) {
        this.nextAmbient = this.camX + 1.6 - 0.9 * params.crowd;
        this.spawn(t, halfW, true, true);
      }
      if (this.spawnNow || this.pendingPop) {
        this.spawnNow = false; this.pendingPop = false;
        this.spawn(t, halfW, false, false);
      }
      this.pops = this.pops.filter((q) => q.x > this.camX - halfW * 1.6 - 1.5);

      p.background(PALETTES[params.palette | 0].c[1]);
      if (!this.gl && !this.glFailed) {
        try { this.initGL(); } catch (e) { this.glFailed = true; console.warn('clay: ' + e.message); }
      }
      if (!this.gl) {
        p.noStroke(); p.fill(60); p.textAlign(p.CENTER, p.CENTER); p.textSize(24);
        p.text('Clay needs WebGL2', ctx.width / 2, ctx.height / 2);
        return;
      }

      // Puppet clock: quantised to twos (or ones), keyed to event times so a
      // squash lands on the kick rather than at the next step.
      const mode = params.fps | 0;
      const pps = mode === 0 ? 12 : mode === 1 ? 24 : 0;
      const q = (x) => (pps ? Math.floor(x * pps) / pps : x);
      const step = pps ? Math.floor(t * pps) : Math.floor(t * 12);

      const gl = this.gl, u = this.u;
      const res = params.res;
      // Cap the internal size: a full-screen raymarch at 3K is wasted on matte clay.
      let w = Math.round(p.width * p.pixelDensity() * res);
      let h = Math.round(p.height * p.pixelDensity() * res);
      // Budget in pixels, not width: fps.mjs measured 22-24 fps at 3024x1890
      // with a 1700 px-wide cap (1.8 MP). Matte clay upscales without loss.
      const cap = Math.sqrt(MAX_PIXELS / (w * h));
      if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
      if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
        this.glCanvas.width = w; this.glCanvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform1f(u.uTime, q(t));
      gl.uniform1f(u.uStep, step % 997);
      gl.uniform1f(u.uCamX, this.camX);
      gl.uniform1f(u.uSnailX, this.camX - 0.9 * Math.min(1.3, aspect));
      gl.uniform1f(u.uKickAge, q(t - this.kickT));
      gl.uniform1f(u.uKickAmp, this.kickAmp * Math.min(1.6, params.react));
      gl.uniform1f(u.uDance, this.dance);
      gl.uniform1f(u.uWake, this.wake);
      gl.uniform1f(u.uBass, this.bass * params.react);
      gl.uniform1f(u.uDrive, this.drive);
      gl.uniform1f(u.uBeat, pps ? Math.floor(this.beat * 8) / 8 : this.beat);
      gl.uniform1f(u.uBoil, params.boil);
      gl.uniform1f(u.uLight, this.light);
      const pb = this.popBuf;
      // Only pops that can reach the view are uploaded; the rest cost nothing.
      const vis = this.pops.filter((o) => Math.abs(o.x - this.camX) < halfW * (6.2 - o.z) / 6.2 + 1.2);
      gl.uniform1i(u.uPopCount, vis.length);
      for (let i = 0; i < MAX_POPS; i++) {
        const o = vis[i];
        if (o) { pb[i * 4] = o.x; pb[i * 4 + 1] = o.z; pb[i * 4 + 2] = q(Math.max(0, t - o.born)); pb[i * 4 + 3] = o.kind * 4 + o.col; }
        else { pb[i * 4] = 1e4; pb[i * 4 + 1] = 0; pb[i * 4 + 2] = 0; pb[i * 4 + 3] = 0; }
      }
      gl.uniform4fv(u.uPops, pb);
      const bb = this.beeBuf, tq = q(t);
      const nb = 2 + Math.round(2 * this.drive);
      for (let i = 0; i < NBEES; i++) {
        const b = this.bees[i];
        b.jx = ease(b.jx, b.tx, 30, dt); b.jy = ease(b.jy, b.ty, 30, dt); b.jz = ease(b.jz, b.tz, 30, dt);
        b.tx *= Math.exp(-dt / 0.25); b.ty *= Math.exp(-dt / 0.25); b.tz *= Math.exp(-dt / 0.25);
        bb[i * 4] = this.camX + 0.9 + 1.8 * Math.sin(tq * 0.37 + i * 2.1) + b.jx;
        bb[i * 4 + 1] = i < nb ? 1.15 + 0.35 * Math.sin(tq * 0.9 + i * 1.3) + b.jy : -50;
        bb[i * 4 + 2] = 0.2 + 1.1 * Math.cos(tq * 0.29 + i * 1.7) + b.jz;
        bb[i * 4 + 3] = (step + i) % 2 ? 0.5 + this.hat : -0.4 - this.hat;
      }
      gl.uniform4fv(u.uBees, bb);
      gl.uniform3fv(u.uPal, PAL[params.palette | 0]);
      gl.uniform3f(u.uSunDir, -0.55, 0.75, 0.5);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const dc = p.drawingContext;
      dc.imageSmoothingEnabled = true;
      dc.drawImage(this.glCanvas, 0, 0, ctx.width, ctx.height);
    },
  });
})();
