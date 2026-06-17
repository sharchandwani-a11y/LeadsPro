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
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png', '.jpeg'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG'));
    }
  }
});

// 📊 GET DASHBOARD STATS: Clients count
exports.getClientsStats = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!currentAdminId) {
      return res.json({ success: true, stats: { total: 0, documents: 0, notes: 0 } });
    }

    const params = [currentAdminId];

    const [[{ total: totalClients }]] = await db.query('SELECT COUNT(*) AS total FROM clients WHERE admin_id = ?', params);
    const [[{ total: totalDocuments }]] = await db.query('SELECT COUNT(*) AS total FROM client_documents WHERE admin_id = ?', params);
    const [[{ total: totalNotes }]] = await db.query('SELECT COUNT(*) AS total FROM client_notes WHERE admin_id = ?', params);

    res.json({
      success: true,
      message: 'Client stats fetched successfully',
      stats: {
        total: totalClients || 0,
        documents: totalDocuments || 0,
        notes: totalNotes || 0
      }
    });
  } catch (err) {
    console.error('getClientsStats error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📋 GET ALL CLIENTS: With search, filter, and pagination
exports.getAllClients = async (req, res) => {
  try {
    const { search, company, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    let query = `SELECT c.*, u.name AS created_by_name,
                 (SELECT COUNT(*) FROM client_documents WHERE client_id = c.id) AS doc_count,
                 (SELECT COUNT(*) FROM client_notes WHERE client_id = c.id) AS notes_count
                 FROM clients c
                 LEFT JOIN users u ON c.created_by = u.id
                 WHERE c.admin_id = ?`;
    const params = [currentAdminId];

    if (search) {
      query += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (company) {
      query += ' AND c.company = ?';
      params.push(company);
    }

    let countQuery = `SELECT COUNT(*) AS total FROM clients c LEFT JOIN users u ON c.created_by = u.id WHERE c.admin_id = ?`;
    const countParams = [currentAdminId];

    if (search) {
      countQuery += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?)';
      const s = `%${search}%`;
      countParams.push(s, s, s, s);
    }
    if (company) {
      countQuery += ' AND c.company = ?';
      countParams.push(company);
    }

    const [[{ total }]] = await db.query(countQuery, countParams);

    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [clients] = await db.query(query, params);

    res.json({
      success: true,
      data: clients,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('getAllClients error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔍 GET SINGLE CLIENT WITH DOCUMENTS AND NOTES
exports.getClient = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [clientRows] = await db.query('SELECT * FROM clients WHERE id = ? AND admin_id = ?', [id, currentAdminId]);

    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const client = clientRows[0];

    const [documents] = await db.query('SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC', [id]);
    const [notes] = await db.query('SELECT cn.*, u.name AS created_by_name FROM client_notes cn LEFT JOIN users u ON cn.created_by = u.id WHERE cn.client_id = ? ORDER BY cn.created_at DESC', [id]);

    res.json({
      success: true,
      data: { ...client, documents, notes, notes_count: notes.length }
    });
  } catch (err) {
    console.error('getClient error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ➕ ADD CLIENT
exports.addClient = async (req, res) => {
  try {
    const { name, phone, email, company, address, notes } = req.body;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Client name is required' });
    }

    const query = `INSERT INTO clients (name, phone, email, company, address, notes, admin_id, created_by, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

    const [result] = await db.query(query, [
      name, phone || null, email || null, company || null, address || null, notes || null,
      currentAdminId, req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Client added successfully',
      data: { id: result.insertId, name, phone, email, company, address, notes, admin_id: currentAdminId }
    });
  } catch (err) {
    console.error('addClient error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✏️ UPDATE CLIENT
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, company, address, notes } = req.body;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Client name is required' });
    }

    const query = `UPDATE clients SET name=?, phone=?, email=?, company=?, address=?, notes=? WHERE id=? AND admin_id=?`;
    const [result] = await db.query(query, [name, phone, email, company, address, notes, id, currentAdminId]);

    if (result.affectedRows === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized or client not found' });
    }

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (err) {
    console.error('updateClient error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ DELETE CLIENT
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [result] = await db.query('DELETE FROM clients WHERE id = ? AND admin_id = ?', [id, currentAdminId]);

    if (result.affectedRows === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized or client not found' });
    }

    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (err) {
    console.error('deleteClient error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📄 UPLOAD DOCUMENT FOR CLIENT
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { client_id } = req.body;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!client_id) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Client ID is required' });
    }

    const [clientRows] = await db.query('SELECT id FROM clients WHERE id = ? AND admin_id = ?', [client_id, currentAdminId]);

    if (clientRows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const doc_name = req.file.originalname;
    const doc_type = path.extname(req.file.originalname).substring(1).toUpperCase();
    const file_path = `/uploads/client-documents/${req.file.filename}`;

    const query = `INSERT INTO client_documents (client_id, doc_name, doc_type, file_path, uploaded_by, admin_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, NOW())`;

    const [result] = await db.query(query, [client_id, doc_name, doc_type, file_path, req.user.id, currentAdminId]);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { id: result.insertId, doc_name, doc_type, file_path }
    });
  } catch (err) {
    console.error('uploadDocument error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ DELETE DOCUMENT
exports.deleteDocument = async (req, res) => {
  try {
    const { doc_id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [docRows] = await db.query('SELECT file_path FROM client_documents WHERE id = ? AND admin_id = ?', [doc_id, currentAdminId]);

    if (docRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const filePath = path.join(__dirname, '..', docRows[0].file_path);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM client_documents WHERE id = ? AND admin_id = ?', [doc_id, currentAdminId]);

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    console.error('deleteDocument error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📝 ADD NOTE TO CLIENT
exports.addNote = async (req, res) => {
  try {
    const { client_id, note } = req.body;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    if (!client_id || !note) {
      return res.status(400).json({ success: false, message: 'Client ID and note are required' });
    }

    const [clientRows] = await db.query('SELECT id FROM clients WHERE id = ? AND admin_id = ?', [client_id, currentAdminId]);

    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const query = `INSERT INTO client_notes (client_id, note, created_by, admin_id, created_at) VALUES (?, ?, ?, ?, NOW())`;
    const [result] = await db.query(query, [client_id, note, req.user.id, currentAdminId]);

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: { id: result.insertId, client_id, note, created_by: req.user.id }
    });
  } catch (err) {
    console.error('addNote error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ DELETE NOTE
exports.deleteNote = async (req, res) => {
  try {
    const { note_id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [result] = await db.query('DELETE FROM client_notes WHERE id = ? AND admin_id = ?', [note_id, currentAdminId]);

    if (result.affectedRows === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized or note not found' });
    }

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (err) {
    console.error('deleteNote error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📋 GET DOCUMENTS FOR CLIENT
exports.getClientDocuments = async (req, res) => {
  try {
    const { client_id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [clientRows] = await db.query('SELECT id FROM clients WHERE id = ? AND admin_id = ?', [client_id, currentAdminId]);

    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const [documents] = await db.query('SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC', [client_id]);

    res.json({ success: true, data: documents });
  } catch (err) {
    console.error('getClientDocuments error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📋 GET NOTES FOR CLIENT
exports.getClientNotes = async (req, res) => {
  try {
    const { client_id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [clientRows] = await db.query('SELECT id FROM clients WHERE id = ? AND admin_id = ?', [client_id, currentAdminId]);

    if (clientRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const [notes] = await db.query('SELECT cn.*, u.name AS created_by_name FROM client_notes cn LEFT JOIN users u ON cn.created_by = u.id WHERE cn.client_id = ? ORDER BY cn.created_at DESC', [client_id]);

    res.json({ success: true, data: notes });
  } catch (err) {
    console.error('getClientNotes error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== ROUTES =====
router.get('/stats', protect, exports.getClientsStats);
router.get('/', protect, exports.getAllClients);
router.get('/:id', protect, exports.getClient);
router.post('/', protect, exports.addClient);
router.put('/:id', protect, exports.updateClient);
router.delete('/:id', protect, exports.deleteClient);

router.post('/upload-document', protect, upload.single('document'), exports.uploadDocument);
router.get('/documents/:client_id', protect, exports.getClientDocuments);
router.delete('/documents/:doc_id', protect, exports.deleteDocument);

router.post('/notes', protect, exports.addNote);
router.get('/notes/:client_id', protect, exports.getClientNotes);
router.delete('/notes/:note_id', protect, exports.deleteNote);

module.exports = router;