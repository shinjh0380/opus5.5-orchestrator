# 실제 실행: Cache Lab 한 번씩 비교

2026-09-07, macOS, Codex CLI 0.153.4. [사전 정의한 프로토콜](experiment-protocol.md)에 따라 같은 계약·테스트·출력 파일을 사용했습니다. 실행은 team, solo 순서이며 캐시 상태는 통제하지 않았습니다.

| 항목 | Astra 계획 + Luna 구현 + Astra 리뷰 | Astra 구현 + Astra 리뷰 |
|---|---:|---:|
| 모델 호출 수 | 4 | 2 |
| 입력 토큰 | 77,697 | 43,433 |
| 출력 토큰 (추론 포함) | 7,032 | 4,747 |
| 캐시 입력 | 0 | 0 |
| 실제 검사 | 11 / 11 통과 | 11 / 11 통과 |
| 독립 리뷰 | accept | accept |
| 실행 전체 경과 | 140.838초 | 156.849초 |
| Standard API 환산 | $0.5204534 | $0.6716800 |

이 한 쌍에서는 **총 처리 토큰이 약 76% 늘었는데 API 환산 비용은 약 22.5% 낮았습니다.** 더 싼 Luna가 구현 출력을 맡았기 때문입니다. 입력·출력 토큰은 같은 단가가 아니고, 모델별 단가도 다릅니다. 이 실행은 캐시 적중이 0으로 기록되어 캐시 절약 사례가 아닙니다.

이 숫자는 작은 웹 도구의 1회씩 관측 결과입니다. 두 구현의 코드·화면은 동일하지 않으며 같은 계약과 기능 검사를 통과했습니다. 무작위 순서·반복 실험·통제된 캐시 상태 없이 일반적인 절약률, 모델 우열, 보편적인 속도 향상으로 해석하면 안 됩니다. 작업자가 많아지거나 Astra가 상세 맥락을 반복해서 읽으면 비용이 증가할 수 있습니다.

## 실패도 비용에 포함

완성한 버전의 비교 실행에 앞서 두 번의 개발 시험이 실패했습니다.

1. 계획의 context 배열에 파일명 대신 지시문이 들어와 검증기가 중단: $0.25310.
2. 출력 스키마를 좁히는 구현에서 공유 객체 참조가 prose 필드까지 제한되는 결함: $0.19923. 참조를 분리하고 회귀 테스트를 추가했습니다.

두 시험 합계 **$0.45233**는 위 표의 반복 사용 비용에 포함하지 않았고, [실패 영수증](../examples/published/development-failure-01/receipt.json)과 [두 번째 영수증](../examples/published/development-failure-02/receipt.json)을 따로 공개합니다. 이를 분업 실행에 더하면 $0.9727834입니다. 초기 도구 개발·연결 테스트·영상 제작 및 이 문서를 쓰는 비용은 별도이며, 위 수치를 전체 제작비로 표현하지 않습니다.

## 직접 확인

- [계산 가능한 비교 JSON](../examples/published/comparison.json)
- [분업 영수증](../examples/published/team/receipt.json) / [실제 생성 코드](../examples/published/team/calculator.mjs)
- [단독 영수증](../examples/published/solo/receipt.json) / [실제 생성 코드](../examples/published/solo/calculator.mjs)
- [분업 작업 계약](../examples/published/team/plan.json)
- [분업 리뷰](../examples/published/team/review-0.json) / [단독 리뷰](../examples/published/solo/review-0.json)

```sh
cd examples/published/team
node --test calculator.test.mjs
python3 -m http.server 8791 --bind 127.0.0.1
```

요금은 [공식 API 가격](https://developers.openai.com/api/docs/pricing)의 2026-09-07 Standard, 짧은 문맥 기준으로 환산했습니다. actual input/cached/write/output 필드를 사용했고, 모든 호출의 총 입력이 272K 이하였습니다. 기록에는 캐시 쓰기도 0입니다. 구독 실제 청구액·도구 사용료·세금은 아닙니다. 모델 표기는 고정된 CLI 요청 인자이며, 서버 내부 모델 독립 검증을 뜻하지 않습니다.
