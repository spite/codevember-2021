import {
  scene,
  addResize,
  resize,
  renderer,
  camera,
  controls,
} from "../modules/renderer.js";
import {
  Mesh,
  PlaneBufferGeometry,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from "../third_party/three.module.js";
import { Volume } from "./Volume.js";
import { Post } from "./post.js";
import { generatePerlin } from "./fields.js";
// import { capture } from "../modules/capture.js";

camera.position.set(1, -1.6, -0.87);
camera.lookAt(scene.position);

const post = new Post(renderer);

renderer.setClearColor(0xdddddd, 1);

let invalidated = true;

const volume = new Volume();
scene.add(volume.mesh);

const hitPlane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshBasicMaterial({ color: 0x202020 })
);
hitPlane.visible = false;
scene.add(hitPlane);

let running = true;

const raycaster = new Raycaster();
const mouse = new Vector2();
const point = new Vector3(0, 0, 0);
const curPoint = new Vector3(0, 0, 0);

function hitTest() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(volume.mesh);

  if (intersects.length) {
    const intersects2 = raycaster.intersectObject(hitPlane);
    point.copy(intersects2[0].point);
    point.clampLength(0, 0.25);
  } else {
    point.set(0, 0, 0);
  }
}

function onPointer(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

controls.addEventListener("change", (e) => {
  invalidated = true;
});

window.addEventListener("pointermove", (e) => {
  onPointer(e);
  hitTest();
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
});

let time = 0;
let prevTime = performance.now();

let frames = 0;

function render() {
  hitPlane.lookAt(camera.position);

  const t = performance.now();
  const dt = (t - prevTime) / 1000;

  if (running) {
    time += dt;
    invalidated = true;
  }

  curPoint.lerp(point, 0.1);

  if (invalidated) {
    volume.mesh.material.uniforms.mousePosition.value.copy(curPoint);
    volume.render(camera, time);
    invalidated = false;
  }

  prevTime = t;
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

// window.start = () => {
//   frames = 0;
//   prevTime = performance.now();
//   window.capturer.start();
// };
