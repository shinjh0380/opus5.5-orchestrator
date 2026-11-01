export const RATES = Object.freeze({
  astra: Object.freeze({ input: 10, cached: 1, write: 12.5, output: 50 }),
  luna: Object.freeze({ input: 0.2, cached: 0.02, write: 0.25, output: 1.2 }),
});
export const RATE_DATE = '2026-09-07';
export const SOURCE_URL = 'https://developers.openai.com/api/docs/pricing';
export const MAX_INPUT_TOKENS = 272000;

function rateFor(model) {
  if (typeof model !== 'string' || !Object.prototype.hasOwnProperty.call(RATES, model)) {
    throw new Error('Unknown model: ' + String(model));
  }
  return RATES[model];
}

function checkCount(name, value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(name + ' must be a nonnegative safe integer');
  }
  return value;
}

export function calculateCost({ model, input, cached, write, output } = {}) {
  const r = rateFor(model);
  checkCount('input', input);
  checkCount('cached', cached);
  checkCount('write', write);
  checkCount('output', output);
  if (cached + write > input) {
    throw new Error('cached + write must not exceed input');
  }
  if (input > MAX_INPUT_TOKENS) {
    throw new Error('input must not exceed ' + MAX_INPUT_TOKENS + ' tokens');
  }
  const ordinaryInput = input - cached - write;
  const inputCost = (ordinaryInput * r.input + cached * r.cached + write * r.write) / 1e6;
  const outputCost = (output * r.output) / 1e6;
  return {
    ordinaryInput,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    cacheHitRate: input === 0 ? 0 : cached / input,
  };
}

export function breakEvenReuse(model) {
  const r = rateFor(model);
  for (let n = 0; n <= 1000; n++) {
    if (r.write + n * r.cached < (n + 1) * r.input) return n;
  }
  return Infinity;
}
