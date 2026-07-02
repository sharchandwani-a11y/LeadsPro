const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/authMiddleware');
 
function getAdminId(user) {
  return user.role === 'admin' ? user.id : user.admin_id;
}
 
// 📊 STATS
router.get('/stats', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const today   = new Date();
    const in7     = new Date(); in7.setDate(in7.getDate() + 7);
    const in30    = new Date(); in30.setDate(in30.getDate() + 30);
 
    const todayStr = today.toISOString().split('T')[0];
    const in7Str   = in7.toISOString().split('T')[0];
    const in30Str  = in30.toISOString().split('T')[0];
 
    const [[{ total }]]   = await db.query('SELECT COUNT(*) AS total FROM domains WHERE admin_id = ?', [adminId]);
    const [[{ expiring }]] = await db.query(
      `SELECT COUNT(*) AS expiring FROM domains WHERE admin_id = ?
       AND (
         (domain_expiry  BETWEEN ? AND ?) OR
         (hosting_expiry BETWEEN ? AND ?) OR
         (ssl_expiry     BETWEEN ? AND ?)
       )`,
      [adminId, todayStr, in30Str, todayStr, in30Str, todayStr, in30Str]
    );
    const [[{ critical }]] = await db.query(
      `SELECT COUNT(*) AS critical FROM domains WHERE admin_id = ?
       AND (
         (domain_expiry  BETWEEN ? AND ?) OR
         (hosting_expiry BETWEEN ? AND ?) OR
         (ssl_expiry     BETWEEN ? AND ?)
       )`,
      [adminId, todayStr, in7Str, todayStr, in7Str, todayStr, in7Str]
    );
    const [[{ expired }]] = await db.query(
      `SELECT COUNT(*) AS expired FROM domains WHERE admin_id = ?
       AND (
         domain_expiry  < ? OR
         hosting_expiry < ? OR
         ssl_expiry     < ?
       )`,
      [adminId, todayStr, todayStr, todayStr]
    );
 
    res.json({ success: true, stats: { total, expiring, critical, expired } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 📋 GET ALL DOMAINS
router.get('/', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
 
    let query = `SELECT d.*, c.name AS client_name
                 FROM domains d
                 LEFT JOIN clients c ON d.client_id = c.id
                 WHERE d.admin_id = ?`;
    const params = [adminId];
 
    if (search) {
      query += ' AND (d.domain_name LIKE ? OR d.registrar LIKE ? OR c.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
 
    let countQ = 'SELECT COUNT(*) AS total FROM domains d LEFT JOIN clients c ON d.client_id = c.id WHERE d.admin_id = ?';
    const countP = [adminId];
    if (search) {
      countQ += ' AND (d.domain_name LIKE ? OR d.registrar LIKE ? OR c.name LIKE ?)';
      const s = `%${search}%`;
      countP.push(s, s, s);
    }
 
    const [[{ total }]] = await db.query(countQ, countP);
    query += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
 
    const [domains] = await db.query(query, params);
    res.json({ success: true, data: domains, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🔍 GET SINGLE DOMAIN
router.get('/:id', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const [rows] = await db.query(
      'SELECT d.*, c.name AS client_name FROM domains d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = ? AND d.admin_id = ?',
      [req.params.id, adminId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Domain not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ➕ ADD DOMAIN
router.post('/', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const { domain_name, client_id, registrar, domain_expiry, hosting_expiry, ssl_expiry, notes } = req.body;
 
    if (!domain_name) return res.status(400).json({ success: false, message: 'Domain name required' });
 
    const [result] = await db.query(
      `INSERT INTO domains (admin_id, client_id, domain_name, registrar, domain_expiry, hosting_expiry, ssl_expiry, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [adminId, client_id || null, domain_name, registrar || null, domain_expiry || null, hosting_expiry || null, ssl_expiry || null, notes || null, req.user.id]
    );
 
    // Generate notification if expiring soon
    await checkAndNotify(adminId, result.insertId);
 
    res.status(201).json({ success: true, message: 'Domain added', data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ✏️ UPDATE DOMAIN
router.put('/:id', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const { domain_name, client_id, registrar, domain_expiry, hosting_expiry, ssl_expiry, notes } = req.body;
 
    const [result] = await db.query(
      `UPDATE domains SET domain_name=?, client_id=?, registrar=?, domain_expiry=?, hosting_expiry=?, ssl_expiry=?, notes=?
       WHERE id=? AND admin_id=?`,
      [domain_name, client_id || null, registrar || null, domain_expiry || null, hosting_expiry || null, ssl_expiry || null, notes || null, req.params.id, adminId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Domain not found' });
    res.json({ success: true, message: 'Domain updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🗑️ DELETE DOMAIN
router.delete('/:id', protect, async (req, res) => {
  try {
    const adminId = getAdminId(req.user);
    const [result] = await db.query('DELETE FROM domains WHERE id = ? AND admin_id = ?', [req.params.id, adminId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Domain not found' });
    res.json({ success: true, message: 'Domain deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ── Check & Notify ──
async function checkAndNotify(adminId, domainId) {
  try {
    const today = new Date();
    const in7   = new Date(); in7.setDate(today.getDate() + 7);
    const in30  = new Date(); in30.setDate(today.getDate() + 30);
    const todayStr = today.toISOString().split('T')[0];
    const in7Str   = in7.toISOString().split('T')[0];
    const in30Str  = in30.toISOString().split('T')[0];
 
    const [rows] = await db.query('SELECT * FROM domains WHERE id = ?', [domainId]);
    if (!rows.length) return;
    const d = rows[0];
 
    const checks = [
      { date: d.domain_expiry,  label: 'Domain' },
      { date: d.hosting_expiry, label: 'Hosting' },
      { date: d.ssl_expiry,     label: 'SSL Certificate' }
    ];
 
    for (const { date, label } of checks) {
      if (!date) continue;
      const expDate = new Date(date).toISOString().split('T')[0];
      if (expDate <= todayStr) {
        await db.query(
          'INSERT INTO notifications (admin_id, title, message, type, link) VALUES (?,?,?,?,?)',
          [adminId, `🚨 ${label} EXPIRED`, `${label} for "${d.domain_name}" has already expired!`, 'domain', 'domains.html']
        );
      } else if (expDate <= in7Str) {
        await db.query(
          'INSERT INTO notifications (admin_id, title, message, type, link) VALUES (?,?,?,?,?)',
          [adminId, `⚠️ ${label} Expiring Soon`, `${label} for "${d.domain_name}" expires on ${expDate} — only 7 days left!`, 'domain', 'domains.html']
        );
      } else if (expDate <= in30Str) {
        await db.query(
          'INSERT INTO notifications (admin_id, title, message, type, link) VALUES (?,?,?,?,?)',
          [adminId, `🔔 ${label} Expiry Reminder`, `${label} for "${d.domain_name}" expires on ${expDate} — renew soon.`, 'domain', 'domains.html']
        );
      }
    }
  } catch (err) {
    console.error('checkAndNotify error:', err.message);
  }
}
 
module.exports = router;