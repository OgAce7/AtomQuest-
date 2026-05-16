/**
 * csvExport.js
 * Converts an array of achievement records to a CSV string.
 * Pure function — no file I/O; caller decides how to send/save.
 */

/**
 * Escape a cell value for CSV (wrap in quotes if contains comma/newline/quote).
 */
function escapeCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {Array<object>} rows  - Array of flat JS objects
 * @param {string[]} [columns]  - Optional explicit column order
 * @returns {string}            - Full CSV text (with BOM for Excel)
 */
function jsonToCsv(rows, columns) {
  if (!rows || rows.length === 0) return '';

  const cols = columns || Object.keys(rows[0]);
  const header = cols.map(escapeCell).join(',');
  const body   = rows.map(row => cols.map(c => escapeCell(row[c])).join(','));

  // UTF-8 BOM so Excel opens correctly
  return '\uFEFF' + [header, ...body].join('\r\n');
}

/**
 * Build a flattened achievement report row from a goal document.
 * @param {object} goal      - Populated Mongoose goal doc (or plain object)
 * @param {object} [user]    - Populated user (optional, for name/dept)
 * @param {object} [manager] - Populated manager (optional)
 * @param {object} [scoreObj]- Result from calcProgressScore (optional)
 * @returns {object}
 */
function goalToReportRow(goal, user, manager, scoreObj) {
  return {
    EmployeeID:    user?._id     || goal.ownerId,
    EmployeeName:  user?.name    || '',
    Department:    user?.department || '',
    ManagerName:   manager?.name || '',
    Quarter:       goal.quarter  || '',
    ThrustArea:    goal.thrustArea,
    Title:         goal.title,
    Description:   goal.description || '',
    UoM:           goal.uom,
    Target:        goal.target,
    Achievement:   goal.achieved ?? '',
    Weightage:     goal.weightage,
    Status:        goal.status,
    IsLocked:      goal.isLocked ? 'Yes' : 'No',
    IsPushed:      goal.isPushed ? 'Yes' : 'No',
    ProgressScore: scoreObj?.percent != null ? `${scoreObj.percent}%` : '',
    ProgressLabel: scoreObj?.label || '',
    CheckinCount:  goal.checkins?.length || 0,
    ManagerComment:goal.managerComment || '',
    ApprovedAt:    goal.approvedAt ? new Date(goal.approvedAt).toISOString() : '',
    CreatedAt:     goal.createdAt  ? new Date(goal.createdAt).toISOString()  : '',
  };
}

module.exports = { jsonToCsv, goalToReportRow, escapeCell };
