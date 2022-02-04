import {
  scene,
  controls,
  resize,
  renderer,
  addResize,
  camera,
} from "../modules/renderer.js";
import { Volume } from "./Volume.js";
import { generatePerlin } from "./noise.js";
import { Post } from "./post.js";
import { randomInRange } from "../modules/Maf.js";
import { Mesh, PlaneBufferGeometry } from "../third_party/three.module.js";
import { FloorMaterial } from "./FloorMaterial.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

camera.position.set(0, 1, 4);
camera.lookAt(scene.position);

const size = 32;
const width = size;
const height = size;
const depth = size;
const data = new Float32Array(width * height * depth);
const noiseData = new Float32Array(width * height * depth);

renderer.setClearColor(0x101010, 1);

const colors = [
  [0xd15d00, 0xf8e118],
  [0x2a9106, 0xa1ff80],
  [0x081cb5, 0x8392ff],
  [0x7e059c, 0xff90fe],
  [0x9b0b00, 0xffa582],
];

function randomize() {
  const s1 = randomInRange(6, 10);
  const s2 = randomInRange(8, 20);
  generatePerlin(data, width, height, depth, s1);
  generatePerlin(noiseData, width, height, depth, s2);
  const color = colors[Math.floor(Math.random() * colors.length)];
  volume.material.uniforms.darkColor.value.setHex(color[0]);
  volume.material.uniforms.lightColor.value.setHex(color[1]);
  floor.material.uniforms.darkColor.value.setHex(color[0]);
  floor.material.uniforms.lightColor.value.setHex(color[1]);
  volume.material.uniforms.up.value = randomInRange(0.8, 2);
  volume.texture.needsUpdate = true;
  volume.noiseTexture.needsUpdate = true;
  console.log(s1, s2);
}

let running = true;

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.code === "Space") {
    running = !running;
  }
});

const volume = new Volume(data, noiseData, width, height, depth);
scene.add(volume.mesh);

const floor = new Mesh(new PlaneBufferGeometry(2, 2), new FloorMaterial());
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.01;
scene.add(floor);

randomize();

let time = 0;
let prevTime = performance.now();

function render() {
  const now = performance.now();
  const dt = now - prevTime;
  if (running) {
    time += dt;
  }
  prevTime = now;
  const t = time / 2000;
  volume.render(camera, t);
  floor.material.uniforms.time.value = t;

  //  renderer.render(scene, camera);
  post.render(scene, camera);
  // capture(renderer.domElement);
  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

resize();
render();
