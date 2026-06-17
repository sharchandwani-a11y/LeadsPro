const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// ── Helper: Email Validation ──
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blockedDomains = ['mailinator.com','tempmail.com','guerrillamail.com','throwaway.email','yopmail.com','sharklasers.com','trashmail.com','fakeinbox.com','dispostable.com','maildrop.cc'];

function isValidEmail(email) {
  if (!emailRegex.test(email)) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (blockedDomains.includes(domain)) return false;
  return true;
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'All Fields are Required' });

    if (!isValidEmail(email))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address!' });

    const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email Already Registered' });

    const hashed = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
      [name, email, hashed, role || 'agent']
    );
    res.status(201).json({ success: true, message: 'Account Created!', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and Password Required' });

    const [users] = await db.query('SELECT * FROM users WHERE email=?', [email]);
    if (users.length === 0)
      return res.status(401).json({ success: false, message: 'Wrong Email or Password' });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Wrong Email or Password' });

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        admin_id: user.admin_id, 
        company_id: user.company_id 
      },
      process.env.JWT_SECRET || 'leadspro_secret_key_2024',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        admin_id: user.admin_id, 
        company_id: user.company_id 
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id,name,email,role,admin_id,company_id,created_at FROM users WHERE id=?',
      [req.user.id]
    );
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: users[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email)
      return res.status(400).json({ success: false, message: 'Name and Email Required' });

    if (!isValidEmail(email))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address!' });

    await db.query('UPDATE users SET name=?, email=? WHERE id=?', [name, email, req.user.id]);
    res.json({ success: true, message: 'Profile Updated!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both Passwords Required' });

    const [users] = await db.query('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(oldPassword, users[0].password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Wrong Password!' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password=? WHERE id=?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password Changed!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const currentAdminId = isAdmin ? req.user.id : req.user.admin_id;

    const [users] = await db.query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE admin_id = ? OR id = ? ORDER BY created_at DESC',
      [currentAdminId, currentAdminId]
    );
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Only Admin can Create Employee' });

    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, Email and Password Required' });

    if (!isValidEmail(email))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address!' });

    const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'Email Already Registered' });

    const hashed = await bcrypt.hash(password, 12);
    const companyId = req.user.company_id || null;
    const adminId = req.user.id;

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role, created_by, admin_id, company_id) VALUES (?,?,?,?,?,?,?)',
      [name, email, hashed, role || 'agent', adminId, adminId, companyId]
    );
    
    res.status(201).json({ success: true, message: 'Employee Account Created!', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Only Admin can perform this activity' });

    const [users] = await db.query('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    if (users[0].role === 'admin')
      return res.status(403).json({ success: false, message: 'You Cannot Deactivate Admin' });

    const newStatus = users[0].is_active ? 0 : 1;
    await db.query('UPDATE users SET is_active=? WHERE id=?', [newStatus, req.params.id]);
    res.json({ success: true, message: newStatus ? 'User Activated!' : 'User Deactivated!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Only Admin can Delete this' });

    const [users] = await db.query('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User not found' });

    if (users[0].role === 'admin')
      return res.status(403).json({ success: false, message: 'You Cannot Delete Admin' });

    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'User Deleted!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.signup = async (req, res) => {
  try {
    const { company_name, email, phone, industry, password, plan } = req.body;

    // ── Required fields check ──
    if (!company_name || !email || !password)
      return res.status(400).json({ success: false, message: 'Company name, email and password required!' });

    // ── Email format validation ──
    if (!isValidEmail(email))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address!' });

    // ── Password strength check ──
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters!' });

    // ── Check users table ──
    const [existingUser] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (existingUser.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered! Please login.' });

    // ── Check companies table ──
    const [existingCompany] = await db.query('SELECT id FROM companies WHERE email=?', [email]);
    if (existingCompany.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered! Please login.' });

    const planExpiry = new Date();
    planExpiry.setDate(planExpiry.getDate() + 14);

    const [company] = await db.query(
      'INSERT INTO companies (company_name, email, phone, plan, plan_expiry) VALUES (?,?,?,?,?)',
      [company_name, email, phone || null, plan || 'trial', planExpiry.toISOString().split('T')[0]]
    );

    const hashed = await bcrypt.hash(password, 12);

    const [user] = await db.query(
      'INSERT INTO users (name, email, password, role, company_id, admin_id) VALUES (?,?,?,?,?,NULL)',
      [company_name + ' Admin', email, hashed, 'admin', company.insertId]
    );

    const adminUserId = user.insertId;

    const token = jwt.sign(
      { id: adminUserId, email, role: 'admin', company_id: company.insertId, admin_id: adminUserId },
      process.env.JWT_SECRET || 'leadspro_secret_key_2024',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account Created Successfully!',
      token,
      user: { 
        id: adminUserId, 
        name: company_name + ' Admin', 
        email, 
        role: 'admin', 
        company_id: company.insertId, 
        admin_id: adminUserId 
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};