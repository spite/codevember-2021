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
import { shader as curl } from "../shaders/curl.js";

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
uniform bool positions;
uniform float dt;
uniform float noiseSpeed;
uniform float noiseScale;
uniform vec3 mousePosition;
uniform float modulo;
uniform float persistence;
uniform float time;
uniform float sphereRadius;
uniform float signDir;
uniform float value;

out vec4 fragColor;

float sdSphere(in vec3 p, in float r) {
  return length(p)-r;
}

${curl}

void main() {
  if(positions == true) {
    vec4 pos = texture(posTexture, vUv);
    vec4 vel = texture(velTexture, vUv);
       
    pos.xyz = pos.xyz + vel.xyz * vel.w * dt;
    pos.w += dt * vel.w * .1;
    
    if(pos.w>100.) {
      pos.w = 0.;
      pos.xyz = texture(originalPos, vUv).xyz;// + mousePosition + .5;
    }
    
    fragColor = pos; 
  } else {
    vec4 pos = texture(posTexture, vUv);
    vec4 vel = texture(velTexture, vUv);
    vel.xyz = noiseSpeed * curlNoise(noiseScale * (pos.xyz + vel.xyz), time/10.) / 200.;
    fragColor = vel;
  }
}`;

function getPoint(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = u * 2.0 * Math.PI;
  const phi = Math.acos(2.0 * v - 1.0);
  const r = radius * Math.cbrt(Math.random());
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const x = r * sinPhi * cosTheta;
  const y = r * sinPhi * sinTheta;
  const z = r * cosPhi;
  return { x: x, y: y, z: z };
}

class Simulation {
  constructor(width, height) {
    const posData = new Float32Array(width * height * 4);
    let ptr = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = getPoint(1);
        posData[ptr] = p.x;
        posData[ptr + 1] = p.y;
        posData[ptr + 2] = p.z;
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
        velData[ptr + 3] = randomInRange(0.1, 2);
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
        mousePosition: { value: new Vector3() },
        signDir: { value: 1 },
        dt: { value: 1 },
        noiseScale: { value: 0.05 },
        persistence: { value: 0.8 },
        noiseSpeed: { value: 1 },
        positions: { value: false },
        time: { value: 0 },
        sphereRadius: { value: 0.5 },
        modulo: { value: 0 },
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

  step(renderer, dt, point) {
    this.simShader.uniforms.mousePosition.value.copy(point);
    this.simShader.uniforms.time.value += dt;
    this.simShader.uniforms.dt.value = dt / 0.016;

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

    this.simShader.uniforms.modulo.value =
      (this.simShader.uniforms.modulo.value + 1) % 4;
    this.current = 1 - this.current;
  }
}

// const debug = new Mesh(
//   new PlaneBufferGeometry(1, 1),
//   new MeshBasicMaterial({ map: null })
// );
// scene.add(debug);

export { Simulation };
