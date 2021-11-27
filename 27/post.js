import {
  RawShaderMaterial,
  HalfFloatType,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
  LinearFilter,
  ClampToEdgeWrapping,
  BackSide,
  FrontSide,
  Vector2,
  GLSL3,
  Vector3,
  DataTexture3D,
  RedFormat,
  FloatType,
} from "../third_party/three.module.js";
import { getFBO } from "../modules/fbo.js";
import { shader as orthoVertexShader } from "../shaders/ortho.js";
import { ShaderPass } from "../modules/ShaderPass.js";
import { shader as vignette } from "../shaders/vignette.js";
import { shader as noise } from "../shaders/noise.js";
import { shader as screen } from "../shaders/screen.js";
// import { shader as fxaa } from "../shaders/fxaa.js";
// import { shader as softLight } from "../shaders/soft-light.js";
// import { shader as colorDodge } from "../shaders/color-dodge.js";
// import { shader as rgbShift } from "../shaders/rgb-shift.js";
import { BloomPass } from "../modules/bloomPass.js";

const finalFragmentShader = `
precision highp float;

uniform vec2 resolution;
uniform sampler2D inputTexture;

uniform sampler2D blur0Texture;
uniform sampler2D blur1Texture;
uniform sampler2D blur2Texture;
uniform sampler2D blur3Texture;
uniform sampler2D blur4Texture;

uniform float vignetteBoost;
uniform float vignetteReduction;

uniform float time;

in vec2 vUv;

out vec4 fragColor;

${vignette}

${noise}

${screen}

void main() {
  vec4 b0 = texture(blur0Texture, vUv);
  vec4 b1 = texture(blur1Texture, vUv);
  vec4 b2 = texture(blur2Texture, vUv);
  vec4 b3 = texture(blur3Texture, vUv);
  vec4 b4 = texture(blur4Texture, vUv);
  
  vec4 color = texture(inputTexture, vUv);

  vec4 b =  b0 / 40.;
  b +=  2.*b1 / 40.;
  b +=  4.*b2 / 40.;
  b +=  8.*b3 / 40.;
  b +=  16.*b4 / 40.;

  fragColor = screen(color, b,1.);
  fragColor *= vignette(vUv, vignetteBoost, vignetteReduction);
  fragColor += .01 * noise(gl_FragCoord.xy + vec2(time, 0.));
  // fragColor = texture(inputTexture, vUv);
}
`;

const colorFragmentShader = `precision highp float;

uniform sampler2D inputTexture;

in vec2 vUv;

out vec4 fragColor;

void main() {
  vec2 size = vec2(textureSize(inputTexture, 0));
  int steps = 10;
  float total = 0.;
  float fSteps = float(steps);
  vec4 accum = vec4(0.);
  for( int i = 0; i < steps; i++){
    vec2 inc = 20. * float(i) / (fSteps*size);
    vec2 dir = vUv-.5;
    vec4 r = texture(inputTexture, vUv - dir * inc);
    vec4 g = texture(inputTexture, vUv);
    vec4 b = texture(inputTexture, vUv + dir * inc);
    float w = float(steps - i)/fSteps;
    accum += vec4(r.r, g.g, b.b, 0.) * w;
    total += w;
  }
  accum /= total;
  fragColor = vec4(accum.rgb , 1.);
}`;

class Post {
  constructor(renderer, params = {}) {
    this.renderer = renderer;

    const supersampled = true;

    this.colorFBO = getFBO(1, 1, {}, supersampled);

    this.colorShader = new RawShaderMaterial({
      uniforms: {
        inputTexture: { value: this.colorFBO.texture },
      },
      vertexShader: orthoVertexShader,
      fragmentShader: colorFragmentShader,
      glslVersion: GLSL3,
    });

    this.colorPass = new ShaderPass(this.colorShader, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
    });

    this.finalShader = new RawShaderMaterial({
      uniforms: {
        resolution: { value: new Vector2(1, 1) },
        vignetteBoost: { value: params.vignetteBoost || 1.1 },
        vignetteReduction: { value: params.vignetteReduction || 1.1 },
        inputTexture: { value: this.colorPass.texture },
        blur0Texture: { value: null },
        blur1Texture: { value: null },
        blur2Texture: { value: null },
        blur3Texture: { value: null },
        blur4Texture: { value: null },
        time: { value: 0 },
      },
      vertexShader: orthoVertexShader,
      fragmentShader: finalFragmentShader,
      glslVersion: GLSL3,
    });
    this.finalPass = new ShaderPass(this.finalShader, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
    });

    this.bloomPass = new BloomPass(5, 5);
  }

  setSize(w, h) {
    this.colorFBO.setSize(w, h);
    this.colorPass.setSize(w, h);
    this.finalPass.setSize(w, h);
    this.finalShader.uniforms.resolution.value.set(w, h);
    this.bloomPass.setSize(w, h);
  }

  render(scene, camera) {
    this.renderer.setRenderTarget(this.colorFBO);
    this.renderer.render(scene, camera, this.colorFBO);
    this.renderer.setRenderTarget(null);

    this.colorPass.shader.uniforms.inputTexture.value = this.colorFBO.texture;
    this.colorPass.render(this.renderer);

    this.bloomPass.source = this.colorPass.texture;
    this.bloomPass.render(this.renderer);

    this.finalPass.shader.uniforms.blur0Texture.value =
      this.bloomPass.blurPasses[0].texture;
    this.finalPass.shader.uniforms.blur1Texture.value =
      this.bloomPass.blurPasses[1].texture;
    this.finalPass.shader.uniforms.blur2Texture.value =
      this.bloomPass.blurPasses[2].texture;
    this.finalPass.shader.uniforms.blur3Texture.value =
      this.bloomPass.blurPasses[3].texture;
    this.finalPass.shader.uniforms.blur4Texture.value =
      this.bloomPass.blurPasses[4].texture;
    this.finalPass.shader.uniforms.time.value = Math.random() * 100000;

    this.finalPass.render(this.renderer, true);
  }
}

export { Post };
