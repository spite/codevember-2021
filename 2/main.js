import {
  scene,
  controls,
  renderer,
  addUpdate,
  camera,
  addResize,
  resize,
} from "../modules/renderer.js";
import {
  Mesh,
  PlaneBufferGeometry,
  GLSL3,
  RawShaderMaterial,
  DoubleSide,
  TextureLoader,
  Raycaster,
  MeshNormalMaterial,
  FloatType,
  Vector2,
  Color,
} from "../third_party/three.module.js";
import { ShaderTexture } from "../modules/ShaderTexture.js";
// import { capture } from "../modules/capture.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import {
  warm,
  natural,
  natural2,
  circus,
  seaside,
} from "../modules/palettes.js";

import { shader as noise3d } from "../shaders/noise3d.js";
import { shader as aastep } from "../shaders/aastep.js";
import { shader as hsl } from "../shaders/hsl.js";

// const gl = renderer.getContext();
// gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);

renderer.setClearColor(0x202020, 1);
camera.position.set(0, 0, 2);
camera.lookAt(scene.position);

controls.enablePan = false;
controls.minAzimuthAngle = -0.5;
controls.maxAzimuthAngle = 0.5;
controls.minPolarAngle = Math.PI / 2 - 0.5;
controls.maxPolarAngle = Math.PI / 2 + 0.5;

const seed = Math.random();

const noiseVs = `
precision highp float;

in vec3 position;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;

void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}`;

const noiseFs = `
precision highp float;

in vec2 vUv;

uniform float seed;
uniform float time;

out vec4 fragColor;

${noise3d}

void main() {
  vec2 uv = vUv * 5.;
  float n = .5 + .5 * snoise(vec3(uv.x, uv.y, seed + time));
  float n2 = .5 + .5 * snoise(vec3(.5 * uv.x, .5* uv.y, 1. + seed + time));
  n = mix(n, n2, .5) + .05;

  fragColor = vec4(n);
}
`;

const noiseShader = new RawShaderMaterial({
  uniforms: { seed: { value: seed }, time: { value: 0 } },
  vertexShader: noiseVs,
  fragmentShader: noiseFs,
  glslVersion: GLSL3,
});

const noiseTexture = new ShaderTexture(
  renderer,
  noiseShader,
  2048,
  2048,
  null,
  FloatType
);
noiseTexture.render();

const vs = `
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
  vPosition = mvPosition.xyz / mvPosition.w;
  gl_Position = projectionMatrix * mvPosition;
}`;

const fs = `
precision highp float;

in vec2 vUv;
in vec3 vPosition;

uniform float layer;
uniform vec3 color;
uniform float scale;
uniform float time;
uniform sampler2D paper;
uniform float seed;
uniform sampler2D noise;
uniform vec2 resolution;
uniform vec2 lightPosition;

out vec4 fragColor;

${noise3d}
${aastep}
${hsl}

vec2 rotate(vec2 v, float a) {
	float s = sin(a);
	float c = cos(a);
	mat2 m = mat2(c, -s, s, c);
	return m * v;
}

float sampleNoise(vec2 uv, float layer) {
  float n = texture(noise, rotate((uv-.5), layer*1.)+.5).r;
  n -= layer;
  n = aastep(n, .5);
  return n;
}

void main() {
  
  float n = sampleNoise(scale*vUv, layer);

  if(vUv.x<.01) n = 1.;
  if(vUv.x>1.-.01) n = 1.;
  if(vUv.y<.01) n = 1.;
  if(vUv.y>1.-.01) n = 1.;

  // if(n>.5) {
  //   discard;
  // }

  // vec3 lightPos = vec3(10.*cos(10.*time), 10.*sin(10.*time), 10.);
  vec3 lightPos = vec3(lightPosition.xy, 10.);
  vec3 dir = -lightPos;

  vec2 uvc = scale*(vUv) - .02 * normalize(dir.xy);
  float d = .5 + .5 * sampleNoise(uvc, layer - 1./40.);
  
  if(layer==0.) d = 1.;

  float b = 0.;
  float s = dFdx(gl_FragCoord.x) / resolution.x;
  for(int y=-1; y<=1; y++){
    for(int x=-1; x<=1; x++){
      vec2 uvlookup = scale*(vUv) + vec2(s*float(x), s*float(y));
      float d = sampleNoise(uvlookup, layer);
      b += d;
    }
  }

  vec2 size = vec2(textureSize(paper, 0));
  float aspect = size.x / size.y;
  vec4 bkg = texture(paper, vUv * vec2(aspect, 1.));
  
  float hue = texture(noise, vUv/2.).r;

  vec3 c = bkg.rgb * (.5 + .5 * color);
  vec3 hc = rgb2hsv(c);
  // hc.y += hue/4.;
  hc.z += b/10.;
  hc.y += (1.-d);
  hc.z -= (1.-d);
  hc.x = clamp(hc.x, 0., 1.);
  hc.y = clamp(hc.y, 0., 1.);
  hc.z = clamp(hc.z, 0., 1.);
  c = hsv2rgb(hc);

  // c= vec3(hue);

  fragColor = vec4(c, 1.-n);
}`;

const loader = new TextureLoader();
const paper = loader.load("../assets/Watercolor_ColdPress.jpg");

const layers = 10;
const meshes = [];

for (let i = 0; i < layers; i++) {
  const material = new RawShaderMaterial({
    uniforms: {
      paper: { value: paper },
      noise: { value: noiseTexture.texture },
      time: { value: 0 },
      layer: { value: i / (4 * layers) },
      scale: { value: 0.95 },
      lightPosition: { value: new Vector2(0, 0.7) },
      color: { value: new Color() },
      seed: { value: seed },
      resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: vs,
    fragmentShader: fs,
    side: DoubleSide,
    glslVersion: GLSL3,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneBufferGeometry(1, 1), material);
  mesh.position.z = layers / 40 - i / (2 * layers);
  scene.add(mesh);
  meshes.push(mesh);
}
randomize();

function randomizeColors() {
  const palettes = [warm, natural, natural2, circus, seaside];
  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  const gradient = new GradientLinear(palette);
  for (const mesh of meshes) {
    const c = gradient.getAt(Math.random());
    mesh.material.uniforms.color.value.set(c);
  }
}

const raycaster = new Raycaster();
const mouse = new Vector2(100, 100);
const plane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshNormalMaterial()
);
plane.visible = false;
scene.add(plane);

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointermove", onMouseMove, false);

let running = true;

function randomize() {
  randomizeColors();
  noiseShader.uniforms.seed.value = Math.random() * 1000;
  noiseTexture.render();
}

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }

  if (e.code === "KeyR") {
    randomize();
  }
});

async function update() {
  const t = performance.now() / 10000;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  let point;
  if (intersects.length) {
    point = intersects[0].point;
  }

  for (const mesh of meshes) {
    if (point) {
      mesh.material.uniforms.lightPosition.value.copy(point);
    }
  }

  if (running) {
    noiseTexture.shader.uniforms.time.value = t;
    noiseTexture.render();
  }

  //capture(renderer.domElement);
}

function resizeSketch(w, h, dPR) {
  for (const mesh of meshes) {
    mesh.material.uniforms.lightPosition.value.set(w * dPR, h * dPR);
  }
}

addUpdate(update);
addResize(resizeSketch);

resize();
