import { Vector3 } from "../third_party/three.module.js";
import { Integrator } from "./Integrator.js";

const velocity = new Vector3();

class Euler extends Integrator {
  integrate(particles, dt, drag) {
    for (const particle of particles) {
      if (particle.fixed) {
        continue;
      }
      particle.previous.position.copy(particle.position);
      particle.acceleration.multiplyScalar(particle._massInv);
      velocity.copy(particle.velocity);
      particle.velocity.add(particle.acceleration.multiplyScalar(dt));
      particle.position.add(particle.velocity.multiplyScalar(dt));
      if (drag) {
        particle.velocity.multiplyScalar(drag);
      }
      particle.acceleration.set(0, 0, 0);
    }
  }
}

export { Euler };
