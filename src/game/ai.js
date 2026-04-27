// AI: minimax + alpha-beta + ระบบแนะนำหมาก
import {
  applyMove, getAllMoves, isKing, sideOf, BOARD_SIZE, movesEqual
} from './rules.js'

const W_MAN = 100
const W_KING = 280
const W_ADVANCE = 4
const W_CENTER = 2
const W_BACK_ROW = 6
const W_EDGE_KING = -8

// คะแนนจากมุมมองของผู้เล่น (1) — บวก = ผู้เล่นได้เปรียบ, ลบ = บอทได้เปรียบ
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
      } else if (r === 0 || r === 7 || c === 0 || c === 7) {
        v += W_EDGE_KING
      }
      const distCenter = Math.abs(3.5 - r) + Math.abs(3.5 - c)
      v += (7 - distCenter) * W_CENTER
      if (!king) {
        if (s === 1 && r === 7) v += W_BACK_ROW
        if (s === -1 && r === 0) v += W_BACK_ROW
      }
      score += s * v
    }
  }
  return score
}

// minimax: คืนคะแนน "จากมุมมองผู้เล่น"
// ผู้เล่น (1) = MAX, บอท (-1) = MIN
function minimax(board, sideToMove, depth, alpha, beta) {
  const moves = getAllMoves(board, sideToMove)
  if (moves.length === 0) {
    return { score: -sideToMove * 100000, move: null }
  }
  if (depth === 0) {
    return { score: evaluate(board), move: null }
  }
  let best = null
  if (sideToMove === 1) {
    let value = -Infinity
    for (const m of moves) {
      const next = applyMove(board, m)
      const r = minimax(next, -1, depth - 1, alpha, beta)
      if (r.score > value) { value = r.score; best = m }
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    return { score: value, move: best }
  } else {
    let value = Infinity
    for (const m of moves) {
      const next = applyMove(board, m)
      const r = minimax(next, 1, depth - 1, alpha, beta)
      if (r.score < value) { value = r.score; best = m }
      beta = Math.min(beta, value)
      if (alpha >= beta) break
    }
    return { score: value, move: best }
  }
}

export function searchBestMove(board, sideToMove, depth) {
  return minimax(board, sideToMove, depth, -Infinity, Infinity)
}

const DIFFICULTY_DEPTH = { easy: 1, medium: 3, hard: 5 }

export function chooseBotMove(board, difficulty) {
  const moves = getAllMoves(board, -1)
  if (moves.length === 0) return null

  if (difficulty === 'easy') {
    if (Math.random() < 0.7) {
      return moves[Math.floor(Math.random() * moves.length)]
    }
    return searchBestMove(board, -1, 1).move || moves[0]
  }
  if (difficulty === 'medium' && Math.random() < 0.1) {
    return moves[Math.floor(Math.random() * moves.length)]
  }
  const depth = DIFFICULTY_DEPTH[difficulty] ?? 3
  return searchBestMove(board, -1, depth).move || moves[0]
}

export function recommendMoveForPlayer(board, depth = 4) {
  const moves = getAllMoves(board, 1)
  if (moves.length === 0) return null
  const { move, score } = searchBestMove(board, 1, depth)
  return { move: move || moves[0], score, total: moves.length }
}

// อธิบายเหตุผลของการเดิน (ภาษาไทย)
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

// คะแนนของแต่ละ move เพื่อจัดอันดับ (ใช้แสดงรายการแนะนำ)
export function rankMovesForPlayer(board, depth = 3) {
  const moves = getAllMoves(board, 1)
  const scored = moves.map(m => {
    const next = applyMove(board, m)
    const { score } = minimax(next, -1, depth - 1, -Infinity, Infinity)
    return { move: m, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
}

export { movesEqual }
