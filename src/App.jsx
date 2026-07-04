import React, { useEffect, useMemo, useState } from 'react'
import Board from './components/Board.jsx'
import TutorialPanel from './components/TutorialPanel.jsx'
import {
  createInitialBoard, applyMove, getAllMoves, sideOf,
  countMaterial, checkWinner
} from './game/rules.js'
import {
  chooseBotMove, recommendMoveForPlayer, explainMove, explainRecommendation
} from './game/ai.js'

const DIFFICULTIES = [
  { id: 'easy', label: 'ง่าย', desc: 'เหมาะสำหรับมือใหม่' },
  { id: 'medium', label: 'ปานกลาง', desc: 'ฝึกฝนกลยุทธ์' },
  { id: 'hard', label: 'ยาก', desc: 'ท้าทายมือฉมัง' }
]

export default function App() {
  const [board, setBoard] = useState(createInitialBoard)
  const [turn, setTurn] = useState(1)            // 1 = ผู้เล่น, -1 = บอท
  const [difficulty, setDifficulty] = useState('medium')
  const [origin, setOrigin] = useState(null)     // ตำแหน่งเริ่มของตัวที่กำลังเดิน
  const [partialPath, setPartialPath] = useState([]) // hops ที่ทำไปแล้วใน multi-jump
  const [lastMove, setLastMove] = useState(null)
  const [winner, setWinner] = useState(0)
  const [recommendedMove, setRecommendedMove] = useState(null)
  const [recAnalysis, setRecAnalysis] = useState(null)
  const [recReasons, setRecReasons] = useState([])
  const [moveExplanation, setMoveExplanation] = useState('')
  const [thinking, setThinking] = useState(false)
  const [history, setHistory] = useState([])    // [{ board, turn }]
  const [showCoach, setShowCoach] = useState(true)
  const [flipped, setFlipped] = useState(false) // true = มองจากฝั่งด้านบน

  const allPlayerMoves = useMemo(() => {
    if (turn !== 1 || winner !== 0) return []
    return getAllMoves(board, 1)
  }, [board, turn, winner])

  // ตำแหน่งปัจจุบันของตัวที่กำลังเดิน (ขยับเมื่อ multi-jump)
  const currentPos = partialPath.length
    ? partialPath[partialPath.length - 1]
    : origin

  // กรองการเดินที่ตรงกับ partialPath ที่ทำไปแล้ว
  const candidates = useMemo(() => {
    if (!origin) return []
    return allPlayerMoves.filter(m => {
      if (m.from[0] !== origin[0] || m.from[1] !== origin[1]) return false
      for (let i = 0; i < partialPath.length; i++) {
        const a = m.path[i], b = partialPath[i]
        if (!a || a[0] !== b[0] || a[1] !== b[1]) return false
      }
      return true
    })
  }, [allPlayerMoves, origin, partialPath])

  // จุดลงตำแหน่งถัดไป (สำหรับโชว์บนกระดาน)
  const nextHopMoves = useMemo(() => {
    if (!currentPos) return []
    const seen = new Set()
    const out = []
    for (const m of candidates) {
      const nh = m.path[partialPath.length]
      if (!nh) continue
      const key = `${nh[0]},${nh[1]}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ from: currentPos, path: [nh], captures: [] })
    }
    return out
  }, [candidates, currentPos, partialPath.length])

  const captureHighlight = useMemo(() => {
    // โชว์ตัวที่ถูกกินไปแล้วใน partialPath ปัจจุบัน
    if (!candidates.length || partialPath.length === 0) return []
    return candidates[0].captures.slice(0, partialPath.length)
  }, [candidates, partialPath.length])

  function handleSquareClick(r, c) {
    if (turn !== 1 || winner !== 0 || thinking) return

    // ถ้าคลิกจุดลงที่ไฮไลต์
    const isDest = nextHopMoves.some(m => m.path[0][0] === r && m.path[0][1] === c)
    if (isDest && origin) {
      const newPartial = [...partialPath, [r, c]]
      const remaining = candidates.filter(m => {
        const step = m.path[newPartial.length - 1]
        return step && step[0] === r && step[1] === c
      })
      const completed = remaining.find(m => m.path.length === newPartial.length)
      const hasMore = remaining.some(m => m.path.length > newPartial.length)
      if (completed && !hasMore) {
        executeMove(completed)
      } else {
        setPartialPath(newPartial)
      }
      return
    }

    // ถ้าคลิกตัวของผู้เล่นที่มีตาเดิน
    if (sideOf(board[r][c]) === 1) {
      const has = allPlayerMoves.some(m => m.from[0] === r && m.from[1] === c)
      if (has) {
        setOrigin([r, c])
        setPartialPath([])
        setRecommendedMove(null)
      }
      return
    }

    // ยกเลิก
    setOrigin(null)
    setPartialPath([])
  }

  function executeMove(move) {
    const next = applyMove(board, move)
    setHistory(h => [...h, { board, turn: 1 }])
    setBoard(next)
    setLastMove(move)
    setOrigin(null)
    setPartialPath([])
    setRecommendedMove(null)
    setRecAnalysis(null)
    setRecReasons([])
    setMoveExplanation(`คุณ: ${explainMove(board, move, 1)}`)
    const w = checkWinner(next, -1)
    if (w !== 0) { setWinner(w); return }
    setTurn(-1)
  }

  // ตาบอท
  useEffect(() => {
    if (turn !== -1 || winner !== 0) return
    setThinking(true)
    const t = setTimeout(() => {
      const move = chooseBotMove(board, difficulty)
      if (!move) { setWinner(1); setThinking(false); return }
      const next = applyMove(board, move)
      setHistory(h => [...h, { board, turn: -1 }])
      setBoard(next)
      setLastMove(move)
      setMoveExplanation(`บอท: ${explainMove(board, move, -1)}`)
      const w = checkWinner(next, 1)
      if (w !== 0) setWinner(w)
      else setTurn(1)
      setThinking(false)
    }, difficulty === 'easy' ? 350 : 600)
    return () => clearTimeout(t)
  }, [turn, winner, board, difficulty])

  function handleHint() {
    if (turn !== 1 || winner !== 0 || thinking) return
    setThinking(true)
    setMoveExplanation('🤔 โค้ชกำลังคิด... (ใช้กำลังเดียวกับบอท)')
    // ปล่อยให้ React render สถานะ thinking ก่อนเริ่มคำนวณ
    setTimeout(() => {
      const analysis = recommendMoveForPlayer(board, difficulty)
      if (analysis?.move) {
        setRecommendedMove(analysis.move)
        setRecAnalysis(analysis)
        setRecReasons(explainRecommendation(board, analysis))
        setMoveExplanation('💡 ดูคำแนะนำในแผงด้านขวา')
      }
      setThinking(false)
    }, 60)
  }

  function handleAutoPlayHint() {
    if (!recommendedMove) return
    executeMove(recommendedMove)
  }

  function handleNewGame() {
    setBoard(createInitialBoard())
    setTurn(1); setOrigin(null); setPartialPath([])
    setLastMove(null); setWinner(0)
    setRecommendedMove(null); setRecAnalysis(null); setRecReasons([])
    setMoveExplanation(''); setHistory([]); setThinking(false)
  }

  function handleUndo() {
    // ย้อนกลับไปยังสถานะก่อนเทิร์นผู้เล่นล่าสุด
    if (history.length === 0 || thinking) return
    let h = [...history]
    // ย้อนตาบอทถ้ามี + ตาผู้เล่น
    let snapshot = null
    while (h.length > 0) {
      const last = h.pop()
      if (last.turn === 1) { snapshot = last; break }
      snapshot = last
    }
    if (!snapshot) return
    setBoard(snapshot.board)
    setHistory(h)
    setTurn(1); setOrigin(null); setPartialPath([])
    setLastMove(null); setWinner(0)
    setRecommendedMove(null); setRecAnalysis(null); setRecReasons([])
  }

  const material = countMaterial(board)
  const playerMustCapture = allPlayerMoves.some(m => m.captures.length > 0)

  return (
    <div className="app">
      <header className="app-head">
        <h1>หมากฮอสไทย <span className="sub">Thai Checkers</span></h1>
        <div className="badge">เล่นกับบอท · มีระบบสอนและแนะนำหมาก</div>
      </header>

      <div className="layout">
        <aside className="side left">
          <div className="card">
            <h3>ระดับความยาก</h3>
            <div className="diff-row">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  className={'diff ' + (difficulty === d.id ? 'active' : '')}
                  onClick={() => setDifficulty(d.id)}
                  title={d.desc}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="hint-text">{DIFFICULTIES.find(d => d.id === difficulty).desc}</div>
          </div>

          <div className="card">
            <h3>สถานะเกม</h3>
            <div className="status">
              <div>
                <span className="dot-red" /> คุณ: เบี้ย {material.pMan} · ฮอส {material.pKing}
              </div>
              <div>
                <span className="dot-black" /> บอท: เบี้ย {material.bMan} · ฮอส {material.bKing}
              </div>
              <div className="turn">
                {winner !== 0
                  ? (winner === 1 ? '🎉 คุณชนะ!' : '😅 บอทชนะ')
                  : thinking
                    ? 'บอทกำลังคิด...'
                    : (turn === 1 ? 'ตาคุณเดิน' : 'ตาบอท')}
              </div>
              {turn === 1 && winner === 0 && playerMustCapture && (
                <div className="warn">⚠️ มีตากิน — ต้องเลือกตัวที่กินได้</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3>ควบคุม</h3>
            <button className="btn primary" onClick={handleHint} disabled={turn !== 1 || winner !== 0 || thinking}>
              💡 แนะนำหมาก
            </button>
            {recommendedMove && (
              <button className="btn" onClick={handleAutoPlayHint}>
                ▶ เดินตามที่แนะนำ
              </button>
            )}
            <button className="btn" onClick={handleUndo} disabled={history.length === 0 || thinking}>
              ↺ ย้อนตา
            </button>
            <button className="btn" onClick={() => setFlipped(f => !f)}>
              🔃 สลับมุมมองกระดาน
            </button>
            <button className="btn ghost" onClick={handleNewGame}>
              🔄 เริ่มเกมใหม่
            </button>
          </div>
        </aside>

        <main className="board-wrap">
          <div className="ranks">
            {[...(flipped ? '12345678' : '87654321')].map(n => <div key={n} className="rank">{n}</div>)}
          </div>
          <div className="board-area">
            <Board
              board={board}
              selected={currentPos}
              onSelectSquare={handleSquareClick}
              legalMovesForSelected={nextHopMoves}
              recommendedMove={recommendedMove}
              lastMove={lastMove}
              highlightCaptures={captureHighlight}
              flipped={flipped}
            />
            <div className="files">
              {[...(flipped ? 'hgfedcba' : 'abcdefgh')].map(n => <div key={n} className="file">{n}</div>)}
            </div>
          </div>
        </main>

        <aside className="side right">
          <div className="card coach">
            <div className="card-head">
              <h3>🎓 โค้ชอธิบาย</h3>
              <button className="link" onClick={() => setShowCoach(s => !s)}>
                {showCoach ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            {showCoach && (
              <>
                <div className="explain">
                  {moveExplanation || 'เลือกตัวหมาก แล้วระบบจะแสดงตาที่เดินได้ — ลองกด "💡 แนะนำหมาก" เพื่อให้โค้ชแนะนำการเดินที่ดีที่สุด'}
                </div>
                {recAnalysis && (
                  <div className="rec-box">
                    <div className="rec-header">
                      <span>🎯 เดินที่แนะนำ</span>
                      <span className="rec-depth">depth {recAnalysis.depth}</span>
                    </div>
                    <code className="rec-move-code">
                      {coordToNotation(recAnalysis.move.from)} →{' '}
                      {recAnalysis.move.path.map(p => coordToNotation(p)).join(' → ')}
                    </code>

                    {recReasons.length > 0 && (
                      <ul className="rec-reasons">
                        {recReasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    )}

                    {recAnalysis.pv && recAnalysis.pv.length > 1 && (
                      <div className="rec-section">
                        <div className="rec-subhead">🎬 คาดการณ์ {Math.min(recAnalysis.pv.length, 5)} ตา</div>
                        <ol className="pv-list">
                          {recAnalysis.pv.slice(0, 5).map((p, i) => (
                            <li key={i}>
                              <span className={p.side === 1 ? 'p-side' : 'b-side'}>
                                {p.side === 1 ? 'คุณ' : 'บอท'}
                              </span>
                              <code>{moveToText(p.move)}</code>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {recAnalysis.ranked && recAnalysis.ranked.length > 1 && (
                      <details className="alt-details">
                        <summary>📊 ตัวเลือกอื่น ({recAnalysis.ranked.length - 1})</summary>
                        <ul className="alt-list">
                          {recAnalysis.ranked.slice(1, 4).map((r, i) => {
                            const gap = recAnalysis.ranked[0].score - r.score
                            return (
                              <li key={i}>
                                <code>{moveToText(r.move)}</code>
                                {gap > 0 && <span className="gap">−{gap.toFixed(0)}</span>}
                              </li>
                            )
                          })}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <TutorialPanel />
        </aside>
      </div>

      <footer className="app-foot">
        ใช้กฎหมากฮอสไทย: เบี้ยเดิน 1 ช่องหน้า · ฮอสบินทแยงไกล · กินบังคับ
      </footer>
    </div>
  )
}

function moveToText(m) {
  return coordToNotation(m.from) + '→' + m.path.map(coordToNotation).join('→') +
    (m.captures?.length ? ` (×${m.captures.length})` : '')
}

function coordToNotation([r, c]) {
  const file = 'abcdefgh'[c]
  const rank = 8 - r
  return `${file}${rank}`
}
