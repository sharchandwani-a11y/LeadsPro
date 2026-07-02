const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const protect = require('../middleware/authMiddleware');

// 📁 FILE UPLOAD CONFIGURATION
const uploadsDir = path.join(__dirname, '../uploads/client-documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.jpeg'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// ─── STATS ───────────────────────────────────────────
router.get('/stats', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;

    const [[{ total }]]     = await db.query('SELECT COUNT(*) AS total FROM clients WHERE admin_id = ?', [adminId]);
    const [[{ docs }]]      = await db.query('SELECT COUNT(*) AS docs FROM client_documents WHERE admin_id = ?', [adminId]);
    const [[{ notes }]]     = await db.query('SELECT COUNT(*) AS notes FROM client_notes WHERE admin_id = ?', [adminId]);

    res.json({ success: true, stats: { total, documents: docs, notes } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── UPLOAD DOCUMENT ─────────────────────────────────
router.post('/upload-document', protect, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { client_id } = req.body;
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!client_id) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Client ID required' });
    }

    const [rows] = await db.query('SELECT id FROM clients WHERE id = ? AND admin_id = ?', [client_id, adminId]);
    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const doc_name  = req.file.originalname;
    const doc_type  = path.extname(req.file.originalname).substring(1).toUpperCase();
    const file_path = `/uploads/client-documents/${req.file.filename}`;

    const [result] = await db.query(
      `INSERT INTO client_documents (client_id, doc_name, doc_type, file_path, uploaded_by, admin_id, created_at) VALUES (?,?,?,?,?,?,NOW())`,
      [client_id, doc_name, doc_type, file_path, req.user.id, adminId]
    );

    res.status(201).json({ success: true, message: 'Document uploaded', data: { id: result.insertId, doc_name, file_path } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── NOTES ───────────────────────────────────────────
router.get('/notes/:client_id', protect, async (req, res) => {
  try {
    const { client_id } = req.params;
    const [notes] = await db.query(
      `SELECT cn.*, u.name AS created_by_name FROM client_notes cn LEFT JOIN users u ON cn.created_by = u.id WHERE cn.client_id = ? ORDER BY cn.created_at DESC`,
      [client_id]
    );
    res.json({ success: true, data: notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/notes', protect, async (req, res) => {
  try {
    const { client_id, note } = req.body;
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!client_id || !note) return res.status(400).json({ success: false, message: 'client_id and note required' });

    const [result] = await db.query(
      `INSERT INTO client_notes (client_id, note, created_by, admin_id, created_at) VALUES (?,?,?,?,NOW())`,
      [client_id, note, req.user.id, adminId]
    );
    res.status(201).json({ success: true, message: 'Note added', data: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/notes/:note_id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const [result] = await db.query('DELETE FROM client_notes WHERE id = ? AND admin_id = ?', [req.params.note_id, adminId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Note not found' });
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DOCUMENTS ───────────────────────────────────────
router.delete('/documents/:doc_id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;

    const [rows] = await db.query('SELECT file_path FROM client_documents WHERE id = ? AND admin_id = ?', [req.params.doc_id, adminId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Document not found' });

    const filePath = path.join(__dirname, '..', rows[0].file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.query('DELETE FROM client_documents WHERE id = ?', [req.params.doc_id]);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── CLIENTS CRUD ────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { search, company, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;

    let query = `SELECT c.*,
                 (SELECT COUNT(*) FROM client_documents WHERE client_id = c.id) AS doc_count,
                 (SELECT COUNT(*) FROM client_notes WHERE client_id = c.id) AS notes_count
                 FROM clients c WHERE c.admin_id = ?`;
    const params = [adminId];

    if (search) {
      query += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (company) { query += ' AND c.company = ?'; params.push(company); }

    let countQ = `SELECT COUNT(*) AS total FROM clients c WHERE c.admin_id = ?`;
    const countP = [adminId];
    if (search) { countQ += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?)'; const s = `%${search}%`; countP.push(s,s,s,s); }
    if (company) { countQ += ' AND c.company = ?'; countP.push(company); }

    const [[{ total }]] = await db.query(countQ, countP);
    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const [clients] = await db.query(query, params);

    res.json({ success: true, data: clients, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const [rows] = await db.query('SELECT * FROM clients WHERE id = ? AND admin_id = ?', [req.params.id, adminId]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });

    const [documents] = await db.query('SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC', [req.params.id]);
    const [notes] = await db.query(
      `SELECT cn.*, u.name AS created_by_name FROM client_notes cn LEFT JOIN users u ON cn.created_by = u.id WHERE cn.client_id = ? ORDER BY cn.created_at DESC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], documents, notes, notes_count: notes.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body;
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });

    const [result] = await db.query(
      `INSERT INTO clients (name, phone, email, company, address, notes, admin_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,NOW())`,
      [name, phone||null, email||null, company||null, address||null, notes||null, adminId, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Client added', data: { id: result.insertId, name } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body;
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });

    const [result] = await db.query(
      `UPDATE clients SET name=?,phone=?,email=?,company=?,address=?,notes=? WHERE id=? AND admin_id=?`,
      [name, phone, email, company, address, notes, req.params.id, adminId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, message: 'Client updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const adminId = isAdmin ? req.user.id : req.user.admin_id;
    const [result] = await db.query('DELETE FROM clients WHERE id = ? AND admin_id = ?', [req.params.id, adminId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;