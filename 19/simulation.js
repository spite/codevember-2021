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
  // float d = length(pos.xz - .5); 
  
  float d = (length(vel.xyz) / .025);
  // d = smoothstep(.25, .65, d) ;
  vColor = texture(gradient, vec2(d, 0.)).rgb; 

  gl_PointSize = 2.5 * dpr / gl_Position.z;
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
  vec3 c = vColor;
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
uniform bool positions;
uniform vec4 rotation;
uniform vec4 prevRotation;
uniform float dt;
uniform float scatter;
uniform float friction;

out vec4 fragColor;

float sdTorus( vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

const float PI = 3.14159265359;

float hash( float n ) { // 0 - 1
    return fract(sin(n)*3538.5453);
}

vec3 randomSphereDir(vec2 rnd) {
  float s = rnd.x*PI*2.;
  float t = rnd.y*2.-1.;
  return vec3(sin(s), cos(s), t) / sqrt(1.0 + t * t);
}

vec3 randomHemisphereDir(vec3 dir, float i) {
  vec3 v = randomSphereDir( vec2(hash(i+1.), hash(i+2.)) );
  return v * sign(dot(v, dir));
}

vec3 rotateVector(vec4 quat, vec3 vec){
  return vec + 2.0 * cross( cross( vec, quat.xyz ) + quat.w * vec, quat.xyz );
}

vec3 calcTorusNormal(vec3 p, vec4 q, vec2 b, float e) {
  const vec3 v1 = vec3( 1.0,-1.0,-1.0);
  const vec3 v2 = vec3(-1.0,-1.0, 1.0);
  const vec3 v3 = vec3(-1.0, 1.0,-1.0);
  const vec3 v4 = vec3( 1.0, 1.0, 1.0);

  return normalize( v1 * sdTorus( rotateVector( q, p + v1 * e ), b ) +
                    v2 * sdTorus( rotateVector( q, p + v2 * e ), b ) +
                    v3 * sdTorus( rotateVector( q, p + v3 * e ), b ) +
                    v4 * sdTorus( rotateVector( q, p + v4 * e ), b ) );
}

vec3 bounce( vec3 v, vec3 n ) {
  // float scatter = 1.;
  // float friction = .7;
  vec3 r = reflect(v,n);
  n = r;
  n = mix(r, randomHemisphereDir(r,length(v)),scatter);
  n = normalize(n);
  float l = length(v.xyz) * ( 1. - friction );
  return n * l;
}

vec3 momentum(vec3 p) {
  vec3 p0 = rotateVector(prevRotation, p);
  vec3 p1 = rotateVector(rotation, p);
  return p0 - p1;
}

const float EPSILON = .01;

void main() {
  if(positions == true) {
    vec4 pos = texture(posTexture, vUv);
    vec4 vel = texture(velTexture, vUv);
    
    pos.xyz += vel.xyz * vel.w * dt;
    pos.w += vel.w * dt;
    
    if(pos.w>100.) {
      pos.w = 0.;
      pos.xz = texture(originalPos, vUv).xz;
      pos.y = 1.;
    }
    // if(pos.y>1.) {
    //   pos.y -= 1.;
    // }
    // if(pos.y<0.) {
    //   pos.y += 1.;
    // }
    
    fragColor = pos; 
  } else {
    vec4 pos = texture(posTexture, vUv);
    vec4 vel = texture(velTexture, vUv);
    if(pos.w == 0.) {
      vel.xyz = vec3(0.);
    }
    vel.y += -.00098 * vel.w * dt;
    vec3 pp = (pos.xyz - .5) + vel.xyz * vel.w * dt;
    
    float d = sdTorus(rotateVector(rotation, pp), vec2(.2, .1));
    if( d <= EPSILON ) {
      vec3 n = calcTorusNormal(pp, rotation, vec2(.2,.1), EPSILON );
      vel.xyz = bounce( vel.xyz, n ) ;
      vel.xyz += momentum(pp);
    }

    if(pp.x<-.5) {
      vec3 n = vec3(1.,0.,0.);
      vel.xyz = bounce( vel.xyz, n ) ;
    }
    if(pp.x>.5) {
      vec3 n = vec3(-1.,0.,0.);
      vel.xyz = bounce( vel.xyz, n ) ;
    }
    if(pp.z<-.5) {
      vec3 n = vec3(0.,0.,1.);
      vel.xyz = bounce( vel.xyz, n ) ;
    }
    if(pp.z>.5) {
      vec3 n = vec3(0.,0.,-1.);
      vel.xyz = bounce( vel.xyz, n ) ;
    }
    if(pp.y<-.5) {
      vec3 n = vec3(0.,1.,0.);
      vel.xyz = bounce( vel.xyz, n ) ;
    }

    vec3 disturbance = vec3(.5-hash(vel.x+vel.a),.5-hash(vel.y+vUv.x),.5-hash(vel.z+vUv.y));
    disturbance = normalize(disturbance);
    vel.xyz += .001 * disturbance;
    
    fragColor = vel;
  }
}`;

class Simulation {
  constructor(width, height, color) {
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
        rotation: { value: new Quaternion() },
        prevRotation: { value: new Quaternion() },
        dt: { value: 1 },
        friction: { value: 0.7 },
        scatter: { value: 1 },
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

  simulate(renderer, dt, rot) {
    this.simShader.uniforms.dt.value = dt / 0.016;
    this.simShader.uniforms.prevRotation.value.copy(
      this.simShader.uniforms.rotation.value
    );
    this.simShader.uniforms.rotation.value.copy(rot);
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

    this.current = 1 - this.current;
  }
}

// const debug = new Mesh(
//   new PlaneBufferGeometry(1, 1),
//   new MeshBasicMaterial({ map: null })
// );
// scene.add(debug);

export { Simulation };
