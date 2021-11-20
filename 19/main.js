import { scene, controls, renderer, camera } from "../modules/renderer.js";
import {
  ACESFilmicToneMapping,
  MeshStandardMaterial,
  sRGBEncoding,
  Vector2,
  Vector3,
  DataTexture,
  RGBFormat,
  Quaternion,
  Mesh,
} from "../third_party/three.module.js";
import { createDonutGeometry } from "./Donut.js";
import { initHdrEnv } from "../modules/hdri.js";
import { clamp, randomInRange } from "../modules/Maf.js";
import { Simulation } from "./simulation.js";
// import { capture } from "../modules/capture.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import { warm } from "../modules/palettes.js";

const palette = warm;
const gradient = new GradientLinear([0x101010, 0xffffff]);

const data = new Uint8Array(palette.length * 3);
for (let i = 0; i < palette.length; i++) {
  const c = gradient.getAt(i / (palette.length - 1));
  data[i * 3] = c.r * 255;
  data[i * 3 + 1] = c.g * 255;
  data[i * 3 + 2] = c.b * 255;
}
const colorTexture = new DataTexture(data, palette.length, 1, RGBFormat);

renderer.toneMapping = ACESFilmicToneMapping;
renderer.sortObjects = false;

controls.enabled = false;

const envMap = await initHdrEnv("studio_small_03_1k.hdr", renderer);
envMap.encodingg = sRGBEncoding;

const mat = new MeshStandardMaterial({
  roughness: 0.7,
  metalness: 0.1,
  color: 0x101010,
  wireframe: !true,
  envMap,
});

let dx = 0;
let dy = 0;

camera.position.set(0, 0, 2);
camera.lookAt(scene.position);

const mouse = new Vector2();
const dragStart = new Vector2();
let dragging = false;

const rotateStartPoint = new Vector3(0, 0, 1);
const rotateEndPoint = new Vector3(0, 0, 1);
const curQuaternion = new Quaternion();
const rotationSpeed = 0.5;

const sphereCoords = new Vector3();
function project(deltaX, deltaY) {
  const w = window.innerWidth / 2;
  const h = window.innerHeight / 2;
  const dx = clamp(deltaX / w, -1, 1);
  const dy = clamp(-deltaY / h, -1, 1);
  sphereCoords.set(dx, dy, 0.0);

  const length = sphereCoords.length();

  if (length > 1.0) {
    sphereCoords.normalize();
  } else {
    sphereCoords.z = Math.sqrt(1.0 - length * length);
  }

  return sphereCoords;
}

function rotateMatrix(rotateStart, rotateEnd) {
  const axis = new Vector3();
  const quaternion = new Quaternion();

  let angle = Math.acos(
    rotateStart.dot(rotateEnd) / rotateStart.length() / rotateEnd.length()
  );

  if (angle) {
    axis.crossVectors(rotateStart, rotateEnd).normalize();
    angle *= rotationSpeed;
    quaternion.setFromAxisAngle(axis, angle);
  }
  return quaternion;
}

function rotation(deltaX, deltaY) {
  rotateEndPoint.copy(project(deltaX, deltaY));

  const rotateQuaternion = rotateMatrix(rotateStartPoint, rotateEndPoint);
  curQuaternion.copy(donut.quaternion);
  curQuaternion.multiplyQuaternions(rotateQuaternion, curQuaternion);
  curQuaternion.normalize();
  donut.setRotationFromQuaternion(curQuaternion);

  rotateEndPoint.copy(rotateStartPoint);
}

window.addEventListener("pointermove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (dragging) {
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    dx = deltaX;
    dy = deltaY;
    dragStart.x += (e.clientX - dragStart.x) * 0.01;
    dragStart.y += (e.clientY - dragStart.y) * 0.01;
  }
});

window.addEventListener("pointerdown", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  dragging = true;
  if (dragging) {
    dragStart.set(e.clientX, e.clientY);
  }
});

window.addEventListener("pointerup", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  dragging = false;
});

const donut = new Mesh(createDonutGeometry(1, 0.5, Math.random() * 100), mat);
donut.scale.setScalar(0.1);
scene.add(donut);
donut.renderOrder = 1;

const simulation = new Simulation(1024, 1024, colorTexture);
scene.add(simulation.mesh);
simulation.mesh.renderOrder = 2;

let prevTime = performance.now();
let frames = 0;
let capturing = false;

function render() {
  const t = performance.now();
  const dt = (t - prevTime) / 1000;
  prevTime = t;

  simulation.simulate(renderer, dt, curQuaternion);
  rotation(dx, dy);
  dx *= 0.95;
  dy *= 0.95;

  renderer.render(scene, camera);
  // capture(renderer.domElement);

  // frames++;
  // if (capturing && frames % 100 === 0) {
  //   dx += randomInRange(-500, 500);
  //   dy += randomInRange(-500, 500);
  // }

  renderer.setAnimationLoop(render);
}

render();

// window.start = () => {
//   frames = 0;
//   capturing = true;
//   prevTime = performance.now();
//   window.capturer.start();
// };
