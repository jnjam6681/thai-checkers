import React, { useMemo } from 'react'
import { BOARD_SIZE, isKing, sideOf } from '../game/rules.js'

const sameCell = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]

export default function Board({
  board,
  selected,                // [r, c] หรือ null
  onSelectSquare,          // (r,c) => void
  legalMovesForSelected,   // [{from, path, captures}, ...] ของตัวที่เลือก
  recommendedMove,         // move object หรือ null
  lastMove,                // move object ล่าสุด
  highlightCaptures        // [[r,c], ...] ตัวที่กำลังจะ/ได้กิน
}) {
  // คำนวณช่องที่สามารถลงได้ทั้งหมดของตัวที่เลือก (ปลายทางขั้นแรก)
  const destinationSet = useMemo(() => {
    const m = new Map()
    for (const mv of legalMovesForSelected) {
      const [r, c] = mv.path[0]
      const key = `${r},${c}`
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(mv)
    }
    return m
  }, [legalMovesForSelected])

  const recFrom = recommendedMove?.from
  const recTo = recommendedMove?.path?.[recommendedMove.path.length - 1]

  return (
    <div className="board">
      {board.map((row, r) => (
        <div className="row" key={r}>
          {row.map((piece, c) => {
            const dark = (r + c) % 2 === 1
            const key = `${r},${c}`
            const isSelected = sameCell(selected, [r, c])
            const isDestination = destinationSet.has(key)
            const isCaptureTarget = highlightCaptures?.some(([cr, cc]) => cr === r && cc === c)
            const isLastFrom = lastMove && sameCell(lastMove.from, [r, c])
            const isLastTo = lastMove && sameCell(lastMove.path[lastMove.path.length - 1], [r, c])
            const isRecFrom = recFrom && sameCell(recFrom, [r, c])
            const isRecTo = recTo && sameCell(recTo, [r, c])

            const classes = ['square']
            classes.push(dark ? 'dark' : 'light')
            if (isSelected) classes.push('selected')
            if (isDestination) classes.push('destination')
            if (isCaptureTarget) classes.push('capture-target')
            if (isLastFrom || isLastTo) classes.push('last-move')
            if (isRecFrom) classes.push('rec-from')
            if (isRecTo) classes.push('rec-to')

            return (
              <div
                key={c}
                className={classes.join(' ')}
                onClick={() => onSelectSquare(r, c)}
              >
                {piece !== 0 && (
                  <div
                    className={
                      'piece ' +
                      (sideOf(piece) === 1 ? 'player' : 'bot') +
                      (isKing(piece) ? ' king' : '')
                    }
                  >
                    {isKing(piece) && <span className="crown">♛</span>}
                  </div>
                )}
                {isDestination && <div className="dot" />}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
