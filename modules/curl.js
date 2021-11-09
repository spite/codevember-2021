import { Vector3 } from "../third_party/three.module.js";
import { simplex3 } from "../third_party/perlin.js";
import { randomInRange } from "./Maf.js";

const generateNoiseFunction = () => {
  const a = randomInRange(-100, 100);
  const b = randomInRange(-100, 100);
  const c = randomInRange(-100, 100);
  const d = randomInRange(-100, 100);
  const e = randomInRange(-100, 100);
  const f = randomInRange(-100, 100);
  console.log(`const func = seedFunc(${a},${b},${c},${d},${e},${f});`);
  return function (v) {
    const s = simplex3(v.x, v.y, v.z);
    const s1 = simplex3(v.y + a, v.z + b, v.x + c);
    const s2 = simplex3(v.z + c, v.x + d, v.y + f);
    return new Vector3(s, s1, s2);
  };
};

const seedFunc = (a, b, c, d, e, f) => {
  return function (v) {
    const s = simplex3(v.x, v.y, v.z);
    const s1 = simplex3(v.y + a, v.z + b, v.x + c);
    const s2 = simplex3(v.z + c, v.x + d, v.y + f);
    return new Vector3(s, s1, s2);
  };
};

const noiseFunc0 = seedFunc(-19.1, 33.4, 47.2, 74.2, -124.5, 99.4);

const e = 0.1;
const dx = new Vector3(e, 0.0, 0.0);
const dy = new Vector3(0.0, e, 0.0);
const dz = new Vector3(0.0, 0.0, e);
const tmp = new Vector3();
const res = new Vector3();

const curl = (p, noiseFunc = noiseFunc0) => {
  const p_x0 = noiseFunc(tmp.copy(p).sub(dx));
  const p_x1 = noiseFunc(tmp.copy(p).add(dx));
  const p_y0 = noiseFunc(tmp.copy(p).sub(dy));
  const p_y1 = noiseFunc(tmp.copy(p).add(dy));
  const p_z0 = noiseFunc(tmp.copy(p).sub(dz));
  const p_z1 = noiseFunc(tmp.copy(p).add(dz));
  const x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  const y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  const z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
  const divisor = 1.0 / (2.0 * e);
  res.set(x, y, z).multiplyScalar(divisor).normalize();
  return res;
};

export { curl, generateNoiseFunction, seedFunc };
