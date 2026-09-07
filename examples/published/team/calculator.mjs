export const RATES = Object.freeze({
  astra: Object.freeze({ input: 10, cached: 1, write: 12.5, output: 50 }),
  luna: Object.freeze({ input: 0.2, cached: 0.02, write: 0.25, output: 1.2 }),
});

const MAX_INPUT_TOKENS = 272000;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function validateModel(model) {
  if (!hasOwn(RATES, model)) {
    throw new Error(`알 수 없는 모델입니다: ${String(model)}`);
  }
  return RATES[model];
}

function validateCount(field, value) {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} 토큰 수는 유한한 0 이상의 안전한 정수여야 합니다.`);
  }
}

export function calculateCost({ model, input, cached, write, output } = {}) {
  const rate = validateModel(model);

  validateCount('input', input);
  validateCount('cached', cached);
  validateCount('write', write);
  validateCount('output', output);

  if (input > MAX_INPUT_TOKENS) {
    throw new Error(`input은 ${MAX_INPUT_TOKENS} 토큰을 초과할 수 없습니다.`);
  }
  if (cached + write > input) {
    throw new Error('cached와 write의 합은 input을 초과할 수 없습니다.');
  }

  const ordinaryInput = input - cached - write;
  const inputCost =
    (ordinaryInput * rate.input + cached * rate.cached + write * rate.write) / 1000000;
  const outputCost = (output * rate.output) / 1000000;
  const totalCost = inputCost + outputCost;
  const cacheHitRate = input === 0 ? 0 : cached / input;

  return {
    ordinaryInput,
    inputCost,
    outputCost,
    totalCost,
    cacheHitRate,
  };
}

export function breakEvenReuse(model) {
  const rate = validateModel(model);
  let reuses = 0;

  while (rate.write + reuses * rate.cached >= (reuses + 1) * rate.input) {
    reuses += 1;
  }

  return reuses;
}
