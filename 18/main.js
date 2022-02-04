import {
  scene,
  addResize,
  resize,
  renderer,
  camera,
  controls,
} from "../modules/renderer.js";
import { Volume } from "./Volume.js";
import { Post } from "./post.js";
import {
  generateGoursat,
  generateTorus,
  generateBlob,
  generatePerlin,
  generateHyperelliptic,
  generateSphere,
} from "./fields.js";
// import { capture } from "../modules/capture.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import { natural } from "../modules/palettes.js";
import { randomInRange } from "../modules/Maf.js";

const palette = natural;
const gradient = new GradientLinear(palette);

camera.position.set(1, -1.6, -0.87);
camera.lookAt(scene.position);

const post = new Post(renderer);

const size = 128;
const width = size;
const height = size;
const depth = size;
const data = new Float32Array(width * height * depth);
const noiseData = new Float32Array(width * height * depth);

renderer.setClearColor(0x101010, 1);

let volume;
let invalidated = true;

function randomize() {
  const generators = [
    generateGoursat,
    generateHyperelliptic,
    generateTorus,
    generateSphere,
    generateBlob,
  ];
  const ptr = Math.floor(Math.random() * generators.length);
  generators[ptr](data, width, height, depth);

  generatePerlin(noiseData, width, height, depth);
  if (volume) {
    volume.texture.needsUpdate = true;
    volume.noiseTexture.needsUpdate = true;
  } else {
    volume = new Volume(data, noiseData, width, height, depth);
    scene.add(volume.mesh);
  }
  volume.mesh.material.uniforms.color.value = gradient.getAt(Math.random());
  invalidated = true;
}

randomize();

let running = true;
let cutting = false;
let changed = false;

controls.addEventListener("change", (e) => {
  changed = true;
  invalidated = true;
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

document.querySelector("#cutBtn").addEventListener("click", (e) => {
  cutting = !cutting;
});

let currentCut = 0.5;
let cut = 0.5;

window.addEventListener("pointerdown", (e) => (changed = false));

window.addEventListener("pointermove", (e) => {
  cut = 0.2 + (0.6 * e.pageY) / window.innerHeight;
  invalidated = true;
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener("click", (e) => {
  if (e.target !== renderer.domElement) return;
  if (!changed) {
    cut = e.pageY / window.innerHeight;
    invalidated = true;
  }
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.code === "KeyC") {
    cutting = !cutting;
  }
});

let time = 0;
let prevTime = performance.now();

let frames = 0;

function render() {
  const t = performance.now();
  const dt = (t - prevTime) / 1000;

  currentCut += (cut - currentCut) * 0.1;
  volume.mesh.material.uniforms.cut.value = currentCut;

  if (running) {
    time += dt;
    invalidated = true;
  }

  if (cutting) {
    volume.mesh.material.uniforms.cut.value = 0.5 + 0.3 * Math.sin(time * 1.1);
    invalidated = true;
  }

  if (invalidated) {
    volume.render(camera, time);
    invalidated = false;
  }

  prevTime = t;
  // renderer.render(scene, camera);
  post.render(scene, camera);

  // capture(renderer.domElement);
  // frames++;
  // if (frames % 60 === 0) {
  //   cut = randomInRange(0.4, 0.6);
  // }
  // if (frames % 120 === 0) {
  //   randomize();
  // }
  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

resize();
render();

// window.start = () => {
//   frames = 0;
//   prevTime = performance.now();
//   window.capturer.start();
// };
