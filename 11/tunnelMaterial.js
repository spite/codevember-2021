import {
  BackSide,
  GLSL3,
  RawShaderMaterial,
} from "../third_party/three.module.js";
import { shader as noise3d } from "../shaders/noise3d.js";

const vertexShader = `
precision highp float;

in vec3 position;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;
out vec3 vPos;

void main() {
  vUv = uv;
  vec4 mvPos = modelViewMatrix * vec4( position, 1. );
  vPos = position;
  gl_Position = projectionMatrix * mvPos; 
}`;

const fragmentShader = `precision highp float;

in vec2 vUv;
in vec3 vPos;

uniform float time;

out vec4 fragColor;

${noise3d}

void main() {
  float n = snoise((vPos + vec3(time,0.,0.))*1.) + snoise((vPos + vec3(.5 * time,0.,0.)) * .1);// + snoise((vPos + vec3(.25*time,0.,0.)) * .01) ;
  fragColor = vec4(vec3(n/5.), 1.);
}
`;

const tunnelMaterial = new RawShaderMaterial({
  uniforms: {
    time: { value: 0 },
  },
  wireframe: !true,
  vertexShader,
  fragmentShader,
  side: BackSide,
  glslVersion: GLSL3,
});

export { tunnelMaterial };
