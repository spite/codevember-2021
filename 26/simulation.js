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
  Quaternion,
  Vector3,
} from "../third_party/three.module.js";
import { getFBO } from "../modules/fbo.js";
import { shader as curl } from "../shaders/curl.js";

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
  vColor = texture(gradient, vec2(vLife, 0.)).rgb * vLife; 
  gl_PointSize = (2.5 * parabola(vLife, 1.)) * dpr / gl_Position.z;
}`;

const particleFs = `precision highp float;

in float vLife;
in vec3 vColor;

uniform float opacity;

out vec4 fragColor;

void main() {
  vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
  float d = dot(circCoord, circCoord);
  if (d > 1.0) {
      discard;
  }
  vec3 c = vColor;
  fragColor = vec4(c, (1.-pow(d, 10.)) * opacity);
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
    pos.w += vel.w * dt * 4.;
    
    if(pos.w>100.) {
      pos.w = 0.;
      pos.xyz = texture(originalPos, vUv).xyz + mousePosition + .5;
    }
    
    fragColor = pos; 
  } else {
    vec4 pos = texture(posTexture, vUv);
    vec4 vel = texture(velTexture, vUv);
    
    if(pos.w== 0.) {
      vel.xyz = vec3(0.);
    }

    vec2 size = vec2(textureSize(posTexture, 0));
    if(mod(round(vUv.x * size.x), 4.) == modulo) {
      float d = sdSphere((pos.xyz - .5)-mousePosition.xyz, sphereRadius);
      vel.xyz = noiseSpeed * curlNoise(noiseScale * pos.xyz / 2., time/10.) / 200.;

      if(d<0.) {
        vec3 n = normalize(pos.xyz - .5 - mousePosition.xyz);
        vec3 r = signDir * refract(n, normalize(vel.xyz), .85);
        vel.xyz += r/10. * vel.w;
      } else {
        vel.xyz /= 1. + pow(d, 2.);
      }
    }

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
        const p = getPoint(0.5);
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
        gradient: { value: null },
        dpr: { value: 1 },
        opacity: { value: 0.25 },
      },
      vertexShader: particleVs,
      fragmentShader: particleFs,
      glslVersion: GLSL3,
      transparent: true,
      depthWrite: false,
      depthTest: true,
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
        mousePosition: { value: new Vector3() },
        signDir: { value: 1 },
        dt: { value: 1 },
        noiseScale: { value: 1 },
        persistence: { value: 1 },
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

  simulate(renderer, dt, point) {
    this.simShader.uniforms.mousePosition.value.copy(point);
    this.simShader.uniforms.time.value += dt;
    this.simShader.uniforms.dt.value = dt / 0.016;
    this.shader.uniforms.dpr.value = renderer.getPixelRatio();

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
