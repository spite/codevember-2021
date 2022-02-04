import { parabola, randomInRange } from "../modules/Maf.js";
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
  PlaneBufferGeometry,
  Mesh,
  FloatType,
  LinearFilter,
  MeshNormalMaterial,
  Vector2,
  Vector3 as Vector3Base,
  DataTexture3D,
  RGBFormat,
  DataTexture,
  BoxBufferGeometry,
  LineSegments,
  LineBasicMaterial,
  BufferGeometry,
} from "../third_party/three.module.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import { natural } from "../modules/palettes.js";
import { Simulation } from "./simulation.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const palette = natural;
const gradient = new GradientLinear(palette);

const data = new Uint8Array(palette.length * 3);
for (let i = 0; i < palette.length; i++) {
  const c = gradient.getAt(i / (palette.length - 1));
  data[i * 3] = c.r * 255;
  data[i * 3 + 1] = c.g * 255;
  data[i * 3 + 2] = c.b * 255;
}
const colorTexture = new DataTexture(data, palette.length, 1, RGBFormat);

class Vector3 extends Vector3Base {
  abs() {
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);
    this.z = Math.abs(this.z);
    return this;
  }
}

const width = 32;
const height = 32;
const depth = 32;

const p = new Vector3();
const scale = 10;

class Charge {
  constructor(q, rho, x, y, z, ir, or) {
    this.q = q;
    this.rho = rho;
    this.position = new Vector3(x, y, z);
    this.innerRadius = ir;
    this.outerRadius = or;
  }
}

const fieldData = new Float32Array(width * height * depth * 3);

const fieldTexture = new DataTexture3D(fieldData, width, height, depth);
fieldTexture.format = RGBFormat;
fieldTexture.type = FloatType;
fieldTexture.minFilter = LinearFilter;
fieldTexture.magFilter = LinearFilter;
fieldTexture.unpackAlignment = 1;

function getChargeField(p, charge) {
  const pos = charge.position;
  const innerRadius = charge.innerRadius;
  const outerRadius = charge.outerRadius;
  const d = p.clone().sub(pos);
  const r = d.length();
  const field = new Vector3(0, 0, 0);
  const Q = charge.q;
  let f = 0;
  if (r <= innerRadius) {
    return field;
  }
  if (r >= innerRadius && r < outerRadius) {
    f =
      (Q * (r - innerRadius ** 3 / r ** 2)) /
      (outerRadius ** 3 - innerRadius ** 3);
  } else {
    f = Q / r ** 2;
  }
  field.copy(d).multiplyScalar(f / r);
  return field;
}

function getCharge(pos, charge) {
  const pc = pos.clone().sub(charge.position);
  const r2 = pc.dot(pc);
  const E = pc.multiplyScalar(charge.q / (Math.pow(r2, 1.5) + 1.0e-2));
  return E;
}

const charges = [];

function getField(p) {
  const res = new Vector3();
  for (const q of charges) {
    const f = getCharge(p, q);
    res.add(f);
  }
  return res;
}

function randomize() {
  charges.length = 0;
  for (let i = 0; i < 20; i++) {
    const q = new Charge(
      randomInRange(-10, 10),
      0,
      randomInRange(-3, 3),
      randomInRange(-3, 3),
      randomInRange(-3, 3),
      randomInRange(0, 1),
      randomInRange(1, 3)
    );
    charges.push(q);
  }

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        p.set(
          x / (width - 1) - 0.5,
          y / (height - 1) - 0.5,
          z / (depth - 1) - 0.5
        ).multiplyScalar(scale);
        const f = getField(p).normalize();
        const ptr = (z * width * height + y * width + x) * 3;
        fieldData[ptr] = f.x;
        fieldData[ptr + 1] = f.y;
        fieldData[ptr + 2] = f.z;
      }
    }
  }

  fieldTexture.needsUpdate = true;
}

randomize();

let running = true;
let follow = true;

function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyT") {
    follow = !follow;
  }
});

document.querySelector("#chargeBtn").addEventListener("click", (e) => {
  follow = !follow;
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

const raycaster = new Raycaster();
const mouse = new Vector2(100, 100);
const plane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshNormalMaterial()
);
plane.visible = false;
scene.add(plane);
const box = new Mesh(
  new BoxBufferGeometry(1, 1, 1),
  new MeshNormalMaterial({ wireframe: true })
);
box.visible = false;
scene.add(box);

const segmentVertices = [
  new Vector3(-0.5, -0.5, -0.5),
  new Vector3(0.5, -0.5, -0.5),
  new Vector3(-0.5, -0.5, -0.5),
  new Vector3(-0.5, -0.5, 0.5),
  new Vector3(-0.5, -0.5, 0.5),
  new Vector3(0.5, -0.5, 0.5),
  new Vector3(0.5, -0.5, 0.5),
  new Vector3(0.5, -0.5, -0.5),

  new Vector3(-0.5, 0.5, -0.5),
  new Vector3(0.5, 0.5, -0.5),
  new Vector3(-0.5, 0.5, -0.5),
  new Vector3(-0.5, 0.5, 0.5),
  new Vector3(-0.5, 0.5, 0.5),
  new Vector3(0.5, 0.5, 0.5),
  new Vector3(0.5, 0.5, 0.5),
  new Vector3(0.5, 0.5, -0.5),
];
const linesGeometry = new BufferGeometry().setFromPoints(segmentVertices);
const segments = new LineSegments(
  linesGeometry,
  new LineBasicMaterial({ color: 0x404040 })
);
scene.add(segments);

let point;
let inBox = false;

function hitPoint() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  point = null;
  if (intersects.length) {
    point = intersects[0].point;
  }
}

function checkInBox() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(box);
  inBox = intersects.length;
  console.log(inBox);
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  hitPoint();
}

window.addEventListener("pointermove", onMouseMove, false);

window.addEventListener("pointerdown", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  if (isTouchDevice() && follow) {
    checkInBox();
    if (inBox) {
      controls.enableRotate = false;
    }
  }
});

window.addEventListener("pointerup", (e) => {
  controls.enableRotate = true;
});

const simulation = new Simulation(1024, 1024, fieldTexture, colorTexture);
scene.add(simulation.mesh);

camera.position.set(1, 0, 1).multiplyScalar(1.5);
camera.lookAt(scene.position);

const post = new Post(renderer);

let prevTime = performance.now();
let time = 0;
let frames = 0;
const up = new Vector3(0, 1, 0);

function render() {
  plane.lookAt(camera.position);
  const t = performance.now();
  const dt = t - prevTime;
  if (running) {
    time += dt;
  }

  if (running) {
    scene.rotation.y += dt / 5000;
  }

  const rp = point ? point.clone().applyAxisAngle(up, -scene.rotation.y) : null;

  prevTime = t;

  if (running) {
    simulation.simulate(renderer, dt / 1000, follow ? rp : null);
  }
  // renderer.render(scene, camera);
  post.render(scene, camera);

  // frames++;
  // if (frames > 60) {
  //   if (Math.random() > 0.5) {
  //     randomize();
  //   } else {
  //     follow = !follow;
  //   }
  //   frames = 0;
  // }

  // capture(renderer.domElement);
  renderer.setAnimationLoop(render);
}

// renderer.setClearColor(0xffffff);
function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

resize();
render();

// window.start = () => {
//   frames = 0;
//   window.capturer.start();
// };
