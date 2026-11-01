function escapeCell(cell) {
  if (typeof cell !== 'string') throw new TypeError('CSV cells must be strings');
  return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

export function toCsv(rows) {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array');
  const lines = [];
  // Index loops visit holes in sparse arrays as undefined, so they are rejected.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) throw new TypeError('each row must be an array');
    const cells = [];
    for (let j = 0; j < row.length; j++) cells.push(escapeCell(row[j]));
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
}
