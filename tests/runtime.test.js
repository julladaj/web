import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Texture, Box3, Vector3, Raycaster } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { interpolatePose } from '../src/parts.js';

test('Three.js loads the real GLB hierarchy and assembles all parts without coordinate drift', async () => {
  const buffer = await readFile(new URL('../public/assets/powerconnex_exploded.glb', import.meta.url));
  const loader = new GLTFLoader();
  // Node has no image decoder/GPU. Only texture decoding is replaced; geometry,
  // materials, transforms, extras and hierarchy use the production Three loader.
  loader.register(() => ({ name: 'NODE_TEXTURE_DECODE_STUB', loadTexture: async () => new Texture() }));
  const gltf = await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  const meshes = []; gltf.scene.traverse(object => { if (object.isMesh) meshes.push(object); });
  assert.equal(meshes.length, 75);
  let triangles = 0;
  for (const mesh of meshes) {
    assert.ok(mesh.material); assert.ok(mesh.geometry.attributes.position.count > 0);
    assert.ok(mesh.geometry.attributes.normal);
    triangles += mesh.geometry.index.count / 3;
    assert.ok(mesh.position.distanceTo(new Vector3().fromArray(mesh.userData.exploded_location_gltf_m)) < 1e-7, mesh.name);
    assert.ok(mesh.parent.name === mesh.name.match(/^Outlet_\d+/)?.[0] || ['Housing_And_Mounting', 'Conductors_And_Insulation'].includes(mesh.parent.name));
  }
  assert.equal(triangles, 43562);
  const housing = meshes.find(mesh => mesh.name === 'Aluminum_Alloy_Housing');
  const bounds = new Box3().setFromObject(housing).getSize(new Vector3());
  assert.ok(Math.abs(bounds.x - .3) < .00001);
  for (const factor of [0, .35, 1]) {
    for (const mesh of meshes) mesh.position.fromArray(interpolatePose(mesh.userData.assembled_location_gltf_m, mesh.userData.exploded_location_gltf_m, factor));
    gltf.scene.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const expected = new Vector3().fromArray(interpolatePose(mesh.userData.assembled_location_gltf_m, mesh.userData.exploded_location_gltf_m, factor));
      assert.ok(mesh.getWorldPosition(new Vector3()).distanceTo(expected) < 1e-7, `${mesh.name}: ${factor}`);
    }
  }
  const face = meshes.find(mesh => mesh.name === 'Outlet_01_Faceplate');
  const surface = face.localToWorld(new Vector3(0, .0016, 0));
  const eye = new Vector3(-.54, .4, .64);
  const ray = new Raycaster(eye, surface.clone().sub(eye).normalize());
  assert.equal(ray.intersectObjects(meshes, false)[0]?.object.name, 'Outlet_01_Faceplate');
});
