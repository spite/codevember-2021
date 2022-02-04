import {
  scene,
  controls,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  DataTexture,
  RGBFormat,
  Raycaster,
  Vector2,
  LinearFilter,
} from "../third_party/three.module.js";
import { ScottGray2D } from "./scott-gray.js";
import { Layer } from "./Layer.js";
import { warm } from "../modules/palettes.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

function generateGradient() {
  const palette = warm;
  const gradient = new GradientLinear(palette);
  const selection = [
    gradient.getAt(Math.random()),
    gradient.getAt(Math.random()),
  ];
  const data = new Uint8Array(selection.length * 3);
  for (let i = 0; i < selection.length; i++) {
    const c = selection[i];
    data[i * 3] = c.r * 255;
    data[i * 3 + 1] = c.g * 255;
    data[i * 3 + 2] = c.b * 255;
  }
  const colorTexture = new DataTexture(
    data,
    selection.length,
    1,
    RGBFormat,
    undefined,
    undefined,
    undefined,
    undefined,
    LinearFilter,
    LinearFilter
  );
  return colorTexture;
}

renderer.setClearColor(0x101010, 1);

const width = 512;
const height = 512;
const scottGray = new ScottGray2D(renderer, width, height);

const raycaster = new Raycaster();
const mouse = new Vector2();
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
renderer.domElement.addEventListener("pointermove", onMouseMove, false);
renderer.domElement.addEventListener("pointerdown", onMouseMove, false);

const LAYERS = 20;
const layers = [];
const layerStep = 0.005;

function randomizeColors() {
  const colorTexture = generateGradient();
  for (const layer of layers) {
    layer.gradient = colorTexture;
  }
}

for (let i = 0; i < LAYERS; i++) {
  const layer = new Layer(renderer);
  layer.setSize(width, height);
  scene.add(layer);
  layers.push(layer);
}
randomizeColors();

let running = true;
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyR") {
    randomizeColors();
    scottGray.randomize();
  }
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomizeColors();
  scottGray.randomize();
});

let currentLayer = 0;
const point = new Vector2();
const curPoint = new Vector2(0, 0);
let time = 0;
let prevTime = performance.now();

function render() {
  if (running) {
    const t = performance.now();
    const dt = (t - prevTime) / 1000;
    time += dt;
    prevTime = time;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(layers[0]);

    point.set(100, 100);
    if (intersects.length) {
      point.copy(intersects[0].uv);
    }
    curPoint.lerp(point, 0.1);

    scottGray.simulation.shader.uniforms.pointer.value.copy(curPoint);

    for (let i = 0; i < 10; i++) {
      scottGray.step();
    }

    layers[currentLayer].copy(scottGray.texture);
    currentLayer = (currentLayer + 1) % layers.length;

    const a = Math.sin(time / 1000);

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[(currentLayer + i) % layers.length];
      layer.position.z = -(layers.length - i) * layerStep;
      layer.material.uniforms.level.value = 1 - i / layers.length;
      layer.rotation.z = (i * a) / layers.length / 10;
    }
  }

  post.render(scene, camera);
  // capture(renderer.domElement);
  // renderer.render(scene, camera);
  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

camera.position.set(0, 0, 1.25);
camera.lookAt(scene.position);

controls.enablePan = false;
controls.minAzimuthAngle = -0.5;
controls.maxAzimuthAngle = 0.5;
controls.minPolarAngle = Math.PI / 2 - 0.5;
controls.maxPolarAngle = Math.PI / 2 + 0.5;

resize();
render();
