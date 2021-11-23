import {
  scene,
  controls,
  renderer,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  Matrix4,
  Mesh,
  sRGBEncoding,
  MeshNormalMaterial,
  PlaneBufferGeometry,
  TorusKnotBufferGeometry,
  TorusBufferGeometry,
  Vector3,
  Group,
  DoubleSide,
  IcosahedronBufferGeometry,
  BoxBufferGeometry,
  CylinderBufferGeometry,
  BufferGeometry,
  BufferAttribute,
  Raycaster,
  Vector2,
  FlatShading,
  MeshStandardMaterial,
  DirectionalLight,
  PCFShadowMap,
  Triangle,
  Plane,
  MeshBasicMaterial,
  Box3,
} from "../third_party/three.module.js";
import { GLTFLoader } from "../third_party/GLTFLoader.js";
// import { loadSuzanne } from "../modules/suzanne.js";
import { toIndexed, weld } from "./toIndexed.js";
import { clamp, mix, map, randomInRange, VERSION } from "../modules/Maf.js";
import Delaunator from "../third_party/delaunator.js";
import { perlin2 } from "../third_party/perlin.js";
import { initHdrEnv } from "../modules/hdri.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import {
  warm,
  natural,
  natural2,
  circus,
  circus2,
  warm2,
  seaside,
} from "../modules/palettes.js";
import { Post } from "./post.js";
import { adjustOrthoToBB } from "../modules/frustum.js";
// import { capture } from "../modules/capture.js";

const post = new Post(renderer);

controls.enablePan = false;
controls.enableRotate = false;

camera.position.set(0, 4, 0);
camera.lookAt(scene.position);

renderer.setClearColor(0x202020, 1);

renderer.shadowMap.type = PCFShadowMap;
renderer.shadowMap.enabled = true;

async function loadSuzanne() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load("../assets/LeePerrySmith.glb", (scene) => {
      const suzanneGeo = scene.scenes[0].children[0].geometry;
      const mat = new Matrix4().makeRotationX(-Math.PI / 2);
      suzanneGeo.applyMatrix4(mat);
      const s = 0.4;
      const scale = new Matrix4().makeScale(s, s, s);
      suzanneGeo.applyMatrix4(scale);
      resolve(suzanneGeo);
    });
  });
}

function triangulate(n) {
  const points = [];
  const vertices = [];
  for (let i = 0; i < n; i++) {
    // const x = randomInRange(-10, 10);
    // const z = randomInRange(-10, 10);
    const a = randomInRange(0, 2 * Math.PI);
    const r = 1 * Math.sqrt(randomInRange(0, 1));
    const o = warp * perlin2(a, r);
    const x = (r + o) * Math.cos(a);
    const z = (r + o) * Math.sin(a);
    const y = 0;

    points.push(x, z);
    vertices.push(new Vector3(x, y, z));
  }
  const d = new Delaunator(points);
  const geometry = new BufferGeometry();
  geometry.setFromPoints(vertices);
  geometry.setIndex(Array.from(d.triangles));
  geometry.computeVertexNormals();
  geometry.hull = Array.from(d.hull);
  return geometry;
}

function perlinMap(x, y, s) {
  return 0.001 + 0.5 + 0.5 * perlin2(s * x + seedx, s * y + seedy);
}

function buildPrism(a, b, c) {
  const geo = new BufferGeometry();
  const s = 5 * scale;
  let ha = perlinMap(a.x, a.z, scale);
  let hb = perlinMap(b.x, b.z, scale);
  let hc = perlinMap(c.x, c.z, scale);
  const h = (ha + hb + hc) / 3;
  ha = mix(ha, h, mixFactor);
  hb = mix(hb, h, mixFactor);
  hc = mix(hc, h, mixFactor);
  const positions = new Float32Array([
    a.x,
    ha,
    a.z,
    b.x,
    hb,
    b.z,
    c.x,
    hc,
    c.z,
    a.x,
    0,
    a.z,
    b.x,
    0,
    b.z,
    c.x,
    0,
    c.z,
  ]);
  const indices = [
    // top
    0, 1, 2,
    // side
    3, 1, 0, 1, 3, 4,
    // side
    1, 4, 5, 1, 5, 2,
    // side
    0, 2, 5, 3, 0, 5,
  ];
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geometry: geo, height: Math.max(Math.max(ha, hb), hc) };
}

const envMap = await initHdrEnv("studio_small_03_1k.hdr", renderer);
envMap.encodingg = sRGBEncoding;

const light = new DirectionalLight(0xffffff, 0.5);
light.position.set(0.24424732787273323, 1.183316847807905, -2.457539865410103);
scene.add(light);
light.castShadow = true;

const prisms = [];
const prismGroup = new Group();
scene.add(prismGroup);

const floor = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshBasicMaterial({ color: 0x202020 })
);
floor.position.y = -0.01;
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

