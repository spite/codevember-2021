import {
  RawShaderMaterial,
  GLSL3,
  TextureLoader,
  DoubleSide,
  Vector2,
  Vector3,
} from "../third_party/three.module.js";
import { ShaderPass } from "../modules/ShaderPass.js";

const loader = new TextureLoader();
const blade = loader.load("../assets/blade.jpg");

const vertexShader = `precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;
in mat4 instanceMatrix;
in vec3 instanceColor;

uniform mat3 normalMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

uniform mat4 modelMatrix;

uniform float time;
uniform sampler2D curlMap;
uniform vec3 boulder;

out vec3 vNormal;
out vec2 vUv;
out float vDry;
out float vLight;

float inCubic(in float t) {
  return t * t * t;
}

float outCubic(in float t ) {
  return --t * t * t + 1.;
}

void main() {
  float cover = .25;

  vUv = vec2(uv.x, 1.-uv.y);
  vec3 base = (instanceMatrix * vec4(position.xy, 0., 1.)).xyz;
  vec3 dBoulder = (boulder-base);
  vLight = (1./length(dBoulder))/5.;
  vLight = pow(vLight, 2.);
  if(length(dBoulder)>cover) {
    dBoulder = vec3(0.);
  }

  vec2 size = vec2(textureSize(curlMap, 0));
  float id = float(int(instanceColor.x));
  vec2 curlUv = instanceColor.yz;
  curlUv = vec2(mod(id, size.x)/(size.x), (id/size.x)/(size.y));
  vec4 c = texture(curlMap, curlUv);
  vec3 n = c.xyz;
  float h = (1.+ c.a);
  if(length(dBoulder) > 0.) {
    float l = length(dBoulder)/cover;
    // n.xy *= l*10.;
    h *= l;
  } 
  vec3 pNormal =(transpose(inverse(modelMatrix)) * vec4(normalize(vec3(.01 * n.xy, 1.)), 1.)).xyz;
  vec3 target = normalize(position + pNormal ) * h;
  vNormal = normalMatrix * normal;
  vec3 offset;
  float f = inCubic(position.z);//pow(position.z, 4.);
  offset = mix(position, target, f);
  // offset *= length(dBoulder);

  vDry = c.a;
  
 vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(offset, 1.0);
  // vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;;
}`;

const fragmentShader = `precision highp float;

in vec2 vUv;
in float vDry;
in float vLight;

uniform sampler2D blade;

out vec4 fragColor;

void main() {
  vec4 c = texture(blade, vUv);
  if(c.r < .5) {
    discard;
  }
  vec3 color1 = vec3(75., 112., 34.) / 255.;
  vec3 color2 = vec3(93., 128., 47.) / 255.;
  vec3 color3 = vec3(102., 146., 44.)/ 255.;
  vec3 color4 = vec3(216., 255., 147.)/ 255.;

  vec3 color = mix(mix(color1, color2, vUv.y), color3, vDry);
  color = mix(color, color4, vLight);
  fragColor = vec4(color * vUv.y, 1.);
}`;

class GrassMaterial extends RawShaderMaterial {
  constructor(options) {
    super({
      vertexShader,
      fragmentShader,
      glslVersion: GLSL3,
      ...options,
      uniforms: {
        curlMap: { value: null },
        boulder: { value: new Vector3() },
        time: { value: 0 },
        persistence: { value: 1 },
        blade: { value: blade },
      },
      side: DoubleSide,
      transparent: true,
    });
  }
}

export { GrassMaterial };
