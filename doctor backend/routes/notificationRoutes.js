const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, notificationController.getUserNotifications);
router.put('/:id/read', verifyToken, notificationController.markAsRead);

module.exports = router;