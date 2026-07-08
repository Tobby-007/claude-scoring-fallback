/**
 * example-usage.js
 *
 * Runs the Scorer against 4 mock applications demonstrating each path:
 *
 *   1. @app_valid_1     → Claude returns valid response, AI-scored (approve)
 *   2. @app_malformed   → Claude returns malformed JSON, retry fails, fallback to rules
 *   3. @app_api_error   → Claude API throws, immediate fallback to rules
 *   4. @app_low_score   → Claude returns valid response, AI-scored (reject)
 */

const { Scorer } = require('./scorer');
const mockClient = require('./mock-anthropic-client');

mockClient.reset();

const applications = [
  {
    handle: '@app_valid_1',
    followers: 45000,
    niche: 'clean beauty and skincare',
    geography: 'US',
    pastPartnerships: 'Sephora, Glossier',
    notes: 'Consistent posts, professional media kit'
  },
  {
    handle: '@app_malformed',
    followers: 30000,
    niche: 'wellness and mindfulness',
    geography: 'US',
    pastPartnerships: 'Calm',
    notes: 'Consistent weekly content'
  },
  {
    handle: '@app_api_error',
    followers: 60000,
    niche: 'skincare tutorials',
    geography: 'US',
    pastPartnerships: 'Fenty Beauty',
    notes: 'Professional media kit'
  },
  {
    handle: '@app_low_score',
    followers: 5000,
    niche: 'general gaming',
    geography: 'US',
    pastPartnerships: 'none',
    notes: 'Sporadic posts'
  }
];

async function main() {
  const scorer = new Scorer();

  console.log(`\nScoring ${applications.length} applications...\n`);

  for (const app of applications) {
    const decision = await scorer.score(app);
    console.log(`--- ${app.handle} ---`);
    console.log(`  Scored by:        ${decision.scoredBy}`);
    console.log(`  Brand fit:        ${decision.brandFit}/10`);
    console.log(`  Audience:         ${decision.audienceRelevance}/10`);
    console.log(`  Reliability:      ${decision.reliabilitySignal}/10`);
    console.log(`  Recommendation:   ${decision.recommendation}`);
    console.log(`  Reasoning:        ${decision.reasoning}`);
    console.log(`  Audit steps:      ${decision.auditTrail.length}`);
    decision.auditTrail.forEach((step, i) => {
      console.log(`    [${i + 1}] ${step.step} → ${step.outcome}${step.error ? ` (${step.error})` : ''}`);
    });
    console.log('');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
