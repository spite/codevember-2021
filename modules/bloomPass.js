import {
  RawShaderMaterial,
  Vector2,
  GLSL3,
  RGBAFormat,
} from "../third_party/three.module.js";
import { ShaderPingPongPass } from "./ShaderPingPongPass.js";
import { shader as orthoVs } from "../shaders/ortho.js";
import { shader as blurFs } from "../shaders/blur.js";

const blurShader = new RawShaderMaterial({
  uniforms: {
    inputTexture: { value: null },
    direction: { value: new Vector2(0, 1) },
  },
  vertexShader: orthoVs,
  fragmentShader: blurFs,
  glslVersion: GLSL3,
});

class BloomPass {
  constructor(strength = 1, levels = 5) {
    this.strength = strength;
    this.levels = levels;
    this.blurPasses = [];
    for (let i = 0; i < this.levels; i++) {
      const blurPass = new ShaderPingPongPass(blurShader, {
        format: RGBAFormat,
      });
      this.blurPasses.push(blurPass);
    }
  }

  setSize(w, h) {
    let tw = w;
    let th = h;
    for (let i = 0; i < this.levels; i++) {
      tw /= 2;
      th /= 2;
      tw = Math.round(tw);
      th = Math.round(th);
      this.blurPasses[i].setSize(tw, th);
    }
  }

  set source(texture) {
    blurShader.uniforms.inputTexture.value = texture;
  }

  render(renderer) {
    let offset = this.strength;
    for (let j = 0; j < this.levels; j++) {
      blurShader.uniforms.direction.value.set(offset, 0);
      const blurPass = this.blurPasses[j];
      blurPass.render(renderer);
      blurShader.uniforms.inputTexture.value =
        blurPass.fbos[blurPass.currentFBO].texture;
      blurShader.uniforms.direction.value.set(0, offset);
      blurPass.render(renderer);
      blurShader.uniforms.inputTexture.value =
        blurPass.fbos[blurPass.currentFBO].texture;
    }
  }
}

export { BloomPass };
