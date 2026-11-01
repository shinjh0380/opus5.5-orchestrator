// Cache Lab — 가상 비용 계산 모듈 (의존성 없음)
// 요율: API Standard, USD / 1,000,000 tokens, 2026-09-07 확인
// 출처: https://developers.openai.com/api/docs/pricing

export const RATES = Object.freeze({
  astra: Object.freeze({ input: 10, cached: 1, write: 12.5, output: 50 }),
  luna: Object.freeze({ input: 0.2, cached: 0.02, write: 0.25, output: 1.2 }),
});

export const RATE_DATE = '2026-09-07';
export const RATE_SOURCE = 'https://developers.openai.com/api/docs/pricing';
export const MAX_INPUT_TOKENS = 272000;

const FIELD_LABELS = Object.freeze({
  input: '전체 입력 토큰(input)',
  cached: '캐시 읽기 토큰(cached)',
  write: '캐시 쓰기 토큰(write)',
  output: '출력 토큰(output)',
});

function getRate(model) {
  if (typeof model !== 'string' || !Object.prototype.hasOwnProperty.call(RATES, model)) {
    throw new Error(`알 수 없는 모델입니다: ${String(model)}. 사용 가능한 모델: ${Object.keys(RATES).join(', ')}`);
  }
  return RATES[model];
}

function checkCount(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${FIELD_LABELS[name]} 값은 유한한 숫자여야 합니다.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${FIELD_LABELS[name]} 값은 안전한 정수여야 합니다(소수 불가).`);
  }
  if (value < 0) {
    throw new Error(`${FIELD_LABELS[name]} 값은 0 이상이어야 합니다.`);
  }
}

export function calculateCost(params) {
  if (params === null || typeof params !== 'object') {
    throw new Error('계산 입력은 객체여야 합니다.');
  }
  const { model, input, cached, write, output } = params;
  const rate = getRate(model);
  checkCount('input', input);
  checkCount('cached', cached);
  checkCount('write', write);
  checkCount('output', output);
  if (input > MAX_INPUT_TOKENS) {
    throw new Error(`전체 입력 토큰이 ${MAX_INPUT_TOKENS.toLocaleString('ko-KR')}개를 초과합니다. 이 계산기는 272K 이하 요청의 Standard 요율만 다룹니다.`);
  }
  if (cached + write > input) {
    throw new Error('캐시 읽기 + 캐시 쓰기 토큰의 합은 전체 입력 토큰을 넘을 수 없습니다.');
  }
  const ordinaryInput = input - cached - write;
  const inputCost = (ordinaryInput * rate.input + cached * rate.cached + write * rate.write) / 1000000;
  const outputCost = (output * rate.output) / 1000000;
  const totalCost = inputCost + outputCost;
  const cacheHitRate = input === 0 ? 0 : cached / input;
  return { ordinaryInput, inputCost, outputCost, totalCost, cacheHitRate };
}

// 최초 1회 캐시 쓰기 후 재사용 N회: write + N*cached
// 매번 새로 처리: (N+1)*input
// 캐시 시나리오가 '엄격히' 더 저렴해지는 최소 N을 반환.
export function breakEvenReuse(model) {
  const rate = getRate(model);
  if (!(rate.cached < rate.input)) {
    throw new Error(`${model} 모델은 캐시 읽기 요율이 일반 입력보다 낮지 않아 손익분기점이 없습니다.`);
  }
  // 해석적 하한을 구한 뒤 정확한 부등식으로 확인
  let n = Math.max(0, Math.floor((rate.write - rate.input) / (rate.input - rate.cached)));
  for (let guard = 0; guard < 1000000; guard++, n++) {
    if (rate.write + n * rate.cached < (n + 1) * rate.input) return n;
  }
  throw new Error('손익분기점을 계산할 수 없습니다.');
}
