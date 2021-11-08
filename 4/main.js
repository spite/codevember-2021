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
  DataTexture,
  FloatType,
  Mesh,
  GLSL3,
  MeshBasicMaterial,
  PlaneBufferGeometry,
  RawShaderMaterial,
  RGBAFormat,
  Float32BufferAttribute,
  NearestFilter,
  Points,
  BufferGeometry,
} from "../third_party/three.module.js";
import { ShaderTexture } from "../modules/ShaderTexture.js";
import { ShaderPingPongPass } from "../modules/ShaderPingPongPass.js";
import { randomInRange } from "../modules/Maf.js";
import { ShaderPass } from "../modules/ShaderPass.js";
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

function randomize() {
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
uniform int fn;
uniform float seed;

out vec4 fragColor;

const float PI = 3.1415926535897932384626433832795;

float rand(in vec2 co){
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * (43758.5453+seed) );
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

  float r = length(c.xy);
  float theta = atan2(c.x, c.y);
  float phi = atan2(c.y, c.x);

  // int fn = int(rand(vUv)*9.);
  float s = .1;

  vec2 p;
  if(fn == 0) {
    p = linear(c.xy, r, theta, phi);
  } else if(fn == 1) {
    p = sinusoidal(c.xy, r, theta, phi);
  } else if(fn == 2) {
    p = spherical(c.xy, r, theta, phi);
  } else if(fn == 3) {
    p = swirl(c.xy, r, theta, phi);
  } else if(fn == 4) {
    p = horseshoe(c.xy, r, theta, phi);
  } else if(fn == 5) {
    p = polar(c.xy, r, theta, phi);
  } else if(fn == 6) {
    p = handkerchief(c.xy, r, theta, phi);
  } else if(fn == 7) {
    p = heart(c.xy, r, theta, phi);
  } else if(fn == 8) {
    p = disc(c.xy, r, theta, phi);
  } else if(fn == 9) {
    p = spiral(c.xy, r, theta, phi);
  } else if(fn == 10) {
    p = hyperbolic(c.xy, r, theta, phi);
  }

  c.xy += p;

  c.a = (c.a + float(fn)) / 2.;

  // c.xy = polar(c.xy, r, theta, phi);
  
  fragColor = c;
}`;

const ifsShader = new RawShaderMaterial({
  uniforms: {
    prev: { value: origin },
    fn: { value: 0 },
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
  vec4 mvPosition = modelViewMatrix * vec4(p.xyz, 1.0 );
  vColor = vec3(p.a/9.);
  gl_PointSize = 1.;
  gl_Position = projectionMatrix * mvPosition;
}`;

const pointFs = `precision highp float;
out vec4 fragColor;

in vec3 vColor;

void main() {
  fragColor = vec4(1., 1., 1., .2);
}`;

const pointMaterial = new RawShaderMaterial({
  uniforms: {
    positions: { value: null },
  },
  transparent: true,
  vertexShader: pointVs,
  fragmentShader: pointFs,
  glslVersion: GLSL3,
});

const pointGeometry = new BufferGeometry();
pointGeometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
const points = new Points(pointGeometry, pointMaterial);
scene.add(points);

const mesh = new Mesh(
  new PlaneBufferGeometry(1, 1),
  new MeshBasicMaterial({ map: null })
);
// scene.add(mesh);

renderer.autoClear = false;

function reset() {
  frames = 0;
  captured = false;
  renderer.autoClear = true;
  ifsShader.uniforms.prev.value = origin;
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
});

function onMove() {
  reset();
}

window.addEventListener("pointerdown", (e) => {
  window.addEventListener("pointermove", onMove);
});

window.addEventListener("pointerup", (e) => {
  window.removeEventListener("pointermove", onMove);
});

let captured = false;
let frames = 0;
function render() {
  if (running && frames < 100) {
    for (let i = 0; i < 100; i++) {
      ifsShader.uniforms.seed.value = randomInRange(-1000, 1000);
      ifsShader.uniforms.fn.value = Math.floor(Math.random() * 10);
      ifs.render(renderer);
      ifsShader.uniforms.prev.value = ifs.current.texture;
      mesh.material.map = ifs.current.texture;
      pointMaterial.uniforms.positions.value = ifs.current.texture;
      renderer.render(scene, camera);
      renderer.autoClear = false;
    }
    frames++;
  }
  // capture(renderer.domElement);
  renderer.setAnimationLoop(render);
}

function resize() {
  reset();
}

addResize(resize);
render();
