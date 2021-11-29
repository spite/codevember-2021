import { randomInRange } from "../modules/Maf.js";
import { Vector3 } from "../third_party/three.module.js";

class Poisson3D {
  constructor(width = 512, height = 512, depth = 512, r = 4, k = 30) {
    this.r = r;
    this.k = k;
    this.cellSize = this.r / Math.sqrt(2); // 2 = dimensions
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.cols = Math.max(1, Math.round(this.width / this.cellSize));
    this.rows = Math.max(1, Math.round(this.height / this.cellSize));
    this.slices = Math.max(1, Math.round(this.depth / this.cellSize));
    this.grid = [];
    this.activeList = [];
    for (let i = 0; i < this.rows * this.cols * this.slices; i++) {
      this.grid[i] = null;
    }

    const x = randomInRange(-0.5 * this.width, 0.5 * this.width);
    const y = randomInRange(-0.5 * this.width, 0.5 * this.height);
    const z = randomInRange(-0.5 * this.width, 0.5 * this.depth);
    const p = new Vector3(x, y, z);
    p.normalize().multiplyScalar(0.5 * this.width);
    const cell = this.cellIndex(p.x, p.y, p.z);
    this.grid[cell.index] = p;
    this.activeList.push(p);
  }

  cellIndex(x, y, z) {
    const col = Math.floor((x + 0.5 * this.width) / this.cellSize);
    const row = Math.floor((y + 0.5 * this.height) / this.cellSize);
    const slice = Math.floor((z + 0.5 * this.height) / this.cellSize);
    return {
      col,
      row,
      slice,
      index: col + row * this.cols + slice * this.rows * this.cols,
    };
  }

  calculate() {
    while (this.activeList.length) {
      this.calculatePoint();
    }
    return this.grid.filter((v) => v !== null);
  }

  calculatePoint() {
    //console.log(this.activeList.length);
    if (this.activeList.length > 0) {
      const randIndex = Math.floor(Math.random() * this.activeList.length);
      const pos = this.activeList[randIndex];

      let found = false;
      for (let n = 0; n < this.k; n++) {
        const sample = new Vector3();
        sample.set(
          randomInRange(-1, 1),
          randomInRange(-1, 1),
          randomInRange(-1, 1)
        );
        sample.setLength(randomInRange(this.r, 2 * this.r));
        sample.add(pos);
        sample.normalize();
        sample.multiplyScalar(0.5 * this.width);

        const cell = this.cellIndex(sample.x, sample.y, sample.z);
        if (
          cell.col >= -1 &&
          cell.row >= -1 &&
          cell.slice >= -1 &&
          cell.col <= this.cols &&
          cell.row <= this.rows &&
          cell.slice <= this.slices &&
          this.grid[
            cell.col + cell.row * this.cols + cell.slice * this.rows * this.cols
          ] == null
        ) {
          let ok = true;
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              for (let k = -1; k <= 1; k++) {
                const index =
                  cell.col +
                  i +
                  (cell.row + j) * this.cols +
                  (cell.slice + k) * this.cols * this.rows;
                const neighbour = this.grid[index];
                if (neighbour) {
                  const d = neighbour.distanceTo(sample);
                  if (d < this.r) {
                    ok = false;
                  }
                }
              }
            }
          }
          if (ok) {
            found = true;
            this.grid[
              cell.col +
                cell.row * this.cols +
                cell.slice * this.rows * this.cols
            ] = sample;
            this.activeList.push(sample);
          }
        }
      }
      if (!found) {
        this.activeList.splice(randIndex, 1);
      }
    }
  }
}

export { Poisson3D };
