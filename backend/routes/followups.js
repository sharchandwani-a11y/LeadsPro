const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT f.*, l.name AS lead_name, l.phone AS lead_phone
      FROM follow_ups f LEFT JOIN leads l ON f.lead_id = l.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ' AND f.status=?'; params.push(status); }
    query += ' ORDER BY f.follow_up_date ASC';
    const [data] = await db.query(query, params);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { lead_id, follow_up_date, notes } = req.body;
    if (!lead_id || !follow_up_date)
      return res.status(400).json({ success: false, message: 'Lead and Date Required' });

    const [result] = await db.query(
      `INSERT INTO follow_ups (lead_id, follow_up_date, notes, created_by) VALUES (?, ?, ?, ?)`,
      [lead_id, follow_up_date, notes, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Follow up added!', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id/done', async (req, res) => {
  try {
    await db.query("UPDATE follow_ups SET status='Done' WHERE id=?", [req.params.id]);
    res.json({ success: true, message: 'Follow-Up Completed Successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM follow_ups WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Follow-Up Deleted Successfully.!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reschedule follow up
router.put('/:id/reschedule', async (req, res) => {
  try {
    const { follow_up_date } = req.body;
    await db.query('UPDATE follow_ups SET follow_up_date=? WHERE id=?', [follow_up_date, req.params.id]);
    res.json({ success: true, message: 'Rescheduled!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
