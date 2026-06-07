const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// GET all meetings
router.get('/', async (req, res) => {
  try {
    const [data] = await db.query(`
      SELECT m.*, 
             l.name AS lead_name, l.phone AS lead_phone,
             u.name AS assigned_to_name
      FROM meetings m 
      LEFT JOIN leads l ON m.lead_id = l.id
      LEFT JOIN users u ON m.assigned_to = u.id
      ORDER BY m.meeting_date ASC, m.meeting_time ASC
    `);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET today's meetings
router.get('/today', async (req, res) => {
  try {
    const [data] = await db.query(`
      SELECT m.*, l.name AS lead_name, u.name AS assigned_to_name
      FROM meetings m 
      LEFT JOIN leads l ON m.lead_id = l.id
      LEFT JOIN users u ON m.assigned_to = u.id
      WHERE m.meeting_date = CURDATE()
      ORDER BY m.meeting_time ASC
    `);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST add meeting
router.post('/', async (req, res) => {
  try {
    const { lead_id, title, meeting_date, meeting_time, platform, notes, assigned_to } = req.body;
    if (!lead_id || !meeting_date || !meeting_time)
      return res.status(400).json({ success: false, message: 'Lead, Date and Time Required' });

    const [result] = await db.query(
      `INSERT INTO meetings (lead_id, title, meeting_date, meeting_time, platform, notes, created_by, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [lead_id, title, meeting_date, meeting_time, platform || 'Zoom', notes, req.user.id, assigned_to || null]
    );
    res.status(201).json({ success: true, message: 'Meeting Scheduled!', meetingId: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update meeting
router.put('/:id', async (req, res) => {
  try {
    const { title, meeting_date, meeting_time, platform, notes, assigned_to } = req.body;
    await db.query(
      `UPDATE meetings SET title=?, meeting_date=?, meeting_time=?, platform=?, notes=?, assigned_to=? WHERE id=?`,
      [title, meeting_date, meeting_time, platform, notes, assigned_to || null, req.params.id]
    );
    res.json({ success: true, message: 'Meeting Updated Successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE meeting
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM meetings WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Meeting Deleted Successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;