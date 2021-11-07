import { shader as positionsFragmentShader } from "./position-fs.js";
import { shader as positionsVertexShader } from "./position-vs.js";

const prepassMaterial = new RawShaderMaterial({
  uniforms: {
    showNormals: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: positionsVertexShader,
  fragmentShader: positionsFragmentShader,
  side: BackSide,
  glslVersion: GLSL3,
});
