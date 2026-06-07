const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

router.post('/register',           auth.register);
router.post('/login',              auth.login);
router.get('/profile',             protect, auth.getProfile);
router.put('/profile',             protect, auth.updateProfile);
router.put('/change-password',     protect, auth.changePassword);
router.get('/users',               protect, auth.getAllUsers);
router.post('/users/create',       protect, auth.createEmployee);
router.put('/users/:id/toggle',    protect, auth.toggleUserStatus);
router.delete('/users/:id',        protect, auth.deleteUser);
router.post('/signup', auth.signup);

module.exports = router;