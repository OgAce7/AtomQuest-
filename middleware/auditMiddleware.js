/**
 * auditMiddleware.js
 * Express middleware factory + helper to write AuditLog records.
 *
 * Usage:
 *   router.patch('/:id', logAudit('edit'), yourHandler);
 *
 * The handler must attach `req.auditMeta` before calling next(),
 * or the middleware calls writeAudit() directly after the handler.
 */

const AuditLog = require('../models/AuditLog');

/**
 * Direct helper — call anywhere in a route handler.
 *
 * @param {object} opts
 * @param {ObjectId|string} opts.goalId
 * @param {ObjectId|string} opts.ownerId
 * @param {ObjectId|string} opts.changedBy
 * @param {string}          opts.role       - 'employee'|'manager'|'admin'
 * @param {string}          opts.action     - 'checkin'|'edit'|'comment'|'approve'|'reject'|'push'
 * @param {string}          [opts.field]
 * @param {*}               [opts.oldValue]
 * @param {*}               [opts.newValue]
 * @param {string}          [opts.note]
 * @param {boolean}         [opts.postLock]
 */
async function writeAudit(opts) {
  try {
    await AuditLog.create({
      goalId:    opts.goalId,
      ownerId:   opts.ownerId,
      changedBy: opts.changedBy,
      role:      opts.role      || 'employee',
      action:    opts.action,
      field:     opts.field     || null,
      oldValue:  opts.oldValue  ?? null,
      newValue:  opts.newValue  ?? null,
      note:      opts.note      || '',
      postLock:  opts.postLock  || false,
    });
  } catch (err) {
    // Audit failures must never crash the main request
    console.error('[AuditLog] write failed:', err.message);
  }
}

/**
 * Middleware factory.
 * Attaches `req.writeAudit` convenience method so route handlers
 * don't need to import the function separately.
 */
function auditMiddleware(req, res, next) {
  req.writeAudit = writeAudit;
  next();
}

module.exports = { writeAudit, auditMiddleware };
