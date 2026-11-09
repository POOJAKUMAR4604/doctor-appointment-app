const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { verifyToken, verifyRole } = require('../middleware/auth');

router.post('/', verifyToken, verifyRole(['doctor']), prescriptionController.createPrescription);
router.get('/:appointmentId', verifyToken, prescriptionController.getPrescription);

module.exports = router;