import {
  Vector3,
  Float32BufferAttribute,
  BufferGeometry,
} from "../third_party/three.module.js";

function pointInTorus(radius, tube, u, v, target) {
  const x = (radius + tube * Math.cos(v)) * Math.cos(u);
  const y = (radius + tube * Math.cos(v)) * Math.sin(u);
  const z = tube * Math.sin(v);
  target.set(x, y, z);
}

class DisplacedTorusGeometry extends BufferGeometry {
  constructor(
    radius = 1,
    tube = 0.4,
    radialSegments = 8,
    tubularSegments = 6,
    arc = Math.PI * 2,
    displacement = null
  ) {
    super();
    this.type = "DisplacedTorusGeometry";

    this.parameters = {
      radius: radius,
      tube: tube,
      radialSegments: radialSegments,
      tubularSegments: tubularSegments,
      arc: arc,
    };

    radialSegments = Math.floor(radialSegments);
    tubularSegments = Math.floor(tubularSegments);

    // buffers

    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    // helper variables

    const center = new Vector3();
    const vertex = new Vector3();
    const normal = new Vector3();

    const vertexU1 = new Vector3();
    const vertexV1 = new Vector3();
    const vertexU2 = new Vector3();
    const vertexV2 = new Vector3();

    // generate vertices, normals and uvs

    for (let j = 0; j <= radialSegments; j++) {
      for (let i = 0; i <= tubularSegments; i++) {
        const u = (i / tubularSegments) * arc;
        const v = (j / radialSegments) * Math.PI * 2;

        // vertex

        pointInTorus(radius, tube, u, v, vertex);
        // vertex.x = (radius + tube * Math.cos(v)) * Math.cos(u);
        // vertex.y = (radius + tube * Math.cos(v)) * Math.sin(u);
        // vertex.z = tube * Math.sin(v);

        if (displacement) {
          displacement(vertex);
        }

        vertices.push(vertex.x, vertex.y, vertex.z);

        // normal

        // center.x = radius * Math.cos(u);
        // center.y = radius * Math.sin(u);
        // normal.subVectors(vertex, center).normalize();

        const e = 0.1;
        pointInTorus(radius, tube, u - e, v, vertexU1);
        pointInTorus(radius, tube, u, v - e, vertexV1);
        pointInTorus(radius, tube, u + e, v, vertexU2);
        pointInTorus(radius, tube, u, v + e, vertexV2);
        vertexU2.sub(vertexU1).normalize();
        vertexV2.sub(vertexU1).normalize();
        normal.crossVectors(vertexU2, vertexV2).normalize();

        normals.push(normal.x, normal.y, normal.z);

        // uv

        uvs.push(i / tubularSegments);
        uvs.push(j / radialSegments);
      }
    }

    // generate indices

    for (let j = 1; j <= radialSegments; j++) {
      for (let i = 1; i <= tubularSegments; i++) {
        // indices

        const a = (tubularSegments + 1) * j + i - 1;
        const b = (tubularSegments + 1) * (j - 1) + i - 1;
        const c = (tubularSegments + 1) * (j - 1) + i;
        const d = (tubularSegments + 1) * j + i;

        // faces

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    // build geometry

    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  }

  static fromJSON(data) {
    return new DisplacedTorusGeometry(
      data.radius,
      data.tube,
      data.radialSegments,
      data.tubularSegments,
      data.arc
    );
  }
}

export { DisplacedTorusGeometry };
