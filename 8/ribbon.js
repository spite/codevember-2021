import { getFBO } from "../modules/fbo.js";
import {
  Mesh,
  PlaneBufferGeometry,
  MeshNormalMaterial,
  RawShaderMaterial,
  GLSL3,
  Line,
  BufferGeometry,
  LineBasicMaterial,
  FloatType,
  RGBAFormat,
  DataTexture,
  ArrowHelper,
  Vector3,
  DoubleSide,
  Group,
  BufferAttribute,
} from "../third_party/three.module.js";
import { curl, generateNoiseFunction } from "../modules/curl.js";
import { randomInRange, VERSION } from "../modules/Maf.js";

const fn = generateNoiseFunction();

const vertexShader = `precision highp float;

in vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform sampler2D data;

void main() {
  vec2 size = vec2(textureSize(data, 0));
  vec4 d = texture(data, vec2(position.x+.5 + .5/size.x, .5));
  vec3 p = vec3(d.x, position.y, 0.);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `precision highp float;

out vec4 fragColor;

void main() {
  fragColor = vec4(1., 0., 1., 1.);
}`;

class Ribbon extends Line {
  constructor() {
    const length = ~~randomInRange(50, 100);
    const points = [];

    for (let i = 0; i < length; i++) {
      points.push({
        point: new Vector3(),
        normal: new Vector3(),
        tangent: new Vector3(),
      });
    }
    const geometry = new BufferGeometry();
    const attribute = new BufferAttribute(new Float32Array(length * 3), 3);
    geometry.setAttribute("position", attribute);

    const ribbonMaterial = new LineBasicMaterial({});

    super(geometry, ribbonMaterial);

    this.length = length;
    this.points = points;
    this.speed = randomInRange(0.05, 0.15);

    this.reset();
    const skip = ~~(randomInRange(0, 0.75) * 2 * this.length);
    for (let i = 0; i < skip; i++) {
      this.update(true);
    }
    this.buildGeometry();
  }

  reset() {
    this.life = 0;
    this.point = new Vector3(
      randomInRange(-1, 1),
      randomInRange(-1, 1),
      randomInRange(-1, 1)
    );

    const p = this.point;
    for (let i = 0; i < this.length; i++) {
      this.points[i].point.copy(p);
    }

    this.buildGeometry();
  }

  buildGeometry() {
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i].point;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  update(skip) {
    this.life++;
    if (this.life >= 2 * this.length) {
      this.reset();
      return;
    }

    if (this.life < this.length) {
      this.points.shift();
      const p = this.points[this.points.length - 1].point;
      this.points.push({ point: this.calcPoint(p).clone() });
    } else {
      this.points.shift();
      const p = this.points[this.points.length - 1].point;
      this.points.push({ point: p.clone() });
    }
    if (skip) {
      return;
    }
    this.buildGeometry();
  }

  calcPoint(p) {
    const res = curl(p.clone().multiplyScalar(0.25), fn)
      .normalize()
      .multiplyScalar(this.speed);
    res.add(p);
    return res;
  }
}

export { Ribbon };
