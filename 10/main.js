import {
  scene,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import { MarchingCubesGeometry } from "../third_party/MarchingCubesGeometry.js";
import {
  HemisphereLight,
  DirectionalLight,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  Vector3,
  Vector2,
  Mesh,
} from "../third_party/three.module.js";
import { initHdrEnv } from "../modules/hdri.js";
import { randomInRange } from "../modules/Maf.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";
import { adjustOrthoToBB } from "../modules/frustum.js";

const post = new Post(renderer);

renderer.setClearColor(0x101010, 1);
renderer.shadowMap.enabled = true;
// renderer.outputEncoding = sRGBEncoding;
renderer.shadowMap.type = PCFSoftShadowMap;

const size = 80;
const material = new MeshStandardMaterial({
  wireframe: !true,
  envMapIntensity: 0.01,
  roughness: 0.1,
  metalness: 0,
});
const mc = new MarchingCubesGeometry(size);
const mesh = new Mesh(mc, material);
mesh.castShadow = mesh.receiveShadow = true;
scene.add(mesh);

const hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0.6);
hemiLight.color.setHSL(0.6, 1, 0.6);
hemiLight.groundColor.setHSL(0.095, 1, 0.75);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new DirectionalLight(0xffffff, 0.5);
dirLight.color.setHSL(0.1, 1, 0.95);
dirLight.position.set(-1, 1.75, 1);
dirLight.position.multiplyScalar(30);
scene.add(dirLight);

dirLight.castShadow = true;

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;

const d = 5;

dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

dirLight.shadow.camera.far = 3500;
// dirLight.shadow.bias = -0.0001;

// https://www.shadertoy.com/view/tltBzS

function rot2d(v, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Vector2(v.x * c - v.y * s, v.x * s + v.y * c);
}

function sdCircle(p, r) {
  return p.length() - r;
}

function sdBox2d(p, s) {
  p.x = Math.abs(p.x) - s.x;
  p.y = Math.abs(p.y) - s.y;
  p.x = Math.max(p.x, 0);
  p.y = Math.max(p.y, 0);
  return p.length() + Math.min(Math.max(p.x, p.y), 0);
}

function displacement(p) {
  return Math.sin(p.x) * Math.sin(p.y) * Math.sin(p.z);
}

function generateTorusFn() {
  const r1 = randomInRange(0.5, 1.4);
  const r2 = randomInRange(0.25, 0.4);
  const pf = Math.round(Math.random() * 4 * 2) / 2;
  const ox = Math.random() * 0.5;
  const oy = Math.random() * 0.5;
  const s = Math.sign(randomInRange(-1, 1));
  const disp = 0; //Math.random() * 0.1;
  const dispFreq = Math.random() * 300;

  let shapeFn;
  if (Math.random() < 0.5) {
    shapeFn = (p) => sdCircle(p, r2);
  } else {
    const r3 = randomInRange(0.25, 0.4);
    const size = new Vector2(r2, r3);
    shapeFn = (p) => sdBox2d(p, size) - 0.1;
  }

  const beta = randomInRange(-2, 2);
  const gamma = randomInRange(-2, 2);

  return (p) => {
    p.multiplyScalar(5.2);
    const r = new Vector2(p.x, p.z);
    r.copy(rot2d(r, p.y * beta));
    p.x = r.x;
    p.z = r.y;

    r.set(p.x, p.y);
    r.copy(rot2d(r, p.z * gamma));
    p.x = r.x;
    p.y = r.y;

    const pp = new Vector2(p.x, p.z);
    const cp = new Vector2(pp.length() - r1, p.y);
    const a = s * Math.atan2(p.x, p.z);
    cp.copy(rot2d(cp, a * pf));
    cp.y = Math.abs(cp.y) - oy;
    cp.x = Math.abs(cp.x) - ox;
    let d = shapeFn(cp);
    d += disp * displacement(p.clone().multiplyScalar(dispFreq));
    return d;
  };
}

let fn = generateTorusFn();

function randomize() {
  fn = generateTorusFn();
  generate();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

function map(x, y, z) {
  const p = new Vector3(x, y, z);
  return fn(p);
}

function generate() {
  mc.reset();
  for (let z = 0; z < size; z++) {
    const cz = (z - 0.5 * size) / size;
    for (let y = 0; y < size; y++) {
      const cy = (y - 0.5 * size) / size;
      for (let x = 0; x < size; x++) {
        const cx = (x - 0.5 * size) / size;
        mc.setCell(x, y, z, -map(cx, cy, cz));
      }
    }
  }
  mc.blur(1);
  mc.blur(1);
  mc.blur(1);
  mc.blur(1);
  mc.invalidated = true;
  mc.build();

  mesh.geometry.computeBoundingBox();
  adjustOrthoToBB(dirLight.shadow.camera, mesh.geometry.boundingBox);
}

randomize();

// let frames = 0;
let prevTime = performance.now();
function render() {
  const time = performance.now();
  const dt = time - prevTime;
  prevTime = time;
  // renderer.render(scene, camera);
  mesh.rotation.y += dt / 5000;
  post.render(scene, camera);

  // capture(renderer.domElement);

  // frames++;
  // if (frames > 60) {
  //   randomize();
  //   frames = 0;
  // }
  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

resize();

async function init() {
  const envMap = await initHdrEnv("studio_small_03_1k.hdr", renderer);
  material.envMap = envMap;
  render();
}

init();

// window.start = () => {
//   frames = 0;
//   capturer.start();
// };
