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
  offset.multiplyScalar(1 * randomInRange(0.01, 0.1));
  const res = sliceGeometry(geometry, slicePlane, offset);

  return mergeGeometries(res.geometry1, res.geometry2);
}

let geo;

async function init() {
  //geo = new IcosahedronBufferGeometry(1, 30);
  // geo = new TorusKnotBufferGeometry(0.5, 0.2, 300, 30).toNonIndexed();
  // geo = new BoxBufferGeometry(1, 1, 1).toNonIndexed();

  for (let i = 0; i < 10; i++) {
    geo = randomSlice(geo);
  }
  geo.computeVertexNormals();

  const mesh = new Mesh(geo, material);
  scene.add(mesh);
}

let slice = !true;

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    geo = originalGeo;
  }
  if (e.code === "Space") {
    slice = !slice;
  }
});

let oneSlice = false;
window.addEventListener("click", (e) => {
  oneSlice = true;
});

function render() {
  if (slice || oneSlice) {
    geo = randomSlice(geo);
    geo.computeVertexNormals();
    mesh.geometry = geo;
    oneSlice = false;
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

  const torusGeo = new TorusKnotBufferGeometry(
    0.5,
    0.2,
    300,
    30
  ).toNonIndexed();

  originalGeo = suzanneGeo;
  geo = originalGeo;

  for (let i = 0; i < 100; i++) {
    geo = randomSlice(geo);
  }
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
