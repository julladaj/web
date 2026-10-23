import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GROUPS, describePart, interpolatePose, matchPart } from '../src/parts.js';

const binary = fs.readFileSync(new URL('../public/assets/powerconnex_exploded.glb', import.meta.url));
const jsonLength = binary.readUInt32LE(12);
const gltf = JSON.parse(binary.subarray(20, 20 + jsonLength).toString());
const nodes = gltf.nodes.filter(node => node.mesh !== undefined);
test('all 75 source meshes retain usable local glTF poses and belong to a listed group', () => {
  assert.equal(nodes.length, 75);
  const groups = new Map();
  for (const group of GROUPS) { const node = gltf.nodes.find(node => node.name === group.id); assert.ok(node, group.id); for (const child of node.children) groups.set(child, group.id); }
  for (const node of nodes) {
    const index = gltf.nodes.indexOf(node); assert.ok(groups.has(index), node.name);
    for (const key of ['assembled_location_gltf_m', 'exploded_location_gltf_m']) { assert.equal(node.extras[key].length, 3); assert.ok(node.extras[key].every(Number.isFinite)); }
    const position = node.translation ?? [0, 0, 0];
    node.extras.exploded_location_gltf_m.forEach((coordinate, axis) => assert.ok(Math.abs(coordinate - position[axis]) < 1e-7, node.name));
  }
});
test('assembly interpolation respects endpoints, clamps factor, and preserves user movement', () => {
  const a = [0, .02, 0], e = [.15, .15, -.03];
  assert.deepEqual(interpolatePose(a, e, 0), a);
  assert.deepEqual(interpolatePose(a, e, 1), e);
  assert.deepEqual(interpolatePose(a, e, -1), a);
  assert.deepEqual(interpolatePose(a, e, 5), e);
  const result = interpolatePose(a, e, .5, [.01, -.02, .03]);
  assert.ok(Math.abs(result[0] - .085) < 1e-10);
  assert.ok(Math.abs(result[1] - .065) < 1e-10);
  assert.ok(Math.abs(result[2] - .015) < 1e-10);
});
test('every source part has a Thai description and searches by Thai and original object names', () => {
  for (const node of nodes) { const info = describePart(node.name); assert.match(info.title, /[ก-๙]/); assert.ok(info.description.length > 20); assert.ok(matchPart(node.name, node.name.toLowerCase())); }
  assert.ok(matchPart('Outlet_01_Industrial_Spring', 'สปริง'));
  assert.ok(matchPart('Outlet_01_Industrial_Spring', 'STEEL') === false);
  assert.ok(matchPart('Aluminum_Alloy_Housing', 'อะลูมิเนียม'));
  assert.ok(!matchPart('Outlet_01_Faceplate', 'ไม่มีชิ้นส่วนนี้'));
});
test('runtime GLB embeds textures and excludes Blender studio objects', () => {
  assert.ok(gltf.images.every(image => image.bufferView !== undefined));
  assert.ok(!gltf.nodes.some(node => node.camera !== undefined || node.name.includes('Studio')));
  assert.equal(binary.subarray(0, 4).toString(), 'glTF');
  assert.ok(binary.length < 2_000_000);
});
