// Current version.
const VERSION = "1.0.0";

const PI = Math.PI;
const TAU = 2 * PI;

// https://www.opengl.org/sdk/docs/man/html/clamp.xhtml

function clamp(v, minVal, maxVal) {
  return Math.min(maxVal, Math.max(minVal, v));
}

// https://www.opengl.org/sdk/docs/man/html/step.xhtml

function step(edge, v) {
  return v < edge ? 0 : 1;
}

// https://www.opengl.org/sdk/docs/man/html/smoothstep.xhtml

function smoothStep(edge0, edge1, v) {
  var t = clamp((v - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// http://docs.unity3d.com/ScriptReference/Mathf.html
// http://www.shaderific.com/glsl-functions/
// https://www.opengl.org/sdk/docs/man4/html/
// https://msdn.microsoft.com/en-us/library/windows/desktop/ff471376(v=vs.85).aspx
// http://moutjs.com/docs/v0.11/math.html#map
// https://code.google.com/p/kuda/source/browse/public/js/hemi/utils/mathUtils.js?r=8d581c02651077c4ac3f5fc4725323210b6b13cc

// Converts from degrees to radians.
function deg2Rad(degrees) {
  return (degrees * Math.PI) / 180;
}

const toRadians = deg2Rad;

// Converts from radians to degrees.
function rad2Deg(radians) {
  return (radians * 180) / Math.PI;
}

const toDegrees = rad2Deg;

function clamp01(v) {
  return clamp(v, 0, 1);
}

// https://www.opengl.org/sdk/docs/man/html/mix.xhtml

function mix(x, y, a) {
  if (a <= 0) return x;
  if (a >= 1) return y;
  return x + a * (y - x);
}

const lerp = mix;

function inverseMix(a, b, v) {
  return (v - a) / (b - a);
}

const inverseLerp = inverseMix;

function mixUnclamped(x, y, a) {
  if (a <= 0) return x;
  if (a >= 1) return y;
  return x + a * (y - x);
}

const lerpUnclamped = mixUnclamped;

// https://www.opengl.org/sdk/docs/man/html/fract.xhtml

function fract(v) {
  return v - Math.floor(v);
}

const frac = fract;

// http://stackoverflow.com/questions/4965301/finding-if-a-number-is-a-power-of-2

function isPowerOfTwo(v) {
  return ((v - 1) & v) == 0;
}

// https://bocoup.com/weblog/find-the-closest-power-of-2-with-javascript

function closestPowerOfTwo(v) {
  return Math.pow(2, Math.round(Math.log(v) / Math.log(2)));
}

function nextPowerOfTwo(v) {
  return Math.pow(2, Math.ceil(Math.log(v) / Math.log(2)));
}

// http://stackoverflow.com/questions/1878907/the-smallest-difference-between-2-angles

//function mod(a, n) { return a - Math.floor(a/n) * n; }
function mod(a, n) {
  return ((a % n) + n) % n;
}

function deltaAngle(a, b) {
  var d = mod(b - a, 360);
  if (d > 180) d = Math.abs(d - 360);
  return d;
}

const deltaAngleDeg = deltaAngle;

function deltaAngleRad(a, b) {
  return toRadians(deltaAngle(toDegrees(a), toDegrees(b)));
}

function lerpAngle(a, b, t) {
  var angle = deltaAngle(a, b);
  return mod(a + lerp(0, angle, t), 360);
}

const lerpAngleDeg = lerpAngle;

function lerpAngleRad(a, b, t) {
  return toRadians(lerpAngleDeg(toDegrees(a), toDegrees(b), t));
}

// http://gamedev.stackexchange.com/questions/74324/gamma-space-and-linear-space-with-shader

function gammaToLinearSpace(v) {
  return Math.pow(v, 2.2);
}

function linearToGammaSpace(v) {
  return Math.pow(v, 1 / 2.2);
}

function map(from1, to1, from2, to2, v) {
  return from2 + ((v - from1) * (to2 - from2)) / (to1 - from1);
}

const scale = map;

// http://www.iquilezles.org/www/articles/functions/functions.htm

function almostIdentity(x, m, n) {
  if (x > m) return x;

  var a = 2 * n - m;
  var b = 2 * m - 3 * n;
  var t = x / m;

  return (a * t + b) * t * t + n;
}

function impulse(k, x) {
  var h = k * x;
  return h * Math.exp(1 - h);
}

function cubicPulse(c, w, x) {
  x = Math.abs(x - c);
  if (x > w) return 0;
  x /= w;
  return 1 - x * x * (3 - 2 * x);
}

function expStep(x, k, n) {
  return Math.exp(-k * Math.pow(x, n));
}

function parabola(x, k) {
  return Math.pow(4 * x * (1 - x), k);
}

function powerCurve(x, a, b) {
  var k = Math.pow(a + b, a + b) / (Math.pow(a, a) * Math.pow(b, b));
  return k * Math.pow(x, a) * Math.pow(1 - x, b);
}

// http://iquilezles.org/www/articles/smin/smin.htm ?

function latLonToCartesian(lat, lon) {
  lon += 180;
  lat = clamp(lat, -85, 85);
  var phi = toRadians(90 - lat);
  var theta = toRadians(180 - lon);
  var x = Math.sin(phi) * Math.cos(theta);
  var y = Math.cos(phi);
  var z = Math.sin(phi) * Math.sin(theta);

  return { x: x, y: y, z: z };
}

function cartesianToLatLon(x, y, z) {
  var n = Math.sqrt(x * x + y * y + z * z);
  return { lat: Math.asin(z / n), lon: Math.atan2(y, x) };
}

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function norm(v, minVal, maxVal) {
  return (v - minVal) / (maxVal - minVal);
}

function hash(n) {
  return fract((1.0 + Math.cos(n)) * 415.92653);
}

function noise2d(x, y) {
  var xhash = hash(x * 37.0);
  var yhash = hash(y * 57.0);
  return fract(xhash + yhash);
}

// http://iquilezles.org/www/articles/smin/smin.htm

function smoothMin(a, b, k) {
  var res = Math.exp(-k * a) + Math.exp(-k * b);
  return -Math.log(res) / k;
}

function smoothMax(a, b, k) {
  return Math.log(Math.exp(a) + Math.exp(b)) / k;
}

function almost(a, b) {
  return Math.abs(a - b) < 0.0001;
}

export {
  VERSION,
  PI,
  TAU,
  clamp,
  step,
  smoothStep,
  deg2Rad,
  toRadians,
  rad2Deg,
  toDegrees,
  clamp01,
  mix,
  lerp,
  inverseMix,
  inverseLerp,
  mixUnclamped,
  lerpUnclamped,
  fract,
  frac,
  isPowerOfTwo,
  closestPowerOfTwo,
  nextPowerOfTwo,
  mod,
  deltaAngle,
  deltaAngleDeg,
  deltaAngleRad,
  lerpAngleDeg,
  lerpAngleRad,
  gammaToLinearSpace,
  linearToGammaSpace,
  map,
  scale,
  almostIdentity,
  impulse,
  cubicPulse,
  expStep,
  parabola,
  powerCurve,
  latLonToCartesian,
  cartesianToLatLon,
  randomInRange,
  norm,
  hash,
  noise2d,
  smoothMin,
  smoothMax,
  almost,
};
