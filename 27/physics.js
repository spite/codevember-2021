let ammo;

const gravityConstant = -9.8;
let collisionConfiguration;
let dispatcher;
let broadphase;
let solver;
let softBodySolver;
let physicsWorld;
const rigidBodies = [];
const margin = 0.05;
let transformAux1;

async function init() {
  ammo = await Ammo();
  collisionConfiguration = new ammo.btSoftBodyRigidBodyCollisionConfiguration();
  dispatcher = new ammo.btCollisionDispatcher(collisionConfiguration);
  broadphase = new ammo.btDbvtBroadphase();
  solver = new ammo.btSequentialImpulseConstraintSolver();
  softBodySolver = new ammo.btDefaultSoftBodySolver();
  physicsWorld = new ammo.btSoftRigidDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration,
    softBodySolver
  );
  physicsWorld.setGravity(new ammo.btVector3(0, gravityConstant, 0));
  physicsWorld
    .getWorldInfo()
    .set_m_gravity(new ammo.btVector3(0, gravityConstant, 0));

  transformAux1 = new ammo.btTransform();

  return ammo;
}

function createParalellepiped(sx, sy, sz, mass, pos, quat, material) {
  const shape = new ammo.btBoxShape(
    new ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );
  shape.setMargin(margin);

  createRigidBody(threeObject, shape, mass, pos, quat);

  return threeObject;
}

function createRigidBody(threeObject, physicsShape, mass, pos, quat) {
  const transform = new ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new ammo.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(new ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
  const motionState = new ammo.btDefaultMotionState(transform);

  const localInertia = new ammo.btVector3(0, 0, 0);
  physicsShape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    physicsShape,
    localInertia
  );
  const body = new ammo.btRigidBody(rbInfo);

  threeObject.userData.physicsBody = body;

  if (mass > 0) {
    rigidBodies.push(threeObject);

    // Disable deactivation
    // body.setActivationState(4);
  }

  physicsWorld.addRigidBody(body);

  return body;
}

function removeRigidBody(obj) {
  physicsWorld.removeRigidBody(obj.userData.physicsBody);
}

function update(deltaTime) {
  // Step world
  physicsWorld.stepSimulation(deltaTime, 10);

  // Update rigid bodies
  for (let i = 0, il = rigidBodies.length; i < il; i++) {
    const objThree = rigidBodies[i];
    const objPhys = objThree.userData.physicsBody;
    const ms = objPhys.getMotionState();
    if (ms) {
      ms.getWorldTransform(transformAux1);
      const p = transformAux1.getOrigin();
      const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
  }
}

export { init, createRigidBody, createParalellepiped, update, removeRigidBody };
