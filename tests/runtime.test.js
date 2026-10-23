import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Texture, Box3, Vector3, Raycaster } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssemblyRig } from '../src/assembly.js';
import { ProductViewer } from '../src/viewer.js';

const EPS = 1e-7;
async function loadRig() {
  const buffer = await readFile(new URL('../public/assets/powerconnex_exploded.glb', import.meta.url));
  const loader = new GLTFLoader();
  // Only texture decoding is stubbed; production geometry, picking and assembly run unchanged.
  loader.register(() => ({ name: 'NODE_TEXTURE_DECODE_STUB', loadTexture: async () => new Texture() }));
  const gltf = await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  return new AssemblyRig(gltf.scene);
}
const near = (a, b, message) => assert.ok(Math.abs(a - b) < EPS, `${message}: ${a} vs ${b}`);
const box = object => {
  object.geometry.computeBoundingBox();
  return object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
};

test('Three.js loads corrected geometry, materials and hierarchy within the web budget', async () => {
  const rig = await loadRig();
  assert.equal(rig.meshes.length, 77); assert.equal(rig.parts.length, 57);
  const inventory = JSON.parse(await readFile(new URL('../public/assets/parts_inventory.json', import.meta.url)));
  assert.equal(inventory.assembly_version, 2);
  let triangles = 0;
  for (const mesh of rig.meshes) {
    assert.ok(mesh.material && mesh.geometry.attributes.normal);
    assert.ok(mesh.geometry.attributes.position.count > 0);
    triangles += mesh.geometry.index.count / 3;
    assert.ok(mesh.position.distanceTo(new Vector3().fromArray(mesh.userData.exploded_location_gltf_m)) < EPS, mesh.name);
  }
  assert.equal(triangles, inventory.triangles); assert.ok(triangles < 100000);
});

test('assembled geometry fits the housing and springs sit on carriers beneath the lids', async () => {
  const rig = await loadRig(); rig.assemble();
  const housing = box(rig.byName.get('Aluminum_Alloy_Housing'));
  near(housing.max.y, .042, '42 mm housing'); near(housing.getSize(new Vector3()).x, .3, '300 mm length');
  const liner = box(rig.byName.get('PVC_Insulation_Liner'));
  for (let i = 1; i <= 4; i++) {
    const prefix = `Outlet_0${i}_`, face = rig.byName.get(prefix + 'Faceplate');
    const body = box(rig.byName.get(prefix + 'Molded_Outlet_Body'));
    const carrier = box(rig.byName.get(prefix + 'Shutter_Carrier'));
    const spring = box(rig.byName.get(prefix + 'Industrial_Spring'));
    const shutter = box(rig.byName.get(prefix + 'Safety_Shutter'));
    const lid = box(face), underside = lid.max.y - .003;
    near(lid.max.y, .045, `${prefix} flush top`); near(body.max.y, .04, `${prefix} body below rim`);
    assert.ok(body.min.y >= liner.max.y - EPS, prefix + ' feet above insulation');
    assert.ok(body.min.z >= housing.min.z + .0025 - EPS && body.max.z <= housing.max.z - .0025 + EPS, prefix + ' side clearance');
    assert.ok(carrier.min.x >= body.min.x + .0045 - EPS && carrier.max.x <= body.max.x - .0045 + EPS, prefix + ' carrier inset');
    assert.ok(carrier.max.y <= underside - .0005 + EPS, prefix + ' carrier below lid');
    const floorTop = rig.byName.get(prefix + 'Shutter_Carrier').position.y + .0015;
    assert.ok(spring.min.y >= floorTop - EPS && spring.min.y - floorTop < .0003, prefix + ' spring on floor');
    assert.ok(spring.max.y <= underside - .0005 + EPS, prefix + ' spring under lid');
    assert.ok(spring.min.x >= carrier.min.x && spring.max.x <= carrier.max.x, prefix + ' spring inside carrier');
    assert.ok(spring.max.z <= shutter.min.z - .0005 + EPS, prefix + ' spring clear of shutter');
    assert.ok(shutter.max.y <= underside - .0005 + EPS, prefix + ' shutter below lid');
    near(rig.byName.get(prefix + 'Industrial_Spring').position.x, face.position.x, `${prefix} spring pivot centered`);
    assert.ok(Math.abs(spring.getCenter(new Vector3()).x - face.position.x) < .00002, prefix + ' coil sampling within 0.02 mm');
  }
  const covers = rig.parts.filter(o => o.name.endsWith('_Faceplate') || o.name.startsWith('Top_End_Cover_')).map(box).sort((a, b) => a.min.x - b.min.x);
  assert.equal(covers.length, 6); near(covers[0].min.x, housing.min.x, 'left cover edge');
  near(covers.at(-1).max.x, housing.max.x, 'right cover edge');
  for (let i = 1; i < covers.length; i++) near(covers[i - 1].max.x, covers[i].min.x, 'no top gaps or overlaps');
  for (const cover of covers) { near(cover.min.z, housing.min.z, 'cover width'); near(cover.max.z, housing.max.z, 'cover width'); }
});

