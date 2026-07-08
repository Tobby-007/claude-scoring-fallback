/**
 * rule-based-fallback.js
 *
 * Deterministic scoring rules used when Claude is unavailable or its response is malformed.
 *
 * Design decision: rules are deliberately conservative. When Claude is down, the pipeline is
 * already in a degraded state. Better to under-approve and route ambiguous cases to human
 * review than to over-approve and risk shipping inappropriate product bundles.
 */

/**
 * Score an application using deterministic rules.
 *
 * @param {Object} application
 * @returns {Object} - same schema as Claude output, with source tag
 */
function score(application) {
  const brandFit = _scoreBrandFit(application);
  const audienceRelevance = _scoreAudienceRelevance(application);
  const reliabilitySignal = _scoreReliabilitySignal(application);

  const total = brandFit + audienceRelevance + reliabilitySignal;

  // Conservative thresholds. Rules approve only clearly-strong applications.
  // Anything else routes to human review, including borderline cases that Claude might have approved.
  let recommendation;
  if (total >= 24) {
    recommendation = 'approve';
  } else if (total <= 12) {
    recommendation = 'reject';
  } else {
    recommendation = 'review';
  }

  return {
    brandFit,
    audienceRelevance,
    reliabilitySignal,
    recommendation,
    reasoning: `Rule-based fallback score. Total score ${total}/30. Rules are conservative; borderline cases route to human review.`
  };
}

/**
 * @private
 * Rule: does the niche include beauty, skincare, wellness, or clean living keywords?
 */
function _scoreBrandFit(application) {
  const niche = (application.niche || '').toLowerCase();
  const brandKeywords = ['beauty', 'skincare', 'wellness', 'clean', 'natural', 'holistic'];

  const matchCount = brandKeywords.filter(k => niche.includes(k)).length;

  if (matchCount >= 2) return 8;
  if (matchCount === 1) return 6;
  return 3;
}

/**
 * @private
 * Rule: is the geography US (our primary market)?
 */
function _scoreAudienceRelevance(application) {
  const geo = (application.geography || '').toUpperCase();
  if (geo === 'US') return 7;
  if (['CA', 'UK', 'AU'].includes(geo)) return 5; // secondary markets
  return 3;
}

/**
 * @private
 * Rule: signals of professionalism: past partnerships and posting consistency.
 */
function _scoreReliabilitySignal(application) {
  const partnerships = application.pastPartnerships || '';
  const notes = (application.notes || '').toLowerCase();

  let score = 3; // baseline

  if (partnerships && partnerships.toLowerCase() !== 'none' && partnerships.toLowerCase() !== 'none listed') {
    score += 3; // has some partnership history
  }

  if (notes.includes('consistent') || notes.includes('professional') || notes.includes('media kit')) {
    score += 2;
  }

  if (notes.includes('sporadic') || notes.includes('mixed')) {
    score -= 1;
  }

  return Math.max(1, Math.min(10, score));
}

module.exports = { score };
