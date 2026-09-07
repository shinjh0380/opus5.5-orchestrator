function validateRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError('rows must be an array');
  }

  for (const row of rows) {
    if (!Array.isArray(row)) {
      throw new TypeError('each row must be an array');
    }
    for (const cell of row) {
      if (typeof cell !== 'string') {
        throw new TypeError('each cell must be a string');
      }
    }
  }
}

function escapeCell(cell) {
  if (!/[",\r\n]/.test(cell)) {
    return cell;
  }
  return `"${cell.replaceAll('"', '""')}"`;
}

export function toCsv(rows) {
  validateRows(rows);
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}
