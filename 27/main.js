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
  Quaternion,
  BoxBufferGeometry,
  Matrix3,
  Matrix4,
  RGBEEncoding,
  ACESFilmicToneMapping,
  FogExp2,
  CanvasTexture,
  NearestFilter,
  RepeatWrapping,
} from "../third_party/three.module.js";
import { scale, randomInRange, clamp, mix } from "../modules/Maf.js";
import { WorleyNoise } from "./worley.js";
import { relax, precalcNeighbours } from "./relax.js";
import { toIndexed } from "../23/toIndexed.js";
import { initHdrEnv } from "../modules/hdri.js";
import { adjustOrthoToBB } from "../modules/frustum.js";
import { Post } from "./post.js";
import { MeshSurfaceSampler } from "../third_party/MeshSurfaceSampler.js";
// import { capture } from "../modules/capture.js";
import {
  init as initPhysics,
  update as updatePhysics,
  createRigidBody,
  removeRigidBody,
} from "./physics.js";
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

// renderer.outputEncoding = RGBEEncoding;
renderer.toneMapping = ACESFilmicToneMapping;

const palettes = [warm, natural, natural2, circus, circus2, warm2, seaside];
const groundColor = 0xb70000;

let Ammo;

function loadSound(file) {
  const audio = new Audio();
  audio.src = `../assets/${file}`;
  return audio;
}

const sounds = [
  loadSound("break1.mp3"),
  loadSound("break2.mp3"),
  loadSound("break3.mp3"),
];

const post = new Post(renderer);

renderer.setClearColor(0x400000, 1);
scene.fog = new FogExp2(0x400000, 0.05);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

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
  d.x = Math.max(d.x, 0);
  d.y = Math.max(d.y, 0);
  d.z = Math.max(d.z, 0);

  return Math.min(Math.max(d.x, d.y), 0.0) + d.length() - rb;
}

function opSmoothUnion(d1, d2, k) {
  const h = clamp(0.5 + (0.5 * (d2 - d1)) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

function generateBlobFn() {
  const points = [];
  const radii = [];
  for (let i = 0; i < 5; i++) {
    const r = randomInRange(0.15, 0.25);
    radii.push(r);
    const d = 0.45 - r;
    points.push(
      new Vector3(
        randomInRange(-d, d),
        randomInRange(-d, d),
        randomInRange(-d, d)
      )
    );
  }
  return (p) => {
    let d;
    for (let i = 0; i < points.length; i++) {
      const v = sdSphere(p.clone().sub(points[i]), radii[i]);
      if (d === undefined) {
        d = v;
      } else {
        d = opSmoothUnion(d, v, 0.1);
      }
    }
    return d;
  };
}

const group = new Group();
let fallingObject;

scene.add(group);

const material = new MeshStandardMaterial({
  color: 0xb70000,
  wireframe: !true,
  envMapIntensity: 0.01,
  roughness: 0.1,
  metalness: 0,
});

const hemiLight = new HemisphereLight(0xffffff, groundColor, 0.6);
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

let running = true;

const rotations = new Map();
const e = 0.0000001;
const fallingDummy = new Mesh(
  new BoxBufferGeometry(0.1, 0.1, 0.1, 1, 1, 1),
  new MeshNormalMaterial()
);
// scene.add(fallingDummy);

let broken = false;

function randomize() {
  material.roughness = randomInRange(0.1, 0.2);
  material.metalness = randomInRange(0, 0.2);

  const palette = palettes[Math.floor(Math.random() * palettes.length)];
  const gradient = new GradientLinear(palette);
  material.color.set(gradient.getAt(Math.random()));

  rotations.clear();

  while (group.children.length) {
    const m = group.children[0];
    removeRigidBody(m);
    m.geometry.dispose();
    group.remove(m);
  }
  const worley = new WorleyNoise(Math.round(randomInRange(10, 30)));

  const voronoiSize = 50;
  const data = new Float32Array(voronoiSize * voronoiSize * voronoiSize * 2);
  generateVoronoi(data, voronoiSize, voronoiSize, voronoiSize, worley);

  const size = 50;
  const mc = new MarchingCubesGeometry(size, false, false, 100000);
  // const material = new MeshNormalMaterial({ wireframe: !true });
  const p = new Vector3();

  const blobFn = generateBlobFn();

  const q = new Vector2(0.3, 0.15);
  const box = new Vector3(0.25, 0.25, 0.25);
  const cylRadius = randomInRange(0.1, 0.2);
  const fns = [
    (p) => sdTorus(p, q),
    (p) => sdSphere(p, 0.4),
    (p) => sdOctahedron(p, 0.4),
    (p) => sdRoundBox(p, box, 0.01),
    (p) => sdRoundedCylinder(p, cylRadius, cylRadius, 0.25),
    (p) => blobFn(p),
  ];
  let dFn = fns[Math.floor(Math.random() * fns.length)];

  const sizeObject = size;
  const mcObject = new MarchingCubesGeometry(sizeObject, false, false, 100000);

  mc.reset();
  let ptr = 0;
  for (let z = 0; z < sizeObject; z++) {
    for (let y = 0; y < sizeObject; y++) {
      for (let x = 0; x < sizeObject; x++) {
        let v = -1;
        const cx = Math.floor((x * voronoiSize) / sizeObject);
        const cy = Math.floor((y * voronoiSize) / sizeObject);
        const cz = Math.floor((z * voronoiSize) / sizeObject);
        p.set(x / sizeObject - 0.5, y / sizeObject - 0.5, z / sizeObject - 0.5);
        const d = dFn(p);
        mcObject.setCell(x, y, z, -d);
        ptr += 2;
      }
    }
  }

  mcObject.invalidated = true;
  const count = mcObject.build();

  const dropHeight = 8;

  if (fallingObject) {
    scene.remove(fallingObject);
    fallingObject.geometry.dispose();
  }
  const object = new Mesh(mcObject.clone(), material);
  object.position.y += dropHeight;
  fallingObject = object;
  fallingObject.castShadow = true;
  scene.add(fallingObject);

  fallingObject.geometry.computeBoundingBox();
  const h =
    fallingObject.geometry.boundingBox.max.y -
    fallingObject.geometry.boundingBox.min.y;

  const trans = new Matrix4().makeTranslation(0, 0.5 * h, 0);
  fallingObject.geometry.applyMatrix4(trans);

  const shapeObject = new Ammo.btBoxShape(new Ammo.btVector3(e, e, e));
  fallingDummy.position.y = dropHeight - 0.5 * h;
  fallingDummy.quaternion.identity();

  const body = createRigidBody(
    fallingDummy,
    shapeObject,
    count / 100,
    fallingDummy.position,
    fallingDummy.quaternion
  );

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
      mesh.position.y += dropHeight;
      rotations.set(mesh, {
        x: randomInRange(-d, d),
        y: randomInRange(-d, d),
        z: randomInRange(-d, d),
      });

      mesh.geometry = mesh.geometry.toNonIndexed();
      const sampler = new MeshSurfaceSampler(mesh).build();
      const shape = new Ammo.btConvexHullShape();
      const tmp = new Vector3();
      for (let i = 0; i < 30; i++) {
        sampler.sample(tmp);
        const v = new Ammo.btVector3(tmp.x, tmp.y, tmp.z);
        shape.addPoint(v, true);
      }

      const margin = 0.005;
      shape.setMargin(margin);
      const ballMass = count / 1000;
      createRigidBody(mesh, shape, ballMass, mesh.position, mesh.quaternion);
    }
  }
  broken = false;
}

