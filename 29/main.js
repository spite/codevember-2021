import {
  scene,
  controls,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  MeshNormalMaterial,
  Object3D,
  InstancedMesh,
  PlaneBufferGeometry,
  Vector3,
  Vector2,
  Matrix4,
  Mesh,
  IcosahedronBufferGeometry,
  MeshBasicMaterial,
  DataTexture,
  RGBFormat,
  FloatType,
  ClampToEdgeWrapping,
  NearestFilter,
  DoubleSide,
  Raycaster,
  CanvasTexture,
  EdgesHelper,
} from "../third_party/three.module.js";
import { Poisson3D } from "./poisson.js";
import { GrassMaterial } from "./GrassMaterial.js";
import { nextPowerOfTwo, randomInRange, VERSION } from "../modules/Maf.js";
import { pointsOnSphere } from "./Fibonacci.js";
import { perlin3 } from "../third_party/perlin.js";
import { CurlPass } from "./CurlPass.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

// blade geometry

const geometry = new PlaneBufferGeometry(0.01, 1, 2, 10);
const trans = new Matrix4().makeTranslation(0, -0.5, 0);
geometry.applyMatrix4(trans);
const rot = new Matrix4().makeRotationX(-Math.PI / 2);
geometry.applyMatrix4(rot);
const material = new GrassMaterial({ wireframe: !true });

const vertices = geometry.attributes.position.array;
for (let i = 0; i < vertices.length; i += 3) {
  if (vertices[i + 0] === 0) {
    const z = vertices[i + 2];
    vertices[i + 1] = 0.005;
  }
}

// opaque interior

const sphere = new Mesh(
  new IcosahedronBufferGeometry(1, 10),
  new MeshBasicMaterial({ color: 0, side: DoubleSide })
);
scene.add(sphere);

function generateDistortFn() {
  const a = randomInRange(-100, 100);
  const b = randomInRange(-100, 100);
  const c = randomInRange(-100, 100);
  const radius = randomInRange(0.5, 1);
  return (p) => {
    p.multiplyScalar(1 + radius * perlin3(p.x + a, p.y + b, p.z + c));
  };
}

let curlPass;

function orthogonal(v) {
  if (Math.abs(v.x) > Math.abs(v.z)) {
    return new Vector3(-v.y, v.x, 0).normalize();
  }
  return new Vector3(0.0, -v.z, v.y).normalize();
}

const up = new Vector3(0, 1, 0);

function calcNormal(p, fn, n) {
  const normal = p.normalize();
  const dPos = p.clone();
  fn(dPos);

  const tangent =
    Math.abs(normal.dot(up)) > 0.5
      ? orthogonal(normal)
      : new Vector3().crossVectors(normal, up);
  const binormal = new Vector3().crossVectors(normal, tangent);

  const offset = 1;
  const a = new Vector3().copy(p).add(tangent.clone().multiplyScalar(offset));
  const b = new Vector3().copy(p).add(binormal.clone().multiplyScalar(offset));

  fn(a);
  fn(b);

  const dT = a.sub(p);
  const dB = b.sub(p);

  n.crossVectors(dT, dB).normalize();
}

const dummy = new Object3D();
let mesh;
let numPoints = 100000;

