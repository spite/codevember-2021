import {
  Vector3,
  BufferGeometry,
  BufferAttribute,
  Ray,
} from "../third_party/three.module.js";

const ray = new Ray();
function sliceSegment(a, b, plane) {
  ray.origin.copy(a);
  ray.direction.copy(b).sub(a).normalize();
  const res = new Vector3();
  ray.intersectPlane(plane, res);
  return res;
}

function sliceGeometry(geometry, plane, o) {
  const triangles1 = [];
  const triangles2 = [];

  const newTriangles1 = [];
  const newTriangles2 = [];

  const positions = geometry.attributes.position.array;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();

  for (let i = 0; i < positions.length; i += 9) {
    a.set(positions[i], positions[i + 1], positions[i + 2]);
    b.set(positions[i + 3], positions[i + 4], positions[i + 5]);
    c.set(positions[i + 6], positions[i + 7], positions[i + 8]);

    const dotA = Math.sign(a.dot(plane.normal));
    const dotB = Math.sign(b.dot(plane.normal));
    const dotC = Math.sign(c.dot(plane.normal));

    if (dotA === dotB && dotB == dotC && dotA === 1) {
      triangles1.push(i);
    } else if (dotA === dotB && dotB == dotC && dotA === -1) {
      triangles2.push(i);
    } else {
      if (dotA === dotB) {
        // slice AC and BC
        const n1 = sliceSegment(a, c, plane);
        const n2 = sliceSegment(b, c, plane);
        const t = dotC === 1 ? newTriangles1 : newTriangles2;
        const t2 = dotC === 1 ? newTriangles2 : newTriangles1;
        t2.push([b.clone(), n1.clone(), a.clone()]);
        t2.push([n2.clone(), n1.clone(), b.clone()]);
        t.push([n2.clone(), c.clone(), n1.clone()]);
      } else if (dotB === dotC) {
        // slice AB and AC
        const n1 = sliceSegment(a, b, plane);
        const n2 = sliceSegment(a, c, plane);
        const t = dotA === 1 ? newTriangles1 : newTriangles2;
        const t2 = dotA === 1 ? newTriangles2 : newTriangles1;
        t.push([a.clone(), n1.clone(), n2.clone()]);
        t2.push([b.clone(), n2.clone(), n1.clone()]);
        t2.push([b.clone(), c.clone(), n2.clone()]);
      } else {
        // slice AB and BC
        const n1 = sliceSegment(a, b, plane);
        const n2 = sliceSegment(b, c, plane);
        const t = dotA === 1 ? newTriangles1 : newTriangles2;
        const t2 = dotA === 1 ? newTriangles2 : newTriangles1;
        t.push([n1.clone(), n2.clone(), a.clone()]);
        t.push([n2.clone(), c.clone(), a.clone()]);
        t2.push([n2.clone(), n1.clone(), b.clone()]);
      }
    }
  }

  const geometry1 = new BufferGeometry();
  const vertices1 = new Float32Array(
    triangles1.length * 9 + newTriangles1.length * 9
  );
  let ptr = 0;
  for (const i of triangles1) {
    for (let j = 0; j < 9; j += 3) {
      vertices1[ptr + j] = positions[i + j] - o.x;
      vertices1[ptr + j + 1] = positions[i + j + 1] - o.y;
      vertices1[ptr + j + 2] = positions[i + j + 2] - o.z;
    }
    ptr += 9;
  }
  for (const t of newTriangles1) {
    for (const p of t) {
      vertices1[ptr] = p.x - o.x;
      vertices1[ptr + 1] = p.y - o.y;
      vertices1[ptr + 2] = p.z - o.z;
      ptr += 3;
    }
  }
  geometry1.setAttribute("position", new BufferAttribute(vertices1, 3));
  geometry1.computeVertexNormals();

  const geometry2 = new BufferGeometry();
  const vertices2 = new Float32Array(
    triangles2.length * 9 + newTriangles2.length * 9
  );
  ptr = 0;
  for (const i of triangles2) {
    for (let j = 0; j < 9; j += 3) {
      vertices2[ptr + j] = positions[i + j] + o.x;
      vertices2[ptr + j + 1] = positions[i + j + 1] + o.y;
      vertices2[ptr + j + 2] = positions[i + j + 2] + o.z;
    }
    ptr += 9;
  }
  for (const t of newTriangles2) {
    for (const p of t) {
      vertices2[ptr] = p.x + o.x;
      vertices2[ptr + 1] = p.y + o.y;
      vertices2[ptr + 2] = p.z + o.z;
      ptr += 3;
    }
  }
  geometry2.setAttribute("position", new BufferAttribute(vertices2, 3));
  geometry2.computeVertexNormals();

  return { geometry1, geometry2 };
}

export { sliceGeometry };
