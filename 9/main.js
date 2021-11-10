import {
  scene,
  controls,
  addResize,
  renderer,
  addUpdate,
  camera,
  resize,
} from "../modules/renderer.js";
import {
  BackSide,
  BoxBufferGeometry,
  Mesh,
  MeshStandardMaterial,
} from "../third_party/three.module.js";
import { Trail } from "./trail.js";
import { Post } from "./post.js";
import { onVisibilityChange } from "../modules/visibility.js";

const post = new Post(renderer, { vignetteBoost: 1.1, vignetteReduction: 1.1 });

camera.position.set(0, 0, 4);
camera.lookAt(scene.position);

const trails = [];
function addTrail(color, width) {
  const trail = new Trail(color, width);
  trails.push(trail);
  scene.add(trail.source);
  scene.add(trail.trailMesh);
}

// addTrail(0xff0000);
// addTrail(0x00ff00);
// addTrail(0x0000ff);
addTrail(0xffffff, 0.2);

addTrail(0xffffff, 0.2);
let running = true;

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
});

onVisibilityChange((hidden) => {
  prevTime = performance.now();
  running = !hidden;
});

let time = performance.now();
let prevTime = time;

function render() {
  const t = performance.now();
  const dt = t - prevTime;
  if (running) {
    time += dt;
    for (const trail of trails) {
      trail.update(time);
    }
  }
  prevTime = t;
  // renderer.render(scene, camera);
  post.render(scene, camera);
  renderer.setAnimationLoop(render);
}

function myResize(w, h) {
  post.setSize(w, h);
  for (const trail of trails) {
    trail.setSize(w, h);
  }
}
addResize(myResize);

resize();
render();
