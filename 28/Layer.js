import {
  RawShaderMaterial,
  GLSL3,
  Mesh,
  PlaneBufferGeometry,
} from "../third_party/three.module.js";
import { shader as vertexShader } from "../shaders/ortho.js";
import { ShaderPass } from "../modules/ShaderPass.js";
import { shader as noise } from "../shaders/noise2d.js";

const fragmentShader = `precision highp float;

uniform sampler2D inputMap;
uniform float level;
uniform sampler2D gradientMap;

in vec2 vUv;

out vec4 fragColor;

float aastep(float threshold, float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return smoothstep(threshold-afwidth, threshold+afwidth, value);
}

${noise}

void main() {
  float n = snoise(vUv);
  vec4 c = texture(inputMap, vUv);
  float attn = length(vUv-.5);
  attn = pow(attn,2.);
  float a = aastep(.25 - level/5. + .5*attn, c.g);
  float u = clamp(level - .25*attn, 0., 1.);
  vec4 color = texture(gradientMap, vec2(u + n/3., 0.));
  color = mix(vec4(0.), color, 1. - level - .25 * attn);
  fragColor = vec4(color.rgb, a- .5*level - .125 * attn);
}`;

const copyFs = `precision highp float;

uniform sampler2D inputMap;

in vec2 vUv;

out vec4 fragColor;

void main() {
  vec4 c = texture(inputMap, vUv);
  fragColor = c;
}`;

const geo = new PlaneBufferGeometry(1, 1);

class Layer extends Mesh {
  constructor(renderer) {
    const material = new RawShaderMaterial({
      uniforms: {
        inputMap: { value: null },
        level: { value: 0 },
        gradientMap: { value: null },
      },
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
      transparent: true,
    });

    super(geo, material);

    const copyShader = new RawShaderMaterial({
      uniforms: {
        inputMap: { value: null },
      },
      vertexShader,
      fragmentShader: copyFs,
      glslVersion: GLSL3,
    });

    this.copyPass = new ShaderPass(copyShader);
    this.renderer = renderer;
  }

  set gradient(texture) {
    this.material.uniforms.gradientMap.value = texture;
  }

  setSize(w, h) {
    this.copyPass.setSize(w, h);
  }

  copy(src) {
    this.copyPass.shader.uniforms.inputMap.value = src;
    this.copyPass.render(this.renderer);
    this.material.uniforms.inputMap.value = this.copyPass.texture;
  }
}

export { Layer };