test('logos remain attached at every pose and follow manual movement and assembly reset', async () => {
  const rig = await loadRig(), attachments = rig.meshes.filter(o => o.userData.interaction_owner);
  assert.equal(attachments.length, 20);
  for (const factor of [0, .25, .5, .75, 1, .5, 0, 1]) {
    rig.applyPose(factor);
    for (const attachment of attachments) {
      const owner = rig.resolve(attachment);
      assert.equal(attachment.parent, owner); assert.ok(!rig.parts.includes(attachment));
      attachment.position.toArray().forEach((coordinate, axis) => near(coordinate, attachment.userData.exploded_location_gltf_m[axis], attachment.name));
      near(box(attachment).min.y - box(owner).max.y, attachment.name.includes('Logo') ? .00003 : .00004, attachment.name + ' surface gap');
    }
    for (const face of rig.parts.filter(o => o.name.endsWith('_Faceplate'))) {
      const spring = rig.byName.get(face.name.replace('Faceplate', 'Industrial_Spring'));
      near(spring.getWorldPosition(new Vector3()).x, face.getWorldPosition(new Vector3()).x, 'no doubled spring X offset');
    }
  }
  const face = rig.byName.get('Outlet_01_Faceplate'), logo = rig.byName.get('Outlet_01_PowerConnex_Logo');
  const before = logo.getWorldPosition(new Vector3());
  rig.offsets.set(face.uuid, [.02, .03, -.01]); rig.applyPose(1);
  assert.ok(logo.getWorldPosition(new Vector3()).sub(before).distanceTo(new Vector3(.02, .03, -.01)) < EPS);
  for (const part of rig.parts) rig.offsets.set(part.uuid, [.07, .15, -.02]);
  rig.assemble(); assert.equal(rig.offsets.size, 0);
  for (const part of rig.parts) assert.ok(part.position.distanceTo(new Vector3().fromArray(part.userData.assembled_location_gltf_m)) < EPS, part.name);
});

test('raycasting a logo resolves its faceplate and hiding the face hides its decorations', async () => {
  const rig = await loadRig(); rig.assemble();
  const logo = rig.byName.get('Outlet_01_PowerConnex_Logo'), face = rig.byName.get('Outlet_01_Faceplate');
  const target = box(logo).getCenter(new Vector3()), eye = target.clone().add(new Vector3(0, .2, 0));
  const ray = new Raycaster(eye, target.clone().sub(eye).normalize());
  const hit = ray.intersectObjects(rig.parts, true)[0]?.object;
  assert.equal(rig.resolve(hit), face); assert.equal(rig.resolve('Outlet_01_PowerConnex_Logo'), face);
  face.visible = false;
  assert.ok(!ray.intersectObjects(rig.parts.filter(o => o.visible), true).some(intersection => intersection.object === logo));
});

test('viewer 0% exits dragging, clears manual offsets and isolation, restores all parts and locks movement', async () => {
  const rig = await loadRig();
  // Exercise the production controller without creating a GPU renderer.
  const viewer = new EventTarget(); Object.setPrototypeOf(viewer, ProductViewer.prototype);
  const face = rig.byName.get('Outlet_01_Faceplate');
  let detached = false, moveMode = true;
  Object.assign(viewer, { rig, model: rig.model, parts: rig.parts, poses: rig.poses, offsets: rig.offsets,
    transform: { dragging: true, detach: () => { detached = true; } }, controls: { enabled: false },
    outline: { visible: false }, hiddenParts: new Set([face.name]), isolated: true,
    selected: face, dragging: true, reducedMotion: true, explosion: .5 });
  viewer.addEventListener('move-mode', event => { moveMode = event.detail; });
  for (const part of rig.parts) { rig.offsets.set(part.uuid, [.02, .1, .04]); part.visible = false; }
  viewer.setExplosion(0);
  assert.ok(detached); assert.equal(moveMode, false); assert.equal(viewer.dragging, false); assert.equal(viewer.transform.dragging, false);
  assert.equal(viewer.controls.enabled, true); assert.equal(viewer.hiddenParts.size, 0);
  assert.equal(viewer.isolated, false); assert.equal(viewer.offsets.size, 0);
  assert.ok(viewer.parts.every(part => part.visible)); assert.equal(viewer.toggleMove(), false);
  for (const part of rig.parts) assert.ok(part.position.distanceTo(new Vector3().fromArray(part.userData.assembled_location_gltf_m)) < EPS, part.name);
  viewer.hide('Outlet_01_PowerConnex_Logo');
  assert.equal(face.visible, false); assert.ok(viewer.hiddenParts.has(face.name));
  viewer.toggleVisibility('Outlet_01_PowerConnex_Logo');
  assert.equal(face.visible, true);
});
