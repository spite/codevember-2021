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

function randomize() {
  const r = Math.random();
  if (r > 2 / 3) {
    generateGoursat(data, width, height, depth);
  } else if (r > 1 / 3) {
    generateHyperelliptic(data, width, height, depth);
  } else {
    generateTorus(data, width, height, depth);
  }
  generatePerlin(noiseData, width, height, depth);
  if (volume) {
    volume.texture.needsUpdate = true;
    volume.noiseTexture.needsUpdate = true;
  } else {
    volume = new Volume(data, noiseData, width, height, depth);
    scene.add(volume.mesh);
  }
}

randomize();

let running = true;

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyR") {
    randomize();
  }
});

let time = 0;
let prevTime = performance.now();

let frames = 0;

function render() {
  const t = performance.now();
  const dt = (t - prevTime) / 1000;
  if (running) {
    time += dt;
    // volume.mesh.material.uniforms.cut.value = 0.1 + 0.4 * Math.sin(time * 1.1);
  }
  volume.render(camera, time);
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

function myResize(w, h) {
  post.setSize(w, h);
}
addResize(myResize);

resize();
render();

// window.start = () => {
//   frames = 0;
//   window.capturer.start();
// };