function riseUp(geo) {
  const indices = geo.index.array;
  const positions = geo.attributes.position.array;
  const pa = new Vector3();
  const pb = new Vector3();
  const pc = new Vector3();
  const tmp = new Vector3();
  // let minArea = 10000;
  // let maxArea = 0;

  // for (let i = 0; i < indices.length; i += 3) {
  //   const a = indices[i];
  //   const b = indices[i + 1];
  //   const c = indices[i + 2];

  //   pa.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
  //   pb.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
  //   pc.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]);

  //   const t = new Triangle(pa, pb, pc);
  //   const area = t.getArea();
  //   minArea = Math.min(minArea, area);
  //   maxArea = Math.max(maxArea, area);
  // }
  let maxHeight = 0;
  let minHeight = 100;

  const bb = new Box3();

  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];

    pa.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]);
    pb.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]);
    pc.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2]);

    // const ha = map(pa.x, pa.z);
    // const hb = map(pb.x, pb.z);
    // const hc = map(pc.x, pc.z);

    // const h = (ha + hb + hc) / 3;

    // const steps = 100;

    const res = buildPrism(pa, pb, pc); //, Math.round(h * steps) / steps);

    // const t = new Triangle(pa, pb, pc);
    // const area = t.getArea();
    // const g = map(minArea, maxArea, 0, 1, area);

    const g = res.height * perlinMap(pa.x, pa.z, scale2);

    const mat = new MeshStandardMaterial({
      roughness: 0.2,
      metalness: 0.1,
      color: gradient.getAt(g),
      wireframe: !true,
      envMap,
      envMapIntensity: 0.1,
    });
    mat.flatShading = true;
    const prism = new Mesh(res.geometry, mat);
    prism.castShadow = prism.receiveShadow = true;
    prism.userData["offset"] = -res.height;
    tmp.copy(pa).add(pb).add(pc).divideScalar(3);
    prism.userData["center"] = tmp.clone();
    prism.userData["height"] = res.height;
    prismGroup.add(prism);
    prisms.push(prism);
    maxHeight = Math.max(maxHeight, res.height);
    minHeight = Math.min(minHeight, res.height);

    bb.expandByObject(prism);
  }

  // minHeight -= 0.05;

  for (const prism of prisms) {
    prism.position.y = -minHeight;
  }
  prismGroup.position.y = -maxHeight + minHeight;

  adjustOrthoToBB(light.shadow.camera, bb);
}

// const suzanneGeo = await loadSuzanne();
// const geo = weld(suzanneGeo); //  toIndexed(suzanneGeo);
// const geo = weld(new TorusBufferGeometry(1, 0.5, 36, 30));
// const geo = weld(new TorusKnotBufferGeometry(1, 0.25, 72, 100));
// const geo = new PlaneBufferGeometry(1, 1, 10, 10);
// const geo = toIndexed(new IcosahedronBufferGeometry(1, 10));
// const geo = weld(new BoxBufferGeometry(1, 1, 1, 10, 10, 10));
// const geo = weld(new CylinderBufferGeometry(1, 1, 1, 10, 10, 10));

function getNeighbours(geo, id) {
  const idx = geo.index.array;
  const n = new Set();
  for (let i = 0; i < geo.index.count; i += 3) {
    if (idx[i] === id || idx[i + 1] === id || idx[i + 2] === id) {
      n.add(idx[i]);
      n.add(idx[i + 1]);
      n.add(idx[i + 2]);
    }
  }
  n.delete(id);
  return Array.from(n.values());
}

function getPoint(geo, id, t) {
  const d = geo.attributes.position.array;
  const ptr = id * 3;
  t.set(d[ptr], d[ptr + 1], d[ptr + 2]);
}

function setPoint(geo, id, p) {
  const d = geo.attributes.position.array;
  const ptr = id * 3;
  d[ptr] = p.x;
  d[ptr + 1] = p.y;
  d[ptr + 2] = p.z;
}

function relax(geo, map) {
  const positions = geo.attributes.position.array;
  const offsets = new Float32Array(positions.length);

  const p = new Vector3();
  const sum = new Vector3(0, 0, 0);
  const t = new Vector3(0, 0, 0);

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;

    const neighbours = map.get(id);

    sum.set(0, 0, 0);
    let total = 0;
    for (let j = 0; j < neighbours.length; j++) {
      getPoint(geo, neighbours[j], t);
      sum.add(t);
      total++;
    }
    sum.divideScalar(total);

    offsets[i + 0] = sum.x;
    offsets[i + 1] = sum.y;
    offsets[i + 2] = sum.z;
  }

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;
    getPoint(geo, id, p);
    p.x = offsets[i + 0];
    p.y = offsets[i + 1];
    p.z = offsets[i + 2];

    setPoint(geo, id, p);
  }
}

