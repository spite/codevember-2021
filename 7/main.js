import { randomInRange } from "../modules/Maf.js";
import {
  scene,
  controls,
  renderer,
  addUpdate,
  camera,
  addResize,
  resize,
} from "../modules/renderer.js";
import {
  Mesh,
  MeshBasicMaterial,
  PlaneBufferGeometry,
} from "../third_party/three.module.js";
import { Stone } from "./stone.js";
import { Post } from "./post.js";
import { colors as comicColors } from "./comic-colors.js";
import { capture } from "../modules/capture.js";

const stone = new Stone(renderer);
scene.add(stone);
stone.rotation.set(-Math.PI / 6, 0, 0);

const post = new Post(renderer);

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
  stone.curvatureRim = 1;
  stone.frostFactor = 0;
  stone.update();

  const c = comicColors[Math.floor(Math.random() * comicColors.length)];
  post.crystalShader.uniforms.lightColor.value = c.colors.light;
  post.crystalShader.uniforms.darkColor.value = c.colors.dark;
}

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
});

function myResize(w, h) {
  post.setSize(w, h);
}

addResize(myResize);

function render() {
  const t = performance.now();
  stone.rotation.y = t / 1000;
  post.render(stone, scene, camera);
  renderer.setAnimationLoop(render);
  capture(renderer.domElement);
}

resize();
render();
