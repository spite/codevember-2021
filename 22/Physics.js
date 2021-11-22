import { Euler } from "./Euler.js";

class Physics {
  constructor(integrator = new Euler()) {
    this.integrator = integrator;
    this.timestep = 1 / 60;
    this.viscosity = 0.0025;
    this.behaviours = [];
    this.time = 0;
    this._step = 0;
    this.clock = null;
    this.buffer = 0;
    this.maxSteps = 4;
    this.particles = [];
    this.springs = [];
  }

  integrate(dt) {
    const drag = 1 - this.viscosity;

    for (let [index, particle] of this.particles.entries()) {
      for (const behaviour of this.behaviours) {
        behaviour.apply(particle, dt, index);
      }
      particle.update(dt, index);
    }

    this.integrator.integrate(this.particles, dt, drag);

    for (const spring of this.springs) {
      spring.apply();
    }
  }

  step(dt) {
    this.clock = this.clock || performance.now();

    const time = performance.now();
    let delta = dt || time - this.clock;

    if (delta < 0) {
      return;
    }

    delta *= 0.001;

    this.clock = time;
    this.buffer += delta;

    let i = 0;

    while (this.buffer >= this.timestep && ++i < this.maxSteps) {
      this.integrate(this.timestep);
      this.buffer -= this.timestep;
      this.time += this.timestep;
    }

    this._step = performance.now() - time;
  }

  destroy() {
    this.integrator = null;
    this.particles.length = 0;
    this.particles = null;
    this.springs.length = 0;
    this.springs = null;
  }
}

export { Physics };
