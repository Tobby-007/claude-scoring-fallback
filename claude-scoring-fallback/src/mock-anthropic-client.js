/**
 * mock-anthropic-client.js
 *
 * A stand-in for the real Anthropic SDK client. Exists so example-usage.js can run
 * without an API key, while still demonstrating each response path:
 *   - Valid response (parseable JSON matching schema)
 *   - Malformed response (looks-like-JSON-but-missing-a-field)
 *   - API error (throws)
 *
 * In production, replace this with `new Anthropic()` from '@anthropic-ai/sdk'.
 */

// Track how many times send() has been called so we can vary the response for the demo.
let callCount = 0;

/**
 * Reset the call counter (useful when the demo is re-run).
 */
function reset() {
  callCount = 0;
}

/**
 * Simulate a Claude API call.
 *
 * @param {Object} params
 * @param {string} params.model
 * @param {number} params.max_tokens
 * @param {Array<Object>} params.messages
 * @returns {Promise<Object>} - shape matches @anthropic-ai/sdk's messages.create() response
 */
async function send(params) {
  callCount++;
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 100));

  const applicationHandle = _extractHandle(params.messages[0].content);

  // Route based on the handle in the application
  if (applicationHandle === '@app_valid_1') {
    return _validResponse({
      brandFit: 8,
      audienceRelevance: 7,
      reliabilitySignal: 8,
      recommendation: 'approve',
      reasoning: 'Strong skincare niche match, US audience, established partnerships.'
    });
  }

  if (applicationHandle === '@app_malformed') {
    // Return JSON that's missing a required field (reliabilitySignal). Parser should reject it.
    return _rawResponse(`{
  "brandFit": 7,
  "audienceRelevance": 6,
  "recommendation": "approve",
  "reasoning": "Missing reliabilitySignal on purpose to demo defensive parsing."
}`);
  }

  if (applicationHandle === '@app_api_error') {
    // Simulate a 500 error
    const err = new Error('Internal Server Error');
    err.status = 500;
    throw err;
  }

  if (applicationHandle === '@app_low_score') {
    return _validResponse({
      brandFit: 4,
      audienceRelevance: 5,
      reliabilitySignal: 4,
      recommendation: 'reject',
      reasoning: 'Weak brand match and low reliability signals.'
    });
  }

  // Default: valid response
  return _validResponse({
    brandFit: 6,
    audienceRelevance: 6,
    reliabilitySignal: 6,
    recommendation: 'review',
    reasoning: 'Default response for unknown application.'
  });
}

/**
 * Extract the handle from the prompt text (used to route mock behavior).
 * Finds the LAST occurrence, since the few-shot examples in the prompt also contain handles;
 * the new application being scored appears at the end of the prompt.
 * @private
 */
function _extractHandle(promptText) {
  const matches = [...promptText.matchAll(/"handle":\s*"(@[^"]+)"/g)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

/**
 * Format a valid response in the Anthropic SDK shape.
 * @private
 */
function _validResponse(scoreObject) {
  return {
    content: [
      { type: 'text', text: JSON.stringify(scoreObject) }
    ]
  };
}

/**
 * Format a raw response (for malformed cases).
 * @private
 */
function _rawResponse(rawText) {
  return {
    content: [
      { type: 'text', text: rawText }
    ]
  };
}

module.exports = { send, reset };
