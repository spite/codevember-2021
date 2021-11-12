import { randomInRange, mod, VERSION } from "../modules/Maf.js";
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
  BackSide,
  BoxBufferGeometry,
  CatmullRomCurve3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  Quaternion,
  TubeBufferGeometry,
  Vector3,
} from "../third_party/three.module.js";
import { curl } from "../modules/curl.js";
import { Trail } from "./trail.js";
import { Post } from "./post.js";
import { tunnelMaterial } from "./tunnelMaterial.js";
// import { capture } from "../modules/capture.js";

controls.enablePan = false;
controls.enableRotate = false;
controls.enableZoom = false;

const post = new Post(renderer);

const numTrails = 100;

camera.fov = 120;
camera.near = 0.0001;
camera.far = 100;
camera.updateProjectionMatrix();
camera.position.set(0, 0, 10);
camera.lookAt(scene.position);

function getBasePoint(a, r) {
  const rr = r + Math.sin(a * 10);
  const x = (r + rr) * Math.cos(a);
  const y = Math.sin(a * 4);
  const z = (r + rr) * Math.sin(a);
  const p = new Vector3(x, y, z);
  const d = curl(p.clone().multiplyScalar(0.05)).multiplyScalar(0.5);
  p.add(d);
  return p;
}

function getAxis(a, r) {
  const p0 = getBasePoint(a - 1 / 360, r);
  const p1 = getBasePoint(a, r);
  return p1.sub(p0).normalize();
}

class Tunnel {
  constructor() {
    const points = [];
    const r1 = 5;
    const r2 = 2;
    for (let i = 0; i < 360; i++) {
      const a = (i * 2 * Math.PI) / 360;
      const p = getBasePoint(a, r1);
      const axis = getAxis(a, r1);
      const pp = new Vector3(0, r2, 0).applyAxisAngle(axis, a * 10);
      p.add(pp);
      points.push(p);
    }

    const path = new CatmullRomCurve3(points, true, "centripetal", 1);

    const geometry = new TubeBufferGeometry(path, 360, 0.5, 36);
    const material = new MeshBasicMaterial({
      wireframe: !true,
      side: BackSide,
      color: 0,
    });
    const mesh = new Mesh(geometry, tunnelMaterial);
    this.mesh = mesh;
    this.path = path;
  }

  update(time, p, t, n) {
    const tt = mod(time, 1);
    this.path.getPointAt(tt, p);
    if (t) this.path.getTangentAt(tt, t);
    if (n) {
      this.path.getPointAt(mod(tt + 0.01, 1), n);
      n.sub(p).normalize();
    }
  }
}

const tunnel = new Tunnel(new Vector3(0, 0, 0), new Vector3(0, 0, 1));
scene.add(tunnel.mesh);

const particleData = [];
const trails = [];

function initTrailsData() {
  for (let i = 0; i < numTrails * 3; i += 3) {
    const dir = new Vector3()
      .set(randomInRange(-1, 1), 0, randomInRange(-1, 1))
      .normalize()
      .multiplyScalar(randomInRange(0.25, 0.45));
    particleData.push({
      dir,
      speed: -randomInRange(1.1, 5),
      offset: Math.random() / 100,
      radius: randomInRange(0, 2 * Math.PI),
    });
    const trail = new Trail(0.01, ~~randomInRange(3, 50));
    trails.push(trail);
    scene.add(trail.trailMesh);
    scene.add(trail.head);
    scene.add(trail.tail);
  }
}

const n = new Vector3();
const d = new Vector3();

function getPos(t, data, p) {
  tunnel.update(t, p, null, n);
  d.copy(data.dir);
  d.applyAxisAngle(n, data.radius);
  p.add(d);
}

function updateTrails(t) {
  for (let i = 0; i < numTrails; i++) {
    const data = particleData[i];
    const trail = trails[i];
    const l = (curSpeed * trail.trailLength) / 10000;
    let t0 = t * data.speed + data.offset;
    t0 = t + mod(t0 - t, 0.05) - 0.025;
    trail.update(t, t0 - l, t0 + l, (t, p) => {
      getPos(t, data, p);
    });
  }
}

initTrailsData();

const target = new Vector3();
const tangent = new Vector3();
const tangentFrom = new Vector3();
const rot = new Matrix4();
const q = new Quaternion();

let speed = 1;
let curSpeed = 1;

window.addEventListener("pointermove", (e) => {
  speed = e.pageY / window.innerHeight;
  e.preventDefault();
  e.stopPropagation();
});

window.addEventListener("pointerdown", (e) => {
  speed = e.pageY / window.innerHeight;
  e.preventDefault();
  e.stopPropagation();
});

let prevTime = performance.now();
let time = 0;

function render() {
  curSpeed += (speed - curSpeed) * 0.1;

  const t = performance.now();
  const dt = t - prevTime;
  time += dt * curSpeed;
  prevTime = t;

  const tunnelTime = time / 100000;
  tunnelMaterial.uniforms.time.value = time / 1000;
  updateTrails(tunnelTime);

  tunnel.update(tunnelTime, camera.position);
  tunnel.update(tunnelTime + 0.01, target, tangentFrom);
  tangent.lerp(tangentFrom, 0.1).normalize();
  rot.lookAt(camera.position, target, tangent);
  q.setFromRotationMatrix(rot);
  camera.quaternion.slerp(q, 0.05);

  // renderer.render(scene, camera);
  post.render(scene, camera);
  // capture(renderer.domElement);
  renderer.setAnimationLoop(render);
}

function myResize(w, h) {
  for (const trail of trails) {
    trail.setSize(w, h);
  }
  post.setSize(w, h);
}
addResize(myResize);

resize();
render();
