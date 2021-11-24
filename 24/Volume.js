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

float sdSphere(in vec3 p, in float r) {
  return length(p)-r;
}

float opSmoothUnion( float d1, float d2, float k ) {
  float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
  return mix( d2, d1, h ) - k*h*(1.0-h); }


float egg( vec3 p ) {
  float d1 = sdSphere(p - vec3(0.,.2 * cos(time),0.), .2);
  float d2 = sdSphere(p - vec3(.2*cos(time*1.1),.2*sin(time*.9),0.), .2);
  float d3 = sdSphere(p - vec3(-.2*cos(time*1.05),.2 * sin(time*1.12),.2*sin(time*.98)), .2);
  float d4 = sdSphere(p - vec3(-.1*cos(time*1.2),.1 * sin(time*.97),.2*cos(time*1.1)), .2);
  float d5 = sdSphere(p - vec3(-.2*cos(time*1.05),.2 * sin(time*1.01),-.2*cos(time*.99)), .1);

  float d6 = sdSphere(p - mousePosition, .1);

  float k = .3;
  return opSmoothUnion(d6, opSmoothUnion(d5, opSmoothUnion(d4, opSmoothUnion(d3, opSmoothUnion(d1, d2, k), k), k), k), k);
}

float yolk(vec3 p) {
  return sdSphere(p, .15);
}

#define epsilon .0001

vec3 normal( in vec3 p ) // for function f(p)
{
    const float h = 0.0001; // replace by an appropriate value
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*egg( p + k.xyy*h ) + 
                      k.yyx*egg( p + k.yyx*h ) + 
                      k.yxy*egg( p + k.yxy*h ) + 
                      k.xxx*egg( p + k.xxx*h ) );
}

vec3 normalYolk( in vec3 p ) // for function f(p)
{
    const float h = 0.0001; // replace by an appropriate value
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*yolk( p + k.xyy*h ) + 
                      k.yyx*yolk( p + k.yyx*h ) + 
                      k.yxy*yolk( p + k.yxy*h ) + 
                      k.xxx*yolk( p + k.xxx*h ) );
}

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

  vec3 p = vOrigin + bounds.y * rayDir;
  vec3 rayDir2 = rayDir;
  vec3 p2 = vOrigin + bounds.y * rayDir2;

  vec3 inc = 1.0 / abs(rayDir);
  float delta = min(inc.x, min(inc.y, inc.z));
  delta /= steps;

  float light = 0.1;
  vec4 lines = vec4(0.);

  vec3 l = normalize(vec3(0.,1.,0.));
  
  float total = 0.;
  float prev = 100.;
  float alpha = 0.;
  float alphaAccum = 0.;
  vec3 color = vec3(0.);
  float rim = 0.;
  bool bend = false;
  float ref = 0.;
  float yolkMask = 0.;
  int yolkSteps = 0;
  bool yolkShaded = false;

  float depth = 0.;
  for (float t = bounds.x; t < bounds.y; t += delta) {
    float d = egg(p);
    // if(d<0.) {
    //   rim += 1. / steps;
    //   total++;
    // } else {
    //   rim += d / steps;
    // }
    if ( (d < 0. && prev >= 0.) || (d >0. && prev <= 0.)) {
      vec3 n = normal(p);
      vec3 e = normalize(-rayDir);
      float cm = sampleEnvMap(reflect(e,n), envMap, 0.).r;
      cm = pow(cm, 5.);
      float r = 1. - max(0., dot(e, n));
      rim += r;
      ref += r * cm ;/// depth;
      rayDir2 = refract(rayDir, -n, .85);
      total++;
    }
    if(d < 0.) {
      alpha+= -d*100.;
      alphaAccum++;
    }
    if(yolkSteps < 10) {
      float dd = yolk(p2);
      float fringe = .05;
      if(dd>0. && dd<fringe) {
        yolkMask +=  100. * (fringe - dd ) / steps;
      }
      if(dd<0. && dd>-fringe) {
        yolkMask +=  100. * (fringe - dd ) / steps;
      }
      if(dd<0. ) {
        yolkMask += .1;

        if(!yolkShaded) {
          vec3 n = normalYolk(p2);
          vec3 e = normalize(-rayDir2);
          float cm = sampleEnvMap(reflect(e,n), envMap, 0.).r;
          cm = pow(cm, 10.);
          float r = 1. - max(0., dot(e, n));
          rim += r;
          ref += cm;
          total++;
          yolkShaded = true;
        }

        yolkSteps++;
      }
    }
    prev = d;
    p -= rayDir * delta;
    p2 -= rayDir2 * delta;
    depth += .01;
  }
  rim /= total;
  ref /= total;
  alpha /= alphaAccum;

  vec3 clear = vec3(255., 238., 195.) / 255.;
  vec3 inner = vec3(228., 176., 66.) / 255.;
  vec3 yolkColor = vec3(222., 135., 2.) / 255.;
  vec3 c = mix(clear, inner, 1.-rim);

  float r = rim;
  rim = .75 + rim * .25;

  c = mix(c, yolkColor, yolkMask);

  fragColor.rgb = c * rim;
  fragColor.rgb = screen(fragColor.rgb, vec3(ref + 4.* ref * pow(r,5.)), 1.);
  fragColor.a = alpha;

  // fragColor.rgb = vec3(yolkMask);
  // fragColor.a = 1.;
}
`;

const loader = new TextureLoader();
const envMap = loader.load("../assets/kiara_interior_2k.jpg");
envMap.wrapS = envMap.wrapT = RepeatWrapping;

class Volume {
  constructor() {
    const geo = new BoxBufferGeometry(1, 1, 1);
    const mat = new RawShaderMaterial({
      uniforms: {
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
