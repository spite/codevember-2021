import {
  scene,
  controls,
  renderer,
  addUpdate,
  camera,
} from "../modules/renderer.js";
import {
  BufferGeometry,
  Mesh,
  MeshNormalMaterial,
  ExtrudeGeometry,
  Shape,
  BufferAttribute,
  Vector2,
  Vector3,
  MeshBasicMaterial,
  Color,
  Raycaster,
  DirectionalLightHelper,
  DoubleSide,
  MeshPhysicalMaterial,
  RectAreaLight,
  DirectionalLight,
  CameraHelper,
  PCFShadowMap,
  Box3,
  PlaneBufferGeometry,
} from "../third_party/three.module.js";
import { hslToRgb, rgbToHsl } from "../modules/color.js";
import { RectAreaLightUniformsLib } from "../third_party/RectAreaLightUniformsLib.js";
import { adjustOrthoToBB } from "../modules/frustum.js";
import { clamp } from "../modules/Maf.js";
//import { CCapture } from "../ccapture2/ccapture.js";
import { MapControls } from "../third_party/OrbitControls.js";

// const capturer = new CCapture({
//   format: "webm",
//   quality: 1,
//   timewarp: window.timewarp,
//   timeLimit: 30,
// });

camera.position.set(0, 0, 6);
camera.lookAt(scene.position);

RectAreaLightUniformsLib.init();

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;

const rectLight1 = new RectAreaLight(0xffffff, 10, 4, 10);
rectLight1.position.set(5, 5, 5);
scene.add(rectLight1);

const directionalLight = new DirectionalLight(0xffffff, 0.5);
scene.add(directionalLight);
directionalLight.shadow.bias = -0.001;
directionalLight.position.set(4, 4, 4);
directionalLight.castShadow = true;

const directionalLight2 = new DirectionalLight(0xffffff, 0.5);
scene.add(directionalLight2);
directionalLight2.position.set(-6, 4, 4);
directionalLight2.castShadow = true;

const directionalLight3 = new DirectionalLight(0xffffff, 0.5);
scene.add(directionalLight3);
directionalLight3.position.set(2, -4, 6);
directionalLight3.castShadow = true;

const triangles = [];

function r() {
  return 0.1 * Math.random();
}

function mutateColor(hsl, f) {
  const r = f / 50;
  return {
    h: hsl.h + r * (Math.random() * 2 - 1),
    s: hsl.s + Math.random() * 0.1 - 0.05,
    l: hsl.l + Math.random() * 0.1 - 0.05,
  };
}

class Triangle {
  constructor(x, y, z, h, color) {
    this.h = h;
    this.center = new Vector3(x, y, z);
    this.color = color;

    const w = (2 * h) / Math.sqrt(3);
    this.w = w;

    const a = Math.abs(this.w * 2) + Math.abs(this.h * 2);

    if (a > 0.2 && Math.random() < Math.random() / 8 + a / 1.5) {
      this.subdivide();
    } else {
      triangles.push(this);
    }
  }

  toTriangle() {
    const vertices = new Float32Array([
      0,
      0 + this.h,
      0,
      0 - this.w,
      0 - this.h,
      0,
      0 + this.w,
      0 - this.h,
      0,
    ]);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    this.geometry.computeVertexNormals();

    const c = hslToRgb(this.color.h, this.color.s, this.color.l);
    const mesh = new Mesh(
      this.geometry,
      new MeshBasicMaterial({
        color: new Color(c[0] / 255, c[1] / 255, c[2] / 255),
        side: DoubleSide,
      })
    );
    mesh.position.copy(this.center);
    return mesh;
  }

