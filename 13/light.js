import {
  CylinderBufferGeometry,
  Group,
  IcosahedronBufferGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SpotLight,
  Color,
  Vector3,
} from "../third_party/three.module.js";
import { curl, generateNoiseFunction } from "../modules/curl.js";

const center = new Vector3(0, 0, 0);

class Light {
  constructor(color) {
    this.fn = generateNoiseFunction();
    this.lightFn = generateNoiseFunction();

    this.color = new Color(color);
    this.source = new Group();

    this.caseMaterial = new MeshStandardMaterial({
      metalness: 1,
      roughness: 0.5,
    });

    const caseMesh = new Mesh(
      new CylinderBufferGeometry(0.1, 0.1, 0.1, 36, 1),
      this.caseMaterial
    );
    caseMesh.castShadow = caseMesh.receiveShadow = true;
    const rot = new Matrix4().makeRotationX(-Math.PI / 2);
    caseMesh.applyMatrix4(rot);
    caseMesh.position.z = -0.05;
    this.source.add(caseMesh);
    this.caseMesh = caseMesh;
    this.blackMaterial = new MeshBasicMaterial({ color: 0 });

    this.bulbMesh = new Mesh(
      new IcosahedronBufferGeometry(0.09, 10),
      new MeshBasicMaterial({ color: color })
    );
    this.bulbMesh.scale.z = 0.2;
    this.source.add(this.bulbMesh);

    this.bulb2Mesh = new Mesh(
      new CylinderBufferGeometry(0.11, 0.11, 0.01, 36, 1),
      new MeshBasicMaterial({ color: color })
    );
    const rot2 = new Matrix4().makeRotationX(-Math.PI / 2);
    this.bulb2Mesh.applyMatrix4(rot2);
    this.bulb2Mesh.position.z = -0.05;
    this.source.add(this.bulb2Mesh);

    this.light = new SpotLight(color, 1, 5, 30, 1, 1);
    this.light.castShadow = true;
    this.source.add(this.light);

    this.position = new Vector3();
    this.mode = 0;
  }

  set mode(mode) {
    if (mode === 0) {
      this.bulbMesh.visible = true;
      this.bulb2Mesh.visible = false;
    } else {
      this.bulbMesh.visible = false;
      this.bulb2Mesh.visible = true;
    }
  }

  update(time) {
    const t = time / 10000;
    const p = new Vector3(t, 0, 0);
    const n = curl(p, this.fn);
    const i = curl(p, this.lightFn);
    this.position.copy(n);
    this.source.position.copy(n);
    this.source.lookAt(center);
    const lum = 0.5 + 0.5 * i.x;
    this.bulb2Mesh.material.color.setRGB(
      this.color.r * lum,
      this.color.g * lum,
      this.color.b * lum
    );
    this.light.intensity = lum;
    this.bulbMesh.material.color.setRGB(
      this.color.r * lum,
      this.color.g * lum,
      this.color.b * lum
    );
  }
}

export { Light };
