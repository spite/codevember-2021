import { Vector3 } from "../third_party/three.module.js";
import { Behaviour } from "./Behaviour.js";

class Attraction extends Behaviour {
  constructor(target = new Vector3(0, 0, 0), radius = 1000, strength = 100) {
    super();
    this.target = target;
    this.strength = strength;
    this._delta = new Vector3(0, 0, 0);
    this._radius = 0;
    this.radius = radius;
  }

  set radius(radius) {
    this._radius = radius;
    this._radiusSq = radius ** 2;
  }

  apply(particle, dt, index) {
    this._delta.copy(this.target).sub(particle.position);
    const distSq = this._delta.lengthSq();
    if (distSq < this._radiusSq && distSq > 0.000001) {
      this._delta.normalize().multiplyScalar(1 - distSq / this._radiusSq);
      particle.acceleration.add(this._delta.multiplyScalar(this.strength));
    }
  }
}

export { Attraction };
