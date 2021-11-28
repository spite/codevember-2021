import { randomInRange } from "../modules/Maf.js";
import { ShaderPingPongPass } from "../modules/ShaderPingPongPass.js";
import {
  RawShaderMaterial,
  RGBAFormat,
  FloatType,
  Vector2,
  LinearFilter,
  RepeatWrapping,
} from "../third_party/three.module.js";

const vertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;

uniform vec2 resolution;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1. );
}
`;

const fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D map;
uniform sampler2D test;
uniform sampler2D modulate;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float feed;
uniform float kill;
uniform float da;
uniform float db;
uniform float radius;

out vec4 color;

void main() {

    vec2 step = 1./resolution;

    vec2 uv = texture(map, vUv).xy;
    vec2 uv0 = texture(map, vUv+vec2(-step.x, 0.0)).xy;
    vec2 uv1 = texture(map, vUv+vec2(step.x, 0.0)).xy;
    vec2 uv2 = texture(map, vUv+vec2(0.0, -step.y)).xy;
    vec2 uv3 = texture(map, vUv+vec2(0.0, step.y)).xy;
    
    float delta = 1.;

    vec2 lapl = (uv0 + uv1 + uv2 + uv3 - 4.0*uv);
    float a = uv.x;
    float b = uv.y;
    float reaction = a*b*b;
    float du = da * lapl.x - reaction + feed*(1.0 - a);
    float dv = db * lapl.y + reaction - (feed+kill)*b;
    vec2 dst = uv + delta*vec2(du, dv);

    color = vec4(dst, 0., 1.);
    if(pointer.x>0. && pointer.y> 0. && length(vUv-pointer)<radius) {
      color.rg = vec2(0., .9);
    }
}`;

class ScottGray2D {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    this.pointer = new Vector2(0.5, 0.5);

    const shader = new RawShaderMaterial({
      uniforms: {
        map: { value: null },
        feed: { value: 0.029 },
        kill: { value: 0.057 },
        da: { value: 0.2097 },
        db: { value: 0.105 },
        radius: { value: 0.05 },
        resolution: { value: new Vector2(width, height) },
        pointer: { value: this.pointer },
      },
      vertexShader,
      fragmentShader,
    });
    this.simulation = new ShaderPingPongPass(shader, {
      format: RGBAFormat,
      type: FloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
    });
    this.simulation.setSize(width, height);
  }

  randomize() {
    this.simulation.shader.uniforms.feed.value = randomInRange(0.02, 0.03);
    this.simulation.shader.uniforms.kill.value = randomInRange(0.05, 0.06);
    this.simulation.shader.uniforms.da.value = randomInRange(0.2, 0.21);
    this.simulation.shader.uniforms.db.value = randomInRange(0.1, 0.11);
    this.simulation.shader.uniforms.radius.value = randomInRange(0.01, 0.1);
  }

  get texture() {
    return this.simulation.fbos[this.simulation.currentFBO].texture;
  }

  step() {
    this.simulation.shader.uniforms.map.value =
      this.simulation.fbos[this.simulation.currentFBO].texture;
    this.simulation.render(this.renderer);
  }
}

export { ScottGray2D };
