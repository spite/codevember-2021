import { Vector3, Matrix4 } from "../third_party/three.module.js";
import { perlin3 } from "../third_party/perlin.js";
import { DisplacedTorusGeometry } from "./DisplacedTorusGeometry.js";

function bump(x, y, z, seed) {
  return perlin3(x + seed, y, z);
}

const normal = new Vector3();

function displace(p, amount, seed) {
  normal.copy(p);
  const n = amount * bump(p.x, p.y, p.z, seed);
  normal.multiplyScalar(1 + 0.1 * n);
  p.add(normal);
}

function createDonutGeometry(outerRadius, innerRadius, seed) {
  const geometry = new DisplacedTorusGeometry(
    outerRadius,
    innerRadius,
    36,
    50,
    undefined,
    (p) => displace(p, 1, seed)
  );
  const rot = new Matrix4().makeRotationX(-Math.PI / 2);
  geometry.applyMatrix4(rot);
  return geometry;
}

export { createDonutGeometry };
