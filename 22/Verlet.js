import { Vector3 } from "../third_party/three.module.js";
import { Integrator } from "./Integrator.js";

const position = new Vector3();

class Verlet extends Integrator {
  integrate(particles, dt, drag) {
    const dtSq = dt * dt;

    for (const p of particles) {
      if (p.fixed) {
        continue;
      }

      p.acceleration.multiplyScalar(p._massInv);

      p.velocity.copy(p.position).sub(p.previous.position);

      if (drag) {
        p.velocity.multiplyScalar(drag);
      }

      position
        .copy(p.position)
        .add(p.velocity.add(p.acceleration.multiplyScalar(dtSq)));

      p.previous.position.copy(p.position);

      p.position.copy(position);

      p.acceleration.set(0, 0, 0);
    }
  }
}

export { Verlet };
