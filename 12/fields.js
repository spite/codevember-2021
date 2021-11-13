import { Vector3, Vector2 } from "../third_party/three.module.js";
import { perlin3 } from "../third_party/perlin.js";
import { clamp, mod, TAU, randomInRange } from "../modules/Maf.js";

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
    return clamp(1 - (p.length() - 0.05), 0, 1);
  });
}

function rot2d(v, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Vector2(v.x * c - v.y * s, v.x * s + v.y * c);
}

function sdCircle(p, r) {
  return p.length() - r;
}

function sdBox2d(p, s) {
  p.x = Math.abs(p.x) - s.x;
  p.y = Math.abs(p.y) - s.y;
  p.x = Math.max(p.x, 0);
  p.y = Math.max(p.y, 0);
  return p.length() + Math.min(Math.max(p.x, p.y), 0);
}

function blur3d(field, width, height, depth, intensity = 1) {
  const fieldCopy = field.slice();
  const size = width;
  const size2 = width * height;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        const index = size2 * z + size * y + x;
        let val = fieldCopy[index];
        let count = 1;

        for (let x2 = -1; x2 <= 1; x2 += 2) {
          const x3 = x2 + x;
          if (x3 < 0 || x3 >= size) continue;

          for (let y2 = -1; y2 <= 1; y2 += 2) {
            const y3 = y2 + y;
            if (y3 < 0 || y3 >= size) continue;

            for (let z2 = -1; z2 <= 1; z2 += 2) {
              const z3 = z2 + z;
              if (z3 < 0 || z3 >= size) continue;

              const index2 = size2 * z3 + size * y3 + x3;
              const val2 = fieldCopy[index2];

              count++;
              val += (intensity * (val2 - val)) / count;
            }
          }
        }

        field[index] = val;
      }
    }
  }
}

function torusBox() {
  const r1 = randomInRange(1, 1.4);
  const r2 = randomInRange(0.1, 0.6);
  const pf = Math.round(Math.random() * 4 * 2) / 2;
  const oy = Math.random() * 0.5;
  const s = Math.sign(randomInRange(-1, 1));

  let shapeFn;
  // if (Math.random() < 0.5) {
  shapeFn = (p) => sdCircle(p, r2);
  // } else {
  //   const r3 = randomInRange(0.25, 0.4);
  //   const size = new Vector2(r2, r3);
  //   shapeFn = (p) => sdBox2d(p, size) - 0.1;
  // }

  return (p) => {
    const pp = new Vector2(p.x, p.z);
    const cp = new Vector2(pp.length() - r1, p.y);
    const a = s * Math.atan2(p.x, p.z);
    cp.copy(rot2d(cp, a * pf));
    cp.y = Math.abs(cp.y) - oy;
    let d = shapeFn(cp);
    return clamp(0.6 - d, 0, 1);
  };
}

function generateTorusKnot(data, width, height, depth) {
  const torusFn = torusBox();
  map(data, width, height, depth, (p) => {
    return torusFn(p.multiplyScalar(5.2));
  });
  blur(data, 1);
}

function hyperelliptic(p, f) {
  return (
    Math.pow(Math.pow(p.x, f) + Math.pow(p.y, f) + Math.pow(p.z, f), 1.0 / 6) -
    1.0
  );
}

function generateHyperelliptic(data, width, height, depth) {
  const f = 6 * ~~randomInRange(1, 10);
  map(data, width, height, depth, (p) => {
    return 0.8 - hyperelliptic(p.multiplyScalar(3), f);
  });
}

export {
  generateTorusKnot,
  generateHyperelliptic,
  generatePerlin,
  generateGoursat,
  generateTorus,
  generateSphere,
};
