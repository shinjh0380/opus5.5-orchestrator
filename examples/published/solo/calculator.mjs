export const RATES = Object.freeze({
  astra: Object.freeze({ input: 10, cached: 1, write: 12.5, output: 50 }),
  luna: Object.freeze({ input: 0.2, cached: 0.02, write: 0.25, output: 1.2 })
});

function getRate(model) {
  if (typeof model !== 'string' || !Object.hasOwn(RATES, model)) {
    throw new Error('지원하지 않는 모델입니다. Astra 또는 Luna를 선택하세요.');
  }
  return RATES[model];
}

export function calculateCost(values) {
  if (!values || typeof values !== 'object') throw new Error('계산할 토큰 수를 입력하세요.');
  const { model, input, cached, write, output } = values;
  const rate = getRate(model);
  const labels = { input: '전체 입력', cached: '캐시 읽기', write: '캐시 쓰기', output: '출력' };
  for (const [key, value] of Object.entries({ input, cached, write, output })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${labels[key]} 토큰 수는 유한한 0 이상의 안전한 정수여야 합니다.`);
    }
  }
  if (input > 272000) throw new Error('전체 입력은 요청당 272,000토큰 이하여야 합니다.');
  if (cached > input || write > input - cached) {
    throw new Error('캐시 읽기와 캐시 쓰기의 합은 전체 입력을 넘을 수 없습니다.');
  }
  const ordinaryInput = input - cached - write;
  const inputCost = (ordinaryInput * rate.input + cached * rate.cached + write * rate.write) / 1000000;
  const outputCost = output * rate.output / 1000000;
  return { ordinaryInput, inputCost, outputCost, totalCost: inputCost + outputCost, cacheHitRate: input === 0 ? 0 : cached / input };
}

export function breakEvenReuse(model) {
  const rate = getRate(model);
  return Math.max(0, Math.floor((rate.write - rate.input) / (rate.input - rate.cached)) + 1);
}
