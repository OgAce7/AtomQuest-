/**
 * checkins.js — Part 3 routes
 * Handles quarterly achievement logging + manager comments.
 *
 * Mount in server.js:
 *   const checkinRoutes = require('./routes/checkins');
 *   app.use('/api/checkins', checkinRoutes);
 */
const router  = require('express').Router();
const Goal    = require('../models/Goal');
const { calcProgressScore, currentQuarter } = require('../utils/progressEngine');
const { writeAudit } = require('../middleware/auditMiddleware');

// ── GET /api/checkins/:goalId  ────────────────────────────
// Returns goal + computed progress score for current state
router.get('/:goalId', async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const progress = calcProgressScore(goal.target, goal.achieved, goal.uom, goal.direction || 'min');
    res.json({ goal, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/checkins/:goalId  ───────────────────────────
// Employee logs actual achievement for a quarter
// Body: { achieved: number, note?: string, userId: string, userRole: string, quarter?: string }
router.post('/:goalId', async (req, res) => {
  try {
    const { achieved, note, userId, userRole, quarter } = req.body;

    if (achieved === undefined || achieved === null) {
      return res.status(400).json({ error: 'achieved value is required' });
    }
    if (typeof achieved !== 'number') {
      return res.status(400).json({ error: 'achieved must be a number' });
    }

    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    if (goal.status !== 'approved') {
      return res.status(400).json({ error: 'Check-ins are only allowed on approved goals' });
    }

    const oldAchieved = goal.achieved;
    goal.achieved = achieved;

    // Push to checkin history sub-array (keep per-quarter log)
    if (!goal.checkins) goal.checkins = [];
    goal.checkins.push({
      quarter:   quarter || currentQuarter(),
      achieved,
      note:      note || '',
      loggedBy:  userId,
      loggedAt:  new Date(),
    });

    await goal.save();

    // Audit
    await writeAudit({
      goalId:    goal._id,
      ownerId:   goal.ownerId,
      changedBy: userId,
      role:      userRole || 'employee',
      action:    'checkin',
      field:     'achieved',
      oldValue:  oldAchieved,
      newValue:  achieved,
      note:      note || '',
      postLock:  goal.isLocked,
    });

    const progress = calcProgressScore(goal.target, goal.achieved, goal.uom, goal.direction || 'min');
    res.json({ goal, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/checkins/:goalId/comment  ─────────────────
// Manager adds a check-in comment to a goal
// Body: { comment: string, managerId: string, quarter?: string }
router.patch('/:goalId/comment', async (req, res) => {
  try {
    const { comment, managerId, quarter } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: 'Comment is required' });

    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    goal.managerComment = comment.trim();

    // Also push to checkin log as a comment entry
    if (!goal.checkins) goal.checkins = [];
    goal.checkins.push({
      quarter:   quarter || currentQuarter(),
      achieved:  goal.achieved,
      note:      `[Manager Comment] ${comment.trim()}`,
      loggedBy:  managerId,
      loggedAt:  new Date(),
      isComment: true,
    });

    await goal.save();

    await writeAudit({
      goalId:    goal._id,
      ownerId:   goal.ownerId,
      changedBy: managerId,
      role:      'manager',
      action:    'comment',
      field:     'managerComment',
      oldValue:  null,
      newValue:  comment.trim(),
      note:      comment.trim(),
      postLock:  goal.isLocked,
    });

    res.json({ goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/checkins/progress/:ownerId  ─────────────────
// Returns all approved goals for an employee with progress scores
router.get('/progress/:ownerId', async (req, res) => {
  try {
    const goals = await Goal.find({ ownerId: req.params.ownerId, status: 'approved' });
    const result = goals.map(g => ({
      goal: g,
      progress: calcProgressScore(g.target, g.achieved, g.uom, g.direction || 'min'),
    }));

    // Overall weighted score
    const weightedTotal = result.reduce((sum, r) => {
      return sum + (r.progress.score * r.goal.weightage);
    }, 0);
    const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);
    const overallPercent = totalWeightage > 0
      ? Math.min(Math.round((weightedTotal / totalWeightage) * 100), 150)
      : 0;

    res.json({ goals: result, overallPercent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
