# Power Connex · Interactive 3D Explorer

เว็บสำรวจโมเดลรางไฟด้วย **Vite 6 + Three.js** ใช้ GLB ต้นฉบับ 75 mesh objects โดยเก็บชื่อและ hierarchy เดิม ไม่มี backend และไม่มีบริการภายนอกที่ต้องใช้ขณะเปิดเว็บ

## เปิดเว็บ

ใช้ Node.js 20.19 ขึ้นไป เปิด Terminal ที่โฟลเดอร์นี้:

```sh
npm install
npm run dev
```

จากนั้นเปิด URL ที่ Vite แสดง เช่น `http://127.0.0.1:5173` ในเบราว์เซอร์ที่รองรับ WebGL ภายใน workspace ปัจจุบันเตรียม dependencies ไว้แล้ว จึงรัน `npm run dev` ได้ทันที

## สิ่งที่ทำได้

- หมุน ซูม เลื่อน และสลับมุม ISO / FRONT / TOP
- ปรับการประกอบ–แยกชิ้นอย่างต่อเนื่องด้วย slider 0–100%
- เลือกแต่ละ object โดยคลิกบนโมเดลหรือจากรายชื่อ ค้นหาด้วยชื่อเดิมหรือคำอธิบายไทย
- ดูชื่อ วัสดุ และคำอธิบาย พร้อม highlight ชิ้นส่วนที่เลือก
- โฟกัส ดูเฉพาะชิ้น ซ่อน/แสดง และแสดงทุกชิ้นกลับ
- ย้ายชิ้นส่วนด้วย gizmo ตามแกน X/Y/Z และคืนตำแหน่งเฉพาะชิ้น หรือเริ่มต้นใหม่ทั้งหมด
- หมุนอัตโนมัติ เปิดภาพอ้างอิงสามมุม และดาวน์โหลด GLB
- ใช้งานด้วย touch และเลือกชิ้นส่วนผ่านปุ่มด้วยคีย์บอร์ดได้

ปุ่มลัด: `F` จัดมุมมอง, `Esc` ยกเลิกการเลือก, `/` ค้นหา, `R` เริ่มต้นใหม่ การย้ายและการซ่อนเก็บใน session ปัจจุบัน ไม่เขียนทับโมเดลต้นฉบับ

## Build และตรวจสอบ

```sh
npm test
npm run build
npm run preview
```

นำไฟล์ใน `dist/` ไปวางบน static hosting ได้ ใช้ relative base เพื่อรองรับ subdirectory และฝังโมเดล/texture ไว้ภายใน ไม่ต้องเรียก CDN หรือ API เพิ่ม

```sh
npm run test:browser
```

คำสั่ง browser test ใช้ Google Chrome ที่ติดตั้งใน macOS หรือระบุ `CHROME_PATH` เอง ทดสอบโหลดโมเดล การประกอบ การเลือก raycast การซ่อน โหมดแยกชิ้น กล้อง และ responsive layout พร้อมสร้าง screenshots ใน `artifacts/`

GitHub Actions รัน Node tests, production build และ browser acceptance tests บน Chrome ใน Ubuntu พร้อมสร้าง screenshot จริงใน `../docs/screenshots/` ก่อน deploy ผ่าน GitHub Pages ดู workflow และลิงก์เว็บใน [README หลัก](../README.md)

## โครงสร้าง

- `src/viewer.js` — Three.js scene, GLTFLoader, OrbitControls, TransformControls, picking และ pose interpolation
- `src/main.js` — UI, tree, search, selection, dialogs และ keyboard controls
- `src/parts.js` — คำอธิบายชิ้นส่วน กลุ่ม และฟังก์ชันคำนวณ pose
- `public/assets/` — โมเดล GLB, inventory, ภาพอ้างอิง และ fallback preview

ใช้ `assembled_location_gltf_m` / `exploded_location_gltf_m` จาก glTF extras โดยตรง (เมตร, Y-up) ส่วนตำแหน่งที่ผู้ใช้ย้ายเป็น offset เพิ่มจาก pose ปัจจุบัน เมื่อเลื่อน slider จึงไม่ล้างระยะที่ผู้ใช้ย้ายเอง การกดคืนตำแหน่งจะล้าง offset

ขนาดตัวรางและรายละเอียดที่ภาพอ้างอิงไม่แสดงเป็นค่าประมาณตามโมเดลเดิม
