const cron = require('node-cron');
const { Op } = require('sequelize');
const { Appointment, DoctorSlot, DoctorProfile, User, Notification } = require('../models');

// Helper to convert date + time strings (e.g. "2026-11-10", "10:30 AM") to Date object
function parseSlotDateTime(dateStr, timeStr) {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const timeMatch = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : null;

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  } catch (err) {
    return null;
  }
}

/**
 * Checks for upcoming booked appointments and generates:
 * 1. 1-day reminder (within 24 hours to 23 hours prior)
 * 2. 1-hour reminder (within 60 mins to 50 mins prior)
 * 3. 15-minute reminder (within 15 mins to 5 mins prior)
 */
async function checkUpcomingAppointmentReminders() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Find all currently booked appointments with their slots
    const appointments = await Appointment.findAll({
      where: { status: 'booked' },
      include: [
        {
          model: DoctorSlot,
          where: {
            date: {
              [Op.gte]: todayStr,
            },
          },
          required: true,
        },
        {
          model: DoctorProfile,
          include: [
            {
              model: User,
              attributes: ['name'],
            },
          ],
        },
        {
          model: User,
          attributes: ['id', 'name'],
        },
      ],
    });

    for (const app of appointments) {
      if (!app.DoctorSlot || !app.userId) continue;

      const slotDateTime = parseSlotDateTime(app.DoctorSlot.date, app.DoctorSlot.startTime);
      if (!slotDateTime) continue;

      const diffMs = slotDateTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      const doctorName = app.DoctorProfile?.User?.name || 'Doctor';
      const slotTimeText = `${app.DoctorSlot.date} at ${app.DoctorSlot.startTime}`;

      // 1. One day reminder: between 23h and 25h away (1380 to 1500 mins)
      if (diffMinutes >= 1380 && diffMinutes <= 1500) {
        await createReminderIfNotExists(
          app.userId,
          `Appointment Tomorrow with Dr. ${doctorName}`,
          `Reminder: Your medical consultation with Dr. ${doctorName} is tomorrow (${slotTimeText}). Please note cancellations/reschedules must be done 24 hours prior.`,
          app.id,
          '1-day'
        );
      }

      // 2. One hour reminder: between 50 and 65 mins away
      if (diffMinutes >= 50 && diffMinutes <= 65) {
        await createReminderIfNotExists(
          app.userId,
          `Appointment in 1 Hour with Dr. ${doctorName}`,
          `Reminder: Your consultation with Dr. ${doctorName} starts in 1 hour (${slotTimeText}). Please get ready.`,
          app.id,
          '1-hour'
        );
      }

      // 3. 15-minute reminder: between 5 and 18 mins away
      if (diffMinutes >= 5 && diffMinutes <= 18) {
        await createReminderIfNotExists(
          app.userId,
          `Appointment in 15 Minutes with Dr. ${doctorName}`,
          `Immediate Reminder: Dr. ${doctorName} will be ready in 15 minutes (${slotTimeText}). Please be available.`,
          app.id,
          '15-min'
        );
      }
    }
  } catch (err) {
    console.error('Error in checkUpcomingAppointmentReminders:', err);
  }
}

// Helper to prevent duplicate notification for the same appointment window
async function createReminderIfNotExists(userId, title, message, appointmentId, reminderKey) {
  try {
    const existing = await Notification.findOne({
      where: {
        userId,
        type: 'reminder',
        message: {
          [Op.like]: `%${appointmentId}%`,
        },
      },
    });

    // Also check if a notification with this title was already sent recently
    const titleMatch = await Notification.findOne({
      where: {
        userId,
        type: 'reminder',
        title,
      },
    });

    if (existing || titleMatch) return;

    await Notification.create({
      userId,
      title,
      message: `${message} [Ref:${appointmentId}-${reminderKey}]`,
      type: 'reminder',
      isRead: false,
    });
  } catch (err) {
    console.error('Error creating reminder notification:', err);
  }
}

// Start recurring scheduler
function startNotificationScheduler() {
  // Check every 2 minutes for upcoming appointments
  cron.schedule('*/2 * * * *', () => {
    checkUpcomingAppointmentReminders();
  });

  // Run initial check right now on server boot
  checkUpcomingAppointmentReminders();
  console.log('Automated Appointment Reminder Scheduler started (runs every 2 mins).');
}

module.exports = {
  startNotificationScheduler,
  parseSlotDateTime,
  checkUpcomingAppointmentReminders,
};
