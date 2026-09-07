export const CSV_HEADERS = Object.freeze([
  'model',
  'input',
  'cached',
  'write',
  'output',
  'ordinaryInput',
  'ordinaryInputCost',
  'cachedCost',
  'writeCost',
  'outputCost',
  'totalCost',
  'cacheHitRate',
]);

export function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsv(values, result) {
  const row = [
    values.model,
    values.input,
    values.cached,
    values.write,
    values.output,
    result.ordinaryInput,
    result.ordinaryInputCost,
    result.cachedCost,
    result.writeCost,
    result.outputCost,
    result.totalCost,
    result.cacheHitRate,
  ];
  return `\uFEFF${[CSV_HEADERS, row].map(line => line.map(escapeCsv).join(',')).join('\r\n')}\r\n`;
}
