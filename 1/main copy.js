import { scene, addUpdate } from "../modules/renderer.js";
import noise from "../third_party/perlin.js";
import {
  Mesh,
  MeshNormalMaterial,
  PlaneBufferGeometry,
} from "../third_party/three.module.js";

const plane = new PlaneBufferGeometry(10, 10, 100, 100);
const material = new MeshNormalMaterial({ wireframe: true });
const mesh = new Mesh(plane, material);
scene.add(mesh);

function fbm(x, y) {
  let value = 0;
  let amplitude = 1;
  for (let i = 0; i < 8; i++) {
    value += amplitude * Math.abs(noise.perlin2(x, y));
    x *= 2;
    y *= 2;
    amplitude *= 0.5;
  }
  return 2 * value - 1;
}

const offsetX = Math.random() * 1000 - 500;
const offsetY = Math.random() * 1000 - 500;

function distort() {
  const s = 50;
  const ss = 10;
  const positions = plane.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i + 1];
    const z = positions[i + 2];
    const n = fbm(x / ss + offsetX, y / ss + offsetY);
    x += n / s;
    y += n / s;
    positions[i] = x;
    positions[i + 1] = y;
  }
}

for (let i = 0; i < 100; i++) {
  distort();
}
plane.isBufferGeometry.computeVertexNormals();

function update() {
  console.log("update");
}

addUpdate(update);
