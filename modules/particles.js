import {
  RawShaderMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  AdditiveBlending,
  DynamicDrawUsage,
  Points,
} from "../third_party/three.module.js";

const vertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec3 color;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in float size;

out vec3 vColor;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * 300. * (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `#version 300 es
precision highp float;

in vec3 vColor;

out vec4 color;

float aastep(in float threshold, in float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return 1.-smoothstep(threshold-afwidth, threshold+afwidth, value);
}

void main() {
  vec2 uv = gl_PointCoord.xy - .5;
  float d = length(uv);
  // d = aastep(.5, d);
  d = (d - .5) / max(fwidth(d), 0.0001) + 0.5;
  d = 1.-d;
  d = clamp(0., 1., d);
  
  vec3 n = normalize(vec3(uv,1.));
  float diffuse = dot(n,normalize(vec3(-1., -1., 1.)));
  float halfLambert = .5 + .5 * diffuse;
  color = vec4(vColor*halfLambert, d);
  // color = vec4(vec3(d), d);
}`;

const shaderMaterial = new RawShaderMaterial({
  uniforms: {},
  vertexShader,
  fragmentShader,
  transparent: true,
});

function init(amount) {
  const geometry = new BufferGeometry();

  const positions = [];
  const colors = [];
  const sizes = [];

  for (let i = 0; i < amount; i++) {
    positions.push(0);
    positions.push(0);
    positions.push(0);

    colors.push(1, 1, 1);

    sizes.push(1);
  }

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("size", new Float32BufferAttribute(sizes, 1));

  const particleSystem = new Points(geometry, shaderMaterial);

  return particleSystem;
}

export { init };
