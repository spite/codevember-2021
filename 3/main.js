import { randomInRange, VERSION } from "../modules/Maf.js";
import {
  scene,
  controls,
  renderer,
  addUpdate,
  camera,
  addResize,
} from "../modules/renderer.js";
import {
  BufferGeometry,
  LineBasicMaterial,
  Line,
  Color,
  CatmullRomCurve3,
  TubeGeometry,
  IcosahedronBufferGeometry,
  Mesh,
  Vector2,
  PlaneBufferGeometry,
  Raycaster,
  MeshNormalMaterial,
  Vector3,
  BoxBufferGeometry,
  TextureLoader,
  ClampToEdgeWrapping,
} from "../third_party/three.module.js";
import { capture } from "../modules/capture.js";
import { MeshLine, MeshLineMaterial } from "../modules/MeshLine.js";
import { GradientLinear } from "../modules/gradient-linear.js";
import {
  warm,
  natural,
  natural2,
  circus,
  seaside,
} from "../modules/palettes.js";

const gradient = new GradientLinear(circus);

camera.position.set(20, 20, 20);
const boids = [];

class Boid {
  constructor() {
    this.position = new Vector3();
    this.velocity = new Vector3();
    this.acceleration = new Vector3();
    this.radius = randomInRange(0.8, 1.2);
    this.maxSpeed = randomInRange(0.1, 0.5) / this.radius;
    this.maxForce = randomInRange(0.004, 0.006) / this.radius;

    this.desired = new Vector3();
    this.accum = new Vector3();
    this.steer = new Vector3();
    this.diff = new Vector3();

    this.separateForce = new Vector3();
    this.alignForce = new Vector3();
    this.cohesionForce = new Vector3();
  }

  seek(target) {
    this.desired
      .copy(target)
      .sub(this.position)
      .normalize()
      .multiplyScalar(this.maxSpeed);
    this.steer
      .copy(this.desired)
      .sub(this.velocity)
      .clampLength(0, this.maxForce);
    return this.steer;
  }

  separate() {
    const desiredSeparation = 20;
    this.steer.set(0, 0, 0);
    let count = 0;
    for (const boid of boids) {
      const d = this.position.distanceTo(boid.position);
      if (d > 0 && d < desiredSeparation) {
        this.diff
          .copy(this.position)
          .sub(boid.position)
          .normalize()
          .divideScalar(d);
        this.steer.add(this.diff);
        count++;
      }
    }
    // for (const trail of trails) {
    //   for (const p of trail.points) {
    //     const d = this.position.distanceTo(p);
    //     if (d > 0 && d < desiredSeparation) {
    //       this.diff.copy(this.position).sub(p).normalize().divideScalar(d);
    //       this.steer.add(this.diff);
    //       count++;
    //     }
    //   }
    // }
    if (count > 0) {
      this.steer.divideScalar(count);
    }
    if (this.steer.length() > 0) {
      this.steer
        .normalize()
        .multiplyScalar(this.maxSpeed)
        .sub(this.velocity)
        .clampLength(0, this.maxForce);
    }
    this.separateForce.copy(this.steer);
  }

  align() {
    const distance = 10;
    this.steer.set(0, 0, 0);
    this.accum.set(0, 0, 0);
    let count = 0;
    for (const boid of boids) {
      const d = this.position.distanceTo(boid.position);
      if (d > 0 && d < distance) {
        this.accum.add(boid.velocity);
        count++;
      }
    }
    if (count > 0) {
      this.accum.divideScalar(count).normalize().multiplyScalar(this.maxSpeed);
      this.steer
        .copy(this.accum)
        .sub(this.velocity)
        .clampLength(0, this.maxForce);
    }
    this.alignForce.copy(this.steer);
  }

  cohesion() {
    let distance = 50;
    this.accum.set(0, 0, 0);
    let count = 0;
    for (const boid of boids) {
      const d = this.position.distanceTo(boid.position);
      if (d > 0 && d < distance) {
        this.accum.add(boid.position);
        count++;
      }
    }
    if (count > 0) {
      this.accum.divideScalar(count);
    }
    this.cohesionForce.copy(this.seek(this.accum));
  }

