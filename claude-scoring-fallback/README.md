# claude-scoring-fallback

A Node.js demonstration of production Anthropic Claude API integration for structured scoring, with a rule-based fallback when the AI is unavailable.

## Why This Pattern Exists

Using an LLM in production for structured decisioning (scoring, classification, routing) has three consistent challenges:

1. **The API is not always available.** Timeouts, 5xx errors, and rate limits happen. Your pipeline should not stop working because Anthropic's API is having a bad hour.
2. **The response is not always well-formed JSON.** LLMs generally return clean JSON when prompted correctly, but "generally" is not "always." One malformed response should not crash the pipeline.
3. **The response is not always trustworthy.** Even well-formed responses can be wrong. Confidence signals from the model, combined with structured audit logging, allow you to catch drift.

The scoring-with-fallback pattern addresses all three:

1. **Structured prompt** with strict schema requirements and few-shot examples
2. **Defensive JSON parsing** with schema validation
3. **Rule-based fallback** for API failures or malformed responses
4. **Full audit logging** on every decision, whether from AI or from rules

## What This Repo Demonstrates

- A `Scorer` class that orchestrates AI scoring with fallback
- A structured prompt with few-shot examples for creator-application-style scoring
- Defensive JSON parsing that catches malformed responses
- A rule-based fallback that produces conservative but usable scores
- Full audit trail on every decision (source, confidence, evidence)

## Files

- `src/scorer.js`: the main orchestrator (calls Claude, falls back to rules)
- `src/prompts.js`: prompt construction with few-shot examples
- `src/rule-based-fallback.js`: the fallback scoring logic
- `src/mock-anthropic-client.js`: a mock Claude client that alternates between valid, malformed, and error responses for demonstration
- `src/example-usage.js`: runs the scorer against 4 mock applications showing each path
- `package.json`: dependencies

## Running Locally

```bash
npm install
node src/example-usage.js
```

Expected output shows the scorer processing 4 applications:

1. **Application 1:** Claude returns valid response → scored by AI
2. **Application 2:** Claude returns malformed JSON → falls back to rules
3. **Application 3:** Claude API returns 500 error → falls back to rules
4. **Application 4:** Claude returns valid response with low score → scored by AI, flagged for review

## Design Notes

**Strict JSON schema.**
The prompt explicitly asks for JSON output with a defined schema. The parser validates every required field is present with the correct type before accepting the response. This catches malformed output before it enters the downstream pipeline.

**One retry, then fallback.**
If the first Claude call returns malformed JSON, the scorer sends a single follow-up prompt clarifying the required format. If that also fails, it falls back to rules. This bounds latency: worst case is two API calls plus rule execution, not an unbounded retry loop.

**Rule-based fallback is deliberately conservative.**
The rules approve fewer applicants than Claude would. This is intentional. When you are falling back because Claude is unavailable, you are already operating in a degraded state. Better to under-approve and let a human review the ambiguous cases than to over-approve and ship bad orders.

**Few-shot examples over rule descriptions.**
The prompt includes 4 hand-curated examples of scored applications (2 approved, 2 rejected) with the reasoning inline. Real examples out-explain rules. The system prompt is short. Most of the tokens are examples.

**Every decision has a source tag.**
The scorer's output includes `scoredBy: 'claude_haiku' | 'rule_based_fallback'`. Downstream code can treat AI-scored and rule-scored decisions differently (for instance, all rule-scored decisions might go to human review even if the score is high).

## Using with Real Claude API

The `mock-anthropic-client.js` file is a stand-in for demonstration. To use with the real Claude API:

1. Install the official Anthropic SDK: `npm install @anthropic-ai/sdk`
2. Set `ANTHROPIC_API_KEY` in your environment
3. Replace the mock client in `scorer.js` with the real client:

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic();
const response = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }]
});
```

The rest of the pipeline (prompt construction, JSON parsing, fallback) stays the same.

## Adapting to Production Use Cases

This pattern generalizes beyond creator scoring to any structured decisioning task:

- **Support ticket classification** (which team, which priority)
- **Fraud signal scoring** (risk level, confidence)
- **Content moderation** (approve, reject, flag for review)
- **Product categorization** (which taxonomy nodes apply)

For each use case, you adjust the prompt, the schema, and the rule-based fallback. The orchestration pattern stays the same.

## License

MIT
