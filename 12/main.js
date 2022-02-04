import {
  scene,
  addResize,
  resize,
  renderer,
  camera,
} from "../modules/renderer.js";
import { Volume } from "./Volume.js";
import { Post } from "./post.js";
import {
  generateGoursat,
  generateTorus,
  generatePerlin,
  generateHyperelliptic,
  generateTorusKnot,
} from "./fields.js";
// import { capture } from "../modules/capture.js";

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
  const r = Math.random();
  if (r > 3 / 4) {
    generateGoursat(data, width, height, depth);
  } else if (r > 2 / 4) {
    generateHyperelliptic(data, width, height, depth);
  } else if (r > 1 / 4) {
    generateTorus(data, width, height, depth);
  } else {
    generateTorusKnot(data, width, height, depth);
  }

  generatePerlin(noiseData, width, height, depth);
  if (volume) {
    volume.texture.needsUpdate = true;
    volume.noiseTexture.needsUpdate = true;
  } else {
    volume = new Volume(data, noiseData, width, height, depth);
    scene.add(volume.mesh);
  }
  invalidated = true;
}

randomize();

let running = true;
let cutting = false;

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

window.addEventListener("pointermove", (e) => {
  cut = e.pageY / window.innerHeight;
  invalidated = true;
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener("click", (e) => {
  if (e.target !== renderer.domElement) return;
  cut = e.pageY / window.innerHeight;
  invalidated = true;
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
    volume.mesh.material.uniforms.cut.value = 0.1 + 0.4 * Math.sin(time * 1.1);
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
//   window.capturer.start();
// };
