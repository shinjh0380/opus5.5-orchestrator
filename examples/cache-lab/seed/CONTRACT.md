# Cache Lab contract

Create two files, calculator.mjs and index.html, which work together when served by any static HTTP server. No external dependencies, network calls, generated screenshots, or unverified benchmark claims.

## Module interface

calculator.mjs exports RATES, calculateCost and breakEvenReuse.

RATES keys astra and luna map to ordinary input, cached input, cache-write and output USD per million tokens, as properties input, cached, write, output. Astra = 10, 1, 12.5, 50. Luna = 0.2, 0.02, 0.25, 1.2. These are direct API Standard rates checked on 2026-09-07, not subscription credits. Source https://developers.openai.com/api/docs/pricing . Limit to requests with at most 272000 input tokens; reject larger inputs instead of silently using short-context rates.

calculateCost({model,input,cached,write,output}) returns {ordinaryInput, inputCost, outputCost, totalCost, cacheHitRate}. input includes cached + write + ordinary. Counts must be finite nonnegative safe integers, cached + write <= input, model must be an own RATES key; invalid inputs throw a descriptive Error. inputCost = ((input-cached-write)*rate.input + cached*rate.cached + write*rate.write)/1000000. outputCost = output*rate.output/1000000. cacheHitRate = input===0 ? 0 : cached/input. Do not add reasoning output separately. Do not round internal values.

breakEvenReuse(model) returns the minimum whole number of REUSES after the initial write needed for the cached scenario to be strictly cheaper than processing the same prefix afresh every time. Astra and Luna both return 1. Unknown models throw.

## UI requirements

index.html imports the module using ./calculator.mjs. All user-facing copy is Korean; model names/code can be English. Design a refined editorial dashboard with deep charcoal/navy, warm off-white and mint accents. No robot/space decoration. Use responsive CSS, a strong headline, explanatory diagrams or segmented cost bars, keyboard accessible controls with actual labels.

Controls: model selector id model with astra/luna; number inputs id input, cached, write, output. Defaults: astra, 100000 input, 80000 cached, 0 write, 2000 output. Immediate recalculation on input/change. Render total USD in element id total (including '$' and at least 4 decimals), breakdown id breakdown, validation message id error with aria-live; never leave a stale valid total when invalid. Show the cache share and break-even statement. Provide preset buttons id preset-warm (100000/80000/0/2000), preset-cold (100000/0/100000/2000), preset-plain (100000/0/0/2000), keeping current model. Preset buttons must be type button.

Explain that cached INPUT reduces repeated processing, not output generation. Label numbers as a hypothetical calculator, not measured performance. Show source link, rate date, Standard and <=272K scope, excludes tools/taxes and subscription charges. The page must work at 390px and 1280px width without horizontal overflow.
