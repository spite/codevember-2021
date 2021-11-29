import { randomInRange } from "../modules/Maf.js";
import { Vector3 } from "../third_party/three.module.js";

const tmp = new Vector3();

class Node {
  constructor(px, py, pz, maxForce, maxSpeed) {
    this.position = new Vector3(px, py, pz, maxForce, maxSpeed);
    this.velocity = new Vector3(
      randomInRange(-1, 1),
      0, //randomInRange(-1, 1),
      randomInRange(-1, 1)
    );
    this.acceleration = new Vector3(0, 0, 0);
    this.maxForce = maxForce;
    this.maxSpeed = maxSpeed;
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  update() {
    this.acceleration.y = 0;
    this.velocity.add(this.acceleration);
    this.velocity.y = 0;
    this.velocity.clampScalar(0, this.maxSpeed);
    this.position.add(this.velocity);
    this.position.y = 0;
    this.acceleration.set(0, 0, 0);
  }

  seek(target, f) {
    tmp.copy(target).sub(this.position).setLength(this.maxSpeed);
    f.copy(tmp).sub(this.velocity);
    f.clampScalar(0, this.maxForce);
  }
}

class DifferentialLine {
  constructor() {
    this.maxSpeed = 0.2;
    this.maxForce = 0.02;
    this.separation = 2;
    this.separation2 = this.separation ** 2;
    this.cohesion = 1;
    this.maxEdgeLen = 2;

    this.nodes = [];
    this.separationForces = [];
    this.cohesionForces = [];
  }

  appendNode(node) {
    this.nodes.push(node);
    this.separationForces.push(new Vector3(0, 0, 0));
    this.cohesionForces.push(new Vector3(0, 0, 0));
  }

  insertNode(node, index) {
    this.nodes.splice(index, 0, node);
    this.separationForces.push(new Vector3(0, 0, 0));
    this.cohesionForces.push(new Vector3(0, 0, 0));
  }

  step() {
    this.differentiate();
    this.grow();
  }

  differentiate() {
    this.calcSeparationForces();
    // this.calcCohesionForces();

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const separation = this.separationForces[i];
      const cohesion = this.cohesionForces[i];
      separation.multiplyScalar(this.cohesion);
      node.applyForce(separation);
      node.applyForce(cohesion);
      node.update();
    }
  }

  grow() {
    for (let i = 0; i < this.nodes.length - 1; i++) {
      const a = this.nodes[i];
      const b = this.nodes[i + 1];
      const d = tmp.copy(a.position).distanceTo(b.position);
      if (d > this.maxEdgeLen) {
        tmp.copy(a.position).lerp(b.position, 0.5);
        const node = new Node(
          tmp.x,
          tmp.y,
          tmp.z,
          this.maxForce,
          this.maxSpeed
        );
        this.insertNode(node, i + 1);
      }
    }
  }

  calcSeparationForces() {
    for (const f of this.separationForces) {
      f.set(0, 0, 0);
    }

    const neighbours = new Array(this.nodes.length).fill(0);

    const f = new Vector3();

    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodes[i];
      const force = this.separationForces[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const b = this.nodes[j];
        this.calcSeparationForce(a, b, f);
        if (f.length()) {
          force.add(f);
          this.separationForces[j].sub(f);
          neighbours[i]++;
          neighbours[j]++;
        }
      }

      if (neighbours[i] > 0) {
        force.divideScalar(neighbours[i]);
      }
      if (force.length() > 0) {
        force.setLength(this.maxSpeed);
        force.sub(a.velocity);
        force.clampScalar(0, this.maxForce);
      }
    }
  }

  calcSeparationForce(a, b, f) {
    f.set(0, 0, 0);

    tmp.copy(a.position).sub(b.position);
    const d = tmp.length();
    if (d && d < this.separation) {
      tmp.normalize().divideScalar(d);
      f.add(tmp);
    }
  }

  calcCohesionForces() {
    for (const f of this.cohesionForces) {
      f.set(0, 0, 0);
    }

    const size = this.nodes.length;
    for (let i = 0; i < size; i++) {
      tmp.set(0, 0, 0);
      if (i != 0 && i != size - 1) {
        tmp.add(this.nodes[i - 1].position).add(this.nodes[i + 1].position);
      } else if (i === 0) {
        tmp.add(this.nodes[size - 1].position).add(this.nodes[i + 1].position);
      } else if (i === size - 1) {
        tmp.add(this.nodes[i - 1].position).add(this.nodes[0].position);
      }
      tmp.divideScalar(2);
      this.nodes[i].seek(tmp, this.cohesionForces[i]);
    }
  }
}

export { DifferentialLine, Node };
