import {
  BoxBufferGeometry,
  Mesh,
  MeshNormalMaterial,
  sRGBEncoding,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "../third_party/three.module.js";
import { OrbitControls } from "../third_party/OrbitControls.js";

const renderer = new WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});

document.body.append(renderer.domElement);
renderer.outputEncoding = sRGBEncoding;
renderer.setPixelRatio(window.devicePixelRatio);
// const gl = renderer.getContext();
// gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);

const scene = new Scene();

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(2, 2, 2);
camera.lookAt(scene.position);

const controls = new OrbitControls(camera, renderer.domElement);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(window.devicePixelRatio);
  const dPR = renderer.getPixelRatio();

  for (const fn of resizes) {
    fn(w, h, dPR);
  }
}

async function render() {
  for (const fn of updates) {
    await fn();
  }
  renderer.render(scene, camera);
  renderer.setAnimationLoop(render);
}

const updates = [];

function addUpdate(fn) {
  updates.push(fn);
}

const resizes = [];

function addResize(fn) {
  resizes.push(fn);
}

window.addEventListener("resize", () => resize());

// const mesh = new Mesh(new BoxBufferGeometry(1, 1, 1), new MeshNormalMaterial());
// scene.add(mesh);

resize();

export {
  renderer,
  scene,
  addUpdate,
  addResize,
  controls,
  camera,
  resize,
  render,
};
