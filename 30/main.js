import { randomInRange } from "../modules/Maf.js";
import {
  scene,
  controls,
  renderer,
  addResize,
  camera,
  resize,
} from "../modules/renderer.js";
import {
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneBufferGeometry,
  DataTexture,
  RGBFormat,
  Vector3,
} from "../third_party/three.module.js";
import { ParticleMaterial } from "./ParticleMaterial.js";
import { SSAO } from "./SSAO.js";
import { Post } from "./post.js";
import { Simulation } from "./simulation.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import { natural, natural2, circus, seaside } from "../modules/palettes.js";

const palette = natural2;
const gradient = new GradientLinear(palette);

const data = new Uint8Array(palette.length * 3);
for (let i = 0; i < palette.length; i++) {
  const c = gradient.getAt(i / (palette.length - 1));
  data[i * 3] = c.r * 255;
  data[i * 3 + 1] = c.g * 255;
  data[i * 3 + 2] = c.b * 255;
}
const colorTexture = new DataTexture(data, palette.length, 1, RGBFormat);

const width = 512;
const height = 512;
const simulation = new Simulation(width, height);

camera.position.set(25, 25, 25);
camera.lookAt(scene.position);

const ssao = new SSAO();
const post = new Post(renderer);

window.ssao = ssao;

const numParticles = width * height;
const quad = new PlaneBufferGeometry(1, 1);
const particles = new InstancedMesh(
  quad,
  new ParticleMaterial({ wireframe: !true }),
  numParticles
);
particles.material.uniforms.colorTexture.value = colorTexture;
scene.add(particles);

const dummy = new Object3D();
let ptr = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    dummy.position.set(x, y, randomInRange(0.1, 2));
    dummy.updateMatrix();
    particles.setMatrixAt(ptr, dummy.matrix);
    particles.setColorAt(ptr, gradient.getAt(randomInRange(0, 1)));
    ptr++;
  }
}

const point = new Vector3(0, 0, 0);
let time = 0;
let prevTime = performance.now();

const debug = new Mesh(
  new PlaneBufferGeometry(10, 10),
  new MeshBasicMaterial()
);
// scene.add(debug);

let running = true;

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
});

function render() {
  const t = performance.now();
  const dt = (t - prevTime) / 1000;
  time += dt;
  prevTime = t;

  if (running) {
    simulation.step(renderer, dt, point);

    particles.material.uniforms.positions.value =
      simulation.positionFBOs[1 - simulation.current].texture;
    particles.material.uniforms.velocities.value =
      simulation.velocityFBOs[1 - simulation.current].texture;
    // debug.material.map = simulation.positionFBOs[1 - simulation.current].texture;
  }

  ssao.render(renderer, scene, camera);
  post.source = ssao.output;
  post.render(scene, camera);

  // renderer.render(scene, camera);
  renderer.setAnimationLoop(render);
}

addResize((w, h) => {
  particles.material.uniforms.near.value = camera.near;
  particles.material.uniforms.far.value = camera.far;

  ssao.setSize(w, h);
  post.setSize(w, h);
});

renderer.setClearColor(0xffffff, 1);
camera.far = 1000;

resize();
render();
