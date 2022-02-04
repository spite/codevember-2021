import {
  scene,
  controls,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  Vector2,
  Vector3,
  PlaneBufferGeometry,
  MeshBasicMaterial,
  Raycaster,
  DataTexture,
  RGBFormat,
  Mesh,
  Matrix4,
} from "../third_party/three.module.js";
import { Simulation } from "./simulation.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import {
  natural,
  natural2,
  circus,
  circus2,
  warm2,
  seaside,
  warm3,
} from "../modules/palettes.js";
import { randomInRange } from "../modules/Maf.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

const palettes = [natural, natural2, circus, circus2, warm2, seaside, warm3];

function randomize() {
  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  const gradient = new GradientLinear(palette);

  const data = new Uint8Array(palette.length * 3);
  for (let i = 0; i < palette.length; i++) {
    const c = gradient.getAt(i / (palette.length - 1));
    data[i * 3] = c.r * 255;
    data[i * 3 + 1] = c.g * 255;
    data[i * 3 + 2] = c.b * 255;
  }
  const colorTexture = new DataTexture(data, palette.length, 1, RGBFormat);
  simulation.shader.uniforms.gradient.value = colorTexture;
  simulation.simShader.uniforms.persistence.value = randomInRange(1, 2.5);
  simulation.simShader.uniforms.signDir.value = Math.random() > 0.5 ? -1 : 1;
  simulation.simShader.uniforms.noiseScale.value = randomInRange(0.5, 2);
  simulation.simShader.uniforms.noiseSpeed.value = randomInRange(0.5, 2);
  simulation.simShader.uniforms.sphereRadius.value = randomInRange(0.25, 1);
}

const simulation = new Simulation(1024, 1024);
scene.add(simulation.mesh);
randomize();

let prevTime = performance.now();
let frames = 0;
let capturing = false;

let running = true;
let shuffling = true;

const hitPlane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshBasicMaterial({ color: 0x202020 })
);
hitPlane.visible = false;
scene.add(hitPlane);

const raycaster = new Raycaster();
const mouse = new Vector2();
const point = new Vector3(0, 0, 0);
const curPoint = new Vector3(0, 0, 0);

function hitTest() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(hitPlane);

  if (intersects.length) {
    point.copy(intersects[0].point);
  } else {
    point.set(0, 0, 0);
  }
}

function onPointer(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointermove", (e) => {
  onPointer(e);
  hitTest();
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener("pointerdown", (e) => {
  onPointer(e);
  hitTest();
  e.preventDefault();
  e.stopPropagation();
});

function toggleRunning() {
  running = !running;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    toggleRunning();
  }
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.code === "KeyS") {
    shuffling = !shuffling;
  }
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  toggleRunning();
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

document.querySelector("#autoBtn").addEventListener("click", (e) => {
  shuffling = !shuffling;
});

const rot = new Matrix4();
const tmp = new Vector3();

function render() {
  hitPlane.lookAt(camera.position);

  const t = performance.now();
  const dt = (t - prevTime) / 1000;
  prevTime = t;

  if (running) {
    curPoint.lerp(point, 0.1);
    simulation.mesh.rotation.y += dt / 10;
    rot.makeRotationY(-simulation.mesh.rotation.y);
    tmp.copy(curPoint);
    simulation.simulate(renderer, 0.01, tmp.applyMatrix4(rot));
  }

  // renderer.render(scene, camera);
  post.render(scene, camera);
  // capture(renderer.domElement);

  frames++;
  if (frames > 240 && running && shuffling) {
    frames = 0;
    randomize();
  }

  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

renderer.setClearColor(0x101010, 1);
resize();
render();

// window.start = () => {
//   frames = 0;
//   capturing = true;
//   prevTime = performance.now();
//   window.capturer.start();
// };
