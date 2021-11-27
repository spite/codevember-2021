import {
  scene,
  controls,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import { MarchingCubesGeometry } from "../third_party/MarchingCubesGeometry.js";
import {
  Mesh,
  Vector3,
  BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  DirectionalLight,
  HemisphereLight,
  MeshNormalMaterial,
  Box3,
  BufferGeometry,
  PCFSoftShadowMap,
  Vector2,
  Group,
} from "../third_party/three.module.js";
import { scale, randomInRange } from "../modules/Maf.js";
import { WorleyNoise } from "./worley.js";
import { relax, precalcNeighbours } from "./relax.js";
import { toIndexed } from "../23/toIndexed.js";
import { initHdrEnv } from "../modules/hdri.js";
import { adjustOrthoToBB } from "../modules/frustum.js";
import { Post } from "./post.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

renderer.setClearColor(0x101010, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const envMap = await initHdrEnv("studio_small_03_1k.hdr", renderer);

function generateVoronoi(data, width, height, depth, worley) {
  let min = Number.MAX_SAFE_INTEGER;
  let max = Number.MIN_SAFE_INTEGER;
  let ptr = 0;
  const p = new Vector3();
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        p.set(x / width, y / height, z / depth);
        const res = worley.getEuclidean(p, 1);
        const v = res.d;
        const id = res.id;
        min = Math.min(min, v);
        max = Math.max(max, v);
        data[ptr] = v;
        data[ptr + 1] = id;
        ptr += 2;
      }
    }
  }
  for (let i = 0; i < data.length; i += 2) {
    data[i] = scale(min, max, 0, 1, data[i]);
  }
}

function getValue(data, px, py, pz, s) {
  const x = px * s;
  const y = py * s;
  const z = pz * s;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const s2 = s * s;
  const v000 = data[(z0 * s2 + y0 * s + x0) * 2];
  const v100 = data[(z0 * s2 + y0 * s + x0 + 1) * 2];
  const v010 = data[(z0 * s2 + (y0 + 1) * s + x0) * 2];
  const v110 = data[(z0 * s2 + (y0 + 1) * s + x0 + 1) * 2];
  const v001 = data[((z0 + 1) * s2 + y0 * s + x0) * 2];
  const v101 = data[((z0 + 1) * s2 + y0 * s + x0 + 1) * 2];
  const v011 = data[((z0 + 1) * s2 + (y0 + 1) * s + x0) * 2];
  const v111 = data[((z0 + 1) * s2 + (y0 + 1) * s + x0 + 1) * 2];

  const dx = 1 - px;
  const dy = 1 - py;
  const dz = 1 - pz;

  return (
    v000 * dx * dy * dz +
    v100 * px * dy * dz +
    v010 * dx * py * dz +
    v001 * dx * dy * pz +
    v101 * px * dy * pz +
    v011 * dx * py * pz +
    v110 * px * py * dz +
    v111 * px * py * pz
  );
}

function clone(geo, count) {
  const neoGeo = new BufferGeometry();
  const vertices = geo.attributes.position.array.slice(0, count * 3);
  const normals = geo.attributes.normal.array.slice(0, count * 3);
  neoGeo.setAttribute("position", new BufferAttribute(vertices, 3));
  neoGeo.setAttribute("normal", new BufferAttribute(normals, 3));
  return neoGeo;
}

function sdTorus(p, t) {
  const pp = new Vector2(p.x, p.y);
  const q = new Vector2(pp.length() - t.x, p.z);
  return q.length() - t.y;
}

function sdSphere(p, r) {
  return p.length() - r;
}

function sdOctahedron(p, s) {
  p.x = Math.abs(p.x);
  p.y = Math.abs(p.y);
  p.z = Math.abs(p.z);
  return (p.x + p.y + p.z - s) * 0.57735027;
}

function sdRoundBox(p, b, r) {
  const q = p.clone();
  q.x = Math.abs(q.x);
  q.y = Math.abs(q.y);
  q.z = Math.abs(q.z);
  q.sub(b);

  q.x = Math.max(q.x, 0);
  q.y = Math.max(q.y, 0);
  q.z = Math.max(q.z, 0);

  return q.length() + Math.min(Math.max(q.x, Math.max(q.y, q.z)), 0.0) - r;
}

function sdRoundedCylinder(p, ra, rb, h) {
  const d = new Vector2(
    new Vector2(p.x, p.z).length() - 2.0 * ra + rb,
    Math.abs(p.y) - h
  );
  return Math.min(Math.max(d.x, d.y), 0.0) + Math.max(d.length(), 0.0) - rb;
}

const group = new Group();
scene.add(group);

const material = new MeshStandardMaterial({
  wireframe: !true,
  envMap,
  envMapIntensity: 0.01,
  roughness: 0.1,
  metalness: 0,
});

const hemiLight = new HemisphereLight(0xffffff, 0xffffff, 0.6);
hemiLight.color.setHSL(0.6, 1, 0.6);
hemiLight.groundColor.setHSL(0.095, 1, 0.75);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

