import { Node } from "./Node.js";
import { Spring } from "./Spring.js";
import { Vector3 } from "../third_party/three.module.js";

const f = new Vector3();
const d = new Vector3();

class SpringSystem {
  constructor() {
    this.nodes = [];
    this.springs = [];
  }

  connect(a, b, stiffness) {
    const spring = new Spring(a, b, stiffness);
    this.springs.push(spring);
    return spring;
  }

  connectIdx(a, b, stiffness) {
    return this.connect(this.nodes[a], this.nodes[b], stiffness);
  }

  addNode(x, y, z = 0) {
    const n = new Node(x, y, z);
    this.nodes.push(n);
    return n;
  }

  calculateForces() {
    for (const node of this.nodes) {
      node.resetForces();
      node.calcForces();
    }

    for (const spring of this.springs) {
      const a = spring.a;
      const b = spring.b;
      d.copy(a.position).sub(b.position);
      const len = Math.max(d.length(), 0.0001);

      f.x = spring.spring * (len - spring.restingLength);
      f.x += (spring.damping * (a.velocity.x - b.velocity.x) * d.x) / len;
      f.x *= -d.x / len;

      f.y = spring.spring * (len - spring.restingLength);
      f.y += (spring.damping * (a.velocity.y - b.velocity.y) * d.y) / len;
      f.y *= -d.y / len;

      f.z = spring.spring * (len - spring.restingLength);
      f.z += (spring.damping * (a.velocity.z - b.velocity.z) * d.z) / len;
      f.z *= -d.z / len;

      a.addForce(f);
      b.addForce(f.multiplyScalar(-1));
    }
  }

  calculateDerivatives() {
    for (const node of this.nodes) {
      if (!node.fixed) {
        node.dPdt.copy(node.velocity);
        node.dVdt.copy(node.force.divideScalar(node.mass));
      }
    }
  }

  update(dt) {
    this.calculateForces();
    this.calculateDerivatives();
    for (const node of this.nodes) {
      node.position.add(node.dPdt.multiplyScalar(dt));
      node.velocity.add(node.dVdt.multiplyScalar(dt));
    }
  }
}

export { SpringSystem };
