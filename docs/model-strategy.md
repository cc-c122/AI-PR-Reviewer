# Model Strategy

The model layer should use a tiered strategy:

1. Fast model for PR summaries and file-level summaries.
2. Stronger reasoning model for high-risk code paths.
3. Schema-validated output for final findings.

Every model-generated finding must include severity, category, evidence, suggestion, confidence, and blocking status.
