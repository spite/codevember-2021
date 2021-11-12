import {
  IcosahedronBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector2,
  Color,
  Vector3,
} from "../third_party/three.module.js";
import { MeshLine, MeshLineMaterial } from "../modules/MeshLine.js";
import { Easings } from "../modules/easings.js";
import { randomInRange, lerp } from "../modules/Maf.js";
import { natural } from "../modules/palettes.js";
import { GradientLinear } from "../modules/gradient-linear.js";

const gradient = new GradientLinear(natural);

class Trail {
  constructor(width = 1, length = 10) {
    this.life = 0;

    this.color = new Color();

    this.colorOffset = Math.random() * Math.PI * 2;
    this.colorTime = Math.random() * Math.PI * 2;
    this.colorSpeed = randomInRange(0.9, 1.1);

    const endGeo = new IcosahedronBufferGeometry(width, 1);
    const endMat = new MeshBasicMaterial({
      color: this.color,
      wireframe: !true,
    });
    this.head = new Mesh(endGeo, endMat);
    this.tail = new Mesh(endGeo, endMat);

    this.trail = new MeshLine();

    const lineMaterial = new MeshLineMaterial({
      lineWidth: 0.65 * width,
      wireframe: !true,
      color: this.color,
      sizeAttenuation: true,
      resolution: new Vector2(window.innerWidth, window.innerHeight),
    });
    this.trailMesh = new Mesh(this.trail, lineMaterial);

    this.trailLength = length;
    this.points = [];
    for (let i = 0; i < this.trailLength; i++) {
      this.points.push(new Vector3(0, 0, 0));
    }
    this.trail.setPoints(this.points);

    this.prevTime = performance.now() / 1000;
  }

  setSize(w, h) {
    this.trailMesh.material.uniforms.resolution.value.set(w, h);
  }

  update(t, t0, t1, fn) {
    const ct = t / 1000;
    const dt = ct - this.prevTime;
    this.prevTime = ct;
    this.life += dt;
    this.colorTime += dt / 10;
    const c = gradient.getAt(
      0.5 + 0.5 * Math.cos(this.colorTime * this.colorSpeed + this.colorOffset)
    );
    this.color.copy(c);
    this.head.material.color.copy(c);

    for (let i = 0; i < this.trailLength; i++) {
      const t = lerp(t0, t1, i / this.trailLength);
      fn(t, this.points[i]);
    }
    this.trail.setPoints(this.points);
    this.head.position.copy(this.points[0]);
    this.tail.position.copy(this.points[this.points.length - 1]);
  }
}

export { Trail };