function equalize(geo, map) {
  const positions = geo.attributes.position.array;
  const offsets = new Float32Array(positions.length);

  const p = new Vector3();
  const sum = new Vector3(0, 0, 0);
  const t = new Vector3(0, 0, 0);
  const d = new Vector3();

  let acc = 0;
  let total = 0;

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;
    const neighbours = map.get(id);
    getPoint(geo, id, p);
    for (let j = 0; j < neighbours.length; j++) {
      getPoint(geo, neighbours[j], t);
      d.copy(p).sub(t);
      acc += d.length();
    }
    total += neighbours.length;
  }
  acc /= total;
  const desiredLength = acc;

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;
    const neighbours = map.get(id);
    getPoint(geo, id, p);
    sum.set(0, 0, 0);
    for (let j = 0; j < neighbours.length; j++) {
      getPoint(geo, neighbours[j], t);
      d.copy(p).sub(t);
      const l = d.length();
      d.normalize().multiplyScalar(l / 100);
      if (l < desiredLength) {
        sum.add(d.multiplyScalar(1 / l));
      }
      if (l > desiredLength) {
        sum.add(d.multiplyScalar(-1 / l));
      }
    }
    sum.divideScalar(neighbours.length);

    offsets[i + 0] += sum.x;
    offsets[i + 1] += sum.y;
    offsets[i + 2] += sum.z;
  }

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;
    getPoint(geo, id, p);
    p.x += offsets[i + 0];
    p.y += offsets[i + 1];
    p.z += offsets[i + 2];

    setPoint(geo, id, p);
  }
}

function precalcNeighbours(geo) {
  const map = new Map();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    map.set(i, getNeighbours(geo, i));
  }
  return map;
}

function relaxWeighted(geo, map) {
  const positions = geo.attributes.position.array;

  const sum = new Vector3(0, 0, 0);
  const p = new Vector3();
  const t = new Vector3(0, 0, 0);
  const d = new Vector3();

  let total = 0;

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;

    if (geo.hull && geo.hull.indexOf(id) !== -1) {
      continue;
    }

    const neighbours = map.get(id);

    getPoint(geo, id, p);

    sum.set(0, 0, 0);
    let weight = 0;
    for (let j = 0; j < neighbours.length; j++) {
      getPoint(geo, neighbours[j], t);

      d.copy(p).sub(t);
      const w = d.length();

      sum.add(t.multiplyScalar(w));
      weight += w;
    }
    if (weight) {
      sum.divideScalar(weight);
    }

    total += t.copy(p).sub(sum).length();
    p.copy(sum);

    setPoint(geo, id, p);
  }
  return total;
}

let relaxing = false;
let rising = false;
let geo;
let neighbours;
let mesh;
let seedx;
let seedy;
let scale;
let scale2;
let mixFactor;
let warp;
let gradient;

const palettes = [warm, natural, natural2, circus, circus2, warm2, seaside];

function randomize() {
  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  gradient = new GradientLinear(palette);

  warp = Math.random() > 0.5 ? 0 : randomInRange(0, 2);
  seedx = randomInRange(-100, 100);
  seedy = randomInRange(-100, 100);
  scale = randomInRange(0.5, 2);
  scale2 = randomInRange(scale / 4, scale);
  mixFactor = 0; //randomInRange(0, 0.1);

  if (geo) {
    geo.dispose();
  }
  geo = triangulate(500, geo);
  neighbours = precalcNeighbours(geo);
  if (!mesh) {
    mesh = new Mesh(
      geo,
      new MeshNormalMaterial({ wireframe: true, side: DoubleSide })
    );
    scene.add(mesh);
  } else {
    mesh.geometry = geo;
  }
  for (const prism of prisms) {
    prismGroup.remove(prism);
    prism.geometry.dispose();
  }
  prisms.length = 0;

  relaxing = true;
  rising = false;
}

randomize();

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") {
    randomize();
  }
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  randomize();
});

const raycaster = new Raycaster();
const mouse = new Vector2();
let point;

function hitTest() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(floor);

  if (intersects.length) {
    point = intersects[0].point;
  }
}

function onPointer(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointermove", (e) => {
  onPointer(e);
  hitTest();
});

window.addEventListener("pointerdown", (e) => {
  onPointer(e);
  hitTest();
});

const tmp = new Vector2();

function render() {
  if (relaxing) {
    relaxing = relaxWeighted(geo, neighbours) > 0.1;
    if (!relaxing && !rising) {
      rising = true;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }
  if (rising) {
    riseUp(geo);
    rising = false;
  }
  if (prismGroup.position.y < 0) {
    prismGroup.position.y += 0.01;
  }
  for (const prism of prisms) {
    if (prism.position.y < 0) {
      prism.position.y += -prism.position.y * 0.1;
    }
  }
  if (point) {
    for (const prism of prisms) {
      tmp.set(prism.userData["center"].x, prism.userData["center"].z);
      tmp.x -= point.x;
      tmp.y -= point.z;
      // const d = (1 / Math.exp(tmp.length() * 2, 20)) * prism.userData["height"];
      const d = prism.userData["height"] - tmp.length() + 0.25;
      if (prism.position.y > -d) {
        prism.position.y += (-d - prism.position.y) * 0.4;
      }
    }
  }
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
