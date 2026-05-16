/**
 * progressEngine.js
 * Calculates goal achievement scores based on Unit of Measure (UoM).
 *
 * Rules:
 *   Numeric / Percentage  → "Min" → score = achieved / target  (higher is better)
 *   Numeric (cost etc.)   → "Max" → score = target / achieved  (lower actual is better)
 *   Timeline              → "Min" → same as Numeric (days/milestones completed)
 *   Zero-based            → 100% if achieved === 0, else 0%
 *
 * The caller decides the direction by passing direction='min'|'max'.
 * Default direction is 'min' (Numeric, Percentage, Timeline).
 */

/**
 * @param {number} target     - Goal target value
 * @param {number} achieved   - Actual achievement logged
 * @param {string} uom        - 'Numeric'|'Percentage'|'Timeline'|'Zero-based'
 * @param {string} direction  - 'min' (higher achieved = better) | 'max' (lower achieved = better)
 * @returns {{ score: number, percent: number, label: string }}
 *   score   → raw ratio (can exceed 1.0 for overachievement)
 *   percent → capped 0-100 for display
 *   label   → human-readable status
 */
function calcProgressScore(target, achieved, uom, direction = 'min') {
  if (achieved === null || achieved === undefined || target === null)
    return { score: 0, percent: 0, label: 'Not Started' };

  // 1. Prevent negative achievements
  const safeAchieved = Math.max(0, achieved);

  let score = 0;
  if (uom === 'Zero-based') {
    score = safeAchieved === 0 ? 1 : 0;
  } else if (direction === 'max') {
    // Lower is better (e.g. Cost). If target is 55, achieved 2 is great.
    score = safeAchieved === 0 ? 1 : target / safeAchieved;
  } else {
    // Higher is better (e.g. Revenue)
    score = target === 0 ? (safeAchieved === 0 ? 1 : 0) : safeAchieved / target;
  }

  // 2. Strict Cap at 1.0 (100%) so overachieving doesn't break total weightage
  score = Math.max(0, Math.min(score, 1));
  
  const percent = Math.round(score * 100);
  const label =
    percent === 100 ? 'Target Met ✓' :
    percent >= 75 ? 'On Track' :
    percent >= 50 ? 'At Risk' :
    percent > 0 ? 'Off Track' : 'Not Started';

  return { score: parseFloat(score.toFixed(4)), percent, label };
}

function currentQuarter() {
  const d = new Date();
  return `Q${Math.ceil((d.getMonth() + 1) / 3)}-${d.getFullYear()}`;
}

module.exports = { calcProgressScore, currentQuarter };

/**
 * Weighted total score across multiple goals.
 * @param {Array<{target, achieved, uom, direction, weightage}>} goals
 * @returns {{ weightedScore: number, weightedPercent: number }}
 */
function calcWeightedScore(goals) {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const g of goals) {
    if (g.weightage == null || g.achieved == null) continue;
    const { score } = calcProgressScore(g.target, g.achieved, g.uom, g.direction || 'min');
    weightedSum += score * g.weightage;
    totalWeight += g.weightage;
  }

  if (totalWeight === 0) return { weightedScore: 0, weightedPercent: 0 };

  const weightedScore = weightedSum / totalWeight;
  return {
    weightedScore: parseFloat(weightedScore.toFixed(4)),
    weightedPercent: Math.min(Math.round(weightedScore * 100), 150),
  };
}

/**
 * Get the current quarter string, e.g. "Q2-2025"
 */
function currentQuarter() {
  const d = new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q}-${d.getFullYear()}`;
}

module.exports = { calcProgressScore, calcWeightedScore, currentQuarter };
