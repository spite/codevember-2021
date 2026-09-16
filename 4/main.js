import {
  scene,
  controls,
  renderer,
  addUpdate,
  camera,
  addResize,
} from "../modules/renderer.js";
import { getFBO } from "../modules/fbo.js";
import {
  AdditiveBlending,
  HalfFloatType,
  DataTexture,
  FloatType,
  Mesh,
  GLSL3,
  MeshBasicMaterial,
  PlaneBufferGeometry,
  RawShaderMaterial,
  RGBAFormat,
  Float32BufferAttribute,
  LinearFilter,
  NearestFilter,
  Points,
  BufferGeometry,
} from "../third_party/three.module.js";
import { ShaderTexture } from "../modules/ShaderTexture.js";
import { ShaderPingPongPass } from "../modules/ShaderPingPongPass.js";
import { clamp, randomInRange } from "../modules/Maf.js";
import { ShaderPass } from "../modules/ShaderPass.js";
import { shader as orthoVertexShader } from "../shaders/ortho.js";
// import { capture } from "../modules/capture.js";

camera.position.set(0, 0, 10);
camera.lookAt(scene.position);

const width = 256;
const height = 256;
const data = new Float32Array(width * height * 4);

let ptr = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    data[ptr] = randomInRange(-1, 1);
    data[ptr + 1] = randomInRange(-1, 1);
    data[ptr + 2] = 0;
    data[ptr + 3] = 0;
    ptr += 4;
  }
}

const origin = new DataTexture(data, width, height, RGBAFormat, FloatType);

const NUM_FNS = 4;
const NUM_VARIATIONS = 11;
const MORPH = 0.5;
const MIN_COVERAGE = 0.08;
const affine = new Float32Array(NUM_FNS * 6);
const baseAffine = new Float32Array(NUM_FNS * 6);
const morphX = new Float32Array(NUM_FNS * 6);
const morphY = new Float32Array(NUM_FNS * 6);
const variationWeights = new Float32Array(NUM_FNS * NUM_VARIATIONS);
const fnWeights = new Float32Array(NUM_FNS);
const mouse = { x: 0, y: 0 };

const variationFns = [
  (x, y) => [x, y],
  (x, y) => [Math.sin(x), Math.sin(y)],
  (x, y, r) => [x / (r * r), y / (r * r)],
  (x, y, r) => {
    const r2 = r * r;
    return [
      x * Math.sin(r2) - y * Math.cos(r2),
      x * Math.cos(r2) + y * Math.sin(r2),
    ];
  },
  (x, y, r) => [((x - y) * (x + y)) / r, (2 * x * y) / r],
  (x, y, r, t) => [t / Math.PI, r - 1],
  (x, y, r, t) => [r * Math.sin(t + r), r * Math.cos(t - r)],
  (x, y, r, t) => [r * Math.sin(t * r), -r * Math.cos(t * r)],
  (x, y, r, t) => [
    (t * Math.sin(Math.PI * r)) / Math.PI,
    (t * Math.cos(Math.PI * r)) / Math.PI,
  ],
  (x, y, r, t) => [(Math.cos(t) + Math.sin(r)) / r, (Math.sin(t) - Math.cos(r)) / r],
  (x, y, r, t) => [Math.sin(t) / r, r * Math.cos(t)],
];

function applyMorph() {
  for (let i = 0; i < affine.length; i++) {
    affine[i] = baseAffine[i] + MORPH * (mouse.x * morphX[i] + mouse.y * morphY[i]);
  }
}

