// กติกาหมากฮอสไทย (Thai Checkers Rules)
// 8x8, ใช้ช่องสีเข้ม (row+col คี่)
// 0 = ว่าง, 1 = เบี้ยผู้เล่น, 2 = ฮอสผู้เล่น, -1 = เบี้ยบอท, -2 = ฮอสบอท

export const BOARD_SIZE = 8
export const PLAYER = 1
export const BOT = -1

export function createInitialBoard() {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 2) board[r][c] = -1
        else if (r > 5) board[r][c] = 1
      }
    }
  }
  return board
}

export const cloneBoard = b => b.map(row => row.slice())
export const sideOf = p => (p > 0 ? 1 : p < 0 ? -1 : 0)
export const isKing = p => Math.abs(p) === 2
export const inBounds = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE

const MAN_DIRS = {
  1: [[-1, -1], [-1, 1]],
  [-1]: [[1, -1], [1, 1]]
}
const ALL_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

export function getAllMoves(board, side) {
  const captures = []
  const quiets = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (sideOf(board[r][c]) !== side) continue
      const caps = getCapturesFor(board, r, c)
      if (caps.length) captures.push(...caps)
      else quiets.push(...getQuietMovesFor(board, r, c))
    }
  }
  return captures.length ? captures : quiets
}

function getQuietMovesFor(board, r, c) {
  const piece = board[r][c]
  const moves = []
  if (isKing(piece)) {
    for (const [dr, dc] of ALL_DIRS) {
      let nr = r + dr, nc = c + dc
      while (inBounds(nr, nc) && board[nr][nc] === 0) {
        moves.push({ from: [r, c], path: [[nr, nc]], captures: [], piece })
        nr += dr; nc += dc
      }
    }
  } else {
    for (const [dr, dc] of MAN_DIRS[sideOf(piece)]) {
      const nr = r + dr, nc = c + dc
      if (inBounds(nr, nc) && board[nr][nc] === 0) {
        moves.push({ from: [r, c], path: [[nr, nc]], captures: [], piece })
      }
    }
  }
  return moves
}

export function getCapturesFor(board, r, c) {
  const piece = board[r][c]
  if (!piece) return []
  const results = []
  exploreCaptures(board, r, c, piece, [], [], results, r, c)
  return results
}

function exploreCaptures(board, r, c, piece, path, captured, results, originR, originC) {
  const side = sideOf(piece)
  const king = isKing(piece)
  const dirs = king ? ALL_DIRS : MAN_DIRS[side]
  const possibilities = []

  for (const [dr, dc] of dirs) {
    if (king) {
      // ฮอสกวาดทแยงหาตัวฝ่ายตรงข้าม แต่ต้องลงที่ช่องถัดจากตัวที่กิน 1 ช่องเท่านั้น
      let nr = r + dr, nc = c + dc
      while (inBounds(nr, nc) && board[nr][nc] === 0) { nr += dr; nc += dc }
      if (!inBounds(nr, nc)) continue
      if (sideOf(board[nr][nc]) !== -side) continue
      if (captured.some(([cr2, cc2]) => cr2 === nr && cc2 === nc)) continue
      const lr = nr + dr, lc = nc + dc
      if (!inBounds(lr, lc)) continue
      if (board[lr][lc] !== 0) continue
      possibilities.push({ lr, lc, capR: nr, capC: nc })
    } else {
      const mr = r + dr, mc = c + dc
      const lr = r + dr * 2, lc = c + dc * 2
      if (!inBounds(lr, lc)) continue
      if (board[lr][lc] !== 0) continue
      if (sideOf(board[mr][mc]) !== -side) continue
      if (captured.some(([cr2, cc2]) => cr2 === mr && cc2 === mc)) continue
      possibilities.push({ lr, lc, capR: mr, capC: mc })
    }
  }

  // ถ้าไม่มีตาขยายต่อ และมีการกินมาแล้ว ให้บันทึกเป็นการเดินที่สมบูรณ์
  if (possibilities.length === 0) {
    if (path.length > 0) {
      results.push({
        from: [originR, originC],
        path: [...path],
        captures: [...captured],
        piece
      })
    }
    return
  }

  for (const ext of possibilities) {
    const newBoard = cloneBoard(board)
    newBoard[r][c] = 0
    // ลบตัวที่เพิ่งกินออกจากกระดาน เพื่อไม่ให้บล็อกการสแกนของฮอสในตา chain ต่อไป
    newBoard[ext.capR][ext.capC] = 0
    newBoard[ext.lr][ext.lc] = piece
    const newPath = [...path, [ext.lr, ext.lc]]
    const newCaptured = [...captured, [ext.capR, ext.capC]]
    exploreCaptures(newBoard, ext.lr, ext.lc, piece, newPath, newCaptured, results, originR, originC)
  }
}

export function applyMove(board, move) {
  const next = cloneBoard(board)
  const [fr, fc] = move.from
  let piece = next[fr][fc]
  next[fr][fc] = 0
  for (const [cr, cc] of move.captures) next[cr][cc] = 0
  const [tr, tc] = move.path[move.path.length - 1]
  const side = sideOf(piece)
  if (!isKing(piece)) {
    if (side === 1 && tr === 0) piece = 2
    if (side === -1 && tr === BOARD_SIZE - 1) piece = -2
  }
  next[tr][tc] = piece
  return next
}

export function checkWinner(board, sideToMove) {
  let p = 0, b = 0
  for (const row of board) for (const v of row) {
    if (v > 0) p++
    if (v < 0) b++
  }
  if (p === 0) return -1
  if (b === 0) return 1
  const moves = getAllMoves(board, sideToMove)
  if (moves.length === 0) return -sideToMove
  return 0
}

export function countMaterial(board) {
  let pMan = 0, pKing = 0, bMan = 0, bKing = 0
  for (const row of board) for (const v of row) {
    if (v === 1) pMan++
    else if (v === 2) pKing++
    else if (v === -1) bMan++
    else if (v === -2) bKing++
  }
  return { pMan, pKing, bMan, bKing }
}

// เปรียบเทียบ move สองตัวว่าเหมือนกันหรือไม่
export function movesEqual(a, b) {
  if (!a || !b) return false
  if (a.from[0] !== b.from[0] || a.from[1] !== b.from[1]) return false
  if (a.path.length !== b.path.length) return false
  for (let i = 0; i < a.path.length; i++) {
    if (a.path[i][0] !== b.path[i][0] || a.path[i][1] !== b.path[i][1]) return false
  }
  return true
}
