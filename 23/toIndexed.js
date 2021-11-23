import { Vector3 } from "../third_party/three.module.js";

function hash(p) {
  return `${p.x}:${p.y}:${p.z}`;
}

function toIndexed(geo) {
  const map = new Map();

  const position = geo.attributes.position.array;
  const indices = [];

  for (let i = 0; i < geo.attributes.position.count; i++) {
    const p = new Vector3();
    p.set(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]);
    const h = hash(p);
    let cached = map.get(h);
    if (cached) {
      indices.push(cached.id);
    } else {
      map.set(h, { point: p, id: i });
      indices.push(i);
    }
  }

  geo.setIndex(indices);

  return geo;
}

function weld(geo) {
  const map = new Map();

  const position = geo.attributes.position.array;

  for (let i = 0; i < geo.attributes.position.count; i++) {
    const p = new Vector3();
    p.set(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]);
    const h = hash(p);
    let cached = map.get(h);
    if (cached) {
    } else {
      map.set(h, { point: p, id: i });
    }
  }

  const indices = geo.index.array;
  for (let i = 0; i < indices.length; i++) {
    const p = new Vector3();
    const id = indices[i];
    p.set(position[id * 3], position[id * 3 + 1], position[id * 3 + 2]);
    const h = hash(p);
    let cached = map.get(h);
    indices[i] = cached.id;
  }

  return geo;
}

export { toIndexed, weld };