const dirLight = new DirectionalLight(0xffffff, 0.5);
dirLight.color.setHSL(0.1, 1, 0.95);
dirLight.position.set(-1, 1.75, 1);
dirLight.position.multiplyScalar(30);
scene.add(dirLight);

dirLight.castShadow = true;

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;

const d = 5;

dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

dirLight.shadow.camera.far = 3500;

let running = false;

const rotations = new Map();

function randomize() {
  rotations.clear();

  while (group.children.length) {
    group.remove(group.children[0]);
  }
  const worley = new WorleyNoise(20);

  const voronoiSize = 50;
  const data = new Float32Array(voronoiSize * voronoiSize * voronoiSize * 2);
  generateVoronoi(data, voronoiSize, voronoiSize, voronoiSize, worley);

  const size = 50;
  const mc = new MarchingCubesGeometry(size, false, false, 100000);
  // const material = new MeshNormalMaterial({ wireframe: !true });
  const p = new Vector3();

  const q = new Vector2(0.3, 0.15);
  const box = new Vector3(0.25, 0.25, 0.25);
  const fns = [
    (p) => sdTorus(p, q),
    (p) => sdSphere(p, 0.4),
    (p) => sdOctahedron(p, 0.4),
    (p) => sdRoundBox(p, box, 0.01),
    // (p) => sdRoundedCylinder(p, 0.2, 0.2, 0.5),
  ];
  let dFn = fns[Math.floor(Math.random() * fns.length)];

  for (let i = 0; i < worley._points.length; i++) {
    mc.reset();
    let ptr = 0;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let v = -1;
          const cx = Math.floor((x * voronoiSize) / size);
          const cy = Math.floor((y * voronoiSize) / size);
          const cz = Math.floor((z * voronoiSize) / size);
          const scalePtr =
            2 * (cz * voronoiSize * voronoiSize + cy * voronoiSize + cx);
          if (data[scalePtr + 1] === i) {
            v = 2 * data[scalePtr] - 1;
            // v =
            //   2 * getValue(data, x / size, y / size, z / size, voronoiSize) - 1;
          }
          p.set(x / size - 0.5, y / size - 0.5, z / size - 0.5);
          // const d = p.length() - 0.4;
          const d = dFn(p);
          mc.setCell(x, y, z, Math.min(v, -d));
          ptr += 2;
        }
      }
    }
    // mc.blur();
    // mc.blur();
    // mc.blur();
    // mc.blur();
    mc.invalidated = true;
    const count = mc.build();
    //mc.computeVertexNormals();

    if (count) {
      const geo = toIndexed(clone(mc, count)); //toIndexed(mc.clone());
      const neighbours = precalcNeighbours(geo);
      for (let i = 0; i < 6; i++) {
        relax(geo, neighbours);
      }
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();

      const mesh = new Mesh(geo, material);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);

      const d = 0.01;
      mesh.rotation.set(
        randomInRange(-d, d),
        randomInRange(-d, d),
        randomInRange(-d, d)
      );
      const center = new Vector3();
      mesh.geometry.boundingBox.getCenter(center);
      mesh.geometry.center();
      mesh.position.copy(center);
      rotations.set(mesh, {
        x: randomInRange(-d, d),
        y: randomInRange(-d, d),
        z: randomInRange(-d, d),
      });
    }
  }
  running = false;
}

const generating = document.querySelector("#generating");

rand();

function rand() {
  generating.style.display = "flex";
  setTimeout(() => {
    randomize();
    generating.style.display = "none";
  }, 10);
}

let time = 0;
let prevTime = performance.now();

let frames = 0;

document.querySelector("#pauseBtn", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn", (e) => {
  rand();
});

document.querySelector("#breakBtn", (e) => {
  running = true;
});

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    rand();
  }
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyB") {
    running = true;
  }
});

const center = new Vector3();

function render() {
  // hitPlane.lookAt(camera.position);

  const t = performance.now();
  const dt = (t - prevTime) / 1000;

  if (running) {
    time += dt;
    const bb = new Box3();
    for (const m of group.children) {
      center.copy(m.position);
      center.normalize().multiplyScalar(0.01);
      m.position.add(center);
      const r = rotations.get(m);
      m.rotation.x += r.x;
      m.rotation.y += r.y;
      m.rotation.z += r.z;

      bb.expandByObject(m);
    }
    adjustOrthoToBB(dirLight.shadow.camera, bb);
  }

  group.rotation.y += 0.01;
  prevTime = t;
  // renderer.render(scene, camera);
  post.render(scene, camera);

  // running = true;
  // frames++;
  // if (frames > 120) {
  //   frames = 0;
  //   rand();
  // }
  // capture(renderer.domElement);

  renderer.setAnimationLoop(render);
}

function myResize(w, h) {
  post.setSize(w, h);
}
addResize(myResize);

resize();
render();

// window.start = () => {
//   frames = 0;
//   rand();
//   capturer.start();
// };
