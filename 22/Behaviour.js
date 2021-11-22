let GUID = 0;

class Behaviour {
  constructor() {
    this.GUID = GUID++;
    this.interval = 1;
  }

  apply(p, dt, index) {
    const id = `__behaviour${this.GUID}`;
    if (!p[id]) {
      p[id] = { counter: 0 };
    }
    p[id].counter++;
  }
}

export { Behaviour };
