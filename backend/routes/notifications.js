const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/authMiddleware');
 
// ── Helper: Get adminId ──
function getAdminId(user) {
  return user.role === 'admin' ? user.id : user.admin_id;
}
 
// 📊 GET UNREAD COUNT (for bell icon)
router.get('/count', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE admin_id = ? AND is_read = 0',
      [adminId]
    );
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 📋 GET ALL NOTIFICATIONS
router.get('/', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
 
    // Auto-generate notifications from existing data
    await generateNotifications(adminId);
 
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE admin_id = ? ORDER BY created_at DESC LIMIT 100',
      [adminId]
    );
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ✅ MARK AS READ (single)
router.put('/:id/read', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND admin_id = ?',
      [req.params.id, adminId]
    );
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ✅ MARK ALL AS READ
router.put('/mark-all/read', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE admin_id = ?',
      [adminId]
    );
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🗑️ DELETE NOTIFICATION
router.delete('/:id', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    await db.query(
      'DELETE FROM notifications WHERE id = ? AND admin_id = ?',
      [req.params.id, adminId]
    );
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🗑️ CLEAR ALL READ
router.delete('/clear/read', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    await db.query(
      'DELETE FROM notifications WHERE admin_id = ? AND is_read = 1',
      [adminId]
    );
    res.json({ success: true, message: 'Cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ── Auto Generate Notifications ──
async function generateNotifications(adminId) {
  try {
    const now   = new Date();
    const today = now.toISOString().split('T')[0];
 
    // 7 days from now
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const in7Date = in7.toISOString().split('T')[0];
 
    // ── Overdue Tasks ──
    const [overdueTasks] = await db.query(
      `SELECT t.id, t.title, u.name AS assigned_name 
       FROM tasks t 
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.status != 'Completed' 
       AND t.due_date < ? 
       AND t.due_date IS NOT NULL
       AND (SELECT COUNT(*) FROM notifications 
            WHERE admin_id = ? AND type = 'task' 
            AND link = CONCAT('task.html#', t.id)
            AND DATE(created_at) = ?) = 0`,
      [today, adminId, today]
    );
 
    for (const task of overdueTasks) {
      await insertNotification(adminId, {
        title: `⚠️ Task Overdue`,
        message: `"${task.title}" assigned to ${task.assigned_name || 'team'} is overdue!`,
        type: 'task',
        link: `task.html`
      });
    }
 
    // ── Pending Followups Due Today ──
    const [followups] = await db.query(
      `SELECT f.id, l.name AS lead_name, f.scheduled_at
       FROM follow_ups f
       LEFT JOIN leads l ON f.lead_id = l.id
       WHERE f.status = 'Pending'
       AND DATE(f.scheduled_at) <= ?
       AND (SELECT COUNT(*) FROM notifications 
            WHERE admin_id = ? AND type = 'followup'
            AND DATE(created_at) = ?) = 0`,
      [today, adminId, today]
    );
 
    for (const fu of followups) {
      await insertNotification(adminId, {
        title: `📞 Follow Up Due`,
        message: `Follow up with "${fu.lead_name || 'lead'}" is due today!`,
        type: 'followup',
        link: `followups.html`
      });
    }
 
    // ── Meetings Today ──
    const [meetings] = await db.query(
      `SELECT m.id, m.title, m.meeting_date
       FROM meetings m
       WHERE m.admin_id = ?
       AND DATE(m.meeting_date) = ?
       AND (SELECT COUNT(*) FROM notifications 
            WHERE admin_id = ? AND type = 'meeting'
            AND DATE(created_at) = ?) = 0`,
      [adminId, today, adminId, today]
    );
 
    for (const meeting of meetings) {
      await insertNotification(adminId, {
        title: `📅 Meeting Today`,
        message: `You have a meeting: "${meeting.title}" scheduled today!`,
        type: 'meeting',
        link: `meetings.html`
      });
    }
 
    // ── Pending Payments ──
    const [payments] = await db.query(
      `SELECT p.id, p.amount, c.name AS client_name
       FROM payments p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.admin_id = ?
       AND p.payment_status = 'pending'
       AND (SELECT COUNT(*) FROM notifications 
            WHERE admin_id = ? AND type = 'payment'
            AND DATE(created_at) = ?) = 0`,
      [adminId, adminId, today]
    );
 
    if (payments.length > 0) {
      const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      await insertNotification(adminId, {
        title: `💰 Pending Payments`,
        message: `You have ${payments.length} pending payment(s) totaling ₹${total.toLocaleString('en-IN')}`,
        type: 'payment',
        link: `revenue.html`
      });
    }
 
  } catch (err) {
    console.error('generateNotifications error:', err.message);
  }
}
 
async function insertNotification(adminId, { title, message, type, link }) {
  await db.query(
    'INSERT INTO notifications (admin_id, title, message, type, link) VALUES (?,?,?,?,?)',
    [adminId, title, message, type, link || null]
  );
}
 
module.exports = router;
module.exports.generateNotifications = generateNotifications;