const db = require('../config/db');

// 📊 DASHBOARD STATS: Naye admin ko 0 aur user ko uske admin ka data dikhane ke liye
exports.getdashboardStats = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!currentAdminId) {
      return res.json({
        success: true,
        stats: { total: 0, followups: 0, meetings: 0, converted: 0 }
      });
    }

    let leadsQuery = `SELECT COUNT(*) AS total FROM leads WHERE admin_id = ?`;
    let convertedQuery = `SELECT COUNT(*) AS total FROM leads WHERE status = 'Converted' AND admin_id = ?`;
    let followupsQuery = `SELECT COUNT(*) AS total FROM leads WHERE status = 'Follow Up' AND admin_id = ?`;
    let meetingsQuery = `SELECT COUNT(*) AS total FROM meetings WHERE admin_id = ?`;

    const params = [currentAdminId];

    const [[{ total: totalLeads }]] = await db.query(leadsQuery, params);
    const [[{ total: converted }]] = await db.query(convertedQuery, params);
    const [[{ total: followups }]] = await db.query(followupsQuery, params);

    let meetings = 0;

    try {
      const [[{ total: meetingsCount }]] = await db.query(meetingsQuery, params);
      meetings = meetingsCount;
    } catch (e) {
      meetings = 0;
    }

    res.json({
      success: true,
      message: 'Stats fetched successfully',
      stats: {
        total: totalLeads || 0,
        followups: followups || 0,
        meetings: meetings || 0,
        converted: converted || 0
      }
    });
  } catch (err) {
    console.error('getdashboardStats error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📋 GET ALL LEADS
exports.getAllLeads = async (req, res) => {
  try {
    const { status, source, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.role === 'admin';

    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    let query = `SELECT l.*, u.name AS assigned_name
                 FROM leads l
                 LEFT JOIN users u ON l.assigned_to = u.id
                 WHERE l.admin_id = ?`;

    const params = [currentAdminId];

    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }

    if (source) {
      query += ' AND l.source = ?';
      params.push(source);
    }

    if (search) {
      query += ' AND (l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const countQuery = query.replace(
      'SELECT l.*, u.name AS assigned_name',
      'SELECT COUNT(*) AS total'
    );

    const [[{ total }]] = await db.query(countQuery, params);

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [leads] = await db.query(query, params);

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('getAllLeads error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔍 GET SINGLE LEAD
exports.getLead = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [rows] = await db.query(
      'SELECT * FROM leads WHERE id = ? AND admin_id = ?',
      [id, currentAdminId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('getLead error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ➕ ADD LEAD
exports.addLead = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      status,
      source,
      assigned_to,
      priority,
      visible_to
    } = req.body;

    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const query = `
      INSERT INTO leads (
        name,
        email,
        phone,
        status,
        source,
        assigned_to,
        priority,
        visible_to,
        admin_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(query, [
      name,
      email,
      phone,
      status || 'New',
      source || 'Website',
      assigned_to || null,
      priority || 'normal',
      visible_to || 'all',
      currentAdminId
    ]);

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        ...req.body,
        admin_id: currentAdminId
      }
    });
  } catch (err) {
    console.error('addLead error:', err.message);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// ✏️ UPDATE LEAD
exports.updateLead = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      email,
      phone,
      status,
      source,
      assigned_to,
      priority,
      visible_to
    } = req.body;

    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const query = `UPDATE leads SET
                   name = ?,
                   email = ?,
                   phone = ?,
                   status = ?,
                   source = ?,
                   assigned_to = ?,
                   priority = ?,
                   visible_to = ?
                   WHERE id = ? AND admin_id = ?`;

    const [result] = await db.query(query, [
      name,
      email,
      phone,
      status,
      source,
      assigned_to,
      priority,
      visible_to,
      id,
      currentAdminId
    ]);

    if (result.affectedRows === 0) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized or lead not found'
      });
    }

    res.json({
      success: true,
      message: 'Lead Updated successfully'
    });
  } catch (err) {
    console.error('updateLead error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ DELETE LEAD
exports.deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [result] = await db.query(
      'DELETE FROM leads WHERE id = ? AND admin_id = ?',
      [id, currentAdminId]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized or lead not found'
      });
    }

    res.json({
      success: true,
      message: 'Lead Deleted successfully'
    });
  } catch (err) {
    console.error('deleteLead error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};