import { randomInRange } from "../modules/Maf.js";
import {
  DataTexture,
  RGBFormat,
  RawShaderMaterial,
  RGBAFormat,
  GLSL3,
  AdditiveBlending,
  BufferGeometry,
  BufferAttribute,
  Points,
  NearestFilter,
  FloatType,
  Scene,
  OrthographicCamera,
  PlaneBufferGeometry,
  Mesh,
  Vector3,
} from "../third_party/three.module.js";
import { getFBO } from "../modules/fbo.js";

const particleVs = `precision highp float;

in vec3 position;

uniform sampler2D positions;
uniform sampler2D velocities;
uniform sampler2D gradient;
uniform float dpr;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec3 vColor;
out float vLife;

float parabola(in float x, in float k) {
  return pow(4. * x * (1. - x), k);
}

void main() {
  vec2 coord = position.xy;
  vec4 pos = texture(positions, coord);
  vec4 vel = texture(velocities, coord);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos.xyz - .5, 1. );
  vLife = pos.w / 100.;
  float d = (length(vel.xyz) / .025);
  d = smoothstep(.25, .65, d) ;
  vColor = texture(gradient, vec2(d, 0.)).rgb; 
  gl_PointSize = 2. * dpr * vel.w / gl_Position.z;
}`;

const particleFs = `precision highp float;

in float vLife;
in vec3 vColor;

out vec4 fragColor;

void main() {
  vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
  if (dot(circCoord, circCoord) > 1.0) {
      discard;
  }
  vec3 c = abs(vColor);// * vLife;
  fragColor = vec4(c, .15);
}`;

const simVs = `precision  highp float;

in vec3 position;
in vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const simFs = `precision highp float;
precision highp sampler3D;

in vec2 vUv;

uniform sampler2D originalPos;
uniform sampler2D posTexture;
uniform sampler2D velTexture;
uniform sampler3D field;
uniform bool positions;
uniform vec3 point;
uniform bool follow;
uniform float dt;

out vec4 fragColor;

vec3 getCharge(in vec3 pos) {
  vec3 chargePosition = point + .5;
  float q = -.2;
  vec3 pc = pos - chargePosition;
  float r2 = dot(pc,pc);
  vec3 E = pc * q / (pow(r2, 1.5) + 1.0e-2);
  return E;
}

vec3 getField(in vec3 p) {
  vec3 res = texture(field, p).xyz;
  if(follow) res += getCharge(p);
  return res;
}

void main() {
  if(positions == true) {
    vec4 pos = texture(posTexture, vUv);
    vec4 vel = texture(velTexture, vUv);
    pos.xyz += vel.xyz * dt;
    pos.w += vel.w * dt;
    if(pos.w>100. || pos.x<0. || pos.x>1. || pos.y<0. || pos.y >1. || pos.z < 0. || pos.z > 1.) {
      pos = texture(originalPos, vUv);
    }
    if(pos.w>100.) {
      pos.w = 0.;
    }
    fragColor = pos; 
  } else {
    vec4 pos = texture(posTexture, vUv);
    vec4 vel = texture(velTexture, vUv);
    vec3 inc = getField(pos.xyz);
    vel.xyz =  inc *.02 * vel.w;
    fragColor = vel;
  }
}`;

class Simulation {
  constructor(width, height, field, color) {
    const posData = new Float32Array(width * height * 4);
    let ptr = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        posData[ptr] = randomInRange(0, 1);
        posData[ptr + 1] = randomInRange(0, 1);
        posData[ptr + 2] = randomInRange(0, 1);
        posData[ptr + 3] = randomInRange(0, 100);
        ptr += 4;
      }
    }
    const posTexture = new DataTexture(
      posData,
      width,
      height,
      RGBAFormat,
      FloatType
    );

    const velData = new Float32Array(width * height * 4);
    ptr = 0;
    let r = 0.01;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        velData[ptr] = randomInRange(-r, r);
        velData[ptr + 1] = randomInRange(-r, r);
        velData[ptr + 2] = randomInRange(-r, r);
        velData[ptr + 3] = randomInRange(0.25, 0.5);
        ptr += 4;
      }
    }
    const velTexture = new DataTexture(
      velData,
      width,
      height,
      RGBAFormat,
      FloatType
    );

    this.shader = new RawShaderMaterial({
      uniforms: {
        positions: { value: posTexture },
        velocities: { value: velTexture },
        gradient: { value: color },
        dpr: { value: 1 },
      },
      vertexShader: particleVs,
      fragmentShader: particleFs,
      glslVersion: GLSL3,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    const geo = new BufferGeometry();
    const vertices = new Float32Array(width * height * 3);
    ptr = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        vertices[ptr] = x / width;
        vertices[ptr + 1] = y / width;
        vertices[ptr + 2] = 0;
        ptr += 3;
      }
    }
    geo.setAttribute("position", new BufferAttribute(vertices, 3));
    this.mesh = new Points(geo, this.shader);

    const options = {
      format: RGBAFormat,
      type: FloatType,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    };

    this.positionFBOs = [
      getFBO(width, height, options),
      getFBO(width, height, options),
    ];
    this.velocityFBOs = [
      getFBO(width, height, options),
      getFBO(width, height, options),
    ];

    this.simShader = new RawShaderMaterial({
      uniforms: {
        originalPos: { value: posTexture },
        posTexture: { value: posTexture },
        velTexture: { value: velTexture },
        field: { value: field },
        point: { value: new Vector3(0, 0, 0) },
        follow: { value: false },
        dt: { value: 1 },
        positions: { value: false },
      },
      vertexShader: simVs,
      fragmentShader: simFs,
      glslVersion: GLSL3,
      depthTest: false,
      depthWrite: false,
    });

    this.simScene = new Scene();
    this.simCamera = new OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.00001,
      1000
    );
    const simQuad = new Mesh(new PlaneBufferGeometry(1, 1), this.simShader);
    simQuad.scale.set(width, height, 1);
    this.simScene.add(simQuad);

    this.current = 0;
  }

  simulate(renderer, dt, point) {
    this.shader.uniforms.dpr.value = renderer.getPixelRatio();
    this.simShader.uniforms.dt.value = dt / 0.016;
    if (point) this.simShader.uniforms.point.value.copy(point);
    this.simShader.uniforms.follow.value = point ? true : false;

    this.simShader.uniforms.positions.value = false;
    renderer.setRenderTarget(this.velocityFBOs[1 - this.current]);
    renderer.render(this.simScene, this.simCamera);
    renderer.setRenderTarget(null);

    this.simShader.uniforms.velTexture.value =
      this.velocityFBOs[1 - this.current].texture;

    this.simShader.uniforms.positions.value = true;
    renderer.setRenderTarget(this.positionFBOs[1 - this.current]);
    renderer.render(this.simScene, this.simCamera);
    renderer.setRenderTarget(null);

    this.simShader.uniforms.posTexture.value =
      this.positionFBOs[1 - this.current].texture;

    this.shader.uniforms.positions.value =
      this.positionFBOs[1 - this.current].texture;
    this.shader.uniforms.velocities.value =
      this.velocityFBOs[1 - this.current].texture;
    //debug.material.map = this.positionFBOs[1 - this.current].texture;

    this.current = 1 - this.current;
  }
}

// const debug = new Mesh(
//   new PlaneBufferGeometry(1, 1),
//   new MeshBasicMaterial({ map: null })
// );
// scene.add(debug);

export { Simulation };
