import { Vector3 } from "../third_party/three.module.js";

class Particle {
  constructor(mass = 1) {
    this.id = 1;

    this._mass = 0;
    this._massInv = 0;
    this.mass = mass;

    this._radius = 0;
    this._radiusSq = 0;
    this.radius = 1;

    this.fixed = false;
    this.behaviours = [];
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.acceleration = new Vector3();
    this.previous = {
      position: new Vector3(),
      velocity: new Vector3(),
      acceleration: new Vector3(),
    };
  }

  moveTo(position) {
    this.position.copy(position);
    this.previous.position.copy(position);
  }

  set mass(mass) {
    this._mass = mass;
    this._massInv = 1 / this.mass;
  }

  get mass() {
    return this._mass;
  }

  set radius(radius) {
    this._radius = radius;
    this._radiusSq = radius ** 2;
  }

  get radius() {
    return this._radius;
  }

  update(dt, index) {
    if (!this.fixed) {
      for (const behaviour of this.behaviours) {
        behaviour.apply(this, dt, index);
      }
    }
  }
}

export { Particle };
