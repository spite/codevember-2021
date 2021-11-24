import { Vector3 } from "../third_party/three.module.js";
import { perlin3 } from "../third_party/perlin.js";
import { randomInRange } from "../modules/Maf.js";

function perlin(x, y, z) {
  return 0.5 + 0.5 * perlin3(x, y, z);
}

function map(data, width, height, depth, fn) {
  let ptr = 0;
  const p = new Vector3();
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        p.set(x / width - 0.5, y / height - 0.5, z / depth - 0.5);
        data[ptr] = fn(p);
        ptr++;
      }
    }
  }
}

function generatePerlin(data, width, height, depth) {
  const s = randomInRange(3, 9);
  const ox = randomInRange(-100, 100);
  const oy = randomInRange(-100, 100);
  const oz = randomInRange(-100, 100);
  map(data, width, height, depth, (p) => {
    p.multiplyScalar(s);
    return perlin(p.x + ox, p.y + oy, p.z + oz);
  });
}

export { generatePerlin };
