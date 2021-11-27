import { randomInRange } from "../modules/Maf.js";
import { Vector3 } from "../third_party/three.module.js";

const v1 = new Vector3();
const v2 = new Vector3();

class WorleyNoise {
  constructor(numPoints) {
    this._points = [];

    for (let i = 0; i < numPoints; i++) {
      this._points.push(
        new Vector3(
          randomInRange(0, 1),
          randomInRange(0, 1),
          randomInRange(0, 1)
        )
      );
    }
  }

  getEuclidean(coord, k) {
    return this._calculateValue(coord, k, euclidean);
  }

  getManhattan(coord, k) {
    return this._calculateValue(coord, k, manhattan);
  }

  _calculateValue(coord, k, distFn) {
    const res = [];
    for (let i = 0; i < this._points.length; i++) {
      const p = this._points[i];
      const dist = distFn(coord.x - p.x, coord.y - p.y, coord.z - p.z);
      res.push({ id: i, dist });
    }

    const sorted = res.sort((a, b) => a.dist - b.dist);

    const a = this._points[sorted[0].id];
    const b = this._points[sorted[1].id];

    v1.copy(coord).sub(a.clone().add(b).divideScalar(2));
    v2.copy(b).sub(a).normalize();
    const d = v1.dot(v2);

    return { d, id: sorted[0].id };
  }
}

const euclidean = (dx, dy, dz) => dx * dx + dy * dy + dz * dz;
const manhattan = (dx, dy, dz) => Math.abs(dx) + Math.abs(dy) + Math.abs(dz);

export { WorleyNoise };
