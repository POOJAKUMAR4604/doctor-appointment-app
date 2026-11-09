const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, verifyRole } = require('../middleware/auth');

// All routes here require Admin role
router.use(verifyToken, verifyRole(['admin']));

// Dashboard overview & stats
router.get('/stats', adminController.getDashboardStats);

// Doctors management
router.get('/doctors', adminController.getAllDoctors);
router.put('/approve-doctor/:doctorId', adminController.approveDoctor);
router.put('/reject-doctor/:doctorId', adminController.rejectDoctor);

// Users management
router.get('/users', adminController.getAllUsers);

// Appointments management
router.get('/appointments', adminController.getAllAppointments);

// Platform Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

module.exports = router;