  toMesh() {
    const bevelThickness = 0.01;
    const bevelSize = 0.01;

    const shape = new Shape();

    shape.moveTo(0, this.h);
    shape.lineTo(-this.w, -this.h);
    shape.lineTo(this.w, -this.h);
    shape.lineTo(0, this.h);

    const extrudeSettings = {
      steps: 1,
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness,
      bevelSize,
      bevelOffset: -bevelSize,
      bevelSegments: 3,
    };
    const col = hslToRgb(this.color.h, this.color.s, this.color.l);

    const geometry = new ExtrudeGeometry(shape, extrudeSettings);

    const material = new MeshPhysicalMaterial({
      color: new Color(col[0] / 255, col[1] / 255, col[2] / 255),
      side: DoubleSide,
      roughness: 0.1,
      metalness: 0,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(this.center);
    this.mesh = mesh;
    return mesh;
  }

  subdivide() {
    const x0 = -this.w / 2;
    const x1 = 0;
    const x2 = this.w / 2;
    const y0 = this.h / 2;

    const x = this.center.x;
    const y = this.center.y;
    const z = this.center.z;

    const a = Math.abs(this.w) + Math.abs(this.h);
    const nh = this.h / 2;

    const t1 = new Triangle(
      x + x0,
      y - y0,
      z + r(),
      nh,
      mutateColor(this.color, a)
    );
    const t2 = new Triangle(
      x + x1,
      y + y0,
      z + r(),
      nh,
      mutateColor(this.color, a)
    );
    const t3 = new Triangle(
      x + x2,
      y - y0,
      z + r(),
      nh,
      mutateColor(this.color, a)
    );
    const t4 = new Triangle(
      x + x1,
      y - y0,
      z + r(),
      -nh,
      mutateColor(this.color, a)
    );

    for (let i = 0; i < triangles.length; i++) {
      if (triangles[i] === this) {
        triangles.splice(i, 1);
      }
    }
  }
}

const triangle = new Triangle(0, 0, 0, 2, {
  h: Math.random(),
  s: 0.5,
  l: 0.5,
});

const bb = new Box3();

for (const triangle of triangles) {
  // const tri = triangle.toTriangle();
  // scene.add(tri);
  const mesh = triangle.toMesh();
  if (mesh) {
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    bb.expandByObject(mesh);
  }
}

const raycaster = new Raycaster();
const mouse = new Vector2();
const plane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshNormalMaterial()
);
scene.add(plane);

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointermove", onMouseMove, false);

const helper = new CameraHelper(directionalLight.shadow.camera);
// scene.add(helper);
const helper2 = new CameraHelper(directionalLight2.shadow.camera);
// scene.add(helper2);
const helper3 = new CameraHelper(directionalLight3.shadow.camera);
// scene.add(helper3);

renderer.render(scene, camera);

adjustOrthoToBB(directionalLight.shadow.camera, bb);
adjustOrthoToBB(directionalLight2.shadow.camera, bb);
adjustOrthoToBB(directionalLight3.shadow.camera, bb);
helper.update();
helper2.update();
helper3.update();

const center = new Vector3();
controls.enabled = false;

async function update() {
  const t = performance.now();

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  let point;
  if (intersects.length) {
    point = intersects[0].point;
  }

  const point2 = new Vector3(2 * Math.cos(t / 800), 2 * Math.sin(t / 1100), 0);

  for (let i = 0; i < triangles.length; i++) {
    const d1 = clamp(triangles[i].center.distanceTo(point), 0.000001, 10000000);
    const d2 = clamp(
      triangles[i].center.distanceTo(point2),
      0.000001,
      10000000
    );
    const s = clamp(1 / d1 ** 20 + 1 / d2 ** 20, 0, 1);
    triangles[i].mesh.scale.set(s, s, 1);
    // triangles[i].mesh.rotation.z = ((Math.PI / 3) * t) / 3000;
  }
  // //console.log("update");
  // for (const triangle of triangles) {
  //   triangle.mesh.lookAt(camera.position);
  // }

  // await capturer.capture(renderer.domElement);
  // capturer.step();
}

addUpdate(update);

// await capturer.start();
