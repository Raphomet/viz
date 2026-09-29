// Kuwahara: painterly smoothing. Anisotropic Kuwahara (Kyprianidis et al.
// 2009, with the polynomial sector weights of the generalised filter): each
// pixel takes the mean of whichever of eight surrounding sectors is least
// varied, over an ellipse stretched along the local edge direction, so flat
// areas become brush strokes that follow the forms instead of square blobs.
// Expensive: everything runs on a half-size box-filtered copy (the result is
// soft anyway), and the filter reads that copy on a stride grid that widens
// with the brush, so a pixel costs at most 7x7 taps whatever the radius.
// Sampling every half-size pixel of the ellipse ran at 15 fps at 3024x1890 on
// the M4 Pro (2026-09-28); the prefilter keeps the sparse grid from aliasing.
// The radius is in 720p pixels so it looks the same on any screen. Music: the
// bass swells the brush.
VIZ_FX.register({
  id: 'kuwahara',
  name: 'Kuwahara',
  group: 'texture',
  params: [
    { key: 'radius', label: 'Brush', min: 2, max: 16, default: 8 },
    { key: 'stretch', label: 'Stroke stretch', min: 0, max: 1, default: 0.6 },
    { key: 'hard', label: 'Hardness', min: 0, max: 1, default: 0.6 },
    { key: 'swell', label: 'Bass brush', min: 0, max: 1, default: 0.4 }
  ],
  passes: [
    // 0: half-size box-filtered colour, which everything below reads.
    { scale: 1 / 2, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uInput, 0));
  vec3 c = texture(uInput, vUv + vec2(-t.x, -t.y)).rgb + texture(uInput, vUv + vec2(t.x, -t.y)).rgb +
           texture(uInput, vUv + vec2(-t.x,  t.y)).rgb + texture(uInput, vUv + vec2(t.x,  t.y)).rgb;
  fragColor = vec4(clamp(c * 0.25, 0.0, 1.0), 1.0);
}` },
    // 1: structure tensor (E, F, G) of the colour gradient.
    { scale: 1 / 2, frag: `
void main() {
  vec2 d = 1.0 / vec2(textureSize(uPass0, 0));
  vec3 tl = texture(uPass0, vUv + vec2(-d.x,  d.y)).rgb, tc = texture(uPass0, vUv + vec2(0.0, d.y)).rgb, tr = texture(uPass0, vUv + d).rgb;
  vec3 ml = texture(uPass0, vUv + vec2(-d.x, 0.0)).rgb, mr = texture(uPass0, vUv + vec2(d.x, 0.0)).rgb;
  vec3 bl = texture(uPass0, vUv - d).rgb, bc = texture(uPass0, vUv + vec2(0.0, -d.y)).rgb, br = texture(uPass0, vUv + vec2(d.x, -d.y)).rgb;
  vec3 gx = ((tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl)) * 0.25;
  vec3 gy = ((tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br)) * 0.25;
  fragColor = vec4(dot(gx, gx), dot(gy, gy), dot(gx, gy), 1.0);
}` },
    // 2: smooth the tensor, then its eigenvector gives the stroke direction.
    // rgb: direction (x, y) and anisotropy.
    { scale: 1 / 2, frag: `
void main() {
  vec2 t = 1.0 / vec2(textureSize(uPass1, 0));
  vec3 g = vec3(0.0); float ws = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    float w = exp(-float(x * x + y * y) / 4.0);
    g += w * texture(uPass1, vUv + vec2(float(x), float(y)) * t * 1.5).rgb; ws += w;
  }
  g /= ws;
  float E = g.x, G = g.y, F = g.z;
  float root = sqrt((E - G) * (E - G) + 4.0 * F * F);
  float l1 = 0.5 * (E + G + root), l2 = 0.5 * (E + G - root);
  vec2 v = vec2(l1 - E, -F);
  v = length(v) > 1e-6 ? normalize(v) : vec2(0.0, 1.0);
  float A = l1 + l2 > 1e-6 ? (l1 - l2) / (l1 + l2) : 0.0;
  fragColor = vec4(v, A, 1.0);
}` },
    // 3: the filter.
    { scale: 1 / 2, frag: `
