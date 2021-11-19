import {
  Vector3 as Vector3Base,
  Vector2,
} from "../third_party/three.module.js";
import { perlin3 } from "../third_party/perlin.js";
import { clamp, mix, mod, TAU, randomInRange } from "../modules/Maf.js";

function sabs(p) {
  return Math.sqrt(p * p + 2e-3);
}

function smin(a, b) {
  return (a + b - sabs(a - b)) * 0.5;
}

function smax(a, b) {
  return (a + b + sabs(a - b)) * 0.5;
}

class Vector3 extends Vector3Base {
  abs() {
    this.x = Math.abs(this.x);
    this.y = Math.abs(this.y);
    this.z = Math.abs(this.z);
    return this;
  }

  sabs() {
    this.x = sabs(this.x);
    this.y = sabs(this.y);
    this.z = sabs(this.z);
    return this;
  }

  smin(a, b) {
    const sabs = a.clone().sub(b).sabs();
    this.x = (a.x + b.x - sabs.x) * 0.5;
    this.y = (a.y + b.y - sabs.y) * 0.5;
    this.z = (a.z + b.z - sabs.z) * 0.5;
    return this;
  }

  smax(a, b) {
    const sabs = a.clone().sub(b).sabs();
    this.x = (a.x + b.x + sabs.x) * 0.5;
    this.y = (a.y + b.y + sabs.y) * 0.5;
    this.z = (a.z + b.z + sabs.z) * 0.5;
    return this;
  }
}

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
  const ox = randomInRange(-100, 100);
  const oy = randomInRange(-100, 100);
  const oz = randomInRange(-100, 100);
  map(data, width, height, depth, (p) => {
    p.multiplyScalar(s);
    return perlin(p.x + ox, p.y + oy, p.z + oz);
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
    return 1 - (1.25 * p.length() - 0.05);
  });
}

function opSmoothUnion(d1, d2, k) {
  const h = clamp(0.5 + (0.5 * (d2 - d1)) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
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
    return 0.1 - hyperelliptic(p.multiplyScalar(3), f);
  });
}

function sdSphere(p, r) {
  return r - p.length();
}
function generateBlob(data, width, height, depth) {
  const r = 0.2;
  const spheres = [];
  for (let i = 0; i < 3; i++) {
    spheres.push({
      position: new Vector3(
        randomInRange(-r, r),
        randomInRange(-r, r),
        randomInRange(-r, r)
      ),
      radius: randomInRange(0.6, 0.7),
    });
  }
  const fn = (p) => {
    let res = 0;
    for (const sphere of spheres) {
      res = Math.max(
        res,
        sdSphere(p.clone().sub(sphere.position), sphere.radius)
      );
    }
    return res;
  };
  map(data, width, height, depth, (p) => {
    return fn(p);
  });
  blur3d(data);
  blur3d(data);
  blur3d(data);
}

const unit = new Vector3(1, 1, 1).normalize().multiplyScalar(2);

function icosa(p, r) {
  const G = Math.sqrt(5) * 0.5 + 0.5;
  const n = new Vector3(G, 1 / G, 0).normalize();
  let d = 0;
  p.sabs();
  d = smax(d, p.dot(n));
  d = smax(d, p.dot(n.clone().set(n.y, n.z, n.xx)));
  d = smax(d, p.dot(n.clone().set(n.z, n.x, n.y)));
  d = smax(d, p.dot(n.clone().set(n.x, n.z, n.y)));
  d = smax(d, p.dot(unit));
  return d - r;
}

const n4 = new Vector3(0.577, 0.577, 0.577);
const n5 = new Vector3(-0.577, 0.577, 0.577);
const n6 = new Vector3(0.577, -0.577, 0.577);
const n7 = new Vector3(0.577, 0.577, -0.577);
const n8 = new Vector3(0.0, 0.357, 0.934);
const n9 = new Vector3(0.0, -0.357, 0.934);
const n10 = new Vector3(0.934, 0.0, 0.357);
const n11 = new Vector3(-0.934, 0.0, 0.357);
const n12 = new Vector3(0.357, 0.934, 0.0);
const n13 = new Vector3(-0.357, 0.934, 0.0);

function icosahedral(p, e, r) {
  let s = Math.pow(Math.abs(p.dot(n4)), e);
  s += Math.pow(Math.abs(p.dot(n5)), e);
  s += Math.pow(Math.abs(p.dot(n6)), e);
  s += Math.pow(Math.abs(p.dot(n7)), e);
  s += Math.pow(Math.abs(p.dot(n8)), e);
  s += Math.pow(Math.abs(p.dot(n9)), e);
  s += Math.pow(Math.abs(p.dot(n10)), e);
  s += Math.pow(Math.abs(p.dot(n11)), e);
  s += Math.pow(Math.abs(p.dot(n12)), e);
  s += Math.pow(Math.abs(p.dot(n13)), e);
  s = Math.pow(s, 1 / e);
  return s - r;
}

function generateIcosahedron(data, width, height, depth) {
  map(data, width, height, depth, (p) => {
    const res = -icosahedral(p, 1.2, 2);
    // console.log(res);
    return res;
  });
}

export {
  // generateIcosahedron,
  generateBlob,
  generateTorusKnot,
  generateHyperelliptic,
  generatePerlin,
  generateGoursat,
  generateTorus,
  generateSphere,
};
