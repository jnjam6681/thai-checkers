# หมากฮอสไทย (Thai Checkers)

เกมหมากฮอสไทยบนเว็บ สร้างด้วย React + Vite มีระบบ AI บอทและโค้ชอธิบายการเดิน

## ฟีเจอร์

- กระดาน 8×8 ตามกฎหมากฮอสไทย
- บอท AI 3 ระดับ: ง่าย / ปานกลาง / ยาก
- ระบบแนะนำหมาก พร้อมอธิบายเหตุผลและคาดการณ์ตาถัดไป
- รองรับการกินหลายตาต่อเนื่อง (multi-jump)
- ย้อนตาได้
- แผงสอนกฎและกติกา

## กฎหลัก

| ตัวหมาก | การเดิน |
|---------|---------|
| เบี้ย | เดินหน้า 1 ช่องทแยง |
| ฮอส | บินทแยงได้ไกลกี่ช่องก็ได้ |
| กินบังคับ | ถ้ามีตากินต้องกินก่อน |

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด [http://localhost:5173](http://localhost:5173) ในเบราว์เซอร์

## คำสั่ง

| คำสั่ง | ความหมาย |
|--------|----------|
| `npm run dev` | เปิด dev server |
| `npm run build` | build สำหรับ production |
| `npm run preview` | preview production build |

## โครงสร้างโปรเจกต์

```
src/
├── game/
│   ├── rules.js      # กฎและ logic การเดิน
│   └── ai.js         # บอท AI และระบบแนะนำหมาก
├── components/
│   ├── Board.jsx     # กระดานหมาก
│   └── TutorialPanel.jsx  # แผงสอนกฎ
├── App.jsx           # หน้าหลักและ state management
└── styles.css        # สไตล์ทั้งหมด
```

## Tech Stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
