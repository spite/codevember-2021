import { RawShaderMaterial, GLSL3 } from "../third_party/three.module.js";

const vertexShader = `precision highp float;

in vec3 position;
in vec2 uv;
in mat4 instanceMatrix;
in vec3 instanceColor;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform sampler2D positions;
uniform sampler2D velocities;

out vec2 vUv;
out vec3 vPosition;
out vec3 vColor;
out vec4 vClipCoord;

float parabola(in float x, in float k) {
  return pow(4. * x * (1. - x), k);
}

void main() {
  vUv = uv;
  vColor = .5 + .5 * instanceColor;
  vec4 center = instanceMatrix * vec4(0.,0.,1.,1.);
  vec2 size = vec2(textureSize(positions, 0));
  vec4 pos = texture(positions, vec2(center.xy/size.xy));
  vec4 vel = texture(velocities, vec2(center.xy/size.xy));
  float scale = vel.w;
  float life = clamp(pos.w/100., 0., 1.);
  scale *= parabola(life, 1.);
  vec4 mvPosition =  ((modelViewMatrix * vec4(pos.xyz, 1.)) + vec4(position * .1 * scale, 0.));
  vPosition = mvPosition.xyz;
  vClipCoord = projectionMatrix * mvPosition;
  gl_Position = vClipCoord;
}`;

const fragmentShader = `precision highp float;

in vec2 vUv;
in vec3 vPosition;
in vec3 vColor;
in vec4 vClipCoord;

uniform float near;
uniform float far;

layout(location = 0) out vec4 color;
layout(location = 1) out vec4 position;
layout(location = 2) out vec4 normal;

float linearizeDepth(float z) {
  return (2.0 * near) / (far + near - z * (far - near));	
}

float sR2 = 2.0*2.0;
vec3 sO = vec3(0.0, 0.0, -4.);
vec3 rO = vec3(0.0);

mat3 rotateX(float rad) {
  float c = cos(rad);
  float s = sin(rad);
  return mat3(
      1.0, 0.0, 0.0,
      0.0, c, s,
      0.0, -s, c
  );
}

mat3 rotateY(float rad) {
  float c = cos(rad);
  float s = sin(rad);
  return mat3(
      c, 0.0, -s,
      0.0, 1.0, 0.0,
      s, 0.0, c
  );
}

void main() {
  vec2 uv = vUv-.5;
  float d = length(uv);
  if(d>.5) {
    discard;
  }
  color = vec4(vColor, 1.);
 
  uv = 2. * uv;
  vec3 n = normalize(vec3(uv, sqrt(1. - clamp(dot(uv, uv), 0., 1.))));
  normal = vec4(n, 0.);

  vec3 p = vPosition;
  p.z += normal.z * .1;
  
  // float f_ndc_depth = vClipCoord.z / vClipCoord.w;
  // f_ndc_depth += .1 * normal.z / (far-near);
  // gl_FragDepth = (1.0 - 0.0) * 0.5 * f_ndc_depth + (1.0 + 0.0) * 0.5;

  float depth = linearizeDepth(length(p));
  position = vec4(p, depth);

}`;

class ParticleMaterial extends RawShaderMaterial {
  constructor(options) {
    super({
      uniforms: {
        positions: { value: null },
        velocities: { value: null },
        colorTexture: { value: null },
        near: { value: 0 },
        far: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
      ...options,
    });
  }
}

export { ParticleMaterial };
