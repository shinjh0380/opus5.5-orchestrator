// Cache Lab — 가상 비용 계산 모듈
// 요율 출처: https://developers.openai.com/api/docs/pricing (Standard, 2026-09-07 확인)
// 단위: 100만 토큰당 USD. 구독 크레딧이 아닌 API 직접 과금 요율입니다.

const MAX_INPUT_TOKENS = 272000;

export const RATES = Object.freeze({
  astra: Object.freeze({ input: 10, cached: 1, write: 12.5, output: 50 }),
  luna: Object.freeze({ input: 0.2, cached: 0.02, write: 0.25, output: 1.2 }),
});

const FIELD_LABELS = {
  input: '전체 입력 토큰(input)',
  cached: '캐시 읽기 토큰(cached)',
  write: '캐시 쓰기 토큰(write)',
  output: '출력 토큰(output)',
};

function getRate(model) {
  if (typeof model !== 'string' || !Object.prototype.hasOwnProperty.call(RATES, model)) {
    throw new Error(`알 수 없는 모델입니다: ${String(model)}. astra 또는 luna만 사용할 수 있습니다.`);
  }
  return RATES[model];
}

function checkCount(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${FIELD_LABELS[name]} 값은 유한한 숫자여야 합니다.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${FIELD_LABELS[name]} 값은 안전한 범위의 정수여야 합니다.`);
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
  if (cached + write > input) {
    throw new Error('캐시 읽기 + 캐시 쓰기 토큰은 전체 입력 토큰을 넘을 수 없습니다. 두 값은 전체 입력의 일부입니다.');
  }
  if (input > MAX_INPUT_TOKENS) {
    throw new Error(`전체 입력은 요청당 ${MAX_INPUT_TOKENS.toLocaleString('ko-KR')} 토큰 이하만 지원합니다. 더 긴 컨텍스트는 다른 요율이 적용될 수 있어 계산하지 않습니다.`);
  }
  const ordinaryInput = input - cached - write;
  const inputCost = (ordinaryInput * rate.input + cached * rate.cached + write * rate.write) / 1000000;
  const outputCost = (output * rate.output) / 1000000;
  const totalCost = inputCost + outputCost;
  const cacheHitRate = input === 0 ? 0 : cached / input;
  return { ordinaryInput, inputCost, outputCost, totalCost, cacheHitRate };
}

export function breakEvenReuse(model) {
  const rate = getRate(model);
  if (!(rate.cached < rate.input)) {
    throw new Error('이 모델은 캐시 읽기가 일반 입력보다 저렴하지 않아 손익분기점이 없습니다.');
  }
  // 최초 1회 쓰기 + k회 재사용(캐시 읽기)  <  (k + 1)회 새로 처리
  for (let k = 0; k <= 1000000; k++) {
    if (rate.write + k * rate.cached < (k + 1) * rate.input) return k;
  }
  throw new Error('손익분기 재사용 횟수를 찾을 수 없습니다.');
}
