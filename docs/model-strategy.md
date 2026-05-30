# Model Strategy

## 当前 MVP 实现

Current MVP uses a single OpenAI-compatible provider for AI review generation.
Users can configure the provider through environment variables, including the
model name. The default model is `gpt-4o-mini`.

When no API key is configured, the system automatically falls back to
`MockReviewModelClient`. This keeps the local demo flow and static demo
experience runnable without calling a real model provider.

Model output is validated with the existing schema before it becomes a review
report. The final findings must include at least:

- `severity`
- `category`
- `evidence`
- `suggestion`
- `confidence`
- `blocking`

The current implementation does not provide fast-model / reasoning-model
routing or multi-model orchestration.

## 未来扩展方向

Future versions can introduce a tiered model strategy based on PR risk level
and review cost:

1. Use a faster, lower-cost model to generate PR summaries.
2. Use a stronger reasoning model for high-risk files or code paths.
3. Add a second validation pass for critical findings to further reduce false
   positives.

These are planning directions, not capabilities implemented in the current MVP.
