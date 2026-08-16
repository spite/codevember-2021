import {
  scene,
  controls,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  Raycaster,
  Vector2,
  Matrix4,
  Mesh,
  PlaneBufferGeometry,
  MeshNormalMaterial,
  Vector3,
} from "../third_party/three.module.js";
import { Curve } from "./Curve.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

renderer.setClearColor(0x101010, 1);

const raycaster = new Raycaster();
const mouse = new Vector2(0, 0);
const plane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshNormalMaterial()
);
plane.visible = false;
scene.add(plane);
const point = new Vector3(0, 0, 0);

function hitPoint() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  if (intersects.length) {
    point.copy(intersects[0].point);
  }
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointermove", onMouseMove, false);

let running = true;
controls.enabled = false;

function toggleRunning() {
  running = !running;
  controls.enabled = !running;
}

document
  .querySelector("#pauseBtn")
  .addEventListener("click", (e) => toggleRunning());

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    toggleRunning();
  }
});

const curve = new Curve(100, 1);
scene.add(curve.tubeMesh);

const up = new Vector3(0, 1, 0);

// the curve grows by one step per 60fps frame, so it advances on a fixed
// accumulator rather than once per drawn frame
const STEP = 1000 / 60;
const MAX_STEPS = 4;
let accumulator = 0;
let prevTime = performance.now();
const rot = new Matrix4();

function render() {
  plane.lookAt(camera.position);

  const now = performance.now();
  accumulator += Math.min(now - prevTime, 200);
  prevTime = now;

  hitPoint();

  if (running) {
    let steps = 0;
    while (accumulator >= STEP && steps < MAX_STEPS) {
      curve.tubeMesh.rotation.y += 0.01;
      rot.makeRotationY(-curve.tubeMesh.rotation.y);
      point.applyMatrix4(rot);
      curve.update(point, up);
      curve.step();
      accumulator -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) accumulator = 0;
    curve.render();
  }

  // renderer.render(scene, camera);
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
