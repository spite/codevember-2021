import {
  OrthographicCamera,
  Scene,
  Mesh,
  PlaneBufferGeometry,
} from "../third_party/three.module.js";
import { getFBO } from "./fbo.js";

class ShaderPass {
  constructor(shader, options = {}, antialiased) {
    this.shader = shader;
    this.orthoScene = new Scene();
    this.fbo = getFBO(1, 1, options, antialiased);
    this.orthoCamera = new OrthographicCamera(
      1 / -2,
      1 / 2,
      1 / 2,
      1 / -2,
      0.00001,
      1000
    );
    this.orthoQuad = new Mesh(new PlaneBufferGeometry(1, 1), this.shader);
    this.orthoQuad.scale.set(1, 1, 1);
    this.orthoScene.add(this.orthoQuad);
    this.texture = this.fbo.texture;
  }

  render(renderer, final) {
    if (!final) {
      renderer.setRenderTarget(this.fbo);
    }
    renderer.render(this.orthoScene, this.orthoCamera);
    renderer.setRenderTarget(null);
  }

  setSize(width, height) {
    this.fbo.setSize(width, height);
    this.orthoQuad.scale.set(width, height, 1);
    this.orthoCamera.left = -width / 2;
    this.orthoCamera.right = width / 2;
    this.orthoCamera.top = height / 2;
    this.orthoCamera.bottom = -height / 2;
    this.orthoCamera.updateProjectionMatrix();
  }
}

export { ShaderPass };
