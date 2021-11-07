import {
  scene,
  renderer,
  camera,
  addResize,
  resize,
} from "../modules/renderer.js";
import { sliceGeometry } from "./SliceGeometry.js";
import {
  BoxBufferGeometry,
  IcosahedronBufferGeometry,
  Mesh,
  Plane,
  Vector3,
  TorusKnotBufferGeometry,
  BufferGeometry,
  BufferAttribute,
  Matrix4,
} from "../third_party/three.module.js";
import { randomInRange } from "../modules/Maf.js";
import { OBJLoader } from "../third_party/OBJLoader.js";
import { material } from "./material.js";
// import { capture } from "../modules/capture.js";
import { getFBO } from "../modules/fbo.js";
import { pass as finalPass } from "./finalPass.js";

const colorFBO = getFBO(1, 1, {}, true);
finalPass.shader.uniforms.color.value = colorFBO.texture;

camera.position.set(0, 0, 5);
camera.lookAt(scene.position);

renderer.setClearColor(0x202020, 1);

function mergeGeometries(a, b) {
  const geo = new BufferGeometry();
  const data = new Float32Array(
    a.attributes.position.count * a.attributes.position.itemSize +
      b.attributes.position.count * b.attributes.position.itemSize
  );
  data.set(a.attributes.position.array);
  data.set(b.attributes.position.array, a.attributes.position.array.length);

  geo.setAttribute("position", new BufferAttribute(data, 3));
  return geo;
}

function randomSlice(geometry) {
  const n = new Vector3(0, 1, 0);
  n.set(
    randomInRange(-1, 1),
    randomInRange(-1, 1),
    randomInRange(-1, 1)
  ).normalize();
  const slicePlane = new Plane(n);
  // slicePlane.constant = 0.5; //randomInRange(-1.1);
  const rnd = new Vector3(
    randomInRange(-1, 1),
    randomInRange(-1, 1),
    randomInRange(-1, 1)
  );
  const offset = new Vector3().crossVectors(n, rnd);
  offset.multiplyScalar(0.5 * randomInRange(0.01, 0.1));
  const res = sliceGeometry(geometry, slicePlane, offset);

  return mergeGeometries(res.geometry1, res.geometry2);
}

let geo;
let slices = 0;
let totalSlices = 0;
let geos = [];
let currentGeo = 0;

function randomize() {
  totalSlices += 50;
}

function reset() {
  geo = geos[currentGeo];
  mesh.geometry = geo;
  totalSlices = 0;
  slices = 0;
}

function toggle() {
  currentGeo = (currentGeo + 1) % geos.length;
  geo = geos[currentGeo];
  mesh.geometry = geo;
  totalSlices = 0;
  slices = 0;
}

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

document.querySelector("#resetBtn").addEventListener("click", (e) => {
  reset();
});

document.querySelector("#toggleBtn").addEventListener("click", (e) => {
  toggle();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    reset();
  }
  if (e.code === "Space") {
    randomize();
  }
  if (e.code === "KeyT") {
    toggle();
  }
});

function render() {
  if (slices < totalSlices) {
    geo = randomSlice(geo);
    geo.computeVertexNormals();
    mesh.geometry = geo;
    slices++;
  }

  material.uniforms.time.value = Math.random() * 100000;

  renderer.setRenderTarget(colorFBO);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  finalPass.render(renderer, true);

  renderer.setAnimationLoop(render);

  // capture(renderer.domElement);
}

let mesh;
let originalGeo;

const objLoader = new OBJLoader();
objLoader.load("../assets/suzanne-hq.obj", (obj) => {
  const suzanneGeo = mergeGeometries(
    obj.children[0].geometry,
    obj.children[1].geometry
  );
  const mat = new Matrix4().makeRotationX(-Math.PI / 2);
  suzanneGeo.applyMatrix4(mat);
  geos.push(suzanneGeo);

  const torusGeo = new TorusKnotBufferGeometry(
    0.5,
    0.2,
    300,
    30
  ).toNonIndexed();
  geos.push(torusGeo);

  // const icosaGeo = new IcosahedronBufferGeometry(1, 1);
  // geos.push(icosaGeo);

  const cubeGeo = new BoxBufferGeometry(1, 1, 1).toNonIndexed();
  geos.push(cubeGeo);

  geo = geos[currentGeo];
  geo.computeVertexNormals();

  mesh = new Mesh(geo, material);
  scene.add(mesh);
  render();
});

function myResize(w, h) {
  colorFBO.setSize(w, h);
  finalPass.setSize(w, h);
}

addResize(myResize);
resize();