  update() {
    this.separate();
    this.align();
    this.cohesion();

    this.acceleration.add(this.separateForce);
    this.acceleration.add(this.alignForce);
    this.acceleration.add(this.cohesionForce);

    this.seek(center);
    this.acceleration.add(this.steer);

    this.velocity.add(this.acceleration);
    this.velocity.clampLength(0, this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.multiplyScalar(0);
  }
}

const loader = new TextureLoader();
const stroke = loader.load("../assets/brush2.png");
stroke.wrapS = stroke.wrapT = ClampToEdgeWrapping;

class Trail {
  constructor(boid) {
    this.boid = boid;
    const length = Math.round(randomInRange(10, 100));
    this.points = [];
    for (let i = 0; i < length; i++) {
      this.points.push(new Vector3());
    }
    this.ptr = 0;

    this.line = new MeshLine();
    const material = new MeshLineMaterial({
      lineWidth: randomInRange(1, 2),
      color: gradient.getAt(Math.random()),
      alphaMap: stroke,
      useAlphaMap: 1,
      transparent: true,
      alphaTest: 0.5,
      resolution: new Vector2(window.innerWidth, window.innerHeight),
    });
    this.mesh = new Mesh(this.line, material);
    // this.geometry = new BufferGeometry();
    // const material = new LineBasicMaterial({ color: 0xff00ff });
    // const material = new MeshNormalMaterial({ wireframe: true });
    // const path = new CatmullRomCurve3([]);
    // this.geometry = new BufferGeometry(); //new TubeGeometry(path, 20, 2, 8, false);
    // this.mesh = new Mesh(this.geometry, material);
  }

  update() {
    this.points[this.ptr].copy(this.boid.position);
    this.ptr = (this.ptr + 1) % this.points.length;

    const pts = [];
    for (let i = 0; i < this.points.length; i++) {
      const ptr = (this.ptr + i) % this.points.length;
      pts.push(this.points[ptr]);
    }
    this.line.setPoints(pts);
    // this.geometry.setFromPoints(pts);

    // const path = new CatmullRomCurve3(pts);
    // this.geometry = new TubeGeometry(path, 10, 0.1, 8, false);
    // this.mesh.geometry = this.geometry;
    // this.geometry.needsUpdate = true;
  }
}

const mat = new MeshNormalMaterial();

const trails = [];

for (let i = 0; i < 30; i++) {
  const boid = new Boid();
  boid.position.set(
    randomInRange(-20, 20),
    randomInRange(-20, 20),
    randomInRange(-20, 20)
  );
  boids.push(boid);
  const mesh = new Mesh(new IcosahedronBufferGeometry(boid.radius, 3), mat);
  mesh.position.copy(boid.position);
  // scene.add(mesh);
  boid.mesh = mesh;

  const trail = new Trail(boid);
  trails.push(trail);
  scene.add(trail.mesh);
}

const center = new Vector3(0, 0);
let frames = 0;

const raycaster = new Raycaster();
const mouse = new Vector2(100, 100);
const plane = new Mesh(
  new PlaneBufferGeometry(100, 100),
  new MeshNormalMaterial()
);
plane.visible = false;
scene.add(plane);

const target = new Mesh(
  new BoxBufferGeometry(1, 1, 1),
  new MeshNormalMaterial()
);
scene.add(target);

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointermove", onMouseMove, false);

function update() {
  plane.lookAt(camera.position);
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(plane);

  if (intersects.length) {
    center.copy(intersects[0].point);
    target.position.copy(center);
  }

  for (const boid of boids) {
    boid.update();
    boid.mesh.position.copy(boid.position);
  }
  if (frames > 1) {
    for (const trail of trails) {
      trail.update();
    }
    frames = 0;
  }
  frames++;
  capture(renderer.domElement);
}

function resize(w, h, dPR) {
  for (const trail of trails) {
    trail.mesh.material.uniforms.resolution.value.set(w, h);
  }
}

addUpdate(update);
addResize(resize);
