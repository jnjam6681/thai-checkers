import React, { useState } from 'react'

const LESSONS = [
  {
    title: '1. กระดานและตัวหมาก',
    body: [
      'กระดาน 8×8 ใช้เฉพาะช่องสีเข้ม',
      'ผู้เล่นแต่ละฝ่ายมีเบี้ย 8 ตัว วางสองแถวหน้า',
      'คุณคือฝั่งล่าง (สีแดง) บอทคือฝั่งบน (สีดำ)'
    ]
  },
  {
    title: '2. การเดินของเบี้ย',
    body: [
      'เบี้ยเดินทแยงไปข้างหน้า 1 ช่องเท่านั้น',
      'กินตัวฝั่งตรงข้ามด้วยการกระโดดข้ามไปยังช่องว่างถัดไป',
      'เมื่อเบี้ยถึงแถวสุดท้ายของฝ่ายตรงข้ามจะกลายเป็น "ฮอส"'
    ]
  },
  {
    title: '3. การเดินของฮอส',
    body: [
      'ฮอสเดินทแยงไปกี่ช่องก็ได้ ทุกทิศทาง',
      'กินด้วยการบินข้ามตัวฝั่งตรงข้าม 1 ตัว แล้วลงในช่องว่างถัดไปได้ทุกช่อง',
      'ตัวที่ถูกกินยังคงอยู่จนจบชุดการกิน เพื่อกันการกินซ้ำ'
    ]
  },
  {
    title: '4. การกินบังคับ',
    body: [
      'ถ้าตาคุณมีโอกาสกิน ต้องกินเสมอ',
      'ถ้ากินแล้วยังกินต่อได้อีก ต้องกินต่อจนกว่าจะไม่มีตาให้กิน',
      'ระบบจะเลือกตัวที่กินได้ให้อัตโนมัติ'
    ]
  },
  {
    title: '5. ชนะอย่างไร',
    body: [
      'ฝั่งที่ตัวหมดก่อน หรือเดินไม่ได้ จะแพ้',
      'พยายามคุมจุดกลางและอย่าทิ้งเบี้ยให้ถูกกินฟรี',
      'การพาเบี้ยเข้าฮอสคือกุญแจสำคัญในการชนะ'
    ]
  },
  {
    title: '6. กลยุทธ์เบื้องต้น',
    body: [
      'อย่าพาเบี้ยข้ามเส้นกลางไปคนเดียว — รอเพื่อนหนุน',
      'เก็บเบี้ยแถวหลังไว้กันการเลื่อนขั้นของฝ่ายตรงข้าม',
      'ใช้ปุ่ม "💡 แนะนำหมาก" เพื่อเรียนรู้การเดินที่ดี'
    ]
  }
]

export default function TutorialPanel() {
  const [open, setOpen] = useState(true)
  const [idx, setIdx] = useState(0)

  if (!open) {
    return (
      <button className="tutorial-toggle" onClick={() => setOpen(true)}>
        📖 เปิดบทเรียน
      </button>
    )
  }

  const lesson = LESSONS[idx]
  return (
    <div className="tutorial">
      <div className="tutorial-head">
        <h3>📖 บทเรียนการเล่น</h3>
        <button className="link" onClick={() => setOpen(false)}>ซ่อน</button>
      </div>
      <h4>{lesson.title}</h4>
      <ul>{lesson.body.map((b, i) => <li key={i}>{b}</li>)}</ul>
      <div className="tutorial-nav">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>
          ← ก่อนหน้า
        </button>
        <span>{idx + 1} / {LESSONS.length}</span>
        <button
          onClick={() => setIdx(i => Math.min(LESSONS.length - 1, i + 1))}
          disabled={idx === LESSONS.length - 1}
        >
          ถัดไป →
        </button>
      </div>
    </div>
  )
}