const generating = document.querySelector("#generating");

function rand() {
  generating.style.display = "flex";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      randomize();
      running = true;
      generating.style.display = "none";
    });
  });
}

let time = 0;
let prevTime = performance.now();

let frames = 0;

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
  e.stopPropagation();
  e.preventDefault();
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  rand();
  e.stopPropagation();
  e.preventDefault();
});

let changed = false;
renderer.domElement.addEventListener("pointerdown", (e) => {
  changed = false;
});

renderer.domElement.addEventListener("pointerup", (e) => {
  if (!changed) {
    rand();
  }
});

controls.addEventListener("change", (e) => {
  changed = true;
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

function playSound() {
  const s = sounds[Math.floor(Math.random() * sounds.length)];
  s.playbackRate = randomInRange(0.6, 0.7);
  s.play();
}

function render() {
  const t = performance.now();
  const dt = (t - prevTime) / 1000;

  if (running) {
    time += dt;
    updatePhysics(dt);

    if (fallingObject) {
      fallingObject.position.copy(fallingDummy.position);
      if (fallingDummy.position.y < 0.5) {
        fallingObject.visible = false;
        group.visible = true;
        if (!broken) {
          playSound();
          for (const m of group.children) {
            const i = 4;
            const v = new Ammo.btVector3(
              randomInRange(-i, i),
              i * 5,
              randomInRange(-i, i)
            );
            m.userData.physicsBody.applyImpulse(v);
          }
          broken = true;
        }
      } else {
        fallingObject.visible = true;
        group.visible = false;
      }
    }

    const bb = new Box3();
    if (fallingObject && fallingObject.visible) {
      bb.expandByObject(fallingObject);
    }
    for (const m of group.children) {
      bb.expandByObject(m);
    }
    adjustOrthoToBB(dirLight.shadow.camera, bb);
    const d = 10;
    dirLight.shadow.camera.left = Math.max(dirLight.shadow.camera.left, -d);
    dirLight.shadow.camera.right = Math.min(dirLight.shadow.camera.right, d);
    dirLight.shadow.camera.top = Math.min(dirLight.shadow.camera.top, d);
    dirLight.shadow.camera.bottom = Math.max(dirLight.shadow.camera.bottom, -d);
    dirLight.shadow.camera.far = Math.max(dirLight.shadow.camera.far, 200);
    dirLight.shadow.camera.updateProjectionMatrix();
  }

  // group.rotation.y += 0.01;
  prevTime = t;
  // renderer.render(scene, camera);
  post.render(scene, camera);

  // frames++;
  // if (frames > 240) {
  //   frames = 0;
  //   rand();
  // }
  // capture(renderer.domElement);

  renderer.setAnimationLoop(render);
}

function myResize(w, h, dpr) {
  post.setSize(w * dpr, h * dpr);
}
addResize(myResize);

resize();

async function init() {
  const envMap = await initHdrEnv("studio_small_03_1k.hdr", renderer);
  material.envMap = envMap;

  Ammo = await initPhysics();

  const sx = 100;
  const sy = 1;
  const sz = 100;
  const ground = new Mesh(
    new BoxBufferGeometry(sx, sy, sz, 1, 1, 1),
    new MeshStandardMaterial({ color: groundColor })
  );
  const margin = 0.005;
  const shape = new Ammo.btBoxShape(
    new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );
  shape.setMargin(margin);

  createRigidBody(ground, shape, 0, ground.position, ground.quaternion);
  ground.receiveShadow = true;
  scene.add(ground);

  camera.position.set(1, 4, -5).normalize().multiplyScalar(10);
  camera.lookAt(ground.position);

  const overlay = document.querySelector("#overlay");
  overlay.addEventListener(
    "click",
    (e) => {
      overlay.remove();
      rand();
      render();
    },
    { once: true }
  );
}

init();

// window.start = () => {
//   frames = 0;
//   rand();
//   capturer.start();
// };