function coverage() {
  const grid = 64;
  const extent = 4.14;
  const hits = new Uint8Array(grid * grid);
  let x = randomInRange(-1, 1);
  let y = randomInRange(-1, 1);
  let age = 0;
  let covered = 0;
  for (let n = 0; n < 40000; n++) {
    const pick = Math.random();
    let i = NUM_FNS - 1;
    for (let k = 0; k < NUM_FNS; k++) {
      if (pick < fnWeights[k]) {
        i = k;
        break;
      }
    }
    const qx = affine[i * 6] * x + affine[i * 6 + 1] * y + affine[i * 6 + 2];
    const qy = affine[i * 6 + 3] * x + affine[i * 6 + 4] * y + affine[i * 6 + 5];
    const r = Math.hypot(qx, qy);
    const t = Math.atan2(qx, qy);
    let px = 0;
    let py = 0;
    for (let j = 0; j < NUM_VARIATIONS; j++) {
      const w = variationWeights[i * NUM_VARIATIONS + j];
      if (w === 0) continue;
      const [vx, vy] = variationFns[j](qx, qy, r, t);
      px += w * vx;
      py += w * vy;
    }
    if (!(Math.abs(px) < 1e5 && Math.abs(py) < 1e5)) {
      px = randomInRange(-1, 1);
      py = randomInRange(-1, 1);
      age = 0;
    }
    x = px;
    y = py;
    age++;
    if (age < 20) continue;
    const u = Math.floor((x / extent / 2 + 0.5) * grid);
    const v = Math.floor((y / extent / 2 + 0.5) * grid);
    if (u >= 0 && u < grid && v >= 0 && v < grid && !hits[v * grid + u]) {
      hits[v * grid + u] = 1;
      covered++;
    }
  }
  return covered / (grid * grid);
}

function randomizeSystem() {
  for (let attempt = 0; attempt < 30; attempt++) {
    generateSystem();
    applyMorph();
    if (coverage() >= MIN_COVERAGE) return;
  }
}

function generateSystem() {
  for (let i = 0; i < affine.length; i++) {
    baseAffine[i] = randomInRange(-1, 1);
    morphX[i] = randomInRange(-1, 1);
    morphY[i] = randomInRange(-1, 1);
  }
  variationWeights.fill(0);
  let total = 0;
  for (let i = 0; i < NUM_FNS; i++) {
    const count = 2 + Math.floor(Math.random() * 2);
    let sum = 0;
    for (let k = 0; k < count; k++) {
      const w = randomInRange(0.1, 1);
      const j = Math.floor(Math.random() * NUM_VARIATIONS);
      variationWeights[i * NUM_VARIATIONS + j] += w;
      sum += w;
    }
    for (let j = 0; j < NUM_VARIATIONS; j++) {
      variationWeights[i * NUM_VARIATIONS + j] /= sum;
    }
    fnWeights[i] = randomInRange(0.1, 1);
    total += fnWeights[i];
  }
  let cumulative = 0;
  for (let i = 0; i < NUM_FNS; i++) {
    cumulative += fnWeights[i] / total;
    fnWeights[i] = cumulative;
  }
}

randomizeSystem();

function randomize() {
  randomizeSystem();
  let ptr = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[ptr] = randomInRange(-1, 1);
      data[ptr + 1] = randomInRange(-1, 1);
      data[ptr + 2] = 0;
      data[ptr + 3] = 0;
      ptr += 4;
    }
  }
  origin.needsUpdate = true;
}

const ifsVs = `precision highp float;
precision highp float;
in vec3 position;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;
out vec3 vPosition;

void main() {
 vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const ifsFs = `precision highp float;
in vec2 vUv;

uniform sampler2D prev;
uniform float affine[${NUM_FNS * 6}];
uniform float variationWeights[${NUM_FNS * NUM_VARIATIONS}];
uniform float fnWeights[${NUM_FNS}];
uniform float seed;

out vec4 fragColor;

const float PI = 3.1415926535897932384626433832795;

