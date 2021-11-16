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
  CylinderBufferGeometry,
  Color,
} from "../third_party/three.module.js";

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

in vec3 vPosition;
in vec3 vOrigin;
in vec3 vDirection;

out vec4 color;

uniform sampler3D map;
uniform sampler3D noise;
uniform float time;
uniform float up;

uniform float cut;
uniform float opacity;
uniform float steps;
uniform vec3 darkColor;
uniform vec3 lightColor;

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

float sample1( vec3 p ) {
  vec3 pr = p - .5;
  pr = rotate(pr, vec3(1.,0.,0.), time);
  pr += .5;

  float distort = texture(noise, mod(pr + vec3(0., time*.05 + pr.y * .1,0.), vec3(1.))).r;
  p += vec3(.1*distort);

  pr = p - .5;
  pr = rotate(pr, vec3(0.,1.,0.), 2.* pr.y);
  pr += .5;

  return texture(map, mod(pr + vec3(0., -time*up,0.), vec3(1.))).r;
}

void main(){

  vec3 rayDir = normalize(vDirection);
  vec2 bounds = hitBox(vOrigin, rayDir);
  if (bounds.x > bounds.y) discard;
  bounds.x = max(bounds.x, 0.);

  vec3 p = vOrigin + bounds.x * rayDir;
  vec3 inc = 1.0 / abs(rayDir);
  float delta = min(inc.x, min(inc.y, inc.z));
  delta /= steps;

  vec4 ac = vec4(0.,0.,0.,0.);

  float total = 0.;
  for (float t = bounds.x; t < bounds.y; t += delta) {
    float d = sample1(p + .5);
    float radius = length(p.xz);
    float g = (.5-1.5*radius);
    float cc = cut - g;
    g = 2. * g * g;
    cc += .75 * (p.y+.5);
    if ( d > cc ) {
      float f = cc;

      vec3 c = vec3(.1)*f;
      color.rgb += c;
      color.a += .1;
      total += f;
    }
    p += rayDir * delta;
  }
  color.rgb += 1.-(p.y -.5);
  color.rgb /= total;

  float l = color.r * color.a;
  color.rgb = mix(darkColor, lightColor, l);
  
}
`;

class Volume {
  constructor(data, noiseData, width, height, depth) {
    const texture = new DataTexture3D(data, width, height, depth);
    texture.format = RedFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.unpackAlignment = 1;
    this.texture = texture;

    const noiseTexture = new DataTexture3D(noiseData, width, height, depth);
    noiseTexture.format = RedFormat;
    noiseTexture.type = FloatType;
    noiseTexture.minFilter = LinearFilter;
    noiseTexture.magFilter = LinearFilter;
    noiseTexture.unpackAlignment = 1;
    this.noiseTexture = noiseTexture;

    const geo = new CylinderBufferGeometry(0.5, 0.5, 1, 36, 1);
    const mat = new RawShaderMaterial({
      uniforms: {
        map: { value: texture },
        noise: { value: noiseTexture },
        cameraPos: { value: new Vector3() },
        darkColor: { value: new Color() },
        lightColor: { value: new Color() },
        time: { value: 0.0 },
        up: { value: 1 },
        cut: { value: 0.5 },
        opacity: { value: 0.1 },
        steps: { value: 200 },
      },
      transparent: true,
      vertexShader,
      fragmentShader,
      side: BackSide,
    });

    this.material = mat;
    this.mesh = new Mesh(geo, mat);
    this.mesh.scale.y = 2;
  }

  render(camera, time) {
    this.mesh.material.uniforms.cameraPos.value.copy(camera.position);
    this.mesh.material.uniforms.time.value = time;
  }
}

export { Volume };
