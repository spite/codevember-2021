class Spring {
  constructor(a, b, stiffness = 0.5) {
    this.a = a;
    this.b = b;
    this.spring = stiffness;
    this.damping = 0.5;
    this.restingLength = a.position.clone().distanceTo(b.position) * 1;
    this.selected = false;
  }
}

export { Spring };
