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
function render() {
  plane.lookAt(camera.position);

  hitPoint();

  if (running) {
    curve.tubeMesh.rotation.y += 0.01;
    const rot = new Matrix4().makeRotationY(-curve.tubeMesh.rotation.y);
    point.applyMatrix4(rot);
    curve.update(point, up);
    curve.step();
    curve.render();
  }

  // renderer.render(scene, camera);
  post.render(scene, camera);
  // capture(renderer.domElement);
  renderer.setAnimationLoop(render);
}

function myResize(w, h) {
  post.setSize(w, h);
}
addResize(myResize);

resize();
render();
