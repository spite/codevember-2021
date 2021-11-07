import { shader as noise3d } from "../shaders/noise3d.js";
import { shader as noise } from "../shaders/noise.js";
import { shader as softLight } from "../shaders/soft-light.js";

const shader = `
precision highp float;
precision highp sampler3D;

uniform sampler2D backTexture;
uniform sampler2D frontTexture;
uniform sampler2D normalsTexture;
uniform sampler2D colorTexture;
uniform sampler3D volumeMap;

uniform vec3 lightColor;
uniform vec3 darkColor;

uniform float time;

in vec2 vUv;

out vec4 fragColor;

${noise}

${noise3d}

${softLight}

float map( in vec3 p ){
  return texture(volumeMap, p).r;
}

#define MAX 200

void main() {

  vec3 boundingBox = vec3(3.5);
  float d = sqrt(3.5*3.5*3.5);

  vec4 normal = texture(normalsTexture, vUv);
  vec4 back = texture(backTexture,vUv);
  vec4 front = texture(frontTexture,vUv);
  vec3 dir = back.xyz-front.xyz;
  float ld = length(dir);
  dir = refract(dir,normalize(normal.xyz), .2);

  // dir = -reflect(dir, normalize(normal.xyz));
  dir = normalize(dir);
  vec3 fStep = .01*dir / (ld/d);
  // fStep += .001 *noise(gl_FragCoord.xy);
  float n = 0.;
  vec3 p = back.xyz;
  
  for(int i=0; i< MAX; i++){
    float dd = length(p.xyz - front.xyz);
    if(dd > ld) {
      break;
    }
    p = front.xyz + float(i) * fStep;
    float v = map(p/boundingBox+ 1.25/boundingBox );
    v = clamp(v, 0., 1.);
    n += smoothstep(.25, .75, v) / 2.;
    // n -=.01;
  }
  n /= d;
  //n += .1 * noise(gl_FragCoord.xy);
  
  vec4 color = texture(colorTexture, vUv);
  float mask = clamp(ld,0.,1.);
  fragColor.rgb = mix(darkColor, lightColor, n);
  fragColor.rgb += vec3( ld/10.);
  fragColor.rgb += .5 *color.rgb * back.a;
  float rim = clamp(1.-.5*ld, 0., 1.);//smoothstep(.5,1.,(1.-ld));
  fragColor.rgb += lightColor * rim * back.a;
  fragColor.rgb = mix(vec3(.3), fragColor.rgb, back.a);

  color.rgb *= lightColor;
  fragColor = softLight( fragColor,color );
  fragColor.a = 1.;

}`;

export { shader };
