import { Matrix4, Vector3 } from "../third_party/three.module.js";

function adjustOrthoToBB(camera, bb) {
  camera.left = -1;
  camera.right = 1;
  camera.top = 1;
  camera.bottom = -1;
  camera.near = 0.1;
  camera.far = 2000;
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const m = camera.matrixWorld.clone().invert();

  const x1 = bb.min.x;
  const x2 = bb.max.x;
  const y1 = bb.min.y;
  const y2 = bb.max.y;
  const z1 = bb.min.z;
  const z2 = bb.max.z;

  const v = [
    new Vector3(x1, y1, z1),
    new Vector3(x1, y1, z2),
    new Vector3(x1, y2, z1),
    new Vector3(x1, y2, z2),
    new Vector3(x2, y1, z1),
    new Vector3(x2, y1, z2),
    new Vector3(x2, y2, z1),
    new Vector3(x2, y2, z2),
  ];
  let maxX = Number.MIN_SAFE_INTEGER;
  let maxY = Number.MIN_SAFE_INTEGER;
  let maxZ = Number.MIN_SAFE_INTEGER;
  let minZ = Number.MAX_SAFE_INTEGER;
  v.forEach((p) => {
    const pp = p.clone().project(camera);
    maxX = Math.max(maxX, Math.abs(pp.x));
    maxY = Math.max(maxY, Math.abs(pp.y));
    const ppp = p.clone().applyMatrix4(m);
    maxZ = Math.max(maxZ, ppp.z);
    minZ = Math.min(minZ, ppp.z);
  });

  camera.left = -maxX;
  camera.right = maxX;
  camera.top = maxY;
  camera.bottom = -maxY;
  camera.near = -maxZ;
  camera.far = -minZ;
  camera.updateProjectionMatrix();
}

export { adjustOrthoToBB };
