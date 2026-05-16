/**
 * admin.js — Part 4 routes
 * Audit trail queries, CSV export, completion-rate dashboard.
 *
 * Mount in server.js:
 *   const adminRoutes = require('./routes/admin');
 *   app.use('/api/admin', adminRoutes);
 */
const router   = require('express').Router();
const Goal     = require('../models/Goal');
const User     = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { calcProgressScore } = require('../utils/progressEngine');
const { jsonToCsv, goalToReportRow } = require('../utils/csvExport');

// ── GET /api/admin/audit/:goalId  ────────────────────────
// Full audit trail for a single goal
router.get('/audit/:goalId', async (req, res) => {
  try {
    const logs = await AuditLog.find({ goalId: req.params.goalId })
      .populate('changedBy', 'name role')
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/audit/user/:userId  ───────────────────
// All audit events touching goals owned by a user
router.get('/audit/user/:userId', async (req, res) => {
  try {
    const logs = await AuditLog.find({ ownerId: req.params.userId })
      .populate('changedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/export/csv  ───────────────────────────
// Download achievement report as CSV
// Query params: ?quarter=Q2-2025 (optional)
router.get('/export/csv', async (req, res) => {
  try {
    const filter = { status: 'approved' };
    if (req.query.quarter) filter.quarter = req.query.quarter;

    const goals = await Goal.find(filter)
      .populate('ownerId',   'name department managerId')
      .populate('approvedBy','name');

    // Gather manager names
    const managerIds = [...new Set(
      goals.map(g => g.ownerId?.managerId).filter(Boolean)
    )];
    const managers = await User.find({ _id: { $in: managerIds } }, 'name');
    const managerMap = Object.fromEntries(managers.map(m => [String(m._id), m]));

    const rows = goals.map(g => {
      const progress = calcProgressScore(g.target, g.achieved, g.uom, g.direction || 'min');
      const mgr = managerMap[String(g.ownerId?.managerId)] || null;
      return goalToReportRow(g, g.ownerId, mgr, progress);
    });

    const csv = jsonToCsv(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="atomquest_achievement_report_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/completion  ───────────────────────────
// Manager-level completion rates: how many employees have done Q check-ins
router.get('/completion', async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' });
    const result = await Promise.all(managers.map(async (mgr) => {
      const subordinates = await User.find({ managerId: mgr._id });
      const subIds = subordinates.map(s => s._id);

      // Approved goals count
      const approvedGoals = await Goal.find({ ownerId: { $in: subIds }, status: 'approved' });
      const totalApproved = approvedGoals.length;

      // Goals with at least one check-in (achieved !== null)
      const checkedIn = approvedGoals.filter(g => g.achieved !== null && g.achieved !== undefined).length;

      // Employees who have fully checked in all their approved goals
      const empStats = subordinates.map(emp => {
        const empGoals = approvedGoals.filter(g => String(g.ownerId) === String(emp._id));
        const done = empGoals.filter(g => g.achieved !== null).length;
        return { emp, total: empGoals.length, done, complete: empGoals.length > 0 && done === empGoals.length };
      });

      return {
        manager: { _id: mgr._id, name: mgr.name, department: mgr.department },
        subordinateCount: subordinates.length,
        totalApprovedGoals: totalApproved,
        goalsCheckedIn: checkedIn,
        completionRate: totalApproved > 0 ? Math.round((checkedIn / totalApproved) * 100) : 0,
        employeeBreakdown: empStats,
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/overview  ─────────────────────────────
// High-level org stats for admin dashboard
router.get('/overview', async (req, res) => {
  try {
    const [totalUsers, totalGoals, approvedGoals, pendingGoals] = await Promise.all([
      User.countDocuments({ role: 'employee' }),
      Goal.countDocuments(),
      Goal.countDocuments({ status: 'approved' }),
      Goal.countDocuments({ status: 'submitted' }),
    ]);

    const checkedInGoals = await Goal.countDocuments({ status: 'approved', achieved: { $ne: null } });

    // Goals by thrust area
    const thrustBreakdown = await Goal.aggregate([
      { $group: { _id: '$thrustArea', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      totalEmployees: totalUsers,
      totalGoals,
      approvedGoals,
      pendingApproval: pendingGoals,
      checkInsComplete: checkedInGoals,
      checkInRate: approvedGoals > 0 ? Math.round((checkedInGoals / approvedGoals) * 100) : 0,
      thrustBreakdown: Object.fromEntries(thrustBreakdown.map(t => [t._id, t.count])),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
