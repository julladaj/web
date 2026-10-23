import { interpolatePose } from './parts.js';

/** Geometry and interaction ownership, shared by the viewer and Node tests. */
export class AssemblyRig {
  constructor(model) {
    this.model = model; this.meshes = []; this.parts = []; this.poses = new Map(); this.offsets = new Map();
    model.traverse(object => {
      if (!object.isMesh) return;
      const assembled = object.userData.assembled_location_gltf_m;
      const exploded = object.userData.exploded_location_gltf_m;
      if (![assembled, exploded].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) throw new Error(`ข้อมูลตำแหน่งของ ${object.name} ไม่ครบ`);
      this.meshes.push(object); this.poses.set(object.uuid, { assembled, exploded });
      if (!object.userData.interaction_owner) this.parts.push(object);
    });
    this.byName = new Map(this.meshes.map(object => [object.name, object]));
    for (const object of this.meshes) {
      if (!object.userData.interaction_owner) continue;
      const owner = this.byName.get(object.userData.interaction_owner);
      const pose = this.poses.get(object.uuid);
      if (!owner || object.parent !== owner || !this.parts.includes(owner) || pose.assembled.some((v, i) => Math.abs(v - pose.exploded[i]) > 1e-7)) throw new Error(`การยึดชิ้นส่วน ${object.name} ไม่ถูกต้อง`);
    }
    if (!this.parts.length) throw new Error('ไม่พบชิ้นส่วนในไฟล์โมเดล');
  }
  resolve(objectOrName) {
    const object = typeof objectOrName === 'string' ? this.byName.get(objectOrName) : objectOrName;
    return object?.userData.interaction_owner ? this.byName.get(object.userData.interaction_owner) : object ?? null;
  }
  applyPose(factor, dragging = null) {
    for (const object of this.parts) {
      if (object === dragging) continue;
      const pose = this.poses.get(object.uuid);
      object.position.fromArray(interpolatePose(pose.assembled, pose.exploded, factor, this.offsets.get(object.uuid)));
    }
    this.model.updateMatrixWorld(true);
  }
  assemble() { this.offsets.clear(); this.applyPose(0); }
}
