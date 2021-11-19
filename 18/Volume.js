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

out vec4 fragColor;

uniform sampler3D map;
uniform sampler3D noise;
uniform float time;

uniform float cut;
uniform float range;
uniform float opacity;
uniform float steps;
uniform bool accumulate;
uniform vec3 color;

vec2 hitSphere(in vec3 origin, in vec3 dir){
  float radius = .5;
  vec3 oc = origin;
  float a = dot(dir, dir);
  float b = 2.0 * dot(oc, dir);
  float c = dot(oc,oc) - radius*radius;
  float discriminant = b*b - 4.*a*c;
  if(discriminant < 0.){
    return vec2(-1.0, -1.0);
  }
  else{
    float disc = sqrt(discriminant);
    return vec2((-b - disc) / (2.0*a), (-b + disc) / (2.0*a));
  }
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
  // return texture(map, p).r;

  vec3 pr = p - .5;
  pr = rotate(pr, vec3(0.,0.,1.), time/2.);
  pr += .5;
  float s = texture(map, pr).r;
  
  pr = p - .5;
  pr = rotate(pr, vec3(1.,0.,0.), time/3.);
  pr += .5;
  float n = texture(noise, pr).r;
  return min(s,  n);
}

#define epsilon .0001

vec3 normal( vec3 coord ) {

  if(coord.x < epsilon){
    return vec3(1.,0.,0.);
  }
  if(coord.x > 1.- epsilon){
    return vec3(-1.,0.,0.);
  }
  if(coord.y < epsilon){
    return vec3(0.,1.,0.);
  }
  if(coord.y > 1.- epsilon){
    return vec3(0.,-1.,0.);
  }
  if(coord.z < epsilon){
    return vec3(0.,0.,1.);
  }
  if(coord.z > 1.- epsilon){
    return vec3(0.,0.,-1.);
  }

  float step = 1./128.;
  float x = sample1( coord + vec3( -step, 0.0, 0.0 ) ) - sample1( coord + vec3( +step, 0.0, 0.0 ) );
  float y = sample1( coord + vec3( 0.0, -step, 0.0 ) ) - sample1( coord + vec3( 0.0, +step, 0.0 ) );
  float z = sample1( coord + vec3( 0.0, 0.0, -step ) ) - sample1( coord + vec3( 0.0, 0.0, +step ) );

  return normalize( vec3( x, y, z ) );

}

float aastep(float threshold, float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return smoothstep(threshold-afwidth, threshold+afwidth, value);
}

void main(){

  vec3 rayDir = normalize(vDirection);
  vec2 bounds = hitSphere(vOrigin, rayDir);
  if (bounds.x >= bounds.y) discard;
  bounds.x = max(bounds.x, 0.);

  vec3 p = vOrigin + bounds.x * rayDir;
  vec3 inc = 1.0 / abs(rayDir);
  float delta = min(inc.x, min(inc.y, inc.z));
  delta /= steps;

  float light = 0.;
  vec4 lines = vec4(0.);

  vec3 l = normalize(vec3(0.,1.,0.));
  
  float total = 0.;
  for (float t = bounds.x; t < bounds.y; t += delta) {
    float d = sample1(p + .5);
   
    // if ( d > cut ) {
    //   vec3 n = normal(p + .5);
    //   float diffuse = .5 + .5 * dot(l, n);
    //   vec3 e = normalize(-p);
    //   vec3 h = normalize(l + e);

    //   float f = d-cut;
    //   float specular = pow(max(dot(n, h), 0.), 10.);
    //   lines.rgb += color * (diffuse + specular)/10. * f;
    //   lines.a += .01 * f;
    //   total++;
    // }

    float e = 1.*length(vec2(dFdx(d), dFdy(d)));
    float f = abs(d-cut) - e;
    if(f<0.) {
      lines.rgb += vec3(1.);
      lines.a += .1;
    }
    if(lines.a>=1.) {
      t+=100.;
    }
    p += rayDir * delta;
  }
  // light /= total;
  fragColor = lines;
  fragColor.rgb *= color;
  // fragColor.a += light;

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

    const geo = new BoxBufferGeometry(1, 1, 1);
    const mat = new RawShaderMaterial({
      uniforms: {
        map: { value: texture },
        noise: { value: noiseTexture },
        cameraPos: { value: new Vector3() },
        cameraRotation: { value: new Matrix4() },
        time: { value: 0.0 },
        cut: { value: 0.5 },
        range: { value: 0.01 },
        opacity: { value: 1 },
        color: { value: new Color() },
        steps: { value: 200 },
        accumulate: { value: !true },
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
