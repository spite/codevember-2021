import {
  BufferGeometry,
  Material,
  Color,
  Vector2,
  RawShaderMaterial,
  BufferAttribute,
} from "../third_party/three.module.js";

function memcpy(src, srcOffset, dst, dstOffset, length) {
  var i;

  src = src.subarray || src.slice ? src : src.buffer;
  dst = dst.subarray || dst.slice ? dst : dst.buffer;

  src = srcOffset
    ? src.subarray
      ? src.subarray(srcOffset, length && srcOffset + length)
      : src.slice(srcOffset, length && srcOffset + length)
    : src;

  if (dst.set) {
    dst.set(src, dstOffset);
  } else {
    for (i = 0; i < src.length; i++) {
      dst[i + dstOffset] = src[i];
    }
  }

  return dst;
}

class MeshLine extends BufferGeometry {
  constructor() {
    super();

    this.positions = [];

    this.previous = [];
    this.next = [];
    this.side = [];
    this.width = [];
    this.indices_array = [];
    this.uvs = [];
    this.counters = [];

    this.widthCallback = null;
  }

  setPoints(points) {
    this.positions.length = 0;

    for (var j = 0; j < points.length; j++) {
      var p = points[j];
      var c = j / points.length;
      this.positions.push(p.x, p.y, p.z);
      this.positions.push(p.x, p.y, p.z);
      this.counters.push(c);
      this.counters.push(c);
    }

    this.process();
  }

  compareV3(a, b) {
    var aa = a * 6;
    var ab = b * 6;
    return (
      this.positions[aa] === this.positions[ab] &&
      this.positions[aa + 1] === this.positions[ab + 1] &&
      this.positions[aa + 2] === this.positions[ab + 2]
    );
  }

  copyV3(a) {
    var aa = a * 6;
    return [this.positions[aa], this.positions[aa + 1], this.positions[aa + 2]];
  }

  process() {
    var l = this.positions.length / 6;

    this.previous = [];
    this.next = [];
    this.side = [];
    this.width = [];
    this.indices_array = [];
    this.uvs = [];

    var w;

    var v;
    // initial previous points
    if (this.compareV3(0, l - 1)) {
      v = this.copyV3(l - 2);
    } else {
      v = this.copyV3(0);
    }
    this.previous.push(v[0], v[1], v[2]);
    this.previous.push(v[0], v[1], v[2]);

    for (var j = 0; j < l; j++) {
      // sides
      this.side.push(1);
      this.side.push(-1);

      // widths
      if (this.widthCallback) w = this.widthCallback(j / (l - 1));
      else w = 1;
      this.width.push(w);
      this.width.push(w);

      // uvs
      this.uvs.push(j / (l - 1), 0);
      this.uvs.push(j / (l - 1), 1);

      if (j < l - 1) {
        // points previous to poisitions
        v = this.copyV3(j);
        this.previous.push(v[0], v[1], v[2]);
        this.previous.push(v[0], v[1], v[2]);

        // indices
        var n = j * 2;
        this.indices_array.push(n, n + 1, n + 2);
        this.indices_array.push(n + 2, n + 1, n + 3);
      }
      if (j > 0) {
        // points after poisitions
        v = this.copyV3(j);
        this.next.push(v[0], v[1], v[2]);
        this.next.push(v[0], v[1], v[2]);
      }
    }

    // last next point
    if (this.compareV3(l - 1, 0)) {
      v = this.copyV3(1);
    } else {
      v = this.copyV3(l - 1);
    }
    this.next.push(v[0], v[1], v[2]);
    this.next.push(v[0], v[1], v[2]);

    // redefining the attribute seems to prevent range errors
    // if the user sets a differing number of vertices
    if (
      !this._attributes ||
      this._attributes.position.count !== this.positions.length / 3
    ) {
      this._attributes = {
        position: new BufferAttribute(new Float32Array(this.positions), 3),
        previous: new BufferAttribute(new Float32Array(this.previous), 3),
        next: new BufferAttribute(new Float32Array(this.next), 3),
        side: new BufferAttribute(new Float32Array(this.side), 1),
        width: new BufferAttribute(new Float32Array(this.width), 1),
        uv: new BufferAttribute(new Float32Array(this.uvs), 2),
        index: new BufferAttribute(new Uint16Array(this.indices_array), 1),
        counters: new BufferAttribute(new Float32Array(this.counters), 1),
      };
    } else {
      this._attributes.position.copyArray(new Float32Array(this.positions));
      this._attributes.position.needsUpdate = true;
      this._attributes.previous.copyArray(new Float32Array(this.previous));
      this._attributes.previous.needsUpdate = true;
      this._attributes.next.copyArray(new Float32Array(this.next));
      this._attributes.next.needsUpdate = true;
      this._attributes.side.copyArray(new Float32Array(this.side));
      this._attributes.side.needsUpdate = true;
      this._attributes.width.copyArray(new Float32Array(this.width));
      this._attributes.width.needsUpdate = true;
      this._attributes.uv.copyArray(new Float32Array(this.uvs));
      this._attributes.uv.needsUpdate = true;
      this._attributes.index.copyArray(new Uint16Array(this.indices_array));
      this._attributes.index.needsUpdate = true;
    }

    this.setAttribute("position", this._attributes.position);
    this.setAttribute("previous", this._attributes.previous);
    this.setAttribute("next", this._attributes.next);
    this.setAttribute("side", this._attributes.side);
    this.setAttribute("width", this._attributes.width);
    this.setAttribute("uv", this._attributes.uv);
    this.setAttribute("counters", this._attributes.counters);

    this.setIndex(this._attributes.index);

    this.computeBoundingSphere();
    this.computeBoundingBox();
  }

