// AI: minimax + alpha-beta + PVS + iterative deepening
// + transposition table + killer moves + quiescence search
import {
  applyMove, getAllMoves, isKing, sideOf, BOARD_SIZE, movesEqual
} from './rules.js'

const W_MAN       = 100
const W_KING      = 340
const W_ADVANCE   = 7
const W_CENTER    = 3
const W_BACK_ROW  = 10
const W_DEFENDED  = 6
const W_PAIR      = 3

const KING_TABLE = [
  [-10, -4, -2, -2, -2, -2, -4,-10],
  [ -4,  6,  8,  8,  8,  8,  6, -4],
  [ -2,  8, 12, 14, 14, 12,  8, -2],
  [ -2,  8, 14, 18, 18, 14,  8, -2],
  [ -2,  8, 14, 18, 18, 14,  8, -2],
  [ -2,  8, 12, 14, 14, 12,  8, -2],
  [ -4,  6,  8,  8,  8,  8,  6, -4],
  [-10, -4, -2, -2, -2, -2, -4,-10]
]

// ค่าประเมินจากมุมมองผู้เล่น (บวก = ผู้เล่นได้เปรียบ, ลบ = บอทได้เปรียบ)
function evaluate(board) {
  let score = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c]
      if (!p) continue
      const s = sideOf(p)
      const king = isKing(p)
      let v = king ? W_KING : W_MAN
      if (!king) {
        const advance = s === 1 ? (BOARD_SIZE - 1 - r) : r
        v += advance * W_ADVANCE
        if (s === 1 && r === 7) v += W_BACK_ROW
        if (s === -1 && r === 0) v += W_BACK_ROW
        const br = s === 1 ? r + 1 : r - 1
        if (br >= 0 && br < BOARD_SIZE) {
          if (c > 0 && sideOf(board[br][c - 1]) === s) v += W_DEFENDED
          if (c < 7 && sideOf(board[br][c + 1]) === s) v += W_DEFENDED
        }
        if (c > 0 && sideOf(board[r][c - 1]) === s) v += W_PAIR
        if (c < 7 && sideOf(board[r][c + 1]) === s) v += W_PAIR
      } else {
        v += KING_TABLE[r][c]
      }
      const distCenter = Math.abs(3.5 - r) + Math.abs(3.5 - c)
      v += (7 - distCenter) * W_CENTER
      score += s * v
    }
  }
  return score
}

// hash กระดาน + ฝั่งที่จะเดิน
function hashBoard(board, side) {
  let h = side === 1 ? 'P' : 'B'
  for (const row of board) for (const v of row) h += String.fromCharCode(v + 5)
  return h
}

// ----- search infrastructure -----
const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2
const MATE = 1_000_000
const QMAX = 24
const MAX_KILLERS_PLY = 32

class SearchContext {
  constructor(deadlineMs) {
    this.tt = new Map()
    this.killers = Array.from({ length: MAX_KILLERS_PLY }, () => [null, null])
    this.deadline = deadlineMs
    this.aborted = false
    this.nodes = 0
  }
  timeUp() {
    if (this.aborted) return true
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) {
      this.aborted = true
      return true
    }
    return false
  }
}

function moveScore(m, ctx, ply) {
  let s = 0
  if (m.captures.length) s += 100000 + m.captures.length * 1000
  const last = m.path[m.path.length - 1]
  // promotion
  if (!isKing(m.piece)) {
    if (sideOf(m.piece) === 1 && last[0] === 0) s += 50000
    if (sideOf(m.piece) === -1 && last[0] === 7) s += 50000
  }
  // killer (non-capture only)
  if (m.captures.length === 0 && ply < MAX_KILLERS_PLY) {
    const ks = ctx.killers[ply]
    if (ks[0] && movesEqual(ks[0], m)) s += 8000
    else if (ks[1] && movesEqual(ks[1], m)) s += 6000
  }
  // ใกล้กลางได้คะแนน
  s += (7 - (Math.abs(3.5 - last[0]) + Math.abs(3.5 - last[1]))) * 10
  return s
}

function orderMoves(moves, ctx, ply, ttMove) {
  const scored = moves.map(m => ({ m, s: moveScore(m, ctx, ply) }))
  if (ttMove) {
    for (const e of scored) if (movesEqual(e.m, ttMove)) e.s += 1_000_000
  }
  scored.sort((a, b) => b.s - a.s)
  return scored.map(e => e.m)
}

// quiescence: ค้นต่อเฉพาะตากิน เพื่อแก้ horizon effect
function quiesce(board, side, alpha, beta, qDepth, ctx) {
  ctx.nodes++
  if (ctx.timeUp()) return evaluate(board)
  const moves = getAllMoves(board, side)
  if (moves.length === 0) return -side * MATE
  if (moves[0].captures.length === 0 || qDepth === 0) {
    return evaluate(board)
  }
  const ordered = orderMoves(moves, ctx, 0, null)
  if (side === 1) {
    let value = -Infinity
    for (const m of ordered) {
      const v = quiesce(applyMove(board, m), -1, alpha, beta, qDepth - 1, ctx)
      if (v > value) value = v
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }
    return value
  } else {
    let value = Infinity
    for (const m of ordered) {
      const v = quiesce(applyMove(board, m), 1, alpha, beta, qDepth - 1, ctx)
      if (v < value) value = v
      if (value < beta) beta = value
      if (alpha >= beta) break
    }
    return value
  }
}

// PVS + alpha-beta + TT + killer moves
function search(board, side, depth, alpha, beta, ply, ctx) {
  ctx.nodes++
  if (ctx.timeUp()) return { score: evaluate(board), move: null }
  const alphaOrig = alpha
  const key = hashBoard(board, side)
  const cached = ctx.tt.get(key)
  let ttMove = null
  if (cached) {
    ttMove = cached.move
    if (cached.depth >= depth) {
      if (cached.flag === TT_EXACT) return cached
      if (cached.flag === TT_LOWER && cached.score > alpha) alpha = cached.score
      else if (cached.flag === TT_UPPER && cached.score < beta) beta = cached.score
      if (alpha >= beta) return cached
    }
  }
  const moves = getAllMoves(board, side)
  if (moves.length === 0) {
    return { score: -side * MATE, move: null }
  }
  if (depth === 0) {
    return { score: quiesce(board, side, alpha, beta, QMAX, ctx), move: null }
  }
  const ordered = orderMoves(moves, ctx, ply, ttMove)
  let best = null
  let value
  if (side === 1) {
    value = -Infinity
    let first = true
    for (const m of ordered) {
      const next = applyMove(board, m)
      let r
      if (first) {
        r = search(next, -1, depth - 1, alpha, beta, ply + 1, ctx)
        first = false
      } else {
        // PVS: null window
        r = search(next, -1, depth - 1, alpha, alpha + 1, ply + 1, ctx)
        if (!ctx.aborted && r.score > alpha && r.score < beta) {
          r = search(next, -1, depth - 1, alpha, beta, ply + 1, ctx)
        }
      }
      if (r.score > value) { value = r.score; best = m }
      if (value > alpha) alpha = value
      if (alpha >= beta) {
        if (m.captures.length === 0 && ply < MAX_KILLERS_PLY) {
          const ks = ctx.killers[ply]
          if (!ks[0] || !movesEqual(ks[0], m)) {
            ks[1] = ks[0]; ks[0] = m
          }
        }
        break
      }
    }
  } else {
    value = Infinity
    let first = true
    for (const m of ordered) {
      const next = applyMove(board, m)
      let r
      if (first) {
        r = search(next, 1, depth - 1, alpha, beta, ply + 1, ctx)
        first = false
      } else {
        r = search(next, 1, depth - 1, beta - 1, beta, ply + 1, ctx)
        if (!ctx.aborted && r.score < beta && r.score > alpha) {
          r = search(next, 1, depth - 1, alpha, beta, ply + 1, ctx)
        }
      }
      if (r.score < value) { value = r.score; best = m }
      if (value < beta) beta = value
      if (alpha >= beta) {
        if (m.captures.length === 0 && ply < MAX_KILLERS_PLY) {
          const ks = ctx.killers[ply]
          if (!ks[0] || !movesEqual(ks[0], m)) {
            ks[1] = ks[0]; ks[0] = m
          }
        }
        break
      }
    }
  }
  let flag = TT_EXACT
  if (value <= alphaOrig) flag = TT_UPPER
  else if (value >= beta) flag = TT_LOWER
  ctx.tt.set(key, { score: value, move: best, depth, flag })
  return { score: value, move: best }
}

// iterative deepening + budget เวลา
export function searchBestMove(board, sideToMove, maxDepth, timeBudgetMs = 5000) {
  const deadline = Date.now() + timeBudgetMs
  const ctx = new SearchContext(deadline)
  let result = { score: 0, move: null }
  for (let d = 1; d <= maxDepth; d++) {
    const r = search(board, sideToMove, d, -Infinity, Infinity, 0, ctx)
    if (!ctx.aborted && r.move) {
      result = { score: r.score, move: r.move, depth: d, nodes: ctx.nodes }
      // ชัยชนะแน่นอน — หยุดเลย
      if (Math.abs(r.score) > MATE - 1000) break
    } else if (ctx.aborted) {
      break
    }
  }
  return result
}

const DIFF = {
  easy:   { depth: 2,  time: 250 },
  medium: { depth: 6,  time: 1500 },
  hard:   { depth: 14, time: 5000 }
}

// ระบบแนะนำการเดินใช้ depth สูงกว่าบอทในโหมด easy/medium เพื่อให้เก่งกว่าบอท
const REC_DIFF = {
  easy:   { depth: 10, time: 3000 },
  medium: { depth: 10, time: 3000 },
  hard:   { depth: 14, time: 5000 }
}

export function chooseBotMove(board, difficulty) {
  const moves = getAllMoves(board, -1)
  if (moves.length === 0) return null

  if (difficulty === 'easy') {
    if (Math.random() < 0.65) {
      const evals = moves.map(m => ({ m, s: evaluate(applyMove(board, m)) }))
      evals.sort((a, b) => a.s - b.s)
      const top = evals.slice(0, Math.max(2, Math.ceil(evals.length / 2)))
      return top[Math.floor(Math.random() * top.length)].m
    }
  }
  if (difficulty === 'medium' && Math.random() < 0.06) {
    return moves[Math.floor(Math.random() * moves.length)]
  }
  const cfg = DIFF[difficulty] ?? DIFF.medium
  const { move } = searchBestMove(board, -1, cfg.depth, cfg.time)
  return move || moves[0]
}

// แนะนำตาให้ผู้เล่น — ใช้กำลังเดียวกับบอทตามระดับความยากที่เลือก
export function recommendMoveForPlayer(board, difficulty = 'hard') {
  const moves = getAllMoves(board, 1)
  if (moves.length === 0) return null

  const cfg = REC_DIFF[difficulty] ?? REC_DIFF.hard
  const ctx = new SearchContext(Date.now() + cfg.time)

  // Iterative deepening เพื่อหาตาดีที่สุด
  let best = { score: 0, move: null, depth: 0 }
  for (let d = 1; d <= cfg.depth; d++) {
    const r = search(board, 1, d, -Infinity, Infinity, 0, ctx)
    if (!ctx.aborted && r.move) {
      best = { score: r.score, move: r.move, depth: d }
      if (Math.abs(r.score) > MATE - 1000) break
    } else if (ctx.aborted) break
  }

  // ดึง principal variation จาก TT (คาดการณ์การเดินถัด)
  const pv = []
  {
    let cb = board, cs = 1
    for (let i = 0; i < 8; i++) {
      const e = ctx.tt.get(hashBoard(cb, cs))
      if (!e?.move) break
      pv.push({ side: cs, move: e.move })
      cb = applyMove(cb, e.move); cs = -cs
    }
  }

  // จัดอันดับตาทางเลือก (ใช้ TT ที่มีอยู่ ตื้นกว่าเล็กน้อย เพื่อความเร็ว)
  const rankDepth = Math.min(Math.max(2, best.depth - 2), 6)
  ctx.deadline = Date.now() + 1500
  ctx.aborted = false
  const ranked = []
  for (const m of moves) {
    const next = applyMove(board, m)
    const r = search(next, -1, rankDepth, -Infinity, Infinity, 0, ctx)
    ranked.push({ move: m, score: r.score })
  }
  ranked.sort((a, b) => b.score - a.score)

  return {
    move: best.move || moves[0],
    score: best.score,
    depth: best.depth,
    total: moves.length,
    pv,
    ranked,
    difficulty
  }
}

