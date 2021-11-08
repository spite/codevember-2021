import { randomInRange } from "../modules/Maf.js";
import {
  scene,
  controls,
  renderer,
  camera,
  addResize,
  resize,
} from "../modules/renderer.js";
import { Stone } from "./stone.js";
import { Post } from "./post.js";
import { colors as comicColors } from "./comic-colors.js";
// import { capture } from "../modules/capture.js";

camera.position.set(1, 1, 1).multiplyScalar(4);
camera.lookAt(scene.position);

const stone = new Stone(renderer);
scene.add(stone);
stone.rotation.set(-Math.PI / 6, 0, 0);

const post = new Post(renderer, { vignetteBoost: 1.1, vignetteReduction: 1.1 });

stone.sphereDetail = 80;
randomize();

function randomize() {
  // stone.octahedronFactor = randomInRange(0.25, 0.75);
  stone.icosahedronFactor = randomInRange(0, 0.75);
  stone.dodecahedronFactor = randomInRange(0, 0.75);
  stone.sphereFactor = randomInRange(0.25, 0.75);
  stone.smoothness = randomInRange(0.5, 1);
  stone.chamfer = randomInRange(0.4, 2);
  stone.height = randomInRange(1, 2);
  stone.twistX = randomInRange(-0.75, 0.75);
  stone.twistY = randomInRange(-0.75, 0.75);
  stone.twistZ = randomInRange(-0.75, 0.75);
  stone.voronoiScaleX = randomInRange(0.5, 2);
  stone.voronoiScaleY = randomInRange(0.5, 2);
  stone.voronoiScaleZ = randomInRange(0.5, 2);
  stone.voronoiStrength = randomInRange(-0.4, -0.2);
  stone.noiseStrength = randomInRange(0, 0.1);
  stone.noiseScale = randomInRange(1, 5);
  stone.curvatureRim = randomInRange(0, 1);
  stone.frostFactor = randomInRange(0, 0.1);
  stone.update();

  const c = comicColors[Math.floor(Math.random() * comicColors.length)];
  post.crystalShader.uniforms.lightColor.value = c.colors.light;
  post.crystalShader.uniforms.darkColor.value = c.colors.dark;
}

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

let spin = true;
document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  spin = !spin;
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.code === "Space") {
    spin = !spin;
  }
});

function myResize(w, h) {
  post.setSize(w, h);
}

addResize(myResize);

let prevTime = performance.now();

function render() {
  const t = performance.now();
  const dt = t - prevTime;
  prevTime = t;
  if (spin) {
    stone.rotation.y += dt / 1000;
  }
  post.render(stone, scene, camera);
  renderer.setAnimationLoop(render);
}

resize();
render();
