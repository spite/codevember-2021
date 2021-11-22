import { Vector3 } from "../third_party/three.module.js";
import { Behaviour } from "./Behaviour.js";

const t = new Vector3();

class Collision extends Behaviour {
  constructor(useMass = true, callback = () => {}) {
    super();
    this.pool = [];
    this.useMass = useMass;
    this.callback = callback;
    this.delta = new Vector3(0, 0, 0);
  }

  apply(particle, dt, index) {
    for (let i = index; i < this.pool.length; i++) {
      const o = this.pool[i];
      if (o === particle) {
        continue;
      }
      this.delta.copy(o.position).sub(particle.position);
      const distSq = this.delta.lengthSq();
      const radii = particle.radius + o.radius;
      if (distSq <= radii ** 2) {
        const dist = Math.sqrt(distSq);
        const overlap = radii - dist + 0.005;
        const mt = particle.mass + o.mass;
        const r1 = this.useMass ? o.mass / mt : 0.5;
        const r2 = this.useMass ? particle.mass / mt : 0.5;
        this.delta.normalize();
        t.copy(this.delta).multiplyScalar(overlap * -r1);
        particle.position.add(t);
        o.position.add(this.delta.multiplyScalar(overlap * r2));

        this.callback(particle, o, overlap);
      }
    }
  }
}

export { Collision };
