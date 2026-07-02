const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/authMiddleware');
 
// 📊 REVENUE STATS
router.get('/stats', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
 
    const [[{ total }]]    = await db.query('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE admin_id = ?', [adminId]);
    const [[{ received }]] = await db.query("SELECT COALESCE(SUM(amount),0) AS received FROM payments WHERE admin_id = ? AND payment_status = 'received'", [adminId]);
    const [[{ pending }]]  = await db.query("SELECT COALESCE(SUM(amount),0) AS pending FROM payments WHERE admin_id = ? AND payment_status = 'pending'", [adminId]);
    const [[{ count }]]    = await db.query('SELECT COUNT(*) AS count FROM payments WHERE admin_id = ?', [adminId]);
 
    res.json({ success: true, stats: { total, received, pending, count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 📋 GET ALL PAYMENTS
router.get('/', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
 
    let query = `SELECT p.*, c.name AS client_name, pr.name AS project_name
                 FROM payments p
                 LEFT JOIN clients c ON p.client_id = c.id
                 LEFT JOIN projects pr ON p.project_id = pr.id
                 WHERE p.admin_id = ?`;
    const params = [adminId];
 
    if (status) { query += ' AND p.payment_status = ?'; params.push(status); }
 
    let countQ = 'SELECT COUNT(*) AS total FROM payments WHERE admin_id = ?';
    const countP = [adminId];
    if (status) { countQ += ' AND payment_status = ?'; countP.push(status); }
 
    const [[{ total }]] = await db.query(countQ, countP);
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
 
    const [payments] = await db.query(query, params);
    res.json({ success: true, data: payments, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ➕ ADD PAYMENT
router.post('/', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const { client_id, project_id, description, amount, payment_status, payment_date } = req.body;
 
    if (!amount) return res.status(400).json({ success: false, message: 'Amount required' });
 
    const [result] = await db.query(
      `INSERT INTO payments (admin_id, client_id, project_id, description, amount, payment_status, payment_date, created_by) VALUES (?,?,?,?,?,?,?,?)`,
      [adminId, client_id || null, project_id || null, description || null, amount, payment_status || 'pending', payment_date || null, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Payment added', data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ✏️ UPDATE PAYMENT
router.put('/:id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const { client_id, project_id, description, amount, payment_status, payment_date } = req.body;
 
    const [result] = await db.query(
      `UPDATE payments SET client_id=?, project_id=?, description=?, amount=?, payment_status=?, payment_date=? WHERE id=? AND admin_id=?`,
      [client_id || null, project_id || null, description || null, amount, payment_status, payment_date || null, req.params.id, adminId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, message: 'Payment updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🗑️ DELETE PAYMENT
router.delete('/:id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const [result] = await db.query('DELETE FROM payments WHERE id = ? AND admin_id = ?', [req.params.id, adminId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;