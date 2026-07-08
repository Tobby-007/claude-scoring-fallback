/**
 * scorer.js
 *
 * Orchestrates AI-driven scoring with rule-based fallback.
 *
 * Flow:
 *   1. Build the scoring prompt with few-shot examples
 *   2. Send to Claude
 *   3. Parse and validate the response
 *   4. If malformed, send one retry with a clarifying prompt
 *   5. If still failing, fall back to rule-based scoring
 *   6. Return a decision with source tag and full audit context
 */

const anthropicClient = require('./mock-anthropic-client'); // In prod: require('@anthropic-ai/sdk')
const prompts = require('./prompts');
const ruleBasedFallback = require('./rule-based-fallback');

// Required fields in a valid response, with expected types
const REQUIRED_FIELDS = {
  brandFit: 'number',
  audienceRelevance: 'number',
  reliabilitySignal: 'number',
  recommendation: 'string',
  reasoning: 'string'
};

const VALID_RECOMMENDATIONS = new Set(['approve', 'reject', 'review']);

/**
 * @typedef {Object} ScoringDecision
 * @property {number} brandFit
 * @property {number} audienceRelevance
 * @property {number} reliabilitySignal
 * @property {string} recommendation - 'approve' | 'reject' | 'review'
 * @property {string} reasoning
 * @property {string} scoredBy - 'claude_haiku' | 'rule_based_fallback'
 * @property {Array<Object>} auditTrail - each step's outcome
 */

class Scorer {
  constructor(config = {}) {
    this.model = config.model || 'claude-haiku-4-5';
    this.maxTokens = config.maxTokens || 1024;
  }

  /**
   * Score an application, using Claude with rule-based fallback.
   *
   * @param {Object} application
   * @returns {Promise<ScoringDecision>}
   */
  async score(application) {
    const auditTrail = [];

    // Attempt 1: Claude with the primary prompt
    let claudeResult;
    try {
      const prompt = prompts.buildPrompt(application);
      const rawResponse = await anthropicClient.send({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }]
      });

      const rawText = this._extractText(rawResponse);
      auditTrail.push({ step: 'claude_call_1', outcome: 'received_response', rawText });

      claudeResult = this._parseAndValidate(rawText);
      auditTrail.push({ step: 'parse_1', outcome: 'valid' });

      return this._buildDecision(claudeResult, 'claude_haiku', auditTrail);

    } catch (err) {
      if (err.isApiError) {
        auditTrail.push({ step: 'claude_call_1', outcome: 'api_error', error: err.message });
        // Skip retry; go straight to fallback
        return this._fallback(application, auditTrail);
      }

      // Parse error: try one retry with a clarifying prompt
      auditTrail.push({ step: 'parse_1', outcome: 'invalid', error: err.message });
    }

    // Attempt 2: retry with clarifying prompt
    try {
      const retryPrompt = prompts.buildRetryPrompt(application, auditTrail[0].rawText);
      const rawResponse = await anthropicClient.send({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: retryPrompt }]
      });

      const rawText = this._extractText(rawResponse);
      auditTrail.push({ step: 'claude_call_2', outcome: 'received_response', rawText });

      claudeResult = this._parseAndValidate(rawText);
      auditTrail.push({ step: 'parse_2', outcome: 'valid' });

      return this._buildDecision(claudeResult, 'claude_haiku', auditTrail);

    } catch (err) {
      auditTrail.push({ step: 'parse_2', outcome: 'invalid_or_error', error: err.message });
    }

    // Both attempts failed. Fall back to rules.
    return this._fallback(application, auditTrail);
  }

  /**
   * Extract the text content from an Anthropic SDK response.
   * @private
   */
  _extractText(response) {
    if (!response || !response.content || !Array.isArray(response.content)) {
      const err = new Error('Response has no content array');
      err.isApiError = true;
      throw err;
    }
    const textBlock = response.content.find(c => c.type === 'text');
    if (!textBlock || !textBlock.text) {
      const err = new Error('Response contains no text block');
      err.isApiError = true;
      throw err;
    }
    return textBlock.text;
  }

  /**
   * Parse the response as JSON and validate it against the required schema.
   * Throws on any validation failure.
   * @private
   */
  _parseAndValidate(rawText) {
    // Strip common markdown fences if present (defensive)
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Response is not valid JSON: ${parseErr.message}`);
    }

    // Validate every required field is present with the correct type
    for (const [field, expectedType] of Object.entries(REQUIRED_FIELDS)) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`);
      }
      if (typeof parsed[field] !== expectedType) {
        throw new Error(`Field ${field} has wrong type (expected ${expectedType}, got ${typeof parsed[field]})`);
      }
    }

    // Validate numeric ranges
    for (const field of ['brandFit', 'audienceRelevance', 'reliabilitySignal']) {
      if (parsed[field] < 1 || parsed[field] > 10) {
        throw new Error(`Field ${field} out of range (expected 1-10, got ${parsed[field]})`);
      }
    }

    // Validate recommendation is one of the allowed values
    if (!VALID_RECOMMENDATIONS.has(parsed.recommendation)) {
      throw new Error(`Invalid recommendation value: ${parsed.recommendation}`);
    }

    return parsed;
  }

  /**
   * Run the rule-based fallback and build a decision from its output.
   * @private
   */
  _fallback(application, auditTrail) {
    auditTrail.push({ step: 'fallback', outcome: 'invoked' });
    const ruleResult = ruleBasedFallback.score(application);
    return this._buildDecision(ruleResult, 'rule_based_fallback', auditTrail);
  }

  /**
   * @private
   */
  _buildDecision(result, source, auditTrail) {
    return {
      ...result,
      scoredBy: source,
      auditTrail,
      timestamp: new Date().toISOString()
    };
  }
}

// Wrap the anthropic client so API errors get a flag we can detect
const originalSend = anthropicClient.send;
anthropicClient.send = async function(params) {
  try {
    return await originalSend(params);
  } catch (err) {
    err.isApiError = true;
    throw err;
  }
};

module.exports = { Scorer };