float rand(in vec2 co){
  vec3 p3 = fract(vec3(co.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float atan2(in float y, in float x) {
  return x == 0.0 ? sign(y)*PI/2. : atan(y, x);
}

vec2 linear(in vec2 p, in float r, in float theta, in float phi) {
  return p;
}

vec2 sinusoidal(in vec2 p, in float r, in float theta, in float phi) {
  return vec2(sin(p.x), sin(p.y));
}

vec2 spherical(in vec2 p, in float r, in float theta, in float phi) {
  float r2 = r*r;
  return p/r2;
}

vec2 swirl(in vec2 p, in float r, in float theta, in float phi) {
  float r2 = r*r;
  return vec2(p.x*sin(r2) - p.y*cos(r2), p.x*cos(r2) + p.y*sin(r2));
}

vec2 horseshoe(in vec2 p, in float r, in float theta, in float phi) {
  return vec2((p.x - p.y) * (p.x + p.y), 2. *p.x *p.y) / r;
}

vec2 polar(in vec2 p, in float r, in float theta, in float phi) {
  return vec2(theta / PI, r - 1.);
}

vec2 handkerchief(in vec2 p, in float r, in float theta, in float phi) {
  return r * vec2(sin(theta + r), cos(theta - r));
}

vec2 heart(in vec2 p, in float r, in float theta, in float phi) {
  return r * vec2(sin(theta * r), - cos(theta * r));
}

vec2 disc(in vec2 p, in float r, in float theta, in float phi) {
  return theta * vec2(sin(PI*r), cos(PI*r))/PI;
}

vec2 spiral(in vec2 p, in float r, in float theta, in float phi) {
  return vec2(cos(theta) + sin(r), sin(theta) - cos(r)) / r;
}

vec2 hyperbolic(in vec2 p, in float r, in float theta, in float phi) {
  return vec2(sin(theta) / r, r * cos(theta));
}

void main() {
  vec4 c = texture(prev, vUv);
  // c.xy +=  vec2(rand(vUv.xy)*2.-1., rand(vUv.yx)*2.-1.);

  float pick = rand(vUv * 512. + seed);
  int i = ${NUM_FNS - 1};
  for (int k = 0; k < ${NUM_FNS}; k++) {
    if (pick < fnWeights[k]) {
      i = k;
      break;
    }
  }
  vec2 q = vec2(
    affine[i * 6] * c.x + affine[i * 6 + 1] * c.y + affine[i * 6 + 2],
    affine[i * 6 + 3] * c.x + affine[i * 6 + 4] * c.y + affine[i * 6 + 5]
  );

  float r = length(q);
  float theta = atan2(q.x, q.y);
  float phi = atan2(q.y, q.x);

  // int fn = int(rand(vUv)*9.);
  float s = .1;

  vec2 p = vec2(0.);
  for (int fn = 0; fn < ${NUM_VARIATIONS}; fn++) {
    float w = variationWeights[i * ${NUM_VARIATIONS} + fn];
    if (w == 0.) continue;
    vec2 v;
    if(fn == 0) {
      v = linear(q, r, theta, phi);
    } else if(fn == 1) {
      v = sinusoidal(q, r, theta, phi);
    } else if(fn == 2) {
      v = spherical(q, r, theta, phi);
    } else if(fn == 3) {
      v = swirl(q, r, theta, phi);
    } else if(fn == 4) {
      v = horseshoe(q, r, theta, phi);
    } else if(fn == 5) {
      v = polar(q, r, theta, phi);
    } else if(fn == 6) {
      v = handkerchief(q, r, theta, phi);
    } else if(fn == 7) {
      v = heart(q, r, theta, phi);
    } else if(fn == 8) {
      v = disc(q, r, theta, phi);
    } else if(fn == 9) {
      v = spiral(q, r, theta, phi);
    } else {
      v = hyperbolic(q, r, theta, phi);
    }
    p += w * v;
  }

  c.xy = p;
  c.z = min(c.z + 1., 20.);
  if (!(abs(p.x) < 1e5 && abs(p.y) < 1e5)) {
    c.xy = vec2(rand(vUv * 512. + seed + 17.), rand(vUv * 512. + seed + 41.)) * 2. - 1.;
    c.z = 0.;
  }

  c.a = (c.a + float(i)) / 2.;

  // c.xy = polar(c.xy, r, theta, phi);
  
  fragColor = c;
}`;

const ifsShader = new RawShaderMaterial({
  uniforms: {
    prev: { value: origin },
    affine: { value: affine },
    variationWeights: { value: variationWeights },
    fnWeights: { value: fnWeights },
    seed: { value: 0 },
  },
  vertexShader: ifsVs,
  fragmentShader: ifsFs,
  glslVersion: GLSL3,
});

const ifs = new ShaderPingPongPass(ifsShader, {
  format: RGBAFormat,
  type: FloatType,
  minFilter: NearestFilter,
  magFilter: NearestFilter,
});
ifs.setSize(width, height);

// const drawVs = ``;

// const drawShader = new RawShaderMaterial({
//   uniforms: {
//     positions: { value: null },
//   },
//   vertexShader: drawVs,
//   fragmentShader: drawFs,
// });

const vertices = [];

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    vertices.push(x / width, y / width, 0);
  }
}

const pointVs = `precision highp float;
in vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D positions;

out vec3 vColor;

void main() {
  vec2 uv = position.xy;
  vec4 p = texture(positions, uv);
  vec4 mvPosition = modelViewMatrix * vec4(p.xy, 0., 1.0 );
  vColor = vec3(p.a/9.);
  gl_PointSize = 1.;
  gl_Position = projectionMatrix * mvPosition;
  if (p.z < 20.) {
    gl_Position = vec4(2., 2., 2., 1.);
  }
}`;

const pointFs = `precision highp float;
out vec4 fragColor;

in vec3 vColor;

void main() {
  fragColor = vec4(1.);
}`;

const pointMaterial = new RawShaderMaterial({
  uniforms: {
    positions: { value: null },
  },
  transparent: true,
  blending: AdditiveBlending,
  depthTest: false,
  depthWrite: false,
  vertexShader: pointVs,
  fragmentShader: pointFs,
  glslVersion: GLSL3,
});

const pointGeometry = new BufferGeometry();
pointGeometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
const points = new Points(pointGeometry, pointMaterial);
scene.add(points);

const densityFBO = getFBO(
  window.innerWidth * renderer.getPixelRatio(),
  window.innerHeight * renderer.getPixelRatio(),
  {
    type: renderer.extensions.has("EXT_float_blend") ? FloatType : HalfFloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  }
);

const TONE_PRESETS = [
  { gamma: 2.2, brightness: 1, percentile: 0, contrast: 0, curve: 0, glow: 0 },
  { gamma: 2.2, brightness: 1, percentile: 1, contrast: 0, curve: 0, glow: 0 },
  { gamma: 2.2, brightness: 1, percentile: 0.5, contrast: 0.6, curve: 0.2, glow: 0.25 },
  { gamma: 2, brightness: 2, percentile: 1, contrast: 2, curve: 0.7, glow: 0 },
  { gamma: 3, brightness: 0.5, percentile: 1, contrast: 0.5, curve: 0, glow: 0.3 },
];
let tonePreset = 2;
let toneDirty = true;

const statsPass = new ShaderPass(
  new RawShaderMaterial({
    uniforms: {
      density: { value: densityFBO.texture },
    },
    vertexShader: orthoVertexShader,
    fragmentShader: `precision highp float;
uniform sampler2D density;
out vec4 fragColor;

const int GRID = 128;
const int BINS = 64;
const float LEVEL = .995;

void main() {
  float m = 0.;
  float count = 0.;
  for (int y = 0; y < GRID; y++) {
    for (int x = 0; x < GRID; x++) {
      float h = texture(density, (vec2(x, y) + .5) / float(GRID)).r;
      m = max(m, h);
      if (h > 0.) count++;
    }
  }
  if (m <= 0.) {
    fragColor = vec4(0.);
    return;
  }
  float lm = log(1. + m);
  float bins[BINS];
  for (int b = 0; b < BINS; b++) {
    bins[b] = 0.;
  }
  for (int y = 0; y < GRID; y++) {
    for (int x = 0; x < GRID; x++) {
      float h = texture(density, (vec2(x, y) + .5) / float(GRID)).r;
      if (h > 0.) {
        bins[min(int(log(1. + h) / lm * float(BINS)), BINS - 1)] += 1.;
      }
    }
  }
  float target = (1. - LEVEL) * count;
  float acc = 0.;
  float p = m;
  for (int b = BINS - 1; b >= 0; b--) {
    acc += bins[b];
    if (acc >= target) {
      p = exp(float(b) / float(BINS) * lm) - 1.;
      break;
    }
  }
  fragColor = vec4(p, m, 0., 1.);
}`,
    glslVersion: GLSL3,
  }),
  { type: FloatType, minFilter: NearestFilter, magFilter: NearestFilter }
);

const toneOptions = {
  type: HalfFloatType,
  minFilter: LinearFilter,
  magFilter: LinearFilter,
};

const downsamplePass = new ShaderPass(
  new RawShaderMaterial({
    uniforms: {
      density: { value: densityFBO.texture },
      stats: { value: statsPass.texture },
      brightness: { value: 1 },
      percentile: { value: 1 },
    },
    vertexShader: orthoVertexShader,
    fragmentShader: `precision highp float;
uniform sampler2D density;
uniform sampler2D stats;
uniform float brightness;
uniform float percentile;
out vec4 fragColor;

void main() {
  vec4 s = texture(stats, vec2(.5));
  float ref = max(mix(s.g, s.r, percentile), 1.);
  float norm = log(1. + brightness * ref);
  ivec2 size = textureSize(density, 0);
  ivec2 base = ivec2(gl_FragCoord.xy) * 4;
  float sum = 0.;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      float h = texelFetch(density, min(base + ivec2(x, y), size - 1), 0).r;
      sum += log(1. + brightness * h) / norm;
    }
  }
  fragColor = vec4(sum / 16.);
}`,
    glslVersion: GLSL3,
  }),
  toneOptions
);

function makeBlurPass(source, direction) {
  return new ShaderPass(
    new RawShaderMaterial({
      uniforms: {
        source: { value: source },
        direction: { value: direction },
      },
      vertexShader: orthoVertexShader,
      fragmentShader: `precision highp float;
uniform sampler2D source;
uniform vec2 direction;
out vec4 fragColor;

void main() {
  ivec2 size = textureSize(source, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  float sum = 0.;
  float total = 0.;
  for (int i = -12; i <= 12; i++) {
    float w = exp(-float(i * i) / 72.);
    ivec2 q = clamp(p + ivec2(direction) * i, ivec2(0), size - 1);
    sum += texelFetch(source, q, 0).r * w;
    total += w;
  }
  fragColor = vec4(sum / total);
}`,
      glslVersion: GLSL3,
    }),
    toneOptions
  );
}

const blurPassH = makeBlurPass(downsamplePass.texture, [1, 0]);
const blurPassV = makeBlurPass(blurPassH.texture, [0, 1]);

const displayPass = new ShaderPass(
  new RawShaderMaterial({
    uniforms: {
      density: { value: densityFBO.texture },
      stats: { value: statsPass.texture },
      blurred: { value: blurPassV.texture },
      gamma: { value: 2.2 },
      brightness: { value: 1 },
      percentile: { value: 1 },
      contrast: { value: 0 },
      curve: { value: 0 },
      glow: { value: 0 },
    },
    vertexShader: orthoVertexShader,
    fragmentShader: `precision highp float;
uniform sampler2D density;
uniform sampler2D stats;
uniform sampler2D blurred;
uniform float gamma;
uniform float brightness;
uniform float percentile;
uniform float contrast;
uniform float curve;
uniform float glow;
in vec2 vUv;
out vec4 fragColor;

void main() {
  float hits = texture(density, vUv).r;
  vec4 s = texture(stats, vec2(.5));
  float ref = max(mix(s.g, s.r, percentile), 1.);
  float v = log(1. + brightness * hits) / log(1. + brightness * ref);
  float b = texture(blurred, vUv).r;
  v = max(v + contrast * (v - b) + glow * b, 0.);
  v = v < .7 ? v : .7 + .3 * (1. - exp(-(v - .7) / .3));
  v = pow(v, 1. / gamma);
  v = mix(v, v * v * (3. - 2. * v), curve);
  fragColor = vec4(vec3(v), 1.);
}`,
    glslVersion: GLSL3,
  })
);

function setToneSize(w, h) {
  const qw = Math.ceil(w / 4);
  const qh = Math.ceil(h / 4);
  downsamplePass.setSize(qw, qh);
  blurPassH.setSize(qw, qh);
  blurPassV.setSize(qw, qh);
}

setToneSize(
  window.innerWidth * renderer.getPixelRatio(),
  window.innerHeight * renderer.getPixelRatio()
);

function updateTone() {
  const preset = TONE_PRESETS[tonePreset];
  for (const pass of [downsamplePass, displayPass]) {
    pass.shader.uniforms.brightness.value = preset.brightness;
    pass.shader.uniforms.percentile.value = preset.percentile;
  }
  displayPass.shader.uniforms.gamma.value = preset.gamma;
  displayPass.shader.uniforms.contrast.value = preset.contrast;
  displayPass.shader.uniforms.curve.value = preset.curve;
  displayPass.shader.uniforms.glow.value = preset.glow;
  statsPass.render(renderer);
  downsamplePass.render(renderer);
  blurPassH.render(renderer);
  blurPassV.render(renderer);
}

const mesh = new Mesh(
  new PlaneBufferGeometry(1, 1),
  new MeshBasicMaterial({ map: null })
);
// scene.add(mesh);

renderer.autoClear = false;

function reset() {
  frames = 0;
  captured = false;
  ifsShader.uniforms.prev.value = origin;
  renderer.setRenderTarget(densityFBO);
  renderer.clear();
  renderer.setRenderTarget(null);
  toneDirty = true;
}

controls.enableRotate = false;
controls.enablePan = false;

controls.addEventListener("change", (e) => {
  reset();
});

let running = true;
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyR") {
    randomize();
    reset();
  }
  if (e.code === "KeyT") {
    tonePreset = (tonePreset + 1) % TONE_PRESETS.length;
    toneDirty = true;
  }
});

let dragging = false;
const dragPrev = { x: 0, y: 0 };

renderer.domElement.addEventListener("pointerdown", (e) => {
  dragging = true;
  dragPrev.x = e.clientX;
  dragPrev.y = e.clientY;
});

window.addEventListener("pointerup", () => {
  dragging = false;
});

window.addEventListener("pointercancel", () => {
  dragging = false;
});

window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  mouse.x = clamp(mouse.x + ((e.clientX - dragPrev.x) / window.innerWidth) * 2, -1, 1);
  mouse.y = clamp(mouse.y - ((e.clientY - dragPrev.y) / window.innerHeight) * 2, -1, 1);
  dragPrev.x = e.clientX;
  dragPrev.y = e.clientY;
  applyMorph();
  reset();
});

let captured = false;
let frames = 0;
const STEP = 1000 / 60;
let accumulator = 0;
let prevTime = performance.now();
function render() {
  const now = performance.now();
  accumulator = Math.min(accumulator + now - prevTime, 2 * STEP);
  prevTime = now;
  if (running && frames < 100 && accumulator >= STEP) {
    accumulator -= STEP;
    for (let i = 0; i < 100; i++) {
      ifsShader.uniforms.seed.value = randomInRange(-1000, 1000);
      ifs.render(renderer);
      ifsShader.uniforms.prev.value = ifs.current.texture;
      mesh.material.map = ifs.current.texture;
      pointMaterial.uniforms.positions.value = ifs.current.texture;
      renderer.setRenderTarget(densityFBO);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
    }
    frames++;
    toneDirty = true;
  }
  if (toneDirty) {
    updateTone();
    toneDirty = false;
  }
  displayPass.render(renderer, true);
  // capture(renderer.domElement);
  renderer.setAnimationLoop(render);
}

function resize(w, h, dpr) {
  densityFBO.setSize(w * dpr, h * dpr);
  setToneSize(w * dpr, h * dpr);
  reset();
}

addResize(resize);
render();
