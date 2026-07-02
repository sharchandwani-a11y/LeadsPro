const express = require('express');
const router = express.Router();
const db = require('../config/db');
const protect = require('../middleware/authMiddleware');
 
// 📊 GET STATS
router.get('/stats', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
 
    const [[{ total }]]     = await db.query('SELECT COUNT(*) AS total FROM projects WHERE admin_id = ?', [adminId]);
    const [[{ active }]]    = await db.query("SELECT COUNT(*) AS active FROM projects WHERE admin_id = ? AND status = 'In Progress'", [adminId]);
    const [[{ completed }]] = await db.query("SELECT COUNT(*) AS completed FROM projects WHERE admin_id = ? AND status = 'Completed'", [adminId]);
    const [[{ totalTasks }]] = await db.query('SELECT COUNT(*) AS totalTasks FROM project_tasks pt JOIN projects p ON pt.project_id = p.id WHERE p.admin_id = ?', [adminId]);
    const [[{ doneTasks }]]  = await db.query("SELECT COUNT(*) AS doneTasks FROM project_tasks pt JOIN projects p ON pt.project_id = p.id WHERE p.admin_id = ? AND pt.status = 'done'", [adminId]);
 
    res.json({ success: true, stats: { total, active, completed, totalTasks, doneTasks } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ✅ ADD TASK — must be before /:id
router.post('/tasks/add', protect, async (req, res) => {
  try {
    const { project_id, task_name } = req.body;
    if (!project_id || !task_name) return res.status(400).json({ success: false, message: 'project_id and task_name required' });
 
    const [result] = await db.query(
      'INSERT INTO project_tasks (project_id, task_name, assigned_to) VALUES (?,?,?)',
      [project_id, task_name, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Task added', data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🔄 TOGGLE TASK STATUS
router.put('/tasks/:task_id/toggle', protect, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT status FROM project_tasks WHERE id = ?', [req.params.task_id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Task not found' });
 
    const newStatus = rows[0].status === 'done' ? 'pending' : 'done';
    await db.query('UPDATE project_tasks SET status = ? WHERE id = ?', [newStatus, req.params.task_id]);
    res.json({ success: true, message: 'Task updated', status: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🗑️ DELETE TASK
router.delete('/tasks/:task_id', protect, async (req, res) => {
  try {
    await db.query('DELETE FROM project_tasks WHERE id = ?', [req.params.task_id]);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 📋 GET ALL PROJECTS
router.get('/', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
 
    let query = `SELECT p.*, c.name AS client_name,
                 (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) AS total_tasks,
                 (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'done') AS done_tasks
                 FROM projects p
                 LEFT JOIN clients c ON p.client_id = c.id
                 WHERE p.admin_id = ?`;
    const params = [adminId];
 
    if (status) { query += ' AND p.status = ?'; params.push(status); }
 
    let countQ = 'SELECT COUNT(*) AS total FROM projects WHERE admin_id = ?';
    const countP = [adminId];
    if (status) { countQ += ' AND status = ?'; countP.push(status); }
 
    const [[{ total }]] = await db.query(countQ, countP);
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
 
    const [projects] = await db.query(query, params);
    res.json({ success: true, data: projects, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🔍 GET SINGLE PROJECT WITH TASKS
router.get('/:id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
 
    const [rows] = await db.query(
      `SELECT p.*, c.name AS client_name FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE p.id = ? AND p.admin_id = ?`,
      [req.params.id, adminId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Project not found' });
 
    const [tasks]    = await db.query('SELECT * FROM project_tasks WHERE project_id = ? ORDER BY created_at ASC', [req.params.id]);
    const [payments] = await db.query('SELECT * FROM payments WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);
 
    res.json({ success: true, data: { ...rows[0], tasks, payments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ➕ ADD PROJECT
router.post('/', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const { name, client_id, description, status, budget, start_date, end_date } = req.body;
 
    if (!name) return res.status(400).json({ success: false, message: 'Project name required' });
 
    const [result] = await db.query(
      `INSERT INTO projects (admin_id, client_id, name, description, status, budget, start_date, end_date, created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      [adminId, client_id || null, name, description || null, status || 'Planning', budget || 0, start_date || null, end_date || null, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Project created', data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// ✏️ UPDATE PROJECT
router.put('/:id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const { name, client_id, description, status, budget, start_date, end_date } = req.body;
 
    const [result] = await db.query(
      `UPDATE projects SET name=?, client_id=?, description=?, status=?, budget=?, start_date=?, end_date=? WHERE id=? AND admin_id=?`,
      [name, client_id || null, description || null, status, budget || 0, start_date || null, end_date || null, req.params.id, adminId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, message: 'Project updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
// 🗑️ DELETE PROJECT
router.delete('/:id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const [result] = await db.query('DELETE FROM projects WHERE id = ? AND admin_id = ?', [req.params.id, adminId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
 
module.exports = router;