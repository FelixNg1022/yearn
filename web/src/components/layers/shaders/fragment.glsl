uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform vec3  uColorC;
uniform float uIntensity;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// fractal brownian motion — layered noise for organic texture
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.08;

  // --- warm light blobs ---
  float n1 = noise(uv * 2.0 + vec2(t * 0.3, t * 0.2));
  float n2 = noise(uv * 3.0 + vec2(-t * 0.2, t * 0.4));
  float n3 = noise(uv * 1.5 + vec2(t * 0.15, -t * 0.1));
  float light = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  light = smoothstep(0.3, 0.7, light);

  vec3 warmLight = mix(
    vec3(1.0, 0.85, 0.55),
    vec3(1.0, 0.7, 0.45),
    n2
  );

  float corner = length(uv - vec2(0.0, 1.0)) * 0.7;
  vec3 rosy = vec3(1.0, 0.6, 0.4);
  warmLight = mix(warmLight, rosy, smoothstep(0.8, 0.2, corner) * 0.3);

  // --- paper texture (smooth, organic fibers) ---
  vec2 paperUv = uv * uResolution / max(uResolution.x, uResolution.y);
  float paper = fbm(paperUv * 12.0);
  float paperFine = fbm(paperUv * 40.0 + 7.0);
  float paperTexture = mix(paper, paperFine, 0.4);
  paperTexture = (paperTexture - 0.5) * 0.18;

  // --- warm film grain (smooth, slow-crawling) ---
  float grainTime = uTime * 0.05;
  float grain = fbm(paperUv * 25.0 + grainTime);
  vec3 grainColor = mix(
    vec3(1.0, 0.88, 0.65),
    vec3(1.0, 0.95, 0.85),
    grain
  );
  float grainAlpha = grain * 0.12;

  // combine
  vec3 color = warmLight * (light * 0.15) + vec3(paperTexture);
  float alpha = max(light * 0.15, abs(paperTexture) * 1.5) * uIntensity;

  color = color + grainColor * grainAlpha;
  alpha = max(alpha, grainAlpha);

  gl_FragColor = vec4(color + vec3(paperTexture), alpha);
}
