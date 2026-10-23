import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { interpolatePose } from './parts.js';
import { AssemblyRig } from './assembly.js';

const ZERO = [0, 0, 0];
const PRESETS = { iso: [-.54, .32, .64], front: [0, .12, .8], top: [0, .85, .0001] };
export class ProductViewer extends EventTarget {
  constructor(element) {
    super(); this.element = element; this.parts = []; this.poses = new Map(); this.offsets = new Map(); this.hiddenParts = new Set();
    this.selected = null; this.isolated = false; this.explosion = 1; this.targetExplosion = 1; this.dragging = false; this.ready = false; this.cameraTween = null;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true'); element.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#f0eee7');
    this.camera = new THREE.PerspectiveCamera(34, 1, .001, 20); this.camera.position.set(...PRESETS.iso);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.target.set(0, .075, 0);
    this.controls.enableDamping = true; this.controls.dampingFactor = .08;
    this.controls.minDistance = .045; this.controls.maxDistance = 1.8; this.controls.maxPolarAngle = Math.PI / 2 + .04; this.controls.autoRotateSpeed = .7;
    this.controls.addEventListener('start', () => { this.cameraTween = null; });
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(); this.environment = pmrem.fromScene(room, .04); this.scene.environment = this.environment.texture;
    room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x777568, 1.8));
    const key = new THREE.DirectionalLight(0xfffaf0, 3.2); key.position.set(-.4, .7, .4); key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -.5, right: .5, top: .4, bottom: -.4, near: .01, far: 2 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.00005; key.shadow.normalBias = .0005;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1); fill.position.set(.4, .2, -.3); this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ color: 0x5e594e, opacity: .13 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; floor.receiveShadow = true; this.scene.add(floor);
    const grid = new THREE.GridHelper(1.6, 64, 0xb9b4a6, 0xb9b4a6); grid.position.y = -.0022; grid.material.transparent = true; grid.material.opacity = .10; grid.material.depthWrite = false; this.scene.add(grid);
    this.outline = new THREE.Box3Helper(new THREE.Box3(), 0xd6603e); this.outline.visible = false; this.scene.add(this.outline);
    this.transform = new TransformControls(this.camera, this.renderer.domElement); this.transform.setMode('translate'); this.transform.setSize(.7);
    this.scene.add(this.transform.getHelper?.() ?? this.transform);
    this.transform.addEventListener('dragging-changed', event => { this.dragging = event.value; this.controls.enabled = !event.value; this.dragEndedAt = performance.now(); });
    this.transform.addEventListener('objectChange', () => {
      if (!this.selected) return;
      const pose = this.poses.get(this.selected.uuid);
      const base = interpolatePose(pose.assembled, pose.exploded, this.explosion);
      this.offsets.set(this.selected.uuid, this.selected.position.toArray().map((v, i) => v - base[i]));
      this.emit('moved', { name: this.selected.name });
    });
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.pointerDown = null;
    this.onPointerDown = event => { this.pointerDown = { x: event.clientX, y: event.clientY, button: event.button }; };
    this.onPointerUp = event => {
      if (!this.pointerDown || this.pointerDown.button !== 0 || this.dragging || this.transform.axis || performance.now() - (this.dragEndedAt ?? 0) < 150) return;
      if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 5) return;
      this.select(this.pick(event)); this.pointerDown = null;
    };
    this.onPointerMove = event => {
      if (event.buttons || this.dragging || this.transform.axis) { this.emit('hover', null); return; }
      const object = this.pick(event);
      this.renderer.domElement.style.cursor = object ? 'pointer' : 'grab';
      this.emit('hover', object ? { name: object.name, x: event.clientX, y: event.clientY } : null);
    };
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointermove', this.onPointerMove);
    this.onPointerLeave = () => this.emit('hover', null);
    this.onDoubleClick = event => { const o = this.pick(event); if (o) { this.select(o); this.focus(o); } };
    this.onContextLost = event => { event.preventDefault(); this.emit('error', 'การเชื่อมต่อกราฟิกหยุดทำงาน กรุณาลองเปิดโมเดลใหม่'); };
    element.addEventListener('pointerleave', this.onPointerLeave);
    element.addEventListener('dblclick', this.onDoubleClick);
    element.addEventListener('webglcontextlost', this.onContextLost, true);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(element);
    this.clock = new THREE.Clock(); this.running = true; this.animate();
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url, event => this.emit('progress', event.total ? Math.round(event.loaded / event.total * 100) : null));
    this.model = gltf.scene; this.scene.add(this.model);
    this.rig = new AssemblyRig(this.model);
    this.parts = this.rig.parts; this.meshes = this.rig.meshes; this.poses = this.rig.poses; this.offsets = this.rig.offsets;
    for (const o of this.meshes) {
      // Each mesh needs its own selection tint; source geometry remains shared.
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      o.castShadow = true; o.receiveShadow = true;
    }
    this.applyPose(); this.ready = true; this.fit('iso', false);
    this.emit('ready', { count: this.parts.length });
    this.refreshVisibility();
    return this.parts;
  }
  resize() { const { width, height } = this.element.getBoundingClientRect(); if (!width || !height) return; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); }
  pick(event) {
    if (!this.ready) return null;
    const rect = this.element.getBoundingClientRect(); this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.parts.filter(o => o.visible), true)[0]?.object;
    return this.rig.resolve(hit);
  }
  select(objectOrName) {
    const object = this.rig?.resolve(objectOrName);
    if (this.selected) this.tint(this.selected, false);
    this.transform.detach(); this.selected = object ?? null;
    if (this.selected) { this.tint(this.selected, true); this.hiddenParts.delete(this.selected.name); }
    else this.isolated = false;
    this.refreshVisibility(); this.emit('selection', this.selected?.name ?? null);
  }
  tint(object, active) {
    object.traverse(child => {
      for (const m of Array.isArray(child.material) ? child.material : child.material ? [child.material] : []) {
        if (m.emissive) { m.emissive.set(active ? 0xc8562f : 0x000000); m.emissiveIntensity = active ? .28 : 0; }
      }
    });
  }
  setExplosion(value) {
    this.targetExplosion = THREE.MathUtils.clamp(value, 0, 1);
    if (this.targetExplosion === 0) {
      this.transform.detach(); this.transform.dragging = false; this.dragging = false; this.controls.enabled = true;
      this.offsets.clear(); this.showAll(); this.emit('move-mode', false);
    }
    if (this.reducedMotion) { this.explosion = this.targetExplosion; this.applyPose(); }
  }
  applyPose() {
    this.rig?.applyPose(this.explosion, this.dragging ? this.selected : null);
  }
  refreshVisibility() {
    for (const o of this.parts) o.visible = !this.hiddenParts.has(o.name) && (!this.isolated || o === this.selected);
    this.outline.visible = !!this.selected?.visible;
    this.emit('visibility', { visible: this.parts.filter(o => o.visible).length, total: this.parts.length, isolated: this.isolated });
  }
  hide(name = this.selected?.name) {
    name = this.rig?.resolve(name)?.name;
    if (!name) return;
    this.hiddenParts.add(name);
    if (this.selected?.name === name) this.select(null);
    this.refreshVisibility();
  }
  toggleVisibility(name) {
    name = this.rig?.resolve(name)?.name;
    if (!name) return;
    if (this.hiddenParts.has(name)) this.hiddenParts.delete(name); else this.hide(name);
    this.refreshVisibility();
  }
  showAll() { this.hiddenParts.clear(); this.isolated = false; this.refreshVisibility(); }
  toggleIsolation() { if (!this.selected) return; this.isolated = !this.isolated; this.refreshVisibility(); if (this.isolated) this.focus(this.selected); else this.fit(); }
  toggleMove() {
    if (!this.selected?.visible || this.targetExplosion === 0) return false;
    if (this.transform.object) { this.transform.detach(); return false; }
    this.transform.attach(this.selected); this.emit('autorotate', false); this.controls.autoRotate = false; return true;
  }
  restoreSelected() { if (!this.selected) return; this.offsets.delete(this.selected.uuid); this.applyPose(); this.transform.detach(); this.emit('moved', { name: this.selected.name }); }
  setAutoRotate(value) { this.controls.autoRotate = value; this.emit('autorotate', value); }
  bounds(object = null) {
    const box = new THREE.Box3(); this.scene.updateMatrixWorld(true);
    if (object) box.setFromObject(object);
    else for (const part of this.parts) if (part.visible) box.union(new THREE.Box3().setFromObject(part));
    return box;
  }
  focus(object = this.selected) { if (!object) return; this.frame(this.bounds(object), null, true); }
  fit(preset = 'iso', animate = true) { if (!this.ready) return; this.frame(this.bounds(), preset, animate); }
  frame(box, preset, animate = true) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov), horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const diameter = size.length();
    const distance = Math.max(.065, diameter / (2 * Math.sin(Math.min(verticalFov, horizontalFov) / 2)) * .91);
    const direction = preset ? new THREE.Vector3(...PRESETS[preset]).normalize() : this.camera.position.clone().sub(this.controls.target).normalize();
    const position = center.clone().addScaledVector(direction, distance);
    if (!animate || this.reducedMotion) { this.camera.position.copy(position); this.controls.target.copy(center); this.controls.update(); return; }
    this.cameraTween = { start: performance.now(), from: this.camera.position.clone(), to: position, targetFrom: this.controls.target.clone(), targetTo: center };
  }
  reset() { this.offsets.clear(); this.showAll(); this.select(null); this.setAutoRotate(false); this.targetExplosion = 1; this.explosion = 1; this.applyPose(); this.fit('iso'); }
  project(name, localPoint = null) {
    const o = this.rig?.byName.get(name); if (!o) return null;
    const p = (localPoint ? o.localToWorld(new THREE.Vector3().fromArray(localPoint)) : this.bounds(o).getCenter(new THREE.Vector3())).project(this.camera), r = this.element.getBoundingClientRect();
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  }
  snapshot() { return { ready: this.ready, selected: this.selected?.name ?? null, explosion: this.explosion, targetExplosion: this.targetExplosion, isolated: this.isolated, autoRotate: this.controls.autoRotate, moving: !!this.transform.object, hidden: [...this.hiddenParts], visible: this.parts.filter(o => o.visible).length, count: this.parts.length, meshCount: this.meshes?.length ?? 0, attachments: (this.meshes ?? []).filter(o => o.userData.interaction_owner).map(o => ({ name: o.name, owner: o.parent.name, localPosition: o.position.toArray(), worldPosition: o.getWorldPosition(new THREE.Vector3()).toArray() })), parts: this.parts.map(o => ({ name: o.name, position: o.position.toArray(), assembled: this.poses.get(o.uuid).assembled, exploded: this.poses.get(o.uuid).exploded, offset: this.offsets.get(o.uuid) ?? ZERO })) }; }
  animate = () => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), .05);
    if (document.hidden) return;
    if (Math.abs(this.explosion - this.targetExplosion) > .0001 && !this.dragging) {
      this.explosion = THREE.MathUtils.damp(this.explosion, this.targetExplosion, 9, dt);
      if (Math.abs(this.explosion - this.targetExplosion) < .0001) this.explosion = this.targetExplosion;
      this.applyPose();
    }
    if (this.cameraTween) {
      const tween = this.cameraTween, t = Math.min(1, (performance.now() - tween.start) / 650), ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(tween.from, tween.to, ease); this.controls.target.lerpVectors(tween.targetFrom, tween.targetTo, ease);
      if (t === 1) this.cameraTween = null;
    }
    if (this.selected?.visible) this.outline.box.setFromObject(this.selected);
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    this.running = false; cancelAnimationFrame(this.animationId); this.resizeObserver.disconnect(); this.controls.dispose(); this.transform.dispose(); this.environment.dispose();
    const textures = new Set();
    this.scene.traverse(o => { o.geometry?.dispose(); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); m.dispose(); } });
    for (const texture of textures) texture.dispose();
    this.renderer.dispose(); this.element.replaceChildren();
    this.element.removeEventListener('pointerdown', this.onPointerDown); this.element.removeEventListener('pointerup', this.onPointerUp); this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerleave', this.onPointerLeave); this.element.removeEventListener('dblclick', this.onDoubleClick); this.element.removeEventListener('webglcontextlost', this.onContextLost, true);
  }
}
