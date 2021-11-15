import { Vector3 } from "../third_party/three.module.js";

class Node {
  constructor(x, y, z) {
    this.fixed = false;
    this.mass = 1;
    this.position = new Vector3(x, y, z);
    this.origin = this.position.clone();
    this.velocity = new Vector3(0, 0, 0);
    this.force = new Vector3(0, 0, 0);
    this.dPdt = new Vector3();
    this.dVdt = new Vector3();
    this.impulse = new Vector3(0, 0, 0);
  }

  hitTest(x, y) {
    const dx = this.position.x - x;
    const dy = this.position.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d < 10;
  }

  resetForces() {
    this.force.set(0, 0, 0);
    this.force.add(this.impulse);
    this.impulse.set(0, 0, 0);
  }

  calcForces() {
    /* Gravitation */
    // this.force.x += 0.98 * this.mass * 0;
    // this.force.y += 0.98 * this.mass * 1;
    // p[i].f.z += phys.gravitational * p[i].m * down.z;
    /* Viscous drag */
    this.force.x -= 0.1 * this.velocity.x;
    this.force.y -= 0.1 * this.velocity.y;
    this.force.z -= 0.1 * this.velocity.z;
    // p[i].f.z -= phys.viscousdrag * p[i].v.z;
  }

  addImpulse(x, y, z) {
    const dir = new Vector3().set(x, y, z).sub(this.position);
    if (dir.length() === 0) return;
    dir.clampLength(0, 10);
    // dir.normalize();
    const force = -1 / dir.length();
    this.impulse.copy(dir).normalize().multiplyScalar(force);
  }

  addForce(f) {
    this.force.add(f);
  }
}

export { Node };
