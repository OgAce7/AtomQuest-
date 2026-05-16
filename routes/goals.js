const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const User = require('../models/User');

// ─── Helpers ────────────────────────────────────────────────
async function getTotalWeightage(ownerId, excludeId = null) {
  const filter = { ownerId };
  if (excludeId) filter._id = { $ne: excludeId };
  const goals = await Goal.find(filter);
  return goals.reduce((sum, g) => sum + g.weightage, 0);
}

async function getGoalCount(ownerId, excludeId = null) {
  const filter = { ownerId };
  if (excludeId) filter._id = { $ne: excludeId };
  return Goal.countDocuments(filter);
}

// ─── EMPLOYEE: Create a goal ─────────────────────────────────
// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const { ownerId, weightage, ...rest } = req.body;

    if (!ownerId) return res.status(400).json({ error: 'ownerId is required' });
    if (!weightage || weightage < 10)
      return res.status(400).json({ error: 'Minimum weightage per goal is 10%' });

    const count = await getGoalCount(ownerId);
    if (count >= 8)
      return res.status(400).json({ error: 'Maximum of 8 goals per employee' });

    const existingTotal = await getTotalWeightage(ownerId);
    if (existingTotal + weightage > 100)
      return res.status(400).json({
        error: `Adding this goal would exceed 100%. Remaining: ${100 - existingTotal}%`,
      });

    const goal = await Goal.create({ ownerId, weightage, ...rest });
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EMPLOYEE: Get my goals ──────────────────────────────────
// GET /api/goals?ownerId=xxx
router.get('/', async (req, res) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) return res.status(400).json({ error: 'ownerId required' });
    const goals = await Goal.find({ ownerId }).sort({ createdAt: -1 });
    const total = goals.reduce((s, g) => s + g.weightage, 0);
    res.json({ goals, totalWeightage: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EMPLOYEE: Update own goal (only if not locked) ──────────
// PATCH /api/goals/:id
router.patch('/:id', async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.isLocked) return res.status(403).json({ error: 'Goal is locked and cannot be edited' });

    const { weightage, ownerId } = req.body;

    if (weightage !== undefined) {
      if (weightage < 10)
        return res.status(400).json({ error: 'Minimum weightage is 10%' });
      const existingTotal = await getTotalWeightage(goal.ownerId, goal._id);
      if (existingTotal + weightage > 100)
        return res.status(400).json({
          error: `Exceeds 100%. Remaining (excl. this goal): ${100 - existingTotal}%`,
        });
    }

    const allowed = ['thrustArea','title','description','uom','target','weightage'];
    allowed.forEach(f => { if (req.body[f] !== undefined) goal[f] = req.body[f]; });
    await goal.save();
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EMPLOYEE: Delete goal (only if draft) ───────────────────
// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.isLocked) return res.status(403).json({ error: 'Cannot delete a locked goal' });
    if (goal.status === 'submitted')
      return res.status(403).json({ error: 'Cannot delete a submitted goal' });
    await goal.deleteOne();
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EMPLOYEE: Submit goal sheet ─────────────────────────────
// POST /api/goals/submit/:ownerId
router.post('/submit/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    // Allow submitting BOTH draft and revision goals
    const goals = await Goal.find({ ownerId, status: { $in: ['draft', 'revision'] } });
    if (!goals.length) return res.status(400).json({ error: 'No draft or revision goals to submit' });

    const total = goals.reduce((s, g) => s + g.weightage, 0);
    if (total !== 100)
      return res.status(400).json({
        error: `Total weightage must be exactly 100%. Current: ${total}%`,
      });

    // Update all draft and revision goals to submitted AND clear old comments
    await Goal.updateMany(
      { ownerId, status: { $in: ['draft', 'revision'] } }, 
      { status: 'submitted', managerComment: '' } 
    );
    res.json({ message: 'Goal sheet submitted for approval', count: goals.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MANAGER: Get pending submissions ────────────────────────
// GET /api/goals/manager/:managerId/pending
router.get('/manager/:managerId/pending', async (req, res) => {
  try {
    const { managerId } = req.params;
    const subordinates = await User.find({ managerId }).select('_id name email department');
    const subIds = subordinates.map(u => u._id);

    const goals = await Goal.find({ ownerId: { $in: subIds }, status: 'submitted' })
      .populate('ownerId', 'name email department')
      .sort({ createdAt: 1 });

    // Group by employee
    const grouped = {};
    for (const g of goals) {
      const uid = g.ownerId._id.toString();
      if (!grouped[uid]) {
        grouped[uid] = {
          employee: g.ownerId,
          goals: [],
          totalWeightage: 0,
        };
      }
      grouped[uid].goals.push(g);
      grouped[uid].totalWeightage += g.weightage;
    }

    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MANAGER: Inline edit a goal ─────────────────────────────
// PATCH /api/goals/manager/edit/:goalId
router.patch('/manager/edit/:goalId', async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.isLocked) return res.status(403).json({ error: 'Already locked' });

    const { target, weightage, managerComment } = req.body;

    if (weightage !== undefined) {
      if (weightage < 10)
        return res.status(400).json({ error: 'Min weightage 10%' });
      const existingTotal = await getTotalWeightage(goal.ownerId, goal._id);
      if (existingTotal + weightage > 100)
        return res.status(400).json({ error: `Exceeds 100%. Remaining: ${100 - existingTotal}%` });
      goal.weightage = weightage;
    }
    if (target !== undefined) goal.target = target;
    if (managerComment !== undefined) goal.managerComment = managerComment;

    await goal.save();
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MANAGER: Approve employee's goals ───────────────────────
// POST /api/goals/manager/approve/:ownerId
router.post('/manager/approve/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { managerId, goalIds } = req.body; // approve specific goals or all submitted

    const filter = { ownerId, status: 'submitted' };
    if (goalIds?.length) filter._id = { $in: goalIds };

    const goals = await Goal.find(filter);
    if (!goals.length) return res.status(404).json({ error: 'No submitted goals found' });

    const total = goals.reduce((s, g) => s + g.weightage, 0);
    if (total !== 100)
      return res.status(400).json({ error: `Total weightage is ${total}%, must be 100%` });

    await Goal.updateMany(filter, {
      status: 'approved',
      isLocked: true,
      approvedBy: managerId,
      approvedAt: new Date(),
    });

    res.json({ message: `${goals.length} goals approved and locked` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MANAGER: Reject / request revision ──────────────────────
// POST /api/goals/manager/reject/:ownerId
router.post('/manager/reject/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { comment } = req.body;

    await Goal.updateMany(
      { ownerId, status: 'submitted' },
      { status: 'revision', managerComment: comment || 'Revision requested' }
    );

    res.json({ message: 'Goals sent back for revision' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: Push a shared KPI to multiple users ───────────────
// POST /api/goals/push
router.post('/push', async (req, res) => {
  try {
    const { pushedBy, targetUserIds, kpi } = req.body;
    // kpi: { thrustArea, title, description, uom, target, weightage }

    if (!targetUserIds?.length)
      return res.status(400).json({ error: 'No target users specified' });

    if (!kpi.weightage || kpi.weightage < 10)
      return res.status(400).json({ error: 'Minimum weightage is 10%' });

    const results = { success: [], failed: [] };

    for (const uid of targetUserIds) {
      const count = await getGoalCount(uid);
      if (count >= 8) { results.failed.push({ uid, reason: 'Max 8 goals reached' }); continue; }

      const existing = await getTotalWeightage(uid);
      if (existing + kpi.weightage > 100) {
        results.failed.push({ uid, reason: `Would exceed 100% (current: ${existing}%)` });
        continue;
      }

      await Goal.create({
        ...kpi,
        ownerId: uid,
        status: 'draft',
        isPushed: true,
        pushedBy,
      });
      results.success.push(uid);
    }

    res.status(201).json({
      message: `KPI pushed to ${results.success.length} user(s)`,
      ...results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
