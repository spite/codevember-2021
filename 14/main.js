import {
  scene,
  controls,
  renderer,
  addUpdate,
  addResize,
  resize,
  camera,
} from "../modules/renderer.js";
import {
  Raycaster,
  Vector2,
  Matrix4,
  Mesh,
  PlaneBufferGeometry,
  MeshNormalMaterial,
} from "../third_party/three.module.js";
import { Distort } from "./Distort.js";
import { OBJLoader } from "../third_party/OBJLoader.js";
import { mergeGeometries } from "../modules/Geometry.js";
import { Letter } from "./Letter.js";
import { Post } from "./post.js";

const post = new Post(renderer);

renderer.setClearColor(0x101010, 1);

const letter = new Letter("Arvo");
letter.generate("Z");

const s = 0.5;
const scale = new Matrix4().makeScale(s, s, s);
letter.mc.applyMatrix4(scale);

let distort;

function loadSuzanne() {
  const objLoader = new OBJLoader();
  objLoader.load("../assets/suzanne-hq.obj", (obj) => {
    const suzanneGeo = mergeGeometries(
      obj.children[0].geometry,
      obj.children[1].geometry
    );
    const mat = new Matrix4().makeRotationX(-Math.PI / 2);
    suzanneGeo.applyMatrix4(mat);
    const s = 0.4;
    const scale = new Matrix4().makeScale(s, s, s);
    suzanneGeo.applyMatrix4(scale);
    suzanneGeo.computeVertexNormals();
    init(suzanneGeo);
  });
}

function init(geo) {
  distort = new Distort(geo);
  scene.add(distort.group);
  initEvents();
  render();
}

const raycaster = new Raycaster();
const mouse = new Vector2(100, 100);
const plane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshNormalMaterial()
);
plane.visible = false;
scene.add(plane);

let dragging = false;
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  point = null;
  if (intersects.length) {
    point = intersects[0].point;
  }

  if (point && dragging && selectedPoint) {
    selectedPoint.position.copy(point);
  }
}

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#randomizeBtn").addEventListener("click", (e) => {
  const list = "ABCDEFGHIJKLMNPQRSTUVWXYZ1234567890";
  var rnd = Math.floor(Math.random() * list.length);
  const res = list.charAt(rnd);
  letter.generate(res);
  e.stopPropagation();
  e.preventDefault();
});

let changed = false;
function initEvents() {
  window.addEventListener("pointermove", onMouseMove, false);

  controls.addEventListener("change", (e) => {
    changed = true;
  });

  window.addEventListener("pointerdown", (e) => (changed = false));

  window.addEventListener("click", (e) => {
    if (point && !changed) {
      distort.addImpulse(point);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (
      (e.keyCode >= 97 && e.keyCode <= 122) ||
      (e.keyCode >= 48 && e.keyCode <= 57) ||
      (e.keyCode >= 65 && e.keyCode <= 90)
    ) {
      letter.generate(String.fromCharCode(e.keyCode));
    }
    if (e.code === "Space") {
      if (point) {
        running = !running;
      }
    }
  });
}

let point;
let selectedPoint;
let running = true;

camera.position.set(0, 0, 2);
camera.lookAt(scene.position);

function render() {
  plane.lookAt(camera.position);
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  point = null;
  if (intersects.length) {
    point = intersects[0].point;
  }

  selectedPoint = null;
  const intersectsPoints = raycaster.intersectObjects(distort.points);
  if (intersectsPoints.length) {
    selectedPoint = distort.pointsMap.get(intersectsPoints[0].object);
  }

  if (running) {
    distort.update(0.16);
  }
  // renderer.render(scene, camera);
  post.render(scene, camera);
  renderer.setAnimationLoop(render);
}

function myResize(w, h) {
  post.setSize(w, h);
}
addResize(myResize);

resize();

init(letter.mc);
