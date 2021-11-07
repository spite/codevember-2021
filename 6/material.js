import {
  DoubleSide,
  GLSL3,
  RawShaderMaterial,
} from "../third_party/three.module.js";
import { shader as noise } from "../shaders/noise.js";

const vs = `precision highp float;

in vec3 position;
in vec3 normal;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out float dotN;
out vec3 c;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
  vec3 n = normalMatrix * normal;
  dotN = dot(n, -mvPosition.xyz);
  vec3 lPos = normalize(vec3(1.));
  if(dotN>0.) {
    float dotL = dot(n, lPos);
    c = vec3(.5 + .5 * dotL);
  } else {
    float dotL = abs(dot(-n, lPos));
    c = .5 + .5 * dotL * vec3(1., 0., 1.);
    c = vec3(1.);
  }
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fs = `precision highp float;

in float dotN;
in vec3 c;

uniform float time;

out vec4 fragColor;

${noise}

void main() {
  if(dotN> 0.) {
    fragColor = vec4(c, 1.);
  } else {
    float scale = 2.;
    float n = noise(round(gl_FragCoord.xy/scale)*scale + vec2(time, 0.));
    fragColor = vec4(vec3(n), 1.);
  }
}
`;

const material = new RawShaderMaterial({
  uniforms: {
    time: { value: 0 },
  },
  vertexShader: vs,
  fragmentShader: fs,
  glslVersion: GLSL3,
  // wireframe: true,
  side: DoubleSide,
});

export { material };
