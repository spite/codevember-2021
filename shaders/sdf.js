const shader = `
#define EPSILON 	0.0001
#define MAXDIST 	2.0
#define MAXSTEPS	10

float sdSphere( vec3 p, float s ) {
  return length(p)-s;
}

float udRoundBox( vec3 p, vec3 b, float r ) {
  return length(max(abs(p)-b,0.0))-r;
}

float dot2( in vec3 v ) { return dot(v,v); }

float sdTetrahedron(vec3 p, float size) {
  const float k = sqrt(2.0);
  p /= size;
  p.xz = abs(p.xz);
  
  float m = 2.0*p.z - k*p.y - 1.0;
  p = (m>0.0) ? p : vec3(p.z,-p.y,p.x);
  float s1 = clamp(p.x,0.0,1.0);
  float s2 = clamp((p.x-p.y*k-p.z+2.0)/4.0,0.0,1.0);
  
  m = 2.0*p.z - k*p.y - 1.0;
  float d = sign(m)*sqrt((sign(p.y*k+p.z+1.0)+sign(2.0-3.0*p.x-k*p.y-p.z)<1.0) 
                ?
                min( dot2(vec3(s1,-k*0.5,0)-p), 
                      dot2(vec3(s2, k*0.5-k*s2,1.0-s2)-p) )
                :
                m*m/6.0 );
  
  return d * size;
}

float opSmoothUnion( float d1, float d2, float k ) {
  float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
  return mix( d2, d1, h ) - k*h*(1.0-h); 
}

float opSmoothSubtraction( float d1, float d2, float k ) {
  float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
  return mix( d2, -d1, h ) + k*h*(1.0-h);
}

float opSmoothIntersection( float d1, float d2, float k ) {
  float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
  return mix( d2, d1, h ) + k*h*(1.0-h);
}

float sdRoundBox( vec3 p, vec3 b, float r ) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

float sdOctahedron( vec3 p, float s) {
  p = abs(p);
  float m = p.x+p.y+p.z-s;
  vec3 q;
       if( 3.0*p.x < m ) q = p.xyz;
  else if( 3.0*p.y < m ) q = p.yzx;
  else if( 3.0*p.z < m ) q = p.zxy;
  else return m*0.57735027;
    
  float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
  return length(vec3(q.x,q.y-s+k,q.z-k)); 
}

// https://www.shadertoy.com/view/XtyXzW

#define PI 3.14159265359
#define PHI (1.618033988749895)
#define TAU 6.283185307179586

#define GDFVector3 normalize(vec3(1, 1, 1 ))
#define GDFVector4 normalize(vec3(-1, 1, 1))
#define GDFVector5 normalize(vec3(1, -1, 1))
#define GDFVector6 normalize(vec3(1, 1, -1))
#define GDFVector7 normalize(vec3(0, 1, PHI+1.))
#define GDFVector8 normalize(vec3(0, -1, PHI+1.))
#define GDFVector9 normalize(vec3(PHI+1., 0, 1))
#define GDFVector10 normalize(vec3(-PHI-1., 0, 1))
#define GDFVector11 normalize(vec3(1, PHI+1., 0))
#define GDFVector12 normalize(vec3(-1, PHI+1., 0))
#define GDFVector13 normalize(vec3(0, PHI, 1))
#define GDFVector14 normalize(vec3(0, -PHI, 1))
#define GDFVector15 normalize(vec3(1, 0, PHI))
#define GDFVector16 normalize(vec3(-1, 0, PHI))
#define GDFVector17 normalize(vec3(PHI, 1, 0))
#define GDFVector18 normalize(vec3(-PHI, 1, 0))

#define fGDFBegin float d = 0.;
#define fGDF(v) d = max(d, abs(dot(p, v)));
#define fGDFEnd return d - r;

// Version with variable exponent.
// This is slow and does not produce correct distances, but allows for bulging of objects.
#define fGDFExp(v) d += pow(abs(dot(p, v)), e);

// Version with without exponent, creates objects with sharp edges and flat faces
#define fGDF(v) d = max(d, abs(dot(p, v)));

// https://www.shadertoy.com/view/lssfW4

#define fGDFExpEnd return pow(d, 1./e) - r;
#define fGDFEnd return d - r;

float fDodecahedron(vec3 p, float r, float e) {
	fGDFBegin
  fGDFExp(GDFVector13) fGDFExp(GDFVector14) fGDFExp(GDFVector15) fGDFExp(GDFVector16)
  fGDFExp(GDFVector17) fGDFExp(GDFVector18)
  fGDFExpEnd
}

float fDodecahedron(vec3 p, float r) {
    fGDFBegin
    fGDF(GDFVector13) fGDF(GDFVector14) fGDF(GDFVector15) fGDF(GDFVector16)
    fGDF(GDFVector17) fGDF(GDFVector18)
    fGDFEnd
}

float fIcosahedron(vec3 p, float r) {
    fGDFBegin
    fGDF(GDFVector3) fGDF(GDFVector4) fGDF(GDFVector5) fGDF(GDFVector6)
    fGDF(GDFVector7) fGDF(GDFVector8) fGDF(GDFVector9) fGDF(GDFVector10)
    fGDF(GDFVector11) fGDF(GDFVector12)
    fGDFEnd
}

float fIcosahedron(vec3 p, float r, float e) {
  fGDFBegin
  fGDFExp(GDFVector3) fGDFExp(GDFVector4) fGDFExp(GDFVector5) fGDFExp(GDFVector6)
  fGDFExp(GDFVector7) fGDFExp(GDFVector8) fGDFExp(GDFVector9) fGDFExp(GDFVector10)
  fGDFExp(GDFVector11) fGDFExp(GDFVector12)
  fGDFExpEnd
}`;

export { shader };
