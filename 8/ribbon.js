import {
  Mesh,
  RawShaderMaterial,
  GLSL3,
  BufferGeometry,
  Vector3,
  DoubleSide,
  BufferAttribute,
  Color,
  TextureLoader,
} from "../third_party/three.module.js";
import { curl, generateNoiseFunction } from "../modules/curl.js";
import { randomInRange, clamp } from "../modules/Maf.js";

const vertexShader = `precision highp float;
in vec3 position;
in vec3 normal;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out vec4 vEyePosition;
out vec3 vPosition;
out vec3 vNormal;
out vec3 vONormal;
out vec4 vWorldPosition;

void main() {
  vONormal = normal;
  vPosition = position.xyz;
  vNormal = normalMatrix * normal;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
  vWorldPosition = modelMatrix * vec4(position, 1.);
  vEyePosition = mvPosition;
  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `precision highp float;

out vec4 fragColor;

uniform vec3 color;
uniform sampler2D matCapMap;

in vec3 vNormal;
in vec3 vONormal;
in vec3 vPosition;
in vec4 vEyePosition;
in vec4 vWorldPosition;

float rand(vec2 co){
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec2 matCapUV(in vec3 eye, in vec3 normal) {
  vec3 r = reflect(eye, normal);
  float m = 2.82842712474619 * sqrt(r.z + 1.0);
  vec2 vN = r.xy / m + .5;
  return vN;
}

void main() {
  vec3 n = normalize(vNormal);

  float f = .05;
  n.x += f * rand(vPosition.xy);
  n.y += f * rand(vPosition.yz);
  n.z += f * rand(vPosition.xy);
  n = normalize(n);

  vec2 vN = matCapUV(normalize(vEyePosition.xyz), n);

  vec3 lightDir = normalize(vec3(0.,10.,0.) - vWorldPosition.xyz);  
  float d = dot(lightDir, vONormal);
  float l = .5 + .5 * abs(d);
  vec4 c = texture(matCapMap, vN);

  fragColor = vec4(c.rgb + color.rgb, 1.);
  fragColor.rgb *= vec3(l);
}`;

const loader = new TextureLoader();
const matCapMap = loader.load("../assets/matcap.png");

let fn;

function randomizeFunction() {
  fn = generateNoiseFunction();
}

randomizeFunction();

class Ribbon extends Mesh {
  constructor() {
    const length = ~~randomInRange(50, 100) * 2;
    const points = [];

    for (let i = 0; i < length; i++) {
      points.push({
        point: new Vector3(),
        tangent: new Vector3(0, 1, 0),
        normal: new Vector3(),
        binormal: new Vector3(),
        dot: 0,
      });
    }
    const geometry = new BufferGeometry();

    // "quad" mesh
    const position = new BufferAttribute(new Float32Array(length * 6 * 3), 3);
    geometry.setAttribute("position", position);

    const normal = new BufferAttribute(new Float32Array(length * 6 * 3), 3);
    geometry.setAttribute("normal", normal);

    const ribbonMaterial = new RawShaderMaterial({
      uniforms: {
        color: { value: new Color() },
        matCapMap: { value: matCapMap },
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
      side: DoubleSide,
    });
    super(geometry, ribbonMaterial);

    this.length = length;
    this.points = points;
    this.speed = randomInRange(0.05, 0.15) / 2;

    this.reset();
    const skip = ~~(randomInRange(0, 0.75) * 2 * this.length);
    for (let i = 0; i < skip; i++) {
      this.update(true);
    }
    this.buildGeometry();
  }

  get color() {
    return this.material.uniforms.color.value;
  }

  reset() {
    this.life = 0;
    const d = 1;
    this.point = new Vector3(
      randomInRange(-d, d),
      randomInRange(-d, d),
      randomInRange(-d, d)
    );

    const t = new Vector3(
      randomInRange(-1, 1),
      randomInRange(-1, 1),
      randomInRange(-1, 1)
    ).normalize();
    const p = this.point;
    for (let i = 0; i < this.length; i++) {
      this.points[i].point.copy(p);
      this.points[i].tangent.copy(t);
    }

    this.frustumCulled = false;
    this.buildGeometry();
  }

  buildLineGeometry() {
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i].point;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  buildGeometry() {
    const positions = this.geometry.attributes.position.array;
    const normal = this.geometry.attributes.normal.array;
    let w = 0.1;
    for (let i = 0; i < this.points.length; i++) {
      const ptr = i * 6 * 3;

      const from = this.points[i];
      const to = this.points[clamp(i + 1, 0, this.points.length - 1)];

      const p0 = from.point;
      const p1 = to.point;

      const d0 = from.tangent.clone().multiplyScalar(w);
      const d1 = to.tangent.clone().multiplyScalar(w);

      // top tri

      positions[ptr] = p0.x - d0.x;
      positions[ptr + 1] = p0.y - d0.y;
      positions[ptr + 2] = p0.z - d0.z;

      positions[ptr + 3] = p1.x - d1.x;
      positions[ptr + 3 + 1] = p1.y - d1.y;
      positions[ptr + 3 + 2] = p1.z - d1.z;

      positions[ptr + 6] = p0.x + d0.x;
      positions[ptr + 6 + 1] = p0.y + d0.y;
      positions[ptr + 6 + 2] = p0.z + d0.z;

      normal[ptr] = from.binormal.x;
      normal[ptr + 1] = from.binormal.y;
      normal[ptr + 2] = from.binormal.z;

      normal[ptr + 3] = to.binormal.x;
      normal[ptr + 3 + 1] = to.binormal.y;
      normal[ptr + 3 + 2] = to.binormal.z;

      normal[ptr + 6] = from.binormal.x;
      normal[ptr + 6 + 1] = from.binormal.y;
      normal[ptr + 6 + 2] = from.binormal.z;

      // bottom tri

      positions[ptr + 9] = p1.x - d1.x;
      positions[ptr + 9 + 1] = p1.y - d1.y;
      positions[ptr + 9 + 2] = p1.z - d1.z;

      positions[ptr + 12] = p1.x + d1.x;
      positions[ptr + 12 + 1] = p1.y + d1.y;
      positions[ptr + 12 + 2] = p1.z + d1.z;

      positions[ptr + 15] = p0.x + d0.x;
      positions[ptr + 15 + 1] = p0.y + d0.y;
      positions[ptr + 15 + 2] = p0.z + d0.z;

      normal[ptr + 9] = to.binormal.x;
      normal[ptr + 9 + 1] = to.binormal.y;
      normal[ptr + 9 + 2] = to.binormal.z;

      normal[ptr + 12] = to.binormal.x;
      normal[ptr + 12 + 1] = to.binormal.y;
      normal[ptr + 12 + 2] = to.binormal.z;

      normal[ptr + 15] = from.binormal.x;
      normal[ptr + 15 + 1] = from.binormal.y;
      normal[ptr + 15 + 2] = from.binormal.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }

  update(skip) {
    this.life++;
    if (this.life >= 2 * this.length) {
      this.reset();
      return;
    }

    if (this.life < this.length) {
      this.points.shift();
      const p = this.points[this.points.length - 1];
      this.points.push(this.calcPoint(p));
    } else {
      this.points.shift();
      const p = this.points[this.points.length - 1];
      this.points.push({
        point: p.point.clone(),
        normal: p.normal.clone(),
        tangent: p.tangent.clone(),
        binormal: p.binormal.clone(),
      });
    }
    if (skip) {
      return;
    }
    this.buildGeometry();
  }

  calcPoint(p) {
    const t = new Vector3(performance.now() / 10000, 0, 0);
    const point = curl(p.point.clone().multiplyScalar(0.25).add(t), fn)
      .normalize()
      .multiplyScalar(this.speed)
      .add(p.point)
      .clone();
    const prevNormal = p.normal;
    const normal = point.clone().sub(p.point).normalize();
    const desiredTangent = normal.clone().cross(prevNormal).normalize();
    const dot = p.tangent.dot(desiredTangent);
    const max = 0.05;
    const theta = clamp(Math.acos(dot), -max, max);
    const tangent = p.tangent.clone().applyAxisAngle(normal, theta).normalize();
    // const tangent = p.normal.clone().cross(normal).normalize();
    const binormal = normal.clone().cross(tangent).normalize();
    return {
      point,
      normal,
      tangent,
      binormal,
      dot,
    };
  }
}

export { Ribbon, randomizeFunction };