function distributeGrass() {
  const distort = generateDistortFn();

  const tmp = new Vector3();
  const sphereVertices = sphere.geometry.attributes.position.array;
  for (let i = 0; i < sphereVertices.length; i += 3) {
    tmp.set(sphereVertices[i], sphereVertices[i + 1], sphereVertices[i + 2]);
    tmp.normalize();
    distort(tmp);
    sphereVertices[i] = tmp.x;
    sphereVertices[i + 1] = tmp.y;
    sphereVertices[i + 2] = tmp.z;
  }
  sphere.geometry.attributes.position.needsUpdate = true;

  // const poisson = new Poisson3D(1, 1, 1, 0.01, 30);
  // const points = poisson.calculate();
  const points = pointsOnSphere(numPoints);

  if (!mesh) {
    mesh = new InstancedMesh(geometry, material, points.length);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const t = new Vector3();
  const n = new Vector3();

  // const width = Math.ceil(Math.sqrt(points.length));
  // const height = Math.ceil(points.length / width);
  const width = nextPowerOfTwo(Math.sqrt(points.length));
  const height = Math.ceil(points.length / width);

  const positionData = new Float32Array(width * height * 3);
  const rotation = randomInRange(0.1, 2);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    t.copy(p);
    distort(p);
    dummy.position.copy(p);
    dummy.scale.set(1, 1, 0.1);
    calcNormal(t, distort, n);
    t.copy(p).add(n);
    dummy.lookAt(t);
    dummy.rotateOnAxis(n, randomInRange(-rotation, rotation));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    positionData[i * 3] = p.x;
    positionData[i * 3 + 1] = p.y;
    positionData[i * 3 + 2] = p.z;

    mesh.setColorAt(
      i,
      new Vector3(i, (i % width) / width, Math.floor(i / width) / height)
    );
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;

  if (!curlPass) {
    curlPass = new CurlPass(
      renderer,
      new DataTexture(
        positionData,
        width,
        height,
        RGBFormat,
        FloatType,
        undefined,
        ClampToEdgeWrapping,
        ClampToEdgeWrapping,
        NearestFilter,
        NearestFilter
      ),
      width,
      height
    );

    material.uniforms.curlMap.value = curlPass.texture;
  }

  curlPass.shader.uniforms.persistence.value = randomInRange(1, 1.5);
  curlPass.shader.uniforms.speed.value = randomInRange(0.5, 1.5);
}

distributeGrass();

function randomize() {
  distributeGrass();
}

let running = true;

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
  if (e.code === "Space") {
    running = !running;
  }
});

function setQuality(num) {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh = null;
  numPoints = num;
  curlPass = null;
  randomize();
}
document.querySelector("#low").addEventListener("click", (e) => {
  setQuality(50000);
});

document.querySelector("#medium").addEventListener("click", (e) => {
  setQuality(100000);
});

document.querySelector("#high").addEventListener("click", (e) => {
  setQuality(300000);
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

const raycaster = new Raycaster();
const mouse = new Vector2();
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
renderer.domElement.addEventListener("pointermove", onMouseMove, false);
renderer.domElement.addEventListener("pointerdown", onMouseMove, false);

let time = 0;
let prevTime = performance.now();

const boulder = new Mesh(
  new IcosahedronBufferGeometry(0.1, 10),
  new MeshBasicMaterial({ color: 0 })
);
scene.add(boulder);

let frames = 0;

const point = new Vector3();

function render() {
  const t = performance.now();
  const dt = (t - prevTime) / 1000;
  prevTime = t;

  // controls.autoRotate = true;
  // controls.rotateSpeed = 0.1;
  // controls.update();

  // mouse.x = 0.5 * Math.cos(time);
  // mouse.y = 0.5 * Math.sin(0.9 * time);
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(sphere);

  if (intersects.length) {
    point.copy(intersects[0].point);
    const n = intersects[0].point.clone();
    boulder.position.copy(point).add(n.multiplyScalar(0.05));
  }

  if (running) {
    time += dt;
  }

  if (curlPass && running) {
    curlPass.shader.uniforms.time.value = time / 10;
    curlPass.render();
  }

  material.uniforms.boulder.value.copy(boulder.position);
  material.uniforms.time.value = time / 10;
  post.render(scene, camera);
  // renderer.render(scene, camera);

  // frames++;
  // if (frames > 240) {
  //   frames = 0;
  //   randomize();
  // }
  // capture(renderer.domElement);

  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

renderer.setClearColor(0x101010, 1);
resize();
render();

// window.start = () => {
//   frames = 0;
//   capturer.start();
// };
