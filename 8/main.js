import {
  scene,
  controls,
  renderer,
  addUpdate,
  camera,
} from "../modules/renderer.js";
import { Ribbon } from "./ribbon.js";

const ribbons = [];
for (let i = 0; i < 1; i++) {
  const ribbon = new Ribbon();
  scene.add(ribbon);
  ribbons.push(ribbon);
}

camera.position.set(4, 4, 4);

let running = !true;

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    running = !running;
  }
});

function render() {
  if (running) {
    for (const ribbon of ribbons) {
      ribbon.update();
    }
  }
  // camera.lookAt(ribbons[0].target);
  renderer.render(scene, camera);
  renderer.setAnimationLoop(render);
}

render();
