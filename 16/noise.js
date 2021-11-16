import { perlin3 } from "../third_party/perlin.js";
import { Vector3 } from "../third_party/three.module.js";

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

function generatePerlin(data, width, height, depth, scale) {
  map(data, width, height, depth, (p) => {
    p.multiplyScalar(scale);
    return perlin(p.x, p.y, p.z);
  });
}

export { generatePerlin };
