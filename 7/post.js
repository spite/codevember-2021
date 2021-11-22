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
import { shader as crystalFragmentShader } from "./crystal.js";
import { ShaderPass } from "../modules/ShaderPass.js";
import { shader as vignette } from "../shaders/vignette.js";
import { shader as noise } from "../shaders/noise.js";
import { shader as screen } from "../shaders/screen.js";
// import { shader as fxaa } from "../shaders/fxaa.js";
// import { shader as softLight } from "../shaders/soft-light.js";
// import { shader as colorDodge } from "../shaders/color-dodge.js";
// import { shader as rgbShift } from "../shaders/rgb-shift.js";
import { BloomPass } from "../modules/bloomPass.js";
import { perlin3 } from "../third_party/perlin.js";

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

float lerpBloomFactor(float v) {
  return mix(v, 1.2 - v, 1.);
}

void main() {
  vec4 b0 = texture(blur0Texture, vUv);
  vec4 b1 = texture(blur1Texture, vUv);
  vec4 b2 = texture(blur2Texture, vUv);
  vec4 b3 = texture(blur3Texture, vUv);
  vec4 b4 = texture(blur4Texture, vUv);
  
  vec4 color = texture(inputTexture, vUv);

  vec4 b =  b0 / 20.;
  b +=  2.*b1 / 20.;
  b +=  4.*b2 / 20.;
  b +=  8.*b3 / 20.;
  b +=  16.*b4 / 20.;
  
  fragColor = screen(color,b,1.);
  fragColor *= vignette(vUv, vignetteBoost, vignetteReduction);
  fragColor += .01 * noise(gl_FragCoord.xy + vec2(time, 0.));
}
`;

const t = new Vector3();
function perlin(x, y, z) {
  const ds = 0.1;
  const dds = 1;
  const tx = x + dds * perlin3(ds * x + 35345, ds * y, ds * z);
  const ty = y + dds * perlin3(ds * x, ds * y - 345, ds * z);
  const tz = z + dds * perlin3(ds * x, ds * y, ds * z + 3456);
  const s = 2.02;
  const s2 = 0.51;
  return (
    perlin3(tx, ty, tz) +
    perlin3(s * tx, s * ty, s * tz) +
    perlin3(s2 * tx, s2 * ty, s2 * tz)
  );
}

function generatePerlin(data, ox, oy, oz) {
  let ptr = 0;
  const s = 0.05;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ox = x - 0.5 * width;
        const oy = y - 0.5 * height;
        const oz = z - 0.5 * depth;
        const alpha = Math.atan2(ox, oz);
        const d = Math.sqrt(ox ** 2 + oz ** 2);
        const beta = (0 * d) / 10;
        const px = s * (0.5 + d * Math.cos(alpha + beta));
        const py = s * (0.5 + oy);
        const pz = s * (0.5 + d * Math.sin(alpha + beta));

        data[ptr] = perlin(px, py, pz);

        ptr++;
      }
    }
  }
}

const size = 128;
const width = size;
const height = size;
const depth = size;

const data = new Float32Array(width * height * depth);
generatePerlin(data, 0, 0, 0);

const texture = new DataTexture3D(data, width, height, depth);
texture.format = RedFormat;
texture.type = FloatType;
texture.minFilter = LinearFilter;
texture.magFilter = LinearFilter;
texture.wrapS = ClampToEdgeWrapping;
texture.wrapT = ClampToEdgeWrapping;
texture.unpackAlignment = 1;

class Post {
  constructor(renderer, params = {}) {
    this.renderer = renderer;

    const supersampled = true;
    this.backFBO = getFBO(
      1,
      1,
      {
        type: HalfFloatType,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
      },
      supersampled
    );
    this.frontFBO = getFBO(
      1,
      1,
      {
        type: HalfFloatType,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
      },
      supersampled
    );
    this.normalsFBO = getFBO(
      1,
      1,
      {
        type: HalfFloatType,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
      },
      supersampled
    );
    this.colorFBO = getFBO(1, 1, {}, supersampled);

    this.crystalShader = new RawShaderMaterial({
      uniforms: {
        volumeMap: { value: texture },
        backTexture: { value: this.backFBO.texture },
        frontTexture: { value: this.frontFBO.texture },
        normalsTexture: { value: this.normalsFBO.texture },
        colorTexture: { value: this.colorFBO.texture },
        time: { value: 0 },
        lightColor: { value: null },
        darkColor: { value: null },
      },
      vertexShader: orthoVertexShader,
      fragmentShader: crystalFragmentShader,
      glslVersion: GLSL3,
    });
    this.crystalPass = new ShaderPass(this.crystalShader, {
      format: RGBAFormat,
      type: UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapt: ClampToEdgeWrapping,
    });

    this.finalShader = new RawShaderMaterial({
      uniforms: {
        resolution: { value: new Vector2(1, 1) },
        vignetteBoost: { value: params.vignetteBoost || 0.5 },
        vignetteReduction: { value: params.vignetteReduction || 0.5 },
        inputTexture: { value: this.crystalPass.fbo.texture },
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

    this.bloomPass = new BloomPass(10, 5);
  }

  setSize(w, h) {
    this.backFBO.setSize(w, h);
    this.frontFBO.setSize(w, h);
    this.normalsFBO.setSize(w, h);
    this.colorFBO.setSize(w, h);
    this.crystalPass.setSize(w, h);
    this.finalPass.setSize(w, h);
    this.finalShader.uniforms.resolution.value.set(w, h);
    this.bloomPass.setSize(w, h);
  }

  render(stone, scene, camera) {
    stone.material = stone.geoMaterial;

    this.renderer.setClearColor(0xff00ff, 0);
    stone.geoMaterial.uniforms.showNormals.value = false;
    stone.geoMaterial.side = BackSide;
    this.renderer.setRenderTarget(this.backFBO);
    this.renderer.render(scene, camera);

    stone.geoMaterial.side = FrontSide;
    this.renderer.setRenderTarget(this.frontFBO);
    this.renderer.render(scene, camera);

    stone.geoMaterial.uniforms.showNormals.value = true;
    this.renderer.setRenderTarget(this.normalsFBO);
    this.renderer.render(scene, camera);

    stone.material = stone.stoneMaterial;
    this.renderer.setRenderTarget(this.colorFBO);
    this.renderer.render(scene, camera, this.colorFBO);

    this.renderer.setRenderTarget(null);

    this.crystalPass.shader.uniforms.time.value = 0.001 * performance.now();
    this.crystalPass.render(this.renderer);

    this.bloomPass.source = this.crystalPass.fbo.texture;
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
