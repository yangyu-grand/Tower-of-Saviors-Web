export function isOrthogonallyAdjacentRuneSwap(startIndex, endIndex, board = {}) {
  if (!board || typeof board !== "object") return false;
  const rows = board.rows ?? 5;
  const columns = board.columns ?? 6;
  if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(columns) || columns <= 0) return false;
  const cellCount = rows * columns;
  if (!Number.isSafeInteger(cellCount)) return false;
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) return false;
  if (startIndex < 0 || startIndex >= cellCount || endIndex < 0 || endIndex >= cellCount || startIndex === endIndex) return false;
  const rowDelta = Math.abs(Math.floor(startIndex / columns) - Math.floor(endIndex / columns));
  const columnDelta = Math.abs((startIndex % columns) - (endIndex % columns));
  return rowDelta + columnDelta === 1;
}
