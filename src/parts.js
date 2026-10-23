export const GROUPS = [
  { id: 'Housing_And_Mounting', title: 'ตัวรางและขายึด', subtitle: 'Housing & mounting', number: '01' },
  { id: 'Conductors_And_Insulation', title: 'ตัวนำและฉนวน', subtitle: 'Conductors & insulation', number: '02' },
  ...Array.from({ length: 4 }, (_, i) => ({ id: `Outlet_0${i + 1}`, title: `ชุดเต้ารับ ${String(i + 1).padStart(2, '0')}`, subtitle: 'Outlet assembly', number: String(i + 3).padStart(2, '0') })),
];
const types = [
  ['Top_End_Cover', 'ฝาปิดบนปลายราง', 'พลาสติกสีดำ', 'แผ่นปิดช่องว่างระหว่างชุดเต้ารับกับปลายราง ให้ด้านบนปิดครบความยาวเมื่อประกอบสมบูรณ์', '#343738'],
  ['Aluminum_Alloy_Housing', 'รางอะลูมิเนียม', 'อะลูมิเนียมสีทอง', 'โครงรางรูปตัว U พร้อมสันยึดภายใน เป็นฐานรองรับชุดเต้ารับและส่วนประกอบทั้งหมด', '#b58e30'],
  ['Mounting_Bracket', 'ขายึดราง', 'โลหะเคลือบดำ', 'ขายึดรูปตัว L มีช่องยาวสำหรับปรับตำแหน่งติดตั้ง แยกออกจากแผ่นปิดปลายราง', '#343738'],
  ['End_Plate', 'แผ่นปิดปลายราง', 'วัสดุผิวดำ', 'ปิดส่วนปลายของโครงราง ด้านซ้ายมีช่องสำหรับทางเข้าสายไฟตามภาพอ้างอิง', '#343738'],
  ['PVC_Insulation', 'ฉนวนรองราง', 'PVC สีดำ', 'ชั้นฉนวนและสันรองรับระหว่างโครงรางกับชุดตัวนำภายใน', '#292b2b'],
  ['Solid_Copper_Bar', 'แถบทองแดง', 'ทองแดง', 'แถบตัวนำต่อเนื่องตามแนวยาวของราง ตำแหน่งเส้นทางที่ภาพไม่แสดงเป็นการประมาณ', '#b6784e'],
  ['Copper_Coated_Nickel_Contact', 'หน้าสัมผัสเต้ารับ', 'โลหะหน้าสัมผัส', 'ชิ้นโลหะพับเป็นขาสัมผัส อยู่ภายในฐานเต้ารับและเชื่อมกับแถบตัวนำ', '#9c9583'],
  ['Lead_Free_Solder', 'จุดเชื่อมตะกั่วบัดกรี', 'โลหะบัดกรีไร้สารตะกั่ว', 'ตำแหน่งเชื่อมหน้าสัมผัสกับชุดตัวนำ จำลองตามองค์ประกอบที่เห็นในภาพ', '#939c9d'],
  ['Faceplate', 'ฝาหน้าเต้ารับ', 'พลาสติกขึ้นรูปสีดำ', 'ฝาครอบพร้อมรูเสียบและขาล็อก โลโก้และตัวอักษรยึดกับฝาเสมอ ด้านล่างแยกจากชุดชัตเตอร์', '#343738'],
  ['Industrial_Spring', 'สปริงอุตสาหกรรม', 'เหล็กสปริง', 'สปริงอัดแบบขดตามแนวนอน เป็นส่วนหนึ่งของกลไกชัตเตอร์ภายในเต้ารับ', '#8a949a'],
  ['Safety_Shutter', 'ชัตเตอร์นิรภัย', 'พลาสติกสีดำ', 'แผ่นเลื่อนใต้ฝาหน้าเต้ารับ แยกเป็นชิ้นเพื่อสำรวจรูปทรงและตำแหน่งกลไกภายใน', '#3d403e'],
  ['Shutter_Carrier', 'ฐานรองชัตเตอร์', 'พลาสติกขึ้นรูปสีดำ', 'โครงรองรับสปริงและชัตเตอร์ มีผนังนำทางและช่องเปิดตรงกับตำแหน่งรูเสียบ', '#343738'],
  ['Molded_Outlet_Body', 'ฐานเต้ารับ', 'พลาสติกขึ้นรูปสีดำ', 'ตัวเรือนด้านล่าง มีร่องล็อก ผนังกั้น ครีบเสริม และขารองรับ แยกจากฝาและกลไกด้านบน', '#343738'],
  ['PowerConnex_Logo', 'โลโก้ Power Connex', 'ลวดลายบนผิว', 'โลโก้ยึดกับฝาหน้าเต้ารับถาวร เลือก ย้าย และซ่อนพร้อมกับฝา ไม่สามารถแยกออกจากฝาได้', '#343738'],
  ['Marking', 'เครื่องหมายบนเต้ารับ', 'ลวดลายบนผิว', 'เครื่องหมายและตัวอักษรยึดกับฝาหน้าเต้ารับถาวร ขยับและซ่อนพร้อมกับฝา', '#343738'],
];
export function describePart(name) {
  const type = types.find(([key]) => name.includes(key));
  const outlet = name.match(/^Outlet_(\d+)_/);
  const suffix = name.endsWith('_Left') ? ' · ซ้าย' : name.endsWith('_Right') ? ' · ขวา' : '';
  const number = name.match(/_(\d+)$/)?.[1];
  const title = (type?.[1] ?? name.replaceAll('_', ' ')) + suffix + (number ? ` ${number}` : '');
  return { title, material: type?.[2] ?? 'วัสดุโมเดล', description: type?.[3] ?? 'ชิ้นส่วนของรางไฟที่จำลองจากภาพอ้างอิง', color: type?.[4] ?? '#343738', group: outlet ? `OUTLET ${outlet[1]}` : name.includes('Copper_Bar') || name.includes('PVC_') ? 'CONDUCTOR' : 'HOUSING' };
}
export function interpolatePose(assembled, exploded, factor, offset = [0, 0, 0]) {
  const t = Math.max(0, Math.min(1, factor));
  return assembled.map((value, i) => value + (exploded[i] - value) * t + offset[i]);
}
export function matchPart(name, query) {
  const info = describePart(name);
  return `${name} ${info.title} ${info.material} ${info.group}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
