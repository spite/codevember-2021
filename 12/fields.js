import { Vector3, Vector2 } from "../third_party/three.module.js";
import { perlin3 } from "../third_party/perlin.js";
import { clamp, randomInRange } from "../modules/Maf.js";

function sdTorus(p, t) {
  const pp = new Vector2(p.x, p.z);
  const q = new Vector2(pp.length() - t.x, p.y);
  return q.length() - t.y;
}

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
  map(data, width, height, depth, (p) => {
    p.multiplyScalar(s);
    return perlin(p.x, p.y, p.z);
  });
}

function Goursat(p) {
  return (
    Math.pow(p.x, 4) +
    Math.pow(p.y, 4) +
    Math.pow(p.z, 4) -
    1.5 * (p.x * p.x + p.y * p.y + p.z * p.z) +
    1
  );
}

function generateGoursat(data, width, height, depth) {
  map(data, width, height, depth, (p) => {
    p.multiplyScalar(3.5);
    return 0.5 - Goursat(p);
  });
}

function generateTorus(data, width, height, depth) {
  const t = new Vector3(3, 0.5);
  map(data, width, height, depth, (p) => {
    p.multiplyScalar(10);
    return 1 - sdTorus(p, t);
  });
}

function generateSphere(data, width, height, depth) {
  map(data, width, height, depth, (p) => {
    return clamp(2 - (p.length() - 1), 0, 1);
  });
}

export { generatePerlin, generateGoursat, generateTorus, generateSphere };
