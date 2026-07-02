const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const protect = require('../middleware/authMiddleware');

router.use(protect);

// ── Helper: Generate occurrences from templates ──
async function generateOccurrences() {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  // Weekly period key (Sunday start)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekKey = weekStart.toISOString().split('T')[0];

  // Monthly period key
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const [templates] = await db.query('SELECT * FROM task_templates WHERE is_active=1');

  for (const tpl of templates) {
    let periodKey, dueDate;

    if (tpl.recurrence === 'Daily') {
      periodKey = today;
      dueDate   = today;
    } else if (tpl.recurrence === 'Weekly') {
      periodKey = weekKey;
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
      dueDate = endOfWeek.toISOString().split('T')[0];
    } else if (tpl.recurrence === 'Monthly') {
      periodKey = monthKey;
      const endOfMonth = new Date(now.getFullYear(), now.getMonth()+1, 0);
      dueDate = endOfMonth.toISOString().split('T')[0];
    }

    const [existing] = await db.query(
      'SELECT id FROM tasks WHERE template_id=? AND period_key=?',
      [tpl.id, periodKey]
    );

    if (existing.length === 0) {
      await db.query(
        `INSERT INTO tasks (title,description,assigned_to,assigned_name,lead_id,lead_name,priority,recurrence,due_date,status,created_by,created_by_name,period_key,template_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [tpl.title, tpl.description, tpl.assigned_to, tpl.assigned_name,
         tpl.lead_id, tpl.lead_name, tpl.priority, tpl.recurrence,
         dueDate, 'Pending', tpl.created_by, tpl.created_by_name, periodKey, tpl.id]
      );
    }
  }
}

// ── GET ALL TASKS ──
router.get('/', async (req, res) => {
  try {
    await generateOccurrences();
    const isAdmin = req.user.role === 'admin';
    let query, params;

    if (isAdmin) {
      query  = 'SELECT * FROM tasks ORDER BY created_at DESC';
      params = [];
    } else {
      query  = 'SELECT * FROM tasks WHERE assigned_to=? ORDER BY created_at DESC';
      params = [req.user.id];
    }

    const [tasks] = await db.query(query, params);
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET STATS ──
router.get('/stats', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const whereClause = isAdmin ? '' : 'WHERE assigned_to=?';
    const params = isAdmin ? [] : [req.user.id];
    const now = new Date().toISOString().split('T')[0];

    const [[{ total }]]     = await db.query(`SELECT COUNT(*) AS total FROM tasks ${whereClause}`, params);
    const [[{ pending }]]   = await db.query(`SELECT COUNT(*) AS pending FROM tasks WHERE status='Pending' ${isAdmin?'':'AND assigned_to=?'}`, params);
    const [[{ completed }]] = await db.query(`SELECT COUNT(*) AS completed FROM tasks WHERE status='Completed' ${isAdmin?'':'AND assigned_to=?'}`, params);
    const [[{ overdue }]]   = await db.query(`SELECT COUNT(*) AS overdue FROM tasks WHERE status='Pending' AND due_date < ? ${isAdmin?'':'AND assigned_to=?'}`, isAdmin ? [now] : [now, req.user.id]);

    res.json({ success: true, stats: { total, pending, completed, overdue } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── CREATE TASK ──
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Sirf admin task create kar sakta hai' });

    const { title, description, assigned_to, assigned_name, lead_id, lead_name, priority, recurrence, due_date } = req.body;

    if (!title || !assigned_to)
      return res.status(400).json({ success: false, message: 'Title aur assigned_to required hai' });

    if (recurrence && recurrence !== 'Once') {
      // Create template for recurring tasks
      const [result] = await db.query(
        `INSERT INTO task_templates (title,description,assigned_to,assigned_name,lead_id,lead_name,priority,recurrence,created_by,created_by_name)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [title, description||null, assigned_to, assigned_name||'', lead_id||null, lead_name||null,
         priority||'Medium', recurrence, req.user.id, req.user.name||'Admin']
      );

      // Immediately generate first occurrence
      await generateOccurrences();

      res.status(201).json({ success: true, message: `${recurrence} recurring task set up!`, templateId: result.insertId });
    } else {
      // One-time task
      const [result] = await db.query(
        `INSERT INTO tasks (title,description,assigned_to,assigned_name,lead_id,lead_name,priority,recurrence,due_date,status,created_by,created_by_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [title, description||null, assigned_to, assigned_name||'', lead_id||null, lead_name||null,
         priority||'Medium', 'Once', due_date||null, 'Pending', req.user.id, req.user.name||'Admin']
      );
      res.status(201).json({ success: true, message: 'Task created!', taskId: result.insertId });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── MARK DONE ──
router.put('/:id/done', async (req, res) => {
  try {
    await db.query(
      "UPDATE tasks SET status='Completed', completed_at=NOW() WHERE id=?",
      [req.params.id]
    );
    res.json({ success: true, message: 'Task completed!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE TASK ──
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Sirf admin delete kar sakta hai' });

    const [tasks] = await db.query('SELECT * FROM tasks WHERE id=?', [req.params.id]);
    if (tasks.length === 0)
      return res.status(404).json({ success: false, message: 'Task not found' });

    // Agar recurring task hai, template bhi delete karo
    if (tasks[0].template_id) {
      await db.query('UPDATE task_templates SET is_active=0 WHERE id=?', [tasks[0].template_id]);
      await db.query('DELETE FROM tasks WHERE template_id=?', [tasks[0].template_id]);
    } else {
      await db.query('DELETE FROM tasks WHERE id=?', [req.params.id]);
    }

    res.json({ success: true, message: 'Task deleted!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;