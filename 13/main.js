import {
  scene,
  controls,
  addResize,
  renderer,
  addUpdate,
  camera,
  resize,
} from "../modules/renderer.js";
import {
  BackSide,
  BoxBufferGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "../third_party/three.module.js";
import { Light } from "./light.js";
import { Post } from "./post.js";
import { material as slitMaterial } from "./SlitMaterial.js";
// import { capture } from "../modules/capture.js";

// renderer.shadowMap.enabled = true;
// renderer.shadowMap.type = PCFSoftShadowMap;

const post = new Post(renderer, { vignetteBoost: 1.1, vignetteReduction: 1.1 });

camera.position.set(0, 0, 8);
camera.lookAt(scene.position);

const lights = [];
function addLight(color) {
  const light = new Light(color);
  lights.push(light);
  scene.add(light.source);
}

addLight(0xff0000);
addLight(0x00ff00);
addLight(0x0000ff);

const lightMaterial = new MeshStandardMaterial({ side: BackSide });

const cube = new Mesh(new BoxBufferGeometry(4, 4, 4), lightMaterial);
cube.receiveShadow = true;
scene.add(cube);

let mode = 0;
let running = true;

function toggleMode() {
  mode = 1 - mode;
  for (const light of lights) {
    light.mode = mode;
    if (mode === 0) {
      light.caseMesh.material = light.caseMaterial;
    } else {
      light.caseMesh.material = light.blackMaterial;
    }
  }
  if (mode === 0) {
    cube.material = lightMaterial;
  } else {
    cube.material = slitMaterial;
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    renderer.domElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
  if (e.code === "KeyM") {
    toggleMode();
  }
  if (e.code === "KeyF") {
    toggleFullscreen();
  }
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  running = !running;
});

document.querySelector("#toggleBtn").addEventListener("click", (e) => {
  toggleMode();
});

document.querySelector("#fullscreenBtn").addEventListener("click", (e) => {
  toggleFullscreen();
});

const tmp = new Vector3();

let prevTime = performance.now();
let time = 0;

function render() {
  const t = performance.now();
  const dt = t - prevTime;
  prevTime = t;

  if (running) {
    time += dt;
  }

  for (const light of lights) {
    light.update(time);
  }

  if (mode === 1) {
    cube.material.uniforms.light1Pos.value.copy(lights[0].position);
    tmp.set(0, 0, -1).applyMatrix4(lights[0].source.matrix);
    cube.material.uniforms.light1Dir.value.copy(tmp);
    cube.material.uniforms.light1Color.value = lights[0].color;

    cube.material.uniforms.light2Pos.value.copy(lights[1].position);
    tmp.set(0, 0, -1).applyMatrix4(lights[1].source.matrix);
    cube.material.uniforms.light2Dir.value.copy(tmp);
    cube.material.uniforms.light2Color.value = lights[1].color;

    cube.material.uniforms.light3Pos.value.copy(lights[2].position);
    tmp.set(0, 0, -1).applyMatrix4(lights[2].source.matrix);
    cube.material.uniforms.light3Dir.value.copy(tmp);
    cube.material.uniforms.light3Color.value = lights[2].color;

    cube.material.uniforms.time.value = time;
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
