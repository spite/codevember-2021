import {
  scene,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  DynamicDrawUsage,
  PointLight,
  Raycaster,
  PlaneBufferGeometry,
  Mesh,
  Vector2,
  IcosahedronBufferGeometry,
  InstancedMesh,
  HemisphereLight,
  Object3D,
  sRGBEncoding,
  Vector3,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  MeshBasicMaterial,
} from "../third_party/three.module.js";
import { Particle } from "./Particle.js";
import { Physics } from "./Physics.js";
import { Attraction } from "./Attraction.js";
import { Collision } from "./Collision.js";
import { clamp, randomInRange, map } from "../modules/Maf.js";
import { Verlet } from "./Verlet.js";
import { Post } from "./post.js";
import {
  warm,
  natural,
  natural2,
  circus,
  circus2,
  warm2,
  warm3,
} from "../modules/palettes.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import { initHdrEnv } from "../modules/hdri.js";
// import { capture } from "../modules/capture.js";

camera.position.set(1, 1, 1).normalize().multiplyScalar(5);

let gradient = new GradientLinear(natural);

const post = new Post(renderer);
renderer.setClearColor(0x202020, 1);
const physics = new Physics(new Verlet());

const raycaster = new Raycaster();
const mouse = new Vector2(0, 0);
const plane = new Mesh(new PlaneBufferGeometry(1000, 1000), new Mesh());
plane.visible = false;
scene.add(plane);
const point = new Vector3(0, 0, 0);
const nextPoint = new Vector3(0, 0, 0);

renderer.shadowMap.type = PCFSoftShadowMap;
renderer.shadowMap.enabled = true;

function hitPoint() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  if (intersects.length) {
    nextPoint.copy(intersects[0].point);
  }
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointermove", onMouseMove, false);

const attraction = new Attraction(point, 200, 0.02);
const repulsion = new Attraction(point, 1, -0.4);
const collide = new Collision();

const envMap = await initHdrEnv("studio_small_03_1k.hdr", renderer);
envMap.encodingg = sRGBEncoding;

let count = 800;
const maxCount = 2000;

const geometry = new IcosahedronBufferGeometry(4, 3);

const material = new MeshStandardMaterial({
  roughness: 0.2,
  metalness: 0,
  envMap,
  envMapIntensity: 0.05,
});
const mesh = new InstancedMesh(geometry, material, maxCount);
mesh.instanceMatrix.setUsage(DynamicDrawUsage);
mesh.castShadow = mesh.receiveShadow = true;
mesh.count = count;
scene.add(mesh);

function addParticles() {
  for (let i = physics.particles.length; i < count; i++) {
    const particle = new Particle(randomInRange(min, max));
    particle.radius = particle.mass * 4;

    particle.moveTo(
      new Vector3(
        randomInRange(-1, 1),
        randomInRange(-1, 1),
        randomInRange(-1, 1)
      )
    );
    particle.behaviours.push(attraction);
    particle.behaviours.push(repulsion);
    particle.behaviours.push(collide);

    collide.pool.push(particle);

    physics.particles.push(particle);

    mesh.setColorAt(i, gradient.getAt(map(min, max, 0, 1, particle.mass)));
  }
  mesh.instanceColor.needsUpdate = true;

  while (physics.particles.length > count) {
    physics.particles.pop();
    collide.pool.pop();
  }
}

let min = 0.001;
let max = 0.03;

addParticles();

function randomizeColors() {
  const palettes = [warm, natural, natural2, circus, circus2, warm2, warm3];
  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  gradient = new GradientLinear(palette);
  min = randomInRange(0.001, 0.005);
  max = randomInRange(0.01, 0.03);
  for (let i = 0; i < physics.particles.length; i++) {
    const particle = physics.particles[i];
    particle.mass = randomInRange(min, max);
    mesh.setColorAt(i, gradient.getAt(map(min, max, 0, 1, particle.mass)));
  }
  mesh.instanceColor.needsUpdate = true;
}

function randomize() {
  material.roughness = randomInRange(0.2, 0.8);
  material.metalness = randomInRange(0, 0.2);
  randomizeColors();
}

const dummy = new Object3D();

const light = new PointLight(0xffffff, 1, 100);
scene.add(light);
light.castShadow = true;

const hemiLight = new HemisphereLight(0xffffbb, 0x080820, 0.5);
scene.add(hemiLight);

const center = new Mesh(
  new IcosahedronBufferGeometry(0.1, 10),
  new MeshBasicMaterial({ color: 0xffffff })
);
scene.add(center);

const prevPoint = new Vector3();
const t = new Vector3();

let running = true;

function setCount(c) {
  count = clamp(c, 0, maxCount);
  mesh.count = count;
  addParticles();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.key === "-") {
    setCount(count - 100);
  }
  if (e.key === "+") {
    setCount(count + 100);
  }
});

document.querySelector("#minusBtn").addEventListener("click", (e) => {
  setCount(count - 100);
});

document.querySelector("#plusBtn").addEventListener("click", (e) => {
  setCount(count + 100);
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

let prevTime = performance.now();

function render() {
  plane.lookAt(camera.position);

  hitPoint();
  point.lerp(nextPoint, 0.1);

  light.position.copy(point);
  center.position.copy(point);
  center.lookAt(prevPoint);
  t.copy(point).sub(prevPoint);
  center.scale.z = 1 + t.length() * 10;
  prevPoint.copy(point);

  const time = performance.now();
  const dt = time - prevTime;
  prevTime = time;

  if (running) {
    physics.step(dt);
  }

  for (let i = 0; i < physics.particles.length; i++) {
    const p = physics.particles[i];
    dummy.position.copy(p.position);
    const v = Math.exp(p.velocity.length() * p.mass * 20) - 1;
    dummy.scale.set(p.mass, p.mass, clamp(p.mass + v, 0, 3 * p.mass));
    t.copy(p.position).add(p.velocity);
    dummy.lookAt(t);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
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
