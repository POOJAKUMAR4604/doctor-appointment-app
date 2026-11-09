const { Notification } = require('../models');

// 1. Get all notifications for logged-in user
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications.', error: err.message });
  }
};

// 2. Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({ where: { id, userId: req.user.id } });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ message: 'Notification marked as read.', notification });
  } catch (err) {
    res.status(500).json({ message: 'Error updating notification.', error: err.memory });
  }
};