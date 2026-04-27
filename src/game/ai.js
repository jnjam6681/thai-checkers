// AI: minimax + alpha-beta + quiescence + move ordering + TT
// + ระบบแนะนำหมาก สำหรับผู้เล่น
import {
  applyMove, getAllMoves, isKing, sideOf, BOARD_SIZE, movesEqual
} from './rules.js'

const W_MAN       = 100
const W_KING      = 320
const W_ADVANCE   = 6
const W_CENTER    = 3
const W_BACK_ROW  = 8
const W_EDGE_KING = -12
const W_DEFENDED  = 5
const W_PAIR      = 3
const W_MOBILITY  = 1.5
const W_CRAMP     = 4   // ลงโทษคู่ต่อสู้ที่เดินไม่ได้
const KING_TABLE = [
  [ -8, -4, -2, -2, -2, -2, -4, -8],
  [ -4,  6,  8,  8,  8,  8,  6, -4],
  [ -2,  8, 12, 14, 14, 12,  8, -2],
  [ -2,  8, 14, 16, 16, 14,  8, -2],
  [ -2,  8, 14, 16, 16, 14,  8, -2],
  [ -2,  8, 12, 14, 14, 12,  8, -2],
  [ -4,  6,  8,  8,  8,  8,  6, -4],
  [ -8, -4, -2, -2, -2, -2, -4, -8]
]

function evaluate(board) {
  let score = 0
  let totalPieces = 0
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = board[r][c]
      if (!p) continue
      totalPieces++
      const s = sideOf(p)
      const king = isKing(p)
      let v = king ? W_KING : W_MAN

      if (!king) {
        const advance = s === 1 ? (BOARD_SIZE - 1 - r) : r
        v += advance * W_ADVANCE
        if (s === 1 && r === 7) v += W_BACK_ROW
        if (s === -1 && r === 0) v += W_BACK_ROW
        // เบี้ยที่มีตัวหนุนข้างหลัง (defender) ปลอดภัยขึ้น
        const behindRow = s === 1 ? r + 1 : r - 1
        if (behindRow >= 0 && behindRow < BOARD_SIZE) {
          if (c > 0 && sideOf(board[behindRow][c - 1]) === s) v += W_DEFENDED
          if (c < 7 && sideOf(board[behindRow][c + 1]) === s) v += W_DEFENDED
        }
        // คู่เคียง (เบี้ยติดกันข้างๆ ป้องกันได้ดี)
        const sameRow = r
        if (c > 0 && sideOf(board[sameRow][c - 1]) === s) v += W_PAIR
        if (c < 7 && sideOf(board[sameRow][c + 1]) === s) v += W_PAIR
      } else {
        v += KING_TABLE[r][c]
      }
      const distCenter = Math.abs(3.5 - r) + Math.abs(3.5 - c)
      v += (7 - distCenter) * W_CENTER
      score += s * v
    }
  }
  // mobility (จำนวนตาที่เดินได้) — สำคัญในเกมหมาก
  const pMoves = getAllMoves(board, 1).length
  const bMoves = getAllMoves(board, -1).length
  score += (pMoves - bMoves) * W_MOBILITY
  if (bMoves === 0 && pMoves > 0) score += 50000
  if (pMoves === 0 && bMoves > 0) score -= 50000
  // หากผู้เล่นเดินไม่ได้แต่ไม่ใช่ตาเขา ก็ไม่นับ; minimax ปลายทางจะดูตามจริง

  // เมื่อกระดานน้อยตัว เน้นเลื่อนเข้ากึ่งกลางเพื่อจัดทัพปิดศัตรู
  if (totalPieces <= 8) {
    score += (pMoves - bMoves) * 1.5
  }
  return score
}

// จัดลำดับการเดินเพื่อให้ alpha-beta ตัดได้มากขึ้น
function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    if (a.captures.length !== b.captures.length) return b.captures.length - a.captures.length
    const aTo = a.path[a.path.length - 1]
    const bTo = b.path[b.path.length - 1]
    const aPromote = !isKing(a.piece) && (
      (sideOf(a.piece) === 1 && aTo[0] === 0) ||
      (sideOf(a.piece) === -1 && aTo[0] === 7)
    )
    const bPromote = !isKing(b.piece) && (
      (sideOf(b.piece) === 1 && bTo[0] === 0) ||
      (sideOf(b.piece) === -1 && bTo[0] === 7)
    )
    if (aPromote !== bPromote) return bPromote ? 1 : -1
    // ใกล้กลางได้คะแนนมาก
    const aCenter = Math.abs(3.5 - aTo[0]) + Math.abs(3.5 - aTo[1])
    const bCenter = Math.abs(3.5 - bTo[0]) + Math.abs(3.5 - bTo[1])
    return aCenter - bCenter
  })
}

// Quiescence: หาก position ไม่นิ่ง (มีตากิน) ค้นต่อจนนิ่ง
const QMAX = 8
function quiesce(board, side, alpha, beta, qDepth) {
  const moves = getAllMoves(board, side)
  if (moves.length === 0) return -side * 100000
  // ถ้าไม่มีตากิน (ตา quiet) ถือว่านิ่ง
  if (moves[0].captures.length === 0 || qDepth === 0) {
    return evaluate(board)
  }
  const ordered = orderMoves(moves)
  if (side === 1) {
    let value = -Infinity
    for (const m of ordered) {
      const next = applyMove(board, m)
      const v = quiesce(next, -1, alpha, beta, qDepth - 1)
      if (v > value) value = v
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }
    return value
  } else {
    let value = Infinity
    for (const m of ordered) {
      const next = applyMove(board, m)
      const v = quiesce(next, 1, alpha, beta, qDepth - 1)
      if (v < value) value = v
      if (value < beta) beta = value
      if (alpha >= beta) break
    }
    return value
  }
}

// transposition table (ใช้ภายในการค้นแต่ละครั้ง)
function hashBoard(board, side) {
  let h = side === 1 ? 'P' : 'B'
  for (const row of board) for (const v of row) h += String.fromCharCode(v + 5)
  return h
}
const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2

function search(board, side, depth, alpha, beta, tt) {
  const alphaOrig = alpha
  const key = hashBoard(board, side)
  const cached = tt.get(key)
  if (cached && cached.depth >= depth) {
    if (cached.flag === TT_EXACT) return cached
    if (cached.flag === TT_LOWER && cached.score > alpha) alpha = cached.score
    else if (cached.flag === TT_UPPER && cached.score < beta) beta = cached.score
    if (alpha >= beta) return cached
  }

  const moves = getAllMoves(board, side)
  if (moves.length === 0) {
    return { score: -side * 100000, move: null }
  }
  if (depth === 0) {
    return { score: quiesce(board, side, alpha, beta, QMAX), move: null }
  }

  // ใช้ move ที่เคยดีที่สุดจาก TT ก่อน
  let ordered = orderMoves(moves)
  if (cached?.move) {
    const idx = ordered.findIndex(m => movesEqual(m, cached.move))
    if (idx > 0) {
      ordered = [cached.move, ...ordered.slice(0, idx), ...ordered.slice(idx + 1)]
    }
  }

  let best = null
  let value
  if (side === 1) {
    value = -Infinity
    for (const m of ordered) {
      const next = applyMove(board, m)
      const r = search(next, -1, depth - 1, alpha, beta, tt)
      if (r.score > value) { value = r.score; best = m }
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }
  } else {
    value = Infinity
    for (const m of ordered) {
      const next = applyMove(board, m)
      const r = search(next, 1, depth - 1, alpha, beta, tt)
      if (r.score < value) { value = r.score; best = m }
      if (value < beta) beta = value
      if (alpha >= beta) break
    }
  }

  let flag = TT_EXACT
  if (value <= alphaOrig) flag = TT_UPPER
  else if (value >= beta) flag = TT_LOWER
  tt.set(key, { score: value, move: best, depth, flag })
  return { score: value, move: best }
}

// iterative deepening + budget เวลา
export function searchBestMove(board, sideToMove, maxDepth, timeBudgetMs = Infinity) {
  const tt = new Map()
  const start = Date.now()
  let result = { score: 0, move: null }
  for (let d = 1; d <= maxDepth; d++) {
    const r = search(board, sideToMove, d, -Infinity, Infinity, tt)
    if (r.move) result = r
    if (Date.now() - start > timeBudgetMs) break
    // ถ้าเจอชัยชนะแน่นอนก็พอ
    if (Math.abs(r.score) > 50000) break
  }
  return result
}

const DIFF = {
  easy:   { depth: 2, time: 200 },
  medium: { depth: 5, time: 800 },
  hard:   { depth: 8, time: 2500 }
}

export function chooseBotMove(board, difficulty) {
  const moves = getAllMoves(board, -1)
  if (moves.length === 0) return null

  if (difficulty === 'easy') {
    // ส่วนใหญ่สุ่ม เพื่อให้มือใหม่ชนะได้ง่าย
    if (Math.random() < 0.65) {
      // หลีกเลี่ยงเลือกตาที่แย่ที่สุด — สุ่มจาก top half
      const evals = moves.map(m => ({ m, s: evaluate(applyMove(board, m)) }))
      evals.sort((a, b) => a.s - b.s) // บอท MIN: ค่าน้อย = ดีกับบอท
      const top = evals.slice(0, Math.max(2, Math.ceil(evals.length / 2)))
      return top[Math.floor(Math.random() * top.length)].m
    }
  }
  if (difficulty === 'medium' && Math.random() < 0.08) {
    return moves[Math.floor(Math.random() * moves.length)]
  }
  const cfg = DIFF[difficulty] ?? DIFF.medium
  const { move } = searchBestMove(board, -1, cfg.depth, cfg.time)
  return move || moves[0]
}

export function recommendMoveForPlayer(board, depth = 6) {
  const moves = getAllMoves(board, 1)
  if (moves.length === 0) return null
  const { move, score } = searchBestMove(board, 1, depth, 1500)
  return { move: move || moves[0], score, total: moves.length }
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

export function rankMovesForPlayer(board, depth = 4) {
  const moves = getAllMoves(board, 1)
  const tt = new Map()
  const scored = moves.map(m => {
    const next = applyMove(board, m)
    const { score } = search(next, -1, depth - 1, -Infinity, Infinity, tt)
    return { move: m, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
}

export { movesEqual }
