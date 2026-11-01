// Cache Lab calculator. Rates: USD per 1,000,000 tokens (API Standard).
export const RATE_DATE = '2026-09-07';
export const RATE_SOURCE = 'https://developers.openai.com/api/docs/pricing';
export const MAX_INPUT_TOKENS = 272000;

export const RATES = Object.freeze(Object.assign(Object.create(null), {
  astra: Object.freeze({ input: 10, cached: 1, write: 12.5, output: 50 }),
  luna: Object.freeze({ input: 0.2, cached: 0.02, write: 0.25, output: 1.2 }),
}));

function getRates(model) {
  if (typeof model !== 'string' || !Object.hasOwn(RATES, model)) {
    throw new Error('model: 알 수 없는 모델입니다.');
  }
  return RATES[model];
}

function checkCount(name, value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name}: 0 이상의 정수여야 합니다.`);
  }
}

export function calculateCost(args) {
  if (args === null || typeof args !== 'object') {
    throw new Error('입력값 객체가 필요합니다.');
  }
  const { model, input, cached, write, output } = args;
  const r = getRates(model);
  checkCount('input', input);
  checkCount('cached', cached);
  checkCount('write', write);
  checkCount('output', output);
  if (cached + write > input) {
    throw new Error('cached + write: 캐시 읽기와 쓰기의 합은 입력 토큰(input) 이하여야 합니다.');
  }
  if (input > MAX_INPUT_TOKENS) {
    throw new Error(`input: ${MAX_INPUT_TOKENS} 토큰 이하만 지원합니다.`);
  }
  const ordinaryInput = input - cached - write;
  const inputCost = (ordinaryInput * r.input + cached * r.cached + write * r.write) / 1e6;
  const outputCost = (output * r.output) / 1e6;
  const totalCost = inputCost + outputCost;
  const cacheHitRate = input === 0 ? 0 : cached / input;
  return { ordinaryInput, inputCost, outputCost, totalCost, cacheHitRate };
}

export function breakEvenReuse(model) {
  const r = getRates(model);
  if (r.cached >= r.input) {
    throw new Error('cached 요금이 input 요금 이상이라 손익분기점이 없습니다.');
  }
  for (let k = 0; k <= 1000; k++) {
    if (r.write + k * r.cached < (k + 1) * r.input) return k;
  }
  throw new Error('손익분기점이 범위 내에 없습니다.');
}
