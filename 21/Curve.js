import {
  Mesh,
  TextureLoader,
  Vector3,
  CylinderBufferGeometry,
  RawShaderMaterial,
  DataTexture,
  RGBFormat,
  FloatType,
  GLSL3,
  LinearFilter,
} from "../third_party/three.module.js";
import { randomInRange } from "../modules/Maf.js";

const vertexShader = `precision highp float;

in vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform sampler2D pointsMap;
uniform float segments;

vec3 getPoint(in float t) {
  vec2 size = vec2(textureSize(pointsMap, 0));
  vec2 uv = vec2(t, 0.) + 0./size;
  vec4 p = texture(pointsMap, uv);
  return p.xyz;
}

const float MAX_NUMBER = 1.79769313e+308;
const float EPSILON = 1.19209290e-7;
const float PI = 3.1415926535897932384626433832795;

vec3 getTangent (vec3 a, vec3 b) {
  return normalize(b - a);
}

void rotateByAxisAngle (inout vec3 normal, vec3 axis, float angle) {
  // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
  // assumes axis is normalized
  float halfAngle = angle / 2.0;
  float s = sin(halfAngle);
  vec4 quat = vec4(axis * s, cos(halfAngle));
  normal = normal + 2.0 * cross(quat.xyz, cross(quat.xyz, normal) + quat.w * normal);
}

float atan2(in float y, in float x) {
  return x == 0.0 ? sign(y)*PI/2. : atan(y, x);
}

vec2 shape(vec2 uv) {
  float a = atan2(uv.y, uv.x);
  float r = length(uv);
  float r2 = .01;
  float f = 10.;
  vec2 d = normalize(uv);
  return uv + d * r2 * vec2(cos(a * f), sin(a * f));
}

void createTube (in vec3 position, out vec3 p, out vec3 n, in float r) {

  float t = position.y;
  float nextT = t + 1. / segments;

  // find first tangent
  vec3 point0 = getPoint(0.0);
  vec3 point1 = getPoint(1. / segments);

  vec3 lastTangent = getTangent(point0, point1);
  vec3 absTangent = abs(lastTangent);
  float min = MAX_NUMBER;
  vec3 tmpNormal = vec3(0.0);
  if (absTangent.x <= min) {
    min = absTangent.x;
    tmpNormal.x = 1.0;
  }
  if (absTangent.y <= min) {
    min = absTangent.y;
    tmpNormal.y = 1.0;
  }
  if (absTangent.z <= min) {
    tmpNormal.z = 1.0;
  }

  vec3 tmpVec = normalize(cross(lastTangent, tmpNormal));
  vec3 lastNormal = cross(lastTangent, tmpVec);
  vec3 lastBinormal = cross(lastTangent, lastNormal);
  vec3 lastPoint = point0;

  vec3 normal;
  vec3 tangent;
  vec3 binormal;
  vec3 point;
  float maxLen = (segments - 1.0);
  float epSq = EPSILON * EPSILON;
  for (float i = 1.0; i < segments; i += 1.0) {
    float u = 1. * i / maxLen;
    // could avoid additional getPoint here at expense of ternary
    // point = i == 1.0 ? point1 : getPoint(u);
    point = getPoint(u);
    tangent = getTangent(lastPoint, point);
    normal = lastNormal;
    binormal = lastBinormal;

    tmpVec = cross(lastTangent, tangent);
    if ((tmpVec.x * tmpVec.x + tmpVec.y * tmpVec.y + tmpVec.z * tmpVec.z) > epSq) {
      tmpVec = normalize(tmpVec);
      float tangentDot = dot(lastTangent, tangent);
      float theta = acos(clamp(tangentDot, -1.0, 1.0)); // clamp for floating pt errors
      rotateByAxisAngle(normal, tmpVec, theta);
    }

    binormal = cross(tangent, normal);
    if (u >= t) break;

    lastPoint = point;
    lastTangent = tangent;
    lastNormal = normal;
    lastBinormal = binormal;
  }

  // compute the TBN matrix
  vec3 T = tangent;
  vec3 B = binormal;
  vec3 N = normal;

  // extrude the path & create a new normal
  vec2 s = position.xz;//shape(position.xz);
  n.xyz = normalize(B * r * s.x + N * r *s.y);
  p.xyz = point + B * r * s.x + N * r *s.y;

}

in vec2 uv;
out vec2 vUv;
out vec3 vPosition;
out vec3 vNormal;
out vec3 vEyePosition;

float parabola(in float x, in float k) {
  return pow(4. * x * (1. - x), k);
}

void main() {
  vUv = uv;

  vec3 p;
  vec3 n;
  vec3 pp = position.xyz + vec3(0., .5, 0.);
  createTube(pp, p, n, parabola(pp.y, 1.));

  vPosition = p;
  vNormal = normalMatrix * n;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vEyePosition = mvPosition.xyz;

  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `precision highp float;

