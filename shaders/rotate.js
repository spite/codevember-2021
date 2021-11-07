const shader = `
vec3 opTwistX( vec3 p, float twist ) {
  float k = twist;
  float c = cos(k*p.x);
  float s = sin(k*p.x);
  mat2  m = mat2(c,-s,s,c);
  vec2 r = m*p.yz;
  vec3 q = vec3(p.x,r.x,r.y);
  return q;
}

vec3 opTwistY( vec3 p, float twist ) {
  float k = twist;
  float c = cos(k*p.y);
  float s = sin(k*p.y);
  mat2  m = mat2(c,-s,s,c);
  vec2 r = m*p.xz;
  vec3 q = vec3(r.x,p.y,r.y);
  return q;
}

vec3 opTwistZ( vec3 p, float twist ) {
  float k = twist;
  float c = cos(k*p.z);
  float s = sin(k*p.z);
  mat2  m = mat2(c,-s,s,c);
  vec2 r = m*p.xy;
  vec3 q = vec3(r.x,r.y,p.z);
  return q;
}

vec3 rotate(vec3 p) {
  return opTwistX(opTwistY(opTwistZ(p, twistZ), twistY), twistX);
}`;

export { shader };