// เหตุผลละเอียดสำหรับการแนะนำ — คืน array ของเหตุผล
export function explainRecommendation(beforeBoard, analysis) {
  if (!analysis?.move) return []
  const reasons = []
  const move = analysis.move
  const [tr, tc] = move.path[move.path.length - 1]
  const piece = beforeBoard[move.from[0]][move.from[1]]

  if (move.captures.length >= 3) {
    reasons.push(`🎯 กิน ${move.captures.length} ตัวรวด — combo ใหญ่!`)
  } else if (move.captures.length === 2) {
    reasons.push(`🎯 Multi-jump กินติดกัน 2 ตัว`)
  } else if (move.captures.length === 1) {
    reasons.push(`🎯 กินตัวฝ่ายตรงข้าม 1 ตัว (กินบังคับ)`)
  }

  if (!isKing(piece) && tr === 0) {
    reasons.push('👑 เลื่อนขั้นเป็นฮอส — ได้ตัวบินทแยงระยะไกล')
  }

  // วิเคราะห์ defense / threat
  const beforeOpp = getAllMoves(beforeBoard, -1)
  const beforeMaxCap = beforeOpp.reduce((m, x) => Math.max(m, x.captures.length), 0)
  const after = applyMove(beforeBoard, move)
  const afterOpp = getAllMoves(after, -1)
  const afterMaxCap = afterOpp.reduce((m, x) => Math.max(m, x.captures.length), 0)

  if (beforeMaxCap > 0 && afterMaxCap < beforeMaxCap) {
    reasons.push(`🛡️ ป้องกันตัวที่กำลังจะโดนกิน (จาก ${beforeMaxCap} เหลือ ${afterMaxCap} ตัว)`)
  }

  const willBeCaptured = afterOpp.some(m =>
    m.captures.length > 0 && m.captures.some(([cr, cc]) => cr === tr && cc === tc))
  if (willBeCaptured) {
    if (analysis.score >= 0) {
      reasons.push('♟️ ยอมแลกตัวเพื่อกลยุทธ์ใหญ่ (คาดว่าได้คืนมากกว่าเสีย)')
    } else {
      reasons.push('⚠️ ระวัง อาจถูกกินตอบในตาถัดไป')
    }
  }

  const distCenter = Math.abs(3.5 - tr) + Math.abs(3.5 - tc)
  if (distCenter <= 2 && move.captures.length === 0) {
    reasons.push('🎯 ลงกึ่งกลางกระดาน — เพิ่มทางเลือกการเดิน')
  }

  if (!isKing(piece) && move.captures.length === 0) {
    const adv = 7 - tr
    if (adv >= 5) reasons.push(`⬆️ รุกถึงแถวที่ ${8 - tr} ใกล้เลื่อนขั้น`)
    else if (adv >= 3) reasons.push('⬆️ พัฒนาเบี้ยขึ้นหน้า')
  }

  if (afterOpp.length === 0) {
    reasons.push('🏆 ทำให้บอทเดินไม่ได้ — ชนะแน่!')
  } else if (afterOpp.length <= 2) {
    reasons.push(`🔒 จำกัดทางเลือกบอทเหลือ ${afterOpp.length} ตา`)
  }

  // สร้างคำคุกคาม (ตาถัดไปจะกินได้)
  // (ดูง่าย ๆ ว่าบอทเลือก move ที่บอทคิดว่าดีสุดแล้ว เราจะมีตากินไหม)
  if (analysis.pv && analysis.pv.length >= 3) {
    const oursNext = analysis.pv[2]
    if (oursNext?.move?.captures?.length) {
      reasons.push(`🎲 หลังบอทตอบ คุณจะกินคืนได้ ${oursNext.move.captures.length} ตัว`)
    }
  }

  // เปรียบเทียบกับตาอื่น
  if (analysis.ranked && analysis.ranked.length > 1) {
    const gap = analysis.ranked[0].score - analysis.ranked[1].score
    if (gap > 200) reasons.push(`🌟 เด่นชัด — ดีกว่าตาอื่น ${gap.toFixed(0)} แต้ม`)
    else if (gap > 50) reasons.push(`⭐ ดีกว่าตาอื่นชัดเจน (+${gap.toFixed(0)} แต้ม)`)
    else if (gap > 10) reasons.push(`✓ ดีกว่าตาอื่นเล็กน้อย (+${gap.toFixed(0)} แต้ม)`)
  }

  if (reasons.length === 0) reasons.push('รักษารูปขบวน พัฒนาตำแหน่งทีละน้อย')
  return reasons
}

export function explainMove(beforeBoard, move, side) {
  if (!move) return ''
  const reasons = []
  if (move.captures && move.captures.length) {
    reasons.push(`กินตัวฝ่ายตรงข้าม ${move.captures.length} ตัว`)
  }
  const [tr, tc] = move.path[move.path.length - 1]
  const piece = beforeBoard[move.from[0]][move.from[1]]
  if (!isKing(piece)) {
    if (side === 1 && tr === 0) reasons.push('เลื่อนขั้นเป็นฮอส 👑')
    if (side === -1 && tr === 7) reasons.push('เลื่อนขั้นเป็นฮอส 👑')
  }
  const distCenter = Math.abs(3.5 - tr) + Math.abs(3.5 - tc)
  if (distCenter <= 2) reasons.push('คุมจุดกลางกระดาน')
  if (!isKing(piece)) {
    const adv = side === 1 ? (7 - tr) : tr
    if (adv >= 5) reasons.push('รุกเข้าแดนตรงข้าม ใกล้เลื่อนขั้น')
  }
  const after = applyMove(beforeBoard, move)
  const opp = getAllMoves(after, -side)
  const couldBeCaptured = opp.some(m => m.captures.length > 0 &&
    m.captures.some(([cr, cc]) => cr === tr && cc === tc))
  if (couldBeCaptured) reasons.push('⚠️ ระวัง อาจถูกกินตอบในตาถัดไป')
  if (reasons.length === 0) reasons.push('รักษารูปขบวน พัฒนาตำแหน่งทีละน้อย')
  return reasons.join(' • ')
}

export function rankMovesForPlayer(board, depth = 6) {
  const moves = getAllMoves(board, 1)
  const ctx = new SearchContext(Date.now() + 2500)
  const scored = moves.map(m => {
    const next = applyMove(board, m)
    const { score } = search(next, -1, depth - 1, -Infinity, Infinity, 0, ctx)
    return { move: m, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
}

export { movesEqual }