  /**
   * Fast method to advance the line by one position.  The oldest position is removed.
   * @param position
   */
  advance(position) {
    var positions = this.attributes.position.array;
    var previous = this.attributes.previous.array;
    var next = this.attributes.next.array;
    var l = positions.length;

    // PREVIOUS
    memcpy(positions, 0, previous, 0, l);

    // POSITIONS
    memcpy(positions, 6, positions, 0, l - 6);

    positions[l - 6] = position.x;
    positions[l - 5] = position.y;
    positions[l - 4] = position.z;
    positions[l - 3] = position.x;
    positions[l - 2] = position.y;
    positions[l - 1] = position.z;

    // NEXT
    memcpy(positions, 6, next, 0, l - 6);

    next[l - 6] = position.x;
    next[l - 5] = position.y;
    next[l - 4] = position.z;
    next[l - 3] = position.x;
    next[l - 2] = position.y;
    next[l - 1] = position.z;

    this.attributes.position.needsUpdate = true;
    this.attributes.previous.needsUpdate = true;
    this.attributes.next.needsUpdate = true;
  }
}

class MeshLineMaterial extends Material {
  constructor(parameters) {
    super();
    var vertexShaderSource = [
      `precision highp float;
    
    attribute vec3 position;
    attribute vec3 previous;
    attribute vec3 next;
    attribute float side;
    attribute float width;
    attribute vec2 uv;
    attribute float counters;
    
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;
    uniform vec2 resolution;
    uniform float lineWidth;
    uniform vec3 color;
    uniform float opacity;
    uniform float near;
    uniform float far;
    uniform float sizeAttenuation;
    
    varying float vDepth;
    varying vec2 vUV;
    varying vec4 vColor;
    varying float vCounters;
    
    vec2 fix( vec4 i, float aspect ) {

    
        vec2 res = i.xy / i.w;
        res.x *= aspect;
        vCounters = counters;
        return res;
    
    }
    
    void main() {
    
        float aspect = resolution.x / resolution.y;
        float pixelWidthRatio = 1. / (resolution.x * projectionMatrix[0][0]);
    
        vColor = vec4( color, opacity );
        vUV = uv;
    
        mat4 m = projectionMatrix * modelViewMatrix;
        vec4 finalPosition = m * vec4( position, 1.0 );
        vec4 prevPos = m * vec4( previous, 1.0 );
        vec4 nextPos = m * vec4( next, 1.0 );
    
        vec2 currentP = fix( finalPosition, aspect );
        vec2 prevP = fix( prevPos, aspect );
        vec2 nextP = fix( nextPos, aspect );
    
        float pixelWidth = finalPosition.w * pixelWidthRatio;
        float w = 1.8 * pixelWidth * lineWidth * width;
    
        if( sizeAttenuation == 1. ) {

            w = 1.8 * lineWidth * width;
        }
    
        vec2 dir;
        if( nextP == currentP ) dir = normalize( currentP - prevP );
        else if( prevP == currentP ) dir = normalize( nextP - currentP );
        else {

            vec2 dir1 = normalize( currentP - prevP );
            vec2 dir2 = normalize( nextP - currentP );
            dir = normalize( dir1 + dir2 );
    
            vec2 perp = vec2( -dir1.y, dir1.x );
            vec2 miter = vec2( -dir.y, dir.x );
            //w = clamp( w / dot( miter, perp ), 0., 4. * lineWidth * width );
    
        }
    
        //vec2 normal = ( cross( vec3( dir, 0. ), vec3( 0., 0., 1. ) ) ).xy;
        vec2 normal = vec2( -dir.y, dir.x );
        normal.x /= aspect;
        normal *= .5 * w;

        // float fogDensity = .35;
        // float fogDepth = - finalPosition.z;
        // float fogFactor = exp( - fogDensity * fogDensity * fogDepth * fogDepth );
        // vDepth = fogFactor; 
    
        vec4 offset = vec4( normal * side, 0.0, 1.0 );
        finalPosition.xy += offset.xy;

        gl_Position = finalPosition;
    
    }`,
    ];

    var fragmentShaderSource = [
      `#extension GL_OES_standard_derivatives : enable
    precision mediump float;

    uniform sampler2D map;
    uniform sampler2D alphaMap;
    uniform float useMap;
    uniform float useAlphaMap;
    uniform float useDash;
    uniform vec2 dashArray;
    uniform float dashOffset;
    uniform float visibility;
    uniform float alphaTest;
    uniform vec2 repeat;

    varying float vDepth;
    varying vec2 vUV;
    varying vec4 vColor;
    varying float vCounters;

    void main() {
      vec4 c = vColor;
      vec2 tuv = vUV * repeat;
      if(useDash == 1.) {
        tuv.x = mod((tuv.x + dashOffset),1.);
      }
      if( useMap == 1. ) c *= texture2D(map, tuv);
      if( useAlphaMap == 1. ) c.a *= texture2D( alphaMap, tuv ).a;
      if( useDash == 1. ){
        if(mod(vCounters*repeat.x+dashOffset,1.)>(dashArray.x / (dashArray.x+dashArray.y))) {
          c.a = 0.;
        }
      }
      if( c.a < alphaTest ) discard;
      gl_FragColor = c;
      gl_FragColor.a *= step(vCounters,visibility);
      // gl_FragColor.rgb = mix(vec3(1.), gl_FragColor.rgb, vDepth);
    }`,
    ];

    function check(v, d) {
      if (v === undefined) return d;
      return v;
    }

    parameters = parameters || {};

    this.lineWidth = check(parameters.lineWidth, 1);
    this.map = check(parameters.map, null);
    this.useMap = check(parameters.useMap, 0);
    this.alphaMap = check(parameters.alphaMap, null);
    this.useAlphaMap = check(parameters.useAlphaMap, 0);
    this.color = check(parameters.color, new Color(0xffffff));
    this.opacity = check(parameters.opacity, 1);
    this.resolution = check(parameters.resolution, new Vector2(1, 1));
    this.sizeAttenuation = check(parameters.sizeAttenuation, 1);
    this.near = check(parameters.near, 1);
    this.far = check(parameters.far, 1);
    this.dashArray = check(parameters.dashArray, new Vector2(1, 0));
    this.dashRatio = check(parameters.dashRatio, 0);
    this.dashOffset = check(parameters.dashOffset, 0);
    this.useDash = this.dashArray ? 1 : 0;
    this.visibility = check(parameters.visibility, 1);
    this.alphaTest = check(parameters.alphaTest, 0);
    this.repeat = check(parameters.repeat, new Vector2(1, 1));

    var material = new RawShaderMaterial({
      uniforms: {
        lineWidth: { value: this.lineWidth },
        map: { value: this.map },
        useMap: { value: this.useMap },
        alphaMap: { value: this.alphaMap },
        useAlphaMap: { value: this.useAlphaMap },
        color: { value: this.color },
        opacity: { value: this.opacity },
        resolution: { value: this.resolution },
        sizeAttenuation: { value: this.sizeAttenuation },
        near: { value: this.near },
        far: { value: this.far },
        dashArray: { value: this.dashArray },
        dashOffset: { value: this.dashOffset },
        useDash: { value: this.useDash },
        visibility: { value: this.visibility },
        alphaTest: { value: this.alphaTest },
        repeat: { value: this.repeat },
      },
      vertexShader: vertexShaderSource.join("\r\n"),
      fragmentShader: fragmentShaderSource.join("\r\n"),
    });

    delete parameters.lineWidth;
    delete parameters.map;
    delete parameters.useMap;
    delete parameters.alphaMap;
    delete parameters.useAlphaMap;
    delete parameters.color;
    delete parameters.opacity;
    delete parameters.resolution;
    delete parameters.sizeAttenuation;
    delete parameters.near;
    delete parameters.far;
    delete parameters.dashArray;
    delete parameters.dashOffset;
    delete parameters.dashRatio;
    delete parameters.visibility;
    delete parameters.alphaTest;
    delete parameters.repeat;

    material.type = "MeshLineMaterial";

    material.setValues(parameters);

    return material;
  }

  copy(source) {
    Material.prototype.copy.call(this, source);

    this.lineWidth = source.lineWidth;
    this.map = source.map;
    this.useMap = source.useMap;
    this.alphaMap = source.alphaMap;
    this.useAlphaMap = source.useAlphaMap;
    this.color.copy(source.color);
    this.opacity = source.opacity;
    this.resolution.copy(source.resolution);
    this.sizeAttenuation = source.sizeAttenuation;
    this.near = source.near;
    this.far = source.far;
    this.dashArray = source.dashArray;
    this.dashRatio = source.dashRatio;
    this.dashOffset = source.dashOffset;
    this.useDash = source.useDash;
    this.visibility = source.visibility;
    this.alphaTest = source.alphaTest;
    this.repeat.copy(source.repeat);

    return this;
  }
}

export { MeshLine, MeshLineMaterial };
