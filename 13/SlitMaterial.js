import {
  BackSide,
  GLSL3,
  Vector3,
  RawShaderMaterial,
} from "../third_party/three.module.js";
import { shader as noise } from "../shaders/noise.js";

const vertexShader = `

precision highp float;

in vec3 position;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

out vec2 vUv;
out vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1. );
}`;

const fragmentShader = `precision highp float;

in vec3 vPosition;

uniform vec3 light1Pos;
uniform vec3 light1Dir;
uniform vec3 light1Color;

uniform vec3 light2Pos;
uniform vec3 light2Dir;
uniform vec3 light2Color;

uniform vec3 light3Pos;
uniform vec3 light3Dir;
uniform vec3 light3Color;

uniform float time;

out vec4 fragColor;

${noise}

vec3 calcColor(in vec3 lightPos, in vec3 lightDir, in vec3 lightColor) {
  vec3 dir = vPosition-lightPos; 
  float d = 2./ pow(length(dir), 2.);
  d += .01 * noise(lightPos.xy);
  d *= 1.-.5*abs(dot(lightDir, dir));
  return lightColor * d;
}

vec4 GammaToLinear( in vec4 value, in float gammaFactor ) {
	return vec4( pow( value.rgb, vec3( gammaFactor ) ), value.a );
}

void main() {
  vec3 c1 = calcColor(light1Pos, light1Dir, light1Color);
  vec3 c2 = calcColor(light2Pos, light2Dir, light2Color);
  vec3 c3 = calcColor(light3Pos, light3Dir, light3Color);
  fragColor = vec4(c1 + c2 + c3 ,1.);
  float d = .5 + 1./length(vPosition);
  fragColor *= d;
  fragColor += .01 * noise(gl_FragCoord.xy + vec2(time, 0.));
  fragColor = GammaToLinear(fragColor, 2.2);
}`;

const material = new RawShaderMaterial({
  uniforms: {
    light1Pos: { value: new Vector3() },
    light1Dir: { value: new Vector3() },
    light1Color: { value: new Vector3() },
    light2Pos: { value: new Vector3() },
    light2Dir: { value: new Vector3() },
    light2Color: { value: new Vector3() },
    light3Pos: { value: new Vector3() },
    light3Dir: { value: new Vector3() },
    light3Color: { value: new Vector3() },
    time: { value: 0 },
  },
  vertexShader,
  fragmentShader,
  side: BackSide,
  glslVersion: GLSL3,
});

export { material };
