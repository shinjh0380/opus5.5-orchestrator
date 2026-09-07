# Native skill demo: add CSV export to Cache Lab

This example was completed in an actual interactive Codex CLI 0.153.4 session using the installed `astra-orchestrator` skill on September 7, 2026. It extends the [original team-generated Cache Lab](../published/team/).

The primary ran Astra low, delegated `index.html`, `export.mjs`, and `export.test.mjs` to the installed `astra_luna_worker` profile (Luna medium), then requested an independent `astra_review` (Astra low). Session metadata confirmed these configured models and efforts. It does not independently attest the service's internal backend model.

The worker added a real **CSV로 저장** download button. The parent requested itemized costs and a click-time validation test during implementation. Fourteen tests passed; both original calculation files remained unchanged. The independent review accepted the result. The implementation-and-review turn took approximately six minutes; browser recording and validation came afterward.

## Run it

```sh
cd examples/native-cache-lab
node --test calculator.test.mjs export.test.mjs
python3 -m http.server 8791 --bind 127.0.0.1
```

Open `http://127.0.0.1:8791`. Change an input and download the current values and costs as UTF-8 CSV with a BOM and CRLF rows. Invalid form inputs do not create a download. Numeric CSV costs preserve JavaScript floating-point precision; the page formats displayed currency to four decimals.

Browser verification additionally checked actual downloads at 2,000 and 6,000 output tokens. The exported totals were numerically $0.38 and $0.58 for the Astra warm-cache preset. Invalid cached input produced an error and zero downloads. These are illustrative calculator inputs, not the cost of running the skill. Native token totals and cost are not reported.

## Reproduce the task from its starting point

Copy `index.html`, `calculator.mjs`, and `calculator.test.mjs` from `examples/published/team` into a disposable project. Install the project skill using the [native setup guide](../../docs/native-mode.md), open a new trusted Codex task, and select Astra. Request:

```text
$astra-orchestrator Add a CSV download to this calculator.
Use one Luna implementer and a fresh Astra reviewer. Preserve calculator.mjs
and calculator.test.mjs. Export the current validated values and itemized costs;
include BOM, CRLF, and correct CSV escaping. Invalid inputs must not download.
Put the pure serializer in export.mjs and add focused export.test.mjs tests.
Run the existing and new tests before review. Do not commit or publish.
```

The recording uses the real terminal input/output, with waits shortened and private account/path lines masked. Browser footage uses the generated app with a compact recording stylesheet. No result screens were fabricated. The original pilot receipts are unchanged.
