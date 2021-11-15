import {
  ArrowHelper,
  BoxBufferGeometry,
  Group,
  Mesh,
  MeshNormalMaterial,
  Vector3,
} from "../third_party/three.module.js";
import { SpringSystem } from "./SpringSystem.js";

const d = new Vector3();

class Distort {
  constructor(geometry) {
    const width = 5;
    const height = 5;
    const depth = 5;

    this.geometry = geometry;
    this.group = new Group();
    this.pointsMap = new Map();

    this.boxGeometry = new BoxBufferGeometry(
      1,
      1,
      1,
      width - 1,
      height - 1,
      depth - 1
    );
    this.mesh = new Mesh(
      this.boxGeometry,
      new MeshNormalMaterial({ wireframe: true })
    );
    // this.group.add(this.mesh);

    this.points = [];

    this.springSystem = new SpringSystem();

    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const n = this.springSystem.addNode(
            x / (width - 1) - 0.5,
            y / (height - 1) - 0.5,
            z / (depth - 1) - 0.5
          );
          const m = new Mesh(
            new BoxBufferGeometry(0.01, 0.01, 0.01),
            new MeshNormalMaterial()
          );
          n.mesh = m;
          this.group.add(m);
          this.points.push(m);
          this.pointsMap.set(m, n);
        }
      }
    }

    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x < width - 1) {
            const a = z * width * height + y * width + x;
            const b = a + 1;
            this.addSpring(a, b, 2);
          }
          if (y < height - 1) {
            const a = z * width * height + y * width + x;
            const b = a + height;
            this.addSpring(a, b, 2);
          }
          if (z < depth - 1) {
            const a = z * width * height + y * width + x;
            const b = a + width * height;
            this.addSpring(a, b, 2);
          }
          if (x < width - 1 && y < height - 1 && z < depth - 1) {
            let a = z * width * height + y * width + x;
            let b = (z + 1) * width * height + (y + 1) * width + (x + 1);
            this.addSpring(a, b, 1);

            a = z * width * height + (y + 1) * width + x;
            b = (z + 1) * width * height + y * width + x + 1;
            this.addSpring(a, b, 1);

            a = (z + 1) * width * height + y * width + x;
            b = z * width * height + (y + 1) * width + (x + 1);
            this.addSpring(a, b, 1);

            a = (z + 1) * width * height + (y + 1) * width + x;
            b = z * width * height + y * width + (x + 1);
            this.addSpring(a, b, 1);
          }
        }
      }
    }
  }

  addSpring(a, b, stiffness = 1) {
    const s = this.springSystem.connectIdx(a, b, stiffness);
    const dir = s.b.position.clone().sub(s.a.position);
    s.mesh = new ArrowHelper(dir, s.a.position.clone(), dir.length(), 0xff00ff);
    this.group.add(s.mesh);
  }

  addImpulse(p) {
    for (const node of this.springSystem.nodes) {
      d.copy(node.position);
      node.addImpulse(p.x, p.y, p.z);
    }
  }

  update(dt) {
    this.springSystem.update(dt);
    for (const node of this.springSystem.nodes) {
      node.mesh.position.copy(node.position);
    }
    for (const spring of this.springSystem.springs) {
      spring.mesh.position.copy(spring.a.position);
      const dir = spring.b.position.clone().sub(spring.a.position);
      spring.mesh.setLength(dir.length(), 0.025, 0.01);
      spring.mesh.setDirection(dir.normalize());
    }
  }
}

export { Distort };
