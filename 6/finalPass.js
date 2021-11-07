import { ShaderPass } from "../modules/ShaderPass.js";
import { RawShaderMaterial, GLSL3 } from "../third_party/three.module.js";
import { shader as chromaticAberration } from "../shaders/chromatic-aberration.js";
import { shader as vignette } from "../shaders/vignette.js";
import { shader as noise } from "../shaders/noise.js";

const vertexShader = `precision highp float;

in vec3 position;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;

void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `precision highp float;

in vec2 vUv;

uniform sampler2D color;

out vec4 fragColor;

${chromaticAberration}
${vignette}
${noise}

void main() {
  // vec4 c = texture(color, vUv);
  vec2 dir = .5 - vUv;
  vec4 c = chromaticAberration(color, vUv, .1, dir);
  float n = .9 + .1 * noise(gl_FragCoord.xy);
  fragColor = c * vignette(vUv, 1.1, 1.1) * n;
}
`;

const shader = new RawShaderMaterial({
  uniforms: {
    color: { value: null },
  },
  vertexShader,
  fragmentShader,
  glslVersion: GLSL3,
});
const pass = new ShaderPass(shader);

export { pass };
