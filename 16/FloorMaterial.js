import {
  Color,
  GLSL3,
  RawShaderMaterial,
} from "../third_party/three.module.js";
import { shader as vertexShader } from "../shaders/ortho.js";
import { shader as noise } from "../shaders/noise.js";

const fragmentShader = `precision highp float;

in vec2 vUv;

uniform vec3 darkColor;
uniform vec3 lightColor;
uniform float time;

out vec4 fragColor;

${noise}

void main() {
  float flicker1 = .75 + .25 * noise(vec2(.123123, .123123 + time*1.));
  float flicker2 = .75 + .25 * noise(vec2(.123123, .123123 + time*3.));
  float flicker = (flicker1 * flicker2);
  float d = 1. - 2. * length(vUv -.5);
  d = clamp(d, 0., 1.);
  vec3 grad = mix(darkColor, lightColor, d);
  grad *= (2. + flicker);
  grad *= d;
  vec3 color = mix(vec3(16./255.), grad, d *flicker);

  fragColor = vec4(color, 1.);
}`;

class FloorMaterial extends RawShaderMaterial {
  constructor() {
    super({
      uniforms: {
        darkColor: { value: new Color() },
        lightColor: { value: new Color() },
        time: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
    });
  }
}
export { FloorMaterial };
