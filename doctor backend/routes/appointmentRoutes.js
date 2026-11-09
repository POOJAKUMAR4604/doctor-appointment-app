const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyToken, verifyRole } = require('../middleware/auth');

// Doctor slot & appointment routes
router.post('/slots', verifyToken, verifyRole(['doctor']), appointmentController.createSlots);
router.get('/my-slots', verifyToken, verifyRole(['doctor']), appointmentController.getMySlots);
router.delete('/slots/:id', verifyToken, verifyRole(['doctor']), appointmentController.deleteSlot);
router.get('/doctor', verifyToken, verifyRole(['doctor']), appointmentController.getDoctorAppointments);

// Public / Patient routes
router.get('/doctors', appointmentController.getApprovedDoctors);
router.get('/slots/:doctorId', appointmentController.getDoctorSlots);

// Patient routes (accepting 'user' or 'patient' role)
router.post('/book', verifyToken, verifyRole(['user', 'patient']), appointmentController.bookAppointment);
router.get('/patient-appointments', verifyToken, verifyRole(['user', 'patient']), appointmentController.getPatientAppointments);

// Cancellation & Rescheduling with 24-hour restriction rule
router.put('/:id/cancel', verifyToken, verifyRole(['user', 'patient', 'doctor', 'admin']), appointmentController.cancelAppointment);
router.get('/:id/reschedule-suggestion', verifyToken, verifyRole(['user', 'patient', 'admin']), appointmentController.getRescheduleSuggestion);
router.put('/:id/reschedule-confirm', verifyToken, verifyRole(['user', 'patient', 'admin']), appointmentController.confirmReschedule);

// Doctor marks slot as completed
router.put('/:id/complete', verifyToken, verifyRole(['doctor', 'admin']), appointmentController.completeAppointment);

module.exports = router;
