import {
  BufferGeometry,
  BufferAttribute,
} from "../third_party/three.module.js";

function mergeGeometries(a, b) {
  const geo = new BufferGeometry();
  const data = new Float32Array(
    a.attributes.position.count * a.attributes.position.itemSize +
      b.attributes.position.count * b.attributes.position.itemSize
  );
  data.set(a.attributes.position.array);
  data.set(b.attributes.position.array, a.attributes.position.array.length);

  geo.setAttribute("position", new BufferAttribute(data, 3));
  return geo;
}

export { mergeGeometries };
