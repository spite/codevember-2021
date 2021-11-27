import {
  Mesh,
  BoxBufferGeometry,
  DataTexture3D,
  RedFormat,
  FloatType,
  RawShaderMaterial,
  LinearFilter,
  Vector3,
  BackSide,
  IcosahedronBufferGeometry,
  MeshNormalMaterial,
  Matrix4,
  Color,
  TextureLoader,
  RepeatWrapping,
  Vector2,
} from "../third_party/three.module.js";
import { shader as screen } from "../shaders/screen.js";

const vertexShader = `#version 300 es
in vec3 position;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPos;

out vec3 vPosition;
out vec3 vOrigin;
out vec3 vDirection;

void main() {
  vec4 worldPosition = modelViewMatrix * vec4(position, 1.);

  vPosition = position;
  vOrigin = vec3(inverse(modelMatrix) * vec4(cameraPos, 1.)).xyz;
  vDirection = position - vOrigin;

  gl_Position = projectionMatrix * worldPosition;
}
`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp sampler3D;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

in vec3 vPosition;
in vec3 vOrigin;
in vec3 vDirection;

out vec4 fragColor;

uniform float time;
uniform vec3 mousePosition;
uniform float steps;
uniform sampler2D envMap;
uniform sampler3D voronoiMap;

vec2 hitBox(vec3 orig, vec3 dir) {
  const vec3 box_min = vec3(-.5);
  const vec3 box_max = vec3(.5);
  vec3 inv_dir = 1.0 / dir;
  vec3 tmin_tmp = (box_min - orig) * inv_dir;
  vec3 tmax_tmp = (box_max - orig) * inv_dir;
  vec3 tmin = min(tmin_tmp, tmax_tmp);
  vec3 tmax = max(tmin_tmp, tmax_tmp);
  float t0 = max(tmin.x, max(tmin.y, tmin.z));
  float t1 = min(tmax.x, min(tmax.y, tmax.z));
  return vec2(t0, t1);
}

mat4 rotationMatrix(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  
  return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
              oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
              oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
              0.0,                                0.0,                                0.0,                                1.0);
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
  mat4 m = rotationMatrix(axis, angle);
  return (m * vec4(v, 1.0)).xyz;
}

vec2 rotate(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  mat2 m = mat2(c, -s, s, c);
  return m * v;
}

float map(vec3 p) {
  return texture(voronoiMap, p).r;
}

#define epsilon .0001

// vec3 normal( in vec3 p ) // for function f(p)
// {
//     const float h = 0.0001; // replace by an appropriate value
//     const vec2 k = vec2(1,-1);
//     return normalize( k.xyy*egg( p + k.xyy*h ) + 
//                       k.yyx*egg( p + k.yyx*h ) + 
//                       k.yxy*egg( p + k.yxy*h ) + 
//                       k.xxx*egg( p + k.xxx*h ) );
// }

float aastep(float threshold, float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return smoothstep(threshold-afwidth, threshold+afwidth, value);
}

#define PI 3.14159265359

vec4 sampleEnvMap(vec3 dir, sampler2D sampler, float lod) {
  vec2 uv;
  uv.x = atan( dir.z, dir.x );
  uv.y = acos( dir.y );
  uv /= vec2( 2. * PI, PI );

  return textureLod( sampler, uv, lod );
}

${screen}

void main(){

  vec3 rayDir = normalize(vDirection);
  vec2 bounds = hitBox(vOrigin, rayDir);
  if (bounds.x >= bounds.y) discard;
  bounds.x = max(bounds.x, 0.);

  vec3 p = vOrigin + bounds.x * rayDir;

  vec3 inc = 1.0 / abs(rayDir);
  float delta = min(inc.x, min(inc.y, inc.z));
  delta /= steps;

  float light = 0.1;
  vec4 lines = vec4(0.);

  vec3 l = normalize(vec3(0.,1.,0.));
  
  float total = 0.;
  vec3 color = vec3(0.);
  float rim = 0.;

  float depth = 0.;
  for (float t = bounds.x; t < bounds.y; t += delta) {
    float d = 1.-map(p + .5);
    // d = smoothstep(.45,.55, d);
    rim += d;
    total++;
    p += rayDir * delta;
  }
  rim /= total;

  fragColor.rgb = vec3(rim);
  fragColor.a = 1.;

}
`;

const loader = new TextureLoader();
const envMap = loader.load("../assets/kiara_interior_2k.jpg");
envMap.wrapS = envMap.wrapT = RepeatWrapping;

class Volume {
  constructor(data, width, height, depth) {
    const texture = new DataTexture3D(data, width, height, depth);
    texture.format = RedFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.unpackAlignment = 1;
    this.texture = texture;

    const geo = new BoxBufferGeometry(1, 1, 1);
    const mat = new RawShaderMaterial({
      uniforms: {
        voronoiMap: { value: texture },
        cameraPos: { value: new Vector3() },
        cameraRotation: { value: new Matrix4() },
        mousePosition: { value: new Vector3(0, 0) },
        envMap: { value: envMap },
        time: { value: 0.0 },
        steps: { value: 200 },
      },
      transparent: true,
      vertexShader,
      fragmentShader,
      side: BackSide,
    });

    this.mesh = new Mesh(geo, mat);
    // this.mesh = new Mesh(geo, new MeshNormalMaterial());
  }

  render(camera, time) {
    this.mesh.material.uniforms.cameraPos.value.copy(camera.position);
    this.mesh.material.uniforms.time.value = time;
  }
}

export { Volume };
