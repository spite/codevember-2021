const shader = `
float aastep(float value, float threshold) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return smoothstep(threshold-afwidth, threshold+afwidth, value);
}
`;

export { shader };
