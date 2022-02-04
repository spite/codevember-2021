import {
  scene,
  renderer,
  camera,
  addResize,
  resize,
} from "../modules/renderer.js";
import {
  DirectionalLight,
  SpotLight,
  AmbientLight,
  sRGBEncoding,
} from "../third_party/three.module.js";
import { Ribbon, randomizeFunction } from "./ribbon.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import { natural, natural2, seaside } from "../modules/palettes.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

renderer.setClearColor(0x202020, 1);

const post = new Post(renderer);

const palettes = [natural, natural2, seaside];
let gradient = new GradientLinear(natural2);
renderer.outputEncoding = sRGBEncoding;

const light = new DirectionalLight(0xffffff, 1);
light.position.set(0, 10, 0);
light.castShadow = true;
scene.add(light);

const ambient = new AmbientLight(0x444444);
scene.add(ambient);

const light2 = new SpotLight(0xffffff, 1, 0, Math.PI / 5, 0.3);
light2.position.set(0, 1500, 1000);
light2.target.position.set(0, 0, 0);

scene.add(light2);

const ribbons = [];
for (let i = 0; i < 100; i++) {
  const ribbon = new Ribbon();
  ribbon.color.set(gradient.getAt(Math.random()));
  scene.add(ribbon);
  ribbons.push(ribbon);
}

camera.position.set(4, 4, 4);

let running = true;
let spin = true;

function randomize() {
  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  gradient = new GradientLinear(palette);
  randomizeFunction();
  for (const ribbon of ribbons) {
    ribbon.color.set(gradient.getAt(Math.random()));
    ribbon.reset();
  }
}

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#spinBtn").addEventListener("click", (e) => {
  spin = !spin;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  running = true;
  randomize();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyR") {
    running = true;
    randomize();
  }
  if (e.code === "KeyS") {
    spin = !spin;
  }
});

let prevTime = performance.now();

function render() {
  const t = performance.now();
  const dt = t - prevTime;
  prevTime = t;
  if (running) {
    for (const ribbon of ribbons) {
      ribbon.update();
    }
  }
  if (spin) {
    scene.rotation.y += dt / 5000;
  }

  renderer.setRenderTarget(post.fbo);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  post.render();

  // capture(renderer.domElement);

  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}

addResize(myResize);
resize();

render();
