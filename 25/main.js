import {
  scene,
  resize,
  renderer,
  addResize,
  camera,
} from "../modules/renderer.js";
import {
  BoxBufferGeometry,
  InstancedMesh,
  DynamicDrawUsage,
  Object3D,
  CylinderBufferGeometry,
  Matrix4,
  IcosahedronBufferGeometry,
  MeshBasicMaterial,
  RGBEEncoding,
} from "../third_party/three.module.js";
import { randomInRange, TAU } from "../modules/Maf.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import {
  natural,
  natural2,
  circus,
  circus2,
  warm2,
  seaside,
  warm3,
} from "../modules/palettes.js";
import { perlin2 } from "../third_party/perlin.js";
import { SSAO } from "./SSAO.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const ssao = new SSAO();
const post = new Post(renderer);

class Square {
  constructor(dir = 0, pct = 0.5) {
    this.children = [];
    this.nestLevel = 0;
    this.splitDir = 0;
    this.splitPct = 0.5;
    this.width = 1;
    this.height = 1;
    this.w = 1;
    this.h = 1;
    this.depth = randomInRange(0.1, 0.9);
    this.phase = randomInRange(0, TAU);
    this.speed = randomInRange(0.9, 1.1);
    squares.push(this);
  }

  set level(level) {
    this.nestLevel = level;
    const p = Math.max(Math.random(), 1 - this.nestLevel / maxDepth);
    if (
      this.nestLevel < maxDepth &&
      p >= probability &&
      squares.length < 2000
    ) {
      this.subdivide();
    }
  }

  get level() {
    return this.nestLevel;
  }

  set split(s) {
    this.splitPct = s;
    this.resize();
  }

  subdivide() {
    this.splitDir = Math.random() > 0.5 ? 1 : 0;
    this.splitPct = 0.5; // randomInRange(0.1, 0.9);
    const a = new Square();
    const b = new Square();
    this.children.push(a, b);
    a.parent = this;
    b.parent = this;
    a.level = this.level + 1;
    b.level = this.level + 1;
    this.resize();
  }

  resize() {
    if (!this.children.length) {
      return;
    }
    const a = this.children[0];
    const b = this.children[1];
    if (this.splitDir === 0) {
      // Horizontal
      a.width = this.splitPct;
      a.height = 1;
      b.width = 1 - this.splitPct;
      b.height = 1;
    } else {
      // Vertical
      a.width = 1;
      a.height = this.splitPct;
      b.width = 1;
      b.height = 1 - this.splitPct;
    }
  }

  update(x, y, w, h, d) {
    this.w = w * this.width;
    this.h = h * this.height;
    this.x = x;
    this.y = y;
    this.d = d + this.depth;
    if (this.children.length) {
      const a = this.children[0];
      const b = this.children[1];
      const dw = this.w * this.splitPct;
      const dh = this.h * this.splitPct;
      if (this.splitDir === 0) {
        a.update(this.x, this.y, this.w, this.h, this.d);
        b.update(this.x + dw, this.y, this.w, this.h, this.d);
      } else {
        a.update(this.x, this.y, this.w, this.h, this.d);
        b.update(this.x, this.y + dh, this.w, this.h, this.d);
      }
    }
  }
}

const palettes = [natural, natural2, circus, circus2, warm2, seaside, warm3];

let square;
let leafSquares = [];
const squares = [];
const dummy = new Object3D();
let mesh;

const cylGeo = new CylinderBufferGeometry(0.5, 0.5, 0.1, 36, 1);
const rot = new Matrix4().makeRotationX(-Math.PI / 2);
cylGeo.applyMatrix4(rot);
const trans = new Matrix4().makeTranslation(0.5, 0.5, 0.05);
cylGeo.applyMatrix4(trans);

const boxGeo = new BoxBufferGeometry(1, 1, 0.1);
boxGeo.applyMatrix4(trans);

const sphereGeo = new IcosahedronBufferGeometry(0.5, 4);

let padding = 0;
let gradient;
let scale = 3;
let depth = 1;
let maxDepth = 10;
let probability = 0.75;

function randomize() {
  depth = randomInRange(1, 6);
  scale = randomInRange(1, 3);
  maxDepth = Math.round(randomInRange(10, 15));
  probability = randomInRange(0.5, 0.9);
  padding = 0; //randomInRange(0, 0.05);
  squares.length = 0;

  square = new Square(1, 1, 0);
  square.split = 0.5;
  square.level = 0;
  square.update(0, 0, 1, 1);

  leafSquares = squares.filter((s) => s.children.length === 0);

  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  gradient = new GradientLinear(palette);

  const mat = new MeshBasicMaterial({
    wireframe: !true,
  });

  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh = null;
  }

  const geo = [cylGeo, boxGeo][Math.floor(Math.random() * 2)];
  mesh = new InstancedMesh(geo, mat, leafSquares.length);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  //mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);

  invalidated = true;
}

let running = true;
let invalidated = false;

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyR") {
    randomize();
  }
});

randomize();

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

function update() {
  if (!square) {
    return;
  }
  const t = performance.now() / 5000;
  for (const s of squares) {
    // s.split = 0.5 + 0.1 * Math.sin(t * s.speed + s.phase);
    s.split = 0.5 + 0.4 * perlin2(t * s.speed + s.phase, s.y);
    // s.depth = 0.1;
  }

  const size = 2;
  square.update(0, 0, size, size);
  let ptr = 0;
  for (const s of leafSquares) {
    dummy.scale.set(s.w - 0.2 * padding, s.h - 0.2 * padding, depth * s.depth);
    dummy.position.set(
      s.x - 0.5 * size + padding,
      s.y - 0.5 * size + padding,
      0 //0.5 * s.depth
    );
    dummy.updateMatrix();
    mesh.setMatrixAt(ptr, dummy.matrix);

    s.color = gradient.getAt(0.5 + 0.5 * perlin2(s.x * scale, s.y * scale));
    mesh.setColorAt(ptr, s.color);

    ptr++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
}

function render() {
  if (running || invalidated) {
    update();
    invalidated = false;
  }
  ssao.render(renderer, scene, camera);
  post.source = ssao.output;
  post.render(scene, camera);

  // capture(renderer.domElement);
  // frames++;
  // if (frames > 120) {
  //   frames = 0;
  //   randomize();
  // }

  // renderer.render(scene, camera);
  renderer.setAnimationLoop(render);
}

addResize((w, h, dpr) => {
  ssao.setSize(w * dpr, h * dpr);
  post.setSize(w * dpr, h * dpr);
});

camera.position.set(0, 0, 3);
camera.lookAt(scene.position);

resize();
renderer.setClearColor(0xffffff, 1);
renderer.outputEncoding = RGBEEncoding;

render();

// window.start = () => {
//   frames = 0;
//   window.capturer.start();
// };
