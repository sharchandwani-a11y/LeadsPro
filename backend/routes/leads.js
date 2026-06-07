const express = require('express');
const router  = express.Router();
const leads   = require('../controllers/leadsController');
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.get('/stats',  leads.getdashboardStats);
router.get('/',       leads.getAllLeads);
router.get('/:id',    leads.getLead);
router.post('/',      leads.addLead);
router.put('/:id',    leads.updateLead);
router.delete('/:id', leads.deleteLead);

module.exports = router;