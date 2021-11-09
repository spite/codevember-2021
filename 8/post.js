import { shader as vertexShader } from "../shaders/ortho.js";
import { getFBO } from "../modules/fbo.js";
import { RawShaderMaterial, GLSL3 } from "../third_party/three.module.js";
import { ShaderPass } from "../modules/ShaderPass.js";
import { shader as vignette } from "../shaders/vignette.js";
import { shader as noise } from "../shaders/noise.js";

const fragmentShader = `precision highp float;

uniform sampler2D colorMap;
uniform float time;

in vec2 vUv;

out vec4 fragColor;

${vignette}

${noise}

void main() {
  vec4 c = texture(colorMap, vUv);
  fragColor = c;
  fragColor *= vignette(vUv, 1.4, 1.4);
  fragColor +=  .01 * noise(gl_FragCoord.xy + vec2(time, 0.));
}
`;

const finalShader = new RawShaderMaterial({
  uniforms: {
    colorMap: { value: null },
    time: { value: 0 },
  },
  vertexShader,
  fragmentShader,
  glslVersion: GLSL3,
});

class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.fbo = getFBO(1, 1, {}, true);

    this.finalPass = new ShaderPass(finalShader, {}, true);
    finalShader.uniforms.colorMap.value = this.fbo.texture;
  }

  setSize(w, h) {
    this.finalPass.setSize(w, h);
    this.fbo.setSize(w, h);
  }

  render() {
    this.finalPass.shader.uniforms.time.value = performance.now();
    this.finalPass.render(this.renderer, true);
  }
}

export { Post };