void main() {
  vec2 ptexel = 1.0 / uRes;
  vec3 T = texture(uPass2, vUv).rgb;
  float bass = 0.5 * (uBands[0] + uBands[1]);
  float radius = p_radius * (1.0 + p_swell * 0.5 * bass) * uRes.y / 720.0;
  radius = max(radius, 1.0);
  float alpha = mix(4.0, 0.5, p_stretch);
  float A = T.z;
  float a = radius * clamp((alpha + A) / alpha, 0.1, 2.0);
  float b = radius * clamp(alpha / (alpha + A), 0.1, 2.0);
  float phi = -atan(T.y, T.x);
  float cp = cos(phi), sp = sin(phi);
  mat2 R = mat2(cp, -sp, sp, cp);
  mat2 S = mat2(0.5 / a, 0.0, 0.0, 0.5 / b);
  mat2 SR = S * R;
  float ex = sqrt(a * a * cp * cp + b * b * sp * sp), ey = sqrt(a * a * sp * sp + b * b * cp * cp);
  // Grid stride in pass pixels: at most 3 steps each side of the centre
  // (4 held 60 fps only without other GPU load).
  float st = max(1.0, max(ex, ey) / 3.0);
  int mx = int(ceil(ex / st)), my = int(ceil(ey / st));
  float zeta = 2.0 / radius;
  float zc = 0.58;
  float eta = (zeta + cos(zc)) / (sin(zc) * sin(zc));
  vec4 m[8]; vec3 s[8];
  for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  for (int y = -my; y <= my; y++) for (int x = -mx; x <= mx; x++) {
    vec2 off = vec2(float(x), float(y)) * st;
    vec2 v = SR * off;
    if (dot(v, v) > 0.25) continue;
    vec3 c = texture(uPass0, vUv + off * ptexel).rgb;
    float w[8]; float sum = 0.0;
    float vxx = zeta - eta * v.x * v.x, vyy = zeta - eta * v.y * v.y, z;
    z = max(0.0,  v.y + vxx); w[0] = z * z;
    z = max(0.0, -v.x + vyy); w[2] = z * z;
    z = max(0.0, -v.y + vxx); w[4] = z * z;
    z = max(0.0,  v.x + vyy); w[6] = z * z;
    vec2 u = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
    vxx = zeta - eta * u.x * u.x; vyy = zeta - eta * u.y * u.y;
    z = max(0.0,  u.y + vxx); w[1] = z * z;
    z = max(0.0, -u.x + vyy); w[3] = z * z;
    z = max(0.0, -u.y + vxx); w[5] = z * z;
    z = max(0.0,  u.x + vyy); w[7] = z * z;
    for (int k = 0; k < 8; k++) sum += w[k];
    float gk = exp(-3.125 * dot(v, v)) / max(sum, 1e-6);
    for (int k = 0; k < 8; k++) {
      float wk = w[k] * gk;
      m[k] += vec4(c * wk, wk);
      s[k] += c * c * wk;
    }
  }
  float hardness = mix(2.0, 60.0, p_hard);
  vec4 o = vec4(0.0);
  for (int k = 0; k < 8; k++) {
    if (m[k].w < 1e-6) continue;
    vec3 mean = m[k].rgb / m[k].w;
    vec3 var = abs(s[k] / m[k].w - mean * mean);
    float sig = var.r + var.g + var.b;
    float wk = 1.0 / (1.0 + pow(hardness * 1000.0 * sig, 4.0));
    o += vec4(mean * wk, wk);
  }
  vec3 outc = o.w > 1e-6 ? o.rgb / o.w : texture(uPass0, vUv).rgb;
  fragColor = vec4(outc, 1.0);
}` },
    { frag: `
void main() { fragColor = vec4(texture(uPass3, vUv).rgb, 1.0); }` }
  ]
});
