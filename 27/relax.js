import { Vector3 } from "../third_party/three.module.js";

function getPoint(geo, id, t) {
  const d = geo.attributes.position.array;
  const ptr = id * 3;
  t.set(d[ptr], d[ptr + 1], d[ptr + 2]);
}

function setPoint(geo, id, p) {
  const d = geo.attributes.position.array;
  const ptr = id * 3;
  d[ptr] = p.x;
  d[ptr + 1] = p.y;
  d[ptr + 2] = p.z;
}

function getNeighbours(geo, id) {
  const idx = geo.index.array;
  const n = new Set();
  for (let i = 0; i < geo.index.count; i += 3) {
    if (idx[i] === id || idx[i + 1] === id || idx[i + 2] === id) {
      n.add(idx[i]);
      n.add(idx[i + 1]);
      n.add(idx[i + 2]);
    }
  }
  n.delete(id);
  return Array.from(n.values());
}

function precalcNeighbours(geo) {
  const map = new Map();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    map.set(i, getNeighbours(geo, i));
  }
  return map;
}

function relaxWeighted(geo, map) {
  const positions = geo.attributes.position.array;

  const sum = new Vector3(0, 0, 0);
  const p = new Vector3();
  const t = new Vector3(0, 0, 0);
  const d = new Vector3();

  let total = 0;

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;

    if (geo.hull && geo.hull.indexOf(id) !== -1) {
      continue;
    }

    const neighbours = map.get(id);

    getPoint(geo, id, p);

    sum.set(0, 0, 0);
    let weight = 0;
    for (let j = 0; j < neighbours.length; j++) {
      getPoint(geo, neighbours[j], t);

      d.copy(p).sub(t);
      const w = d.length();

      sum.add(t.multiplyScalar(w));
      weight += w;
    }
    if (weight) {
      sum.divideScalar(weight);
    }

    total += t.copy(p).sub(sum).length();
    p.copy(sum);

    setPoint(geo, id, p);
  }
  return total;
}

function relax(geo, map) {
  const positions = geo.attributes.position.array;
  const offsets = new Float32Array(positions.length);

  const p = new Vector3();
  const sum = new Vector3(0, 0, 0);
  const t = new Vector3(0, 0, 0);

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;

    const neighbours = map.get(id);

    sum.set(0, 0, 0);
    let total = 0;
    for (let j = 0; j < neighbours.length; j++) {
      getPoint(geo, neighbours[j], t);
      sum.add(t);
      total++;
    }
    if (total > 0) {
      sum.divideScalar(total);
    }
    offsets[i + 0] = sum.x;
    offsets[i + 1] = sum.y;
    offsets[i + 2] = sum.z;
  }

  for (let i = 0; i < positions.length; i += 3) {
    const id = i / 3;
    getPoint(geo, id, p);
    p.x = offsets[i + 0];
    p.y = offsets[i + 1];
    p.z = offsets[i + 2];

    setPoint(geo, id, p);
  }
}

export { relax, relaxWeighted, precalcNeighbours };
