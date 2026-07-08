/**
 * prompts.js
 *
 * Builds the scoring prompt with few-shot examples.
 *
 * Design decision: real few-shot examples out-explain rule descriptions.
 * The system prompt is short. Most of the tokens are examples.
 */

const SCORING_INSTRUCTION = `You are a scoring assistant that evaluates creator applications for a brand's gifting program.

Score each application on 3 criteria (each on a scale of 1-10):
- brandFit: how well the creator's content style matches our brand voice
- audienceRelevance: how well their audience matches our target demographic
- reliabilitySignal: signals of professionalism and follow-through

Return your response as strict JSON with this exact schema:
{
  "brandFit": <integer 1-10>,
  "audienceRelevance": <integer 1-10>,
  "reliabilitySignal": <integer 1-10>,
  "recommendation": "approve" | "reject" | "review",
  "reasoning": "<one or two sentences>"
}

Do not include any text outside the JSON object. Do not use markdown code fences.`;

// Few-shot examples curated from previously-decided applications.
// These do more explanatory work than any rule description would.
const FEW_SHOT_EXAMPLES = [
  {
    application: {
      handle: '@creator_alpha',
      followers: 45000,
      niche: 'clean beauty and skincare tutorials',
      geography: 'US',
      pastPartnerships: 'Sephora, Glossier',
      notes: 'Consistent weekly posts, high engagement rate, professional media kit provided'
    },
    response: {
      brandFit: 9,
      audienceRelevance: 8,
      reliabilitySignal: 9,
      recommendation: 'approve',
      reasoning: 'Strong brand fit with clean beauty focus, established partnerships indicate reliability, and engagement patterns suggest genuine audience.'
    }
  },
  {
    application: {
      handle: '@creator_beta',
      followers: 8000,
      niche: 'general lifestyle',
      geography: 'US',
      pastPartnerships: 'none listed',
      notes: 'Posts sporadically, mixed content style, no media kit'
    },
    response: {
      brandFit: 4,
      audienceRelevance: 5,
      reliabilitySignal: 3,
      recommendation: 'reject',
      reasoning: 'General lifestyle content is a weak brand match, and sporadic posting with no partnership history signals low reliability.'
    }
  },
  {
    application: {
      handle: '@creator_gamma',
      followers: 120000,
      niche: 'wellness and mental health',
      geography: 'UK',
      pastPartnerships: 'Headspace, Calm',
      notes: 'Strong content quality, but audience is primarily UK, not US'
    },
    response: {
      brandFit: 8,
      audienceRelevance: 5,
      reliabilitySignal: 8,
      recommendation: 'review',
      reasoning: 'Excellent brand fit and reliability, but geographic mismatch with our primary US market means human should evaluate strategic value.'
    }
  },
  {
    application: {
      handle: '@creator_delta',
      followers: 2500,
      niche: 'skincare reviews',
      geography: 'US',
      pastPartnerships: 'none',
      notes: 'Very small following but exceptional engagement and content quality'
    },
    response: {
      brandFit: 8,
      audienceRelevance: 7,
      reliabilitySignal: 6,
      recommendation: 'review',
      reasoning: 'Content quality is strong and niche is a match, but small follower count and no partnership history means human review appropriate.'
    }
  }
];

/**
 * Build the full prompt to send to Claude.
 *
 * @param {Object} application - the new application to score
 * @returns {string} - the prompt ready to send
 */
function buildPrompt(application) {
  const examplesSection = FEW_SHOT_EXAMPLES.map((example, i) => {
    return `Example ${i + 1}:
Application: ${JSON.stringify(example.application, null, 2)}
Response: ${JSON.stringify(example.response)}`;
  }).join('\n\n');

  return `${SCORING_INSTRUCTION}

Below are examples of scored applications. Study the patterns.

${examplesSection}

Now score this new application:
${JSON.stringify(application, null, 2)}

Response:`;
}

/**
 * Build a clarifying follow-up prompt when the first response was malformed.
 *
 * @param {Object} application - the same application
 * @param {string} priorResponse - the malformed response from the first attempt
 * @returns {string}
 */
function buildRetryPrompt(application, priorResponse) {
  return `Your previous response could not be parsed as valid JSON matching the required schema.

Previous response was:
${priorResponse}

Please score the same application and return ONLY a valid JSON object with this exact schema (no markdown, no additional text):
{
  "brandFit": <integer 1-10>,
  "audienceRelevance": <integer 1-10>,
  "reliabilitySignal": <integer 1-10>,
  "recommendation": "approve" | "reject" | "review",
  "reasoning": "<one or two sentences>"
}

Application:
${JSON.stringify(application, null, 2)}

Response:`;
}

module.exports = {
  buildPrompt,
  buildRetryPrompt
};
