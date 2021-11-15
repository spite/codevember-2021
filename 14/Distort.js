import {
  ArrowHelper,
  BoxBufferGeometry,
  DataTexture3D,
  Group,
  IcosahedronBufferGeometry,
  Mesh,
  MeshNormalMaterial,
  RawShaderMaterial,
  GLSL3,
  Vector3,
  RGBFormat,
  FloatType,
  LinearMipMapLinearFilter,
  LinearFilter,
  TextureLoader,
} from "../third_party/three.module.js";
import { SpringSystem } from "./SpringSystem.js";

const d = new Vector3();

const vertexShader = `
precision highp float;
precision highp sampler3D;

in vec3 normal;
in vec3 position;
in vec2 uv;

uniform sampler3D distortMap;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out vec2 vUv;
out vec3 vNormal;
out vec3 vEyePosition;
out vec3 vColor;

vec3 getPoint(in vec3 pos) {
  return texture(distortMap, pos).rgb;
}

vec3 calcNormal(in vec3 pos) {
  vec3 size = vec3(textureSize(distortMap, 0));
  float step = 2./size.x;
  vec3 up = getPoint(pos + vec3(0., step, 0.));
  vec3 down = getPoint(pos + vec3(0.,- step, 0.));
  vec3 right = getPoint(pos + vec3( step, 0., 0.));
  vec3 left = getPoint(pos + vec3(-step, 0., 0.));

  vec3 u = up - down;
  vec3 v = right - left;
  vec3 n = cross(u,v);

  return normal + 10.*n;
}

void main() {
  vUv = uv;
  vec3 pos = position + .5;
  vec4 disp = texture(distortMap, pos);

  vNormal = normalMatrix * calcNormal(pos);

  vec4 mvPosition = modelViewMatrix * vec4( position + disp.xyz, 1. );
  vEyePosition = mvPosition.xyz;
  vColor = disp.xyz;
  
  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `precision highp float;

in vec2 vUv;
in vec3 vNormal;
in vec3 vEyePosition;
in vec3 vColor;

uniform mat3 normalMatrix;
uniform sampler2D matCapMap;

out vec4 fragColor;

#define PI 3.14159265359

vec2 matCapUV(in vec3 eye, in vec3 normal) {
  vec3 r = reflect(eye, normal);
  float m = 2.82842712474619 * sqrt(r.z + 1.0);
  vec2 vN = r.xy / m + .5;
  return vN;
}

void main() {

  vec3 X = dFdx(vEyePosition);
  vec3 Y = dFdy(vEyePosition);
  vec3 normal = normalize(cross(X,Y));

  vec2 vN = matCapUV(normalize(vEyePosition.xyz), normal);
  vec4 c = texture(matCapMap, vN);

  fragColor = vec4( c.rgb ,1.);
  // fragColor = vec4(.5 + .5 * normalize(vNormal),1.);
}`;

const loader = new TextureLoader();

class Distort {
  constructor(geometry) {
    const width = 10;
    const height = 10;
    const depth = 10;

    this.group = new Group();

    this.data = new Float32Array(width * height * depth * 3);
    this.texture = new DataTexture3D(this.data, width, height, depth);
    this.texture.format = RGBFormat;
    this.texture.type = FloatType;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.unpackAlignment = 1;

    this.objectGeometry = geometry; //new IcosahedronBufferGeometry(0.5, 10);
    //    this.objectGeometry = new BoxBufferGeometry(1, 1, 1, 10, 10, 10);
    this.objectMesh = new Mesh(
      this.objectGeometry,
      new RawShaderMaterial({
        uniforms: {
          distortMap: { value: this.texture },
          matCapMap: {
            value: loader.load("../assets/matcap-cherry_orange.png"),
          },
        },
        vertexShader,
        fragmentShader,
        glslVersion: GLSL3,
        // wireframe: true,
      })
    );
    this.objectMesh.frustumCulled = false;
    this.group.add(this.objectMesh);

    this.geometry = geometry;
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
          // const m = new Mesh(
          //   new BoxBufferGeometry(0.01, 0.01, 0.01),
          //   new MeshNormalMaterial()
          // );
          // n.mesh = m;
          n.idx = z * width * height + y * height + x;
          // this.group.add(m);
          // this.points.push(m);
          // this.pointsMap.set(m, n);
        }
      }
    }

    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x < width - 1) {
            const a = z * width * height + y * width + x;
            const b = a + 1;
            this.addSpring(a, b, 1);
          }
          if (y < height - 1) {
            const a = z * width * height + y * width + x;
            const b = a + height;
            this.addSpring(a, b, 1);
          }
          if (z < depth - 1) {
            const a = z * width * height + y * width + x;
            const b = a + width * height;
            this.addSpring(a, b, 1);
          }
          if (x < width - 1 && y < height - 1 && z < depth - 1) {
            let a = z * width * height + y * width + x;
            let b = (z + 1) * width * height + (y + 1) * width + (x + 1);
            this.addSpring(a, b, 0.5);

            a = z * width * height + (y + 1) * width + x;
            b = (z + 1) * width * height + y * width + x + 1;
            this.addSpring(a, b, 0.5);

            a = (z + 1) * width * height + y * width + x;
            b = z * width * height + (y + 1) * width + (x + 1);
            this.addSpring(a, b, 0.5);

            a = (z + 1) * width * height + (y + 1) * width + x;
            b = z * width * height + y * width + (x + 1);
            this.addSpring(a, b, 0.5);
          }
        }
      }
    }
  }

  updateTexture() {
    for (const node of this.springSystem.nodes) {
      const ptr = node.idx * 3;
      this.data[ptr] = node.position.x - node.origin.x;
      this.data[ptr + 1] = node.position.y - node.origin.y;
      this.data[ptr + 2] = node.position.z - node.origin.z;
    }
    this.texture.needsUpdate = true;
  }

  addSpring(a, b, stiffness = 1) {
    const s = this.springSystem.connectIdx(a, b, stiffness);
    const dir = s.b.position.clone().sub(s.a.position);
    // s.mesh = new ArrowHelper(dir, s.a.position.clone(), dir.length(), 0xff00ff);
    // this.group.add(s.mesh);
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
      // node.mesh.position.copy(node.position);
      d.copy(node.origin).sub(node.position);
      node.position.add(d.multiplyScalar(0.01));
    }
    for (const spring of this.springSystem.springs) {
      // spring.mesh.position.copy(spring.a.position);
      // const dir = spring.b.position.clone().sub(spring.a.position);
      // spring.mesh.setLength(dir.length(), 0.025, 0.01);
      // spring.mesh.setDirection(dir.normalize());
    }
    this.updateTexture();
  }
}

export { Distort };
