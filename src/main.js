import './style.css';
import { ProductViewer } from './viewer.js';
import { GROUPS, describePart, matchPart } from './parts.js';
import { icon, mountIcons } from './icons.js';

mountIcons();
const $ = selector => document.querySelector(selector);
const base = import.meta.env.BASE_URL;
let viewer, parts = [], loading = false;
const groupsOpen = new Set(['Housing_And_Mounting', 'Outlet_01']);
const announce = text => { $('#announcement').textContent = text; };
function setPose(value) {
  const percentage = Math.max(0, Math.min(100, Number(value)));
  $('#explosion').value = percentage; $('#explosion').style.setProperty('--progress', `${percentage}%`);
  $('#explosion-value').innerHTML = `${percentage}<span>%</span>`;
  $('#stage-caption').textContent = percentage === 0 ? 'ASSEMBLED VIEW' : percentage === 100 ? 'EXPLODED VIEW' : 'ASSEMBLY EXPLORATION';
  viewer?.setExplosion(percentage / 100);
}
function renderTree() {
  const tree = $('#parts-tree'), query = $('#part-search').value, selected = viewer?.selected?.name;
  tree.replaceChildren(); let matches = 0;
  for (const group of GROUPS) {
    const children = parts.filter(o => o.parent?.name === group.id && matchPart(o.name, query));
    if (!children.length) continue; matches += children.length;
    const detail = document.createElement('details'); detail.className = 'part-group'; detail.open = query.trim() ? true : groupsOpen.has(group.id);
    const summary = document.createElement('summary');
    summary.innerHTML = `${icon('chevron')}<span class="group-number">${group.number}</span><span class="group-label">${group.title}<small>${group.subtitle}</small></span><span class="group-count">${children.length}</span>`;
    detail.append(summary); detail.addEventListener('toggle', () => { if (!query.trim()) { if (detail.open) groupsOpen.add(group.id); else groupsOpen.delete(group.id); } });
    const list = document.createElement('div'); list.className = 'part-children';
    for (const part of children) {
      const info = describePart(part.name), row = document.createElement('div'); row.className = 'part-row'; row.dataset.name = part.name;
      row.classList.toggle('selected', part.name === selected); row.classList.toggle('part-hidden', !part.visible);
      const select = document.createElement('button'); select.className = 'part-select'; select.dataset.part = part.name; select.title = part.name;
      select.setAttribute('aria-pressed', String(part.name === selected));
      select.innerHTML = `${icon('cube')}<span></span>`; select.querySelector('span').textContent = info.title;
      select.addEventListener('click', () => { viewer.select(part.name); });
      const visibility = document.createElement('button'); visibility.className = 'part-visibility'; visibility.innerHTML = icon(part.visible ? 'eye' : 'eye-off'); visibility.title = `${part.visible ? 'ซ่อน' : 'แสดง'} ${info.title}`; visibility.setAttribute('aria-label', visibility.title);
      visibility.addEventListener('click', () => { if (viewer.isolated) viewer.showAll(); viewer.toggleVisibility(part.name); });
      row.append(select, visibility); list.append(row);
    }
    detail.append(list); tree.append(detail);
  }
  if (!matches) { const empty = document.createElement('p'); empty.className = 'tree-empty'; empty.textContent = 'ไม่พบชิ้นส่วนที่ตรงกับคำค้น'; tree.append(empty); }
  $('#parts-count').textContent = query ? `${matches}/${parts.length}` : String(parts.length);
}
function refreshRows() {
  document.querySelectorAll('.part-row').forEach(row => {
    const o = parts.find(part => part.name === row.dataset.name); const selected = viewer.selected?.name === o.name;
    row.classList.toggle('selected', selected); row.classList.toggle('part-hidden', !o.visible);
    row.querySelector('.part-select').setAttribute('aria-pressed', String(selected));
    const visibility = row.querySelector('.part-visibility'); visibility.innerHTML = icon(o.visible ? 'eye' : 'eye-off'); visibility.title = `${o.visible ? 'ซ่อน' : 'แสดง'} ${describePart(o.name).title}`; visibility.setAttribute('aria-label', visibility.title);
  });
}
function selectionChanged(name) {
  const selected = !!name; $('#detail-empty').hidden = selected; $('#detail-content').hidden = !selected; $('#selection-tag').hidden = !selected;
  $('#move-button').setAttribute('aria-pressed', 'false');
  if (name) {
    const info = describePart(name);
    $('#detail-title').textContent = info.title; $('#detail-name').textContent = name; $('#detail-name').title = name;
    $('#detail-description').textContent = info.description; $('#detail-material').textContent = info.material;
    $('#detail-group').textContent = info.group; $('#material-swatch').style.background = info.color;
    $('#selection-tag-text').textContent = info.title;
    const parent = viewer.selected.parent?.name;
    if (!groupsOpen.has(parent)) { groupsOpen.add(parent); renderTree(); }
    announce(`เลือก ${info.title}`);
  } else announce('ยกเลิกการเลือกชิ้นส่วน');
  refreshRows(); $('#isolate-button').setAttribute('aria-pressed', String(viewer.isolated));
}
async function start() {
  if (loading) return; loading = true;
  $('#error-state').hidden = true; $('#loading').hidden = false; $('#loading-title').textContent = 'กำลังเปิดโมเดล';
  try {
    viewer?.dispose(); viewer = new ProductViewer($('#viewport'));
    viewer.addEventListener('selection', event => selectionChanged(event.detail));
    viewer.addEventListener('visibility', event => {
      const { visible, total, isolated } = event.detail;
      $('#visibility-status').textContent = visible === total ? `${total} INDIVIDUAL COMPONENTS` : `${visible} / ${total} COMPONENTS VISIBLE`;
      $('#isolate-button').setAttribute('aria-pressed', String(isolated)); refreshRows();
    });
    viewer.addEventListener('progress', event => { if (event.detail != null) $('#loading-message').textContent = `กำลังโหลดโมเดล ${event.detail}%`; });
    viewer.addEventListener('autorotate', event => $('#rotate-button').setAttribute('aria-pressed', String(event.detail)));
    viewer.addEventListener('error', event => showError(event.detail));
    viewer.addEventListener('hover', event => {
      const label = $('#hover-label'); if (!event.detail) { label.hidden = true; return; }
      const rect = $('#stage').getBoundingClientRect(); label.textContent = describePart(event.detail.name).title; label.hidden = false;
      label.style.left = `${Math.min(event.detail.x - rect.left + 16, rect.width - label.offsetWidth - 12)}px`;
      label.style.top = `${Math.max(10, event.detail.y - rect.top - 34)}px`;
    });
    parts = await viewer.load(`${base}assets/powerconnex_exploded.glb`);
    renderTree(); selectionChanged(null); setPose(100); $('#loading').hidden = true;
    announce(`โมเดลพร้อมใช้งาน ${parts.length} ชิ้นส่วน`);
    // Small diagnostic surface for reproducible browser acceptance checks.
    window.__explorer = { isReady: () => viewer.ready, getState: () => viewer.snapshot(), project: (name, localPoint) => viewer.project(name, localPoint) };
  } catch (error) { console.error('Model viewer:', error); showError(error.message); }
  finally { loading = false; }
}
function showError(message) { $('#loading').hidden = true; $('#error-state').hidden = false; $('#error-message').textContent = `ตรวจสอบว่าเบราว์เซอร์รองรับ WebGL และไฟล์โมเดลโหลดได้ (${message})`; }