out vec4 fragColor;

in vec3 vEyePosition;
in vec3 vNormal;
in vec2 vUv;

uniform sampler2D matCapMap;

vec2 matCapUV(in vec3 eye, in vec3 normal) {
  vec3 r = reflect(eye, normal);
  float m = 2.82842712474619 * sqrt(r.z + 1.0);
  vec2 vN = r.xy / m + .5;
  return vN;
}

float parabola(in float x, in float k) {
  return pow(4. * x * (1. - x), k);
}

void main() {

  vec2 vN = matCapUV(normalize(vEyePosition.xyz), vNormal);
  vec4 c = texture(matCapMap, vN);

  fragColor = vec4(c.rgb * parabola(vUv.y, 1.), 1.);
}`;

class Point {
  constructor(position) {
    this.position = new Vector3().copy(position);
    this.velocity = new Vector3(0, 0, 0);
    this.tmp = new Vector3();
  }

  step(pos, force) {
    this.tmp.copy(pos).sub(this.position).multiplyScalar(force);
    this.velocity.add(this.tmp);
    this.velocity.multiplyScalar(0.5);
    this.position.add(this.velocity);
  }
}

const loader = new TextureLoader();

class Curve {
  constructor(numPoints, width) {
    this.width = width;
    this.numPoints = numPoints;
    this.spring = 0.45; //randomInRange(0.4, 0.5); //  0.45
    this.dampening = 0.2; //randomInRange(0.2, 0.25); // .25
    this.friction = 0.5; //randomInRange(0.45, 0.5); // .5
    this.tension = 0.98; //randomInRange(0.98, 0.99); // 0.98;

    this.points = [];
    this.initialised = false;
    this.vertices = new Float32Array(this.numPoints * 3);
    for (let i = 0; i < this.vertices.length; i++) {
      this.vertices[i] = 0;
    }

    this.pointsTexture = new DataTexture(
      this.vertices,
      this.numPoints,
      1,
      RGBFormat,
      FloatType,
      undefined,
      undefined,
      undefined,
      LinearFilter,
      LinearFilter
    );
    this.tubeMaterial = new RawShaderMaterial({
      uniforms: {
        segments: { value: this.numPoints },
        pointsMap: { value: this.pointsTexture },
        matCapMap: {
          value: loader.load("../assets/matcap-cherry_1k.jpg"),
        },
      },
      vertexShader,
      fragmentShader,
      // wireframe: true,
      glslVersion: GLSL3,
    });
    this.tubeGeometry = new CylinderBufferGeometry(
      0.1,
      0.1,
      1,
      36,
      this.numPoints - 1,
      true
    );
    this.tubeMesh = new Mesh(this.tubeGeometry, this.tubeMaterial);
    this.tubeMesh.frustumCulled = false;
    this.tubeMesh.receiveShadow = this.tubeMesh.castShadow = true;

    this.ptr = 0;
  }

  update(point) {
    if (!this.initialised) {
      this.initialised = true;
      for (let j = 0; j < this.numPoints; j++) {
        const p = new Point(new Vector3(0, 0, 0));
        this.points[j] = p;
      }
    }
    this.points[0].position.copy(point);
  }

  step(dt) {
    let spring = this.spring;
    const dampening = this.dampening;
    const friction = this.friction;
    const tension = this.tension;

    for (let j = 1; j < this.points.length; j++) {
      const prev = this.points[j - 1];
      const cur = this.points[j];

      cur.velocity.x += (prev.position.x - cur.position.x) * spring;
      cur.velocity.y += (prev.position.y - cur.position.y) * spring;
      cur.velocity.z += (prev.position.z - cur.position.z) * spring;
      cur.velocity.x += prev.velocity.x * dampening;
      cur.velocity.y += prev.velocity.y * dampening;
      cur.velocity.z += prev.velocity.z * dampening;
      cur.velocity.multiplyScalar(friction);

      cur.velocity.clampLength(0, 0.1); // clamp to prevent craziness

      cur.position.add(cur.velocity);
      spring *= tension;
    }
  }

  render() {
    const e = 0.0001;
    for (let j = 0; j < this.points.length; j++) {
      const p = this.points[j].position;
      this.vertices[j * 3] = p.x + randomInRange(-e, e);
      this.vertices[j * 3 + 1] = p.y + randomInRange(-e, e);
      this.vertices[j * 3 + 2] = p.z + randomInRange(-e, e);
    }
    this.pointsTexture.needsUpdate = true;
  }
}

export { Curve };