$('#explosion').addEventListener('input', event => setPose(event.target.value));
$('#assemble-button').addEventListener('click', () => setPose(0));
$('#explode-button').addEventListener('click', () => setPose(100));
$('#part-search').addEventListener('input', renderTree);
$('#clear-selection').addEventListener('click', () => viewer?.select(null));
$('#detail-close').addEventListener('click', () => viewer?.select(null));
$('#show-all-button').addEventListener('click', () => { viewer?.showAll(); announce('แสดงทุกชิ้นส่วนแล้ว'); });
$('#focus-button').addEventListener('click', () => viewer?.focus());
$('#isolate-button').addEventListener('click', () => viewer?.toggleIsolation());
$('#hide-button').addEventListener('click', () => viewer?.hide());
$('#move-button').addEventListener('click', event => { const active = viewer?.toggleMove(); event.currentTarget.setAttribute('aria-pressed', String(!!active)); announce(active ? 'ลากลูกศรสีบนชิ้นส่วนเพื่อย้ายตำแหน่ง' : 'ปิดการย้ายชิ้นส่วน'); });
$('#restore-part-button').addEventListener('click', () => { viewer?.restoreSelected(); $('#move-button').setAttribute('aria-pressed', 'false'); announce('คืนตำแหน่งชิ้นส่วนแล้ว'); });
$('#fit-button').addEventListener('click', () => viewer?.fit());
$('#rotate-button').addEventListener('click', () => viewer?.setAutoRotate(!viewer.controls.autoRotate));
function reset() { viewer?.reset(); setPose(100); $('#part-search').value = ''; renderTree(); document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === 'iso'); b.setAttribute('aria-pressed', String(b.dataset.view === 'iso')); }); announce('คืนค่าโมเดลและมุมมองเริ่มต้นแล้ว'); }
$('#reset-button').addEventListener('click', reset);
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  viewer?.fit(button.dataset.view);
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
}));
$('#mobile-panel-button').addEventListener('click', event => { const collapsed = $('#inspector').classList.toggle('collapsed'); event.currentTarget.setAttribute('aria-expanded', String(!collapsed)); });
$('#references-button').addEventListener('click', () => $('#references-dialog').showModal());
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } }));
$('#retry-button').addEventListener('click', start);
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return;
  const editing = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;
  if (event.key === 'Escape') { if (editing) event.target.blur(); else viewer?.select(null); return; }
  if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === '/') { event.preventDefault(); $('#inspector').classList.remove('collapsed'); $('#mobile-panel-button').setAttribute('aria-expanded', 'true'); $('#part-search').focus(); }
  if (event.key.toLowerCase() === 'f') viewer?.fit();
  if (event.key.toLowerCase() === 'r') reset();
});
setPose(100); start();
