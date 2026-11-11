const { Op } = require('sequelize');
const { Appointment, DoctorSlot, DoctorProfile, Setting, User, Prescription, Notification } = require('../models');
const sequelize = require('../config/database');
const { parseSlotDateTime } = require('../services/reminderScheduler');

// Helper to convert 24h "HH:mm" to 12h "hh:mm AM/PM"
function formatTo12Hour(timeStr) {
  if (!timeStr) return '';
  const trimmed = String(timeStr).trim();
  if (/AM|PM/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const parts = trimmed.split(':');
  if (parts.length < 2) return trimmed;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2);
  if (isNaN(hours)) return trimmed;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');
  return `${formattedHours}:${minutes} ${ampm}`;
}

// 1. Doctor creates availability slots (single or bulk array)
exports.createSlots = async (req, res) => {
  try {
    const { date, slots, startTime, endTime } = req.body;
    const doctorProfile = await DoctorProfile.findOne({ where: { userId: req.user.id } });

    if (!doctorProfile || !doctorProfile.isApproved) {
      return res.status(403).json({ message: 'Only approved doctors can create availability slots.' });
    }

    if (!date) {
      return res.status(400).json({ message: 'Slot date is required.' });
    }

    // Check date is not in the past
    const todayStr = new Date().toISOString().split('T')[0];
    if (date < todayStr) {
      return res.status(400).json({ message: 'Cannot create consultation slots for past dates.' });
    }

    // Determine list of raw slots
    let rawSlots = [];
    if (Array.isArray(slots) && slots.length > 0) {
      rawSlots = slots;
    } else if (startTime && endTime) {
      rawSlots = [{ startTime, endTime }];
    } else {
      return res.status(400).json({ message: 'Please provide start time and end time for the slot(s).' });
    }

    // Normalize and filter invalid slots
    const normalizedSlots = [];
    for (const s of rawSlots) {
      const sTime = formatTo12Hour(s.startTime);
      const eTime = formatTo12Hour(s.endTime);
      if (sTime && eTime) {
        normalizedSlots.push({ startTime: sTime, endTime: eTime });
      }
    }

    if (normalizedSlots.length === 0) {
      return res.status(400).json({ message: 'No valid slot times provided.' });
    }

    // Check existing slots for this doctor on this date to prevent duplicates
    const existingSlots = await DoctorSlot.findAll({
      where: {
        doctorId: doctorProfile.id,
        date: date,
      },
    });

    const existingSet = new Set(
      existingSlots.map((s) => `${s.startTime}-${s.endTime}`)
    );

    const newSlotsToInsert = [];
    let skippedCount = 0;

    for (const slot of normalizedSlots) {
      const key = `${slot.startTime}-${slot.endTime}`;
      if (existingSet.has(key)) {
        skippedCount++;
      } else {
        existingSet.add(key); // avoid duplicates within the incoming payload itself
        newSlotsToInsert.push({
          doctorId: doctorProfile.id,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBooked: false,
        });
      }
    }

    if (newSlotsToInsert.length === 0) {
      return res.status(400).json({
        message: 'All specified slot(s) already exist in your schedule for this date.',
        skippedCount,
      });
    }

    const created = await DoctorSlot.bulkCreate(newSlotsToInsert);

    const message = skippedCount > 0
      ? `${created.length} slot(s) created successfully (${skippedCount} existing duplicate slot(s) skipped).`
      : `${created.length} slot(s) created successfully!`;

    res.status(201).json({
      message,
      createdCount: created.length,
      skippedCount,
      slots: created,
    });
  } catch (err) {
    console.error('Error creating slots:', err);
    res.status(500).json({ message: 'Error creating slots.', error: err.message });
  }
};

// 2. Doctor fetches all their own slots (with booking & appointment info)
exports.getMySlots = async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ where: { userId: req.user.id } });
    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Auto-clean any expired unbooked slots from past days for this doctor
    await DoctorSlot.destroy({
      where: {
        doctorId: doctorProfile.id,
        isBooked: false,
        date: {
          [Op.lt]: todayStr,
        },
      },
    });

    const whereClause = { doctorId: doctorProfile.id };

    if (req.query.date) {
      whereClause.date = req.query.date;
    }

    if (req.query.status === 'available') {
      whereClause.isBooked = false;
    } else if (req.query.status === 'booked') {
      whereClause.isBooked = true;
    }

    const slots = await DoctorSlot.findAll({
      where: whereClause,
      include: [
        {
          model: Appointment,
          include: [
            {
              model: User,
              attributes: ['id', 'name', 'email', 'phone'],
            },
          ],
        },
      ],
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
    });

    res.json(slots);
  } catch (err) {
    console.error('Error fetching doctor slots:', err);
    res.status(500).json({ message: 'Error fetching slots.', error: err.message });
  }
};

// 3. Doctor deletes an unbooked slot
exports.deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorProfile = await DoctorProfile.findOne({ where: { userId: req.user.id } });

    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    const slot = await DoctorSlot.findOne({
      where: { id, doctorId: doctorProfile.id },
    });

    if (!slot) {
      return res.status(404).json({ message: 'Slot not found or does not belong to you.' });
    }

    if (slot.isBooked) {
      return res.status(400).json({
        message: 'Cannot delete a slot that is already booked by a patient. Please manage the appointment instead.',
      });
    }

    await slot.destroy();
    res.json({ message: 'Availability slot removed successfully.' });
  } catch (err) {
    console.error('Error deleting slot:', err);
    res.status(500).json({ message: 'Error deleting slot.', error: err.message });
  }
};

// 4. Doctor fetches booked appointments
exports.getDoctorAppointments = async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ where: { userId: req.user.id } });
    if (!doctorProfile) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    const appointments = await Appointment.findAll({
      where: { doctorId: doctorProfile.id },
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email', 'phone'],
        },
        {
          model: DoctorSlot,
          attributes: ['id', 'date', 'startTime', 'endTime', 'isBooked'],
        },
        {
          model: Prescription,
          as: 'prescription',
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(appointments);
  } catch (err) {
    console.error('Error fetching doctor appointments:', err);
    res.status(500).json({ message: 'Error fetching appointments.', error: err.message });
  }
};

// 5. Patient/Public: Get all active approved doctors (for doctor directory & selection with fee breakdown)
exports.getApprovedDoctors = async (req, res) => {
  try {
    const setting = await Setting.findOne();
    const commissionPercentage = setting ? parseFloat(setting.commissionPercentage) : 10.0;

    const doctors = await DoctorProfile.findAll({
      where: { isApproved: true },
      include: [
        {
          model: User,
          attributes: ['name', 'email', 'phone'],
        },
      ],
      attributes: ['id', 'specialization', 'experienceYears', 'consultationFee', 'bio'],
      order: [['createdAt', 'DESC']],
    });

    const doctorsWithFee = doctors.map((doc) => {
      const docJson = doc.toJSON();
      const fee = parseFloat(docJson.consultationFee || 0);
      const commission = (fee * commissionPercentage) / 100;
      const total = fee + commission;

      return {
        ...docJson,
        commissionPercentage,
        adminCommission: parseFloat(commission.toFixed(2)),
        totalAmount: parseFloat(total.toFixed(2)),
      };
    });

    res.json(doctorsWithFee);
  } catch (err) {
    console.error('Error fetching approved doctors:', err);
    res.status(500).json({ message: 'Error fetching doctors.', error: err.message });
  }
};

// 6. Public / Patient route to view available slots for a doctor
exports.getDoctorSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const todayStr = new Date().toISOString().split('T')[0];

    const slots = await DoctorSlot.findAll({
      where: {
        doctorId,
        isBooked: false,
        date: {
          [Op.gte]: todayStr,
        },
      },
      order: [['date', 'ASC'], ['startTime', 'ASC']],
    });
    res.json(slots);
  } catch (err) {
    console.error('Error fetching available slots:', err);
    res.status(500).json({ message: 'Error fetching slots.', error: err.message });
  }
};

// 7. Patient books a slot with Transaction Lock (Concurrency Control)
exports.bookAppointment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { slotId } = req.body;
    const userId = req.user.id;

    // Lock the row to prevent concurrent race conditions (Double Booking Prevention)
    const slot = await DoctorSlot.findOne({
      where: { id: slotId, isBooked: false },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!slot) {
      await t.rollback();
      return res.status(400).json({ message: 'Slot is already booked or unavailable.' });
    }

    // Get doctor profile to fetch consultation fee
    const doctor = await DoctorProfile.findByPk(slot.doctorId, { transaction: t });
    if (!doctor) {
      await t.rollback();
      return res.status(404).json({ message: 'Doctor not found.' });
    }

    // Fetch global admin commission setting
    const setting = await Setting.findOne({ transaction: t });
    const commissionPercentage = setting ? parseFloat(setting.commissionPercentage) : 10.00;

    const consultationFee = parseFloat(doctor.consultationFee);
    const adminCommission = (consultationFee * commissionPercentage) / 100;
    const totalAmount = consultationFee + adminCommission;

    // Mark slot as booked
    slot.isBooked = true;
    await slot.save({ transaction: t });

    // Create the appointment record
    const appointment = await Appointment.create({
      userId,
      doctorId: doctor.id,
      slotId: slot.id,
      consultationFee,
      adminCommission,
      totalAmount,
      status: 'booked',
    }, { transaction: t });

    await t.commit();

    // Trigger instant booking notification for patient & doctor
    try {
      const docUser = await User.findByPk(doctor.userId);
      const doctorName = docUser ? docUser.name : 'your doctor';
      await Notification.create({
        userId,
        title: 'Appointment Booked Successfully',
        message: `Your appointment with Dr. ${doctorName} on ${slot.date} at ${slot.startTime} is confirmed. Total fee: ₹${totalAmount}. Note: Free cancellation/reschedule is permitted up to 24 hours before the appointment.`,
        type: 'booking',
        isRead: false,
      });

      if (doctor.userId) {
        const patientUser = await User.findByPk(userId);
        const patientName = patientUser ? patientUser.name : 'A patient';
        await Notification.create({
          userId: doctor.userId,
          title: 'New Appointment Booked',
          message: `${patientName} booked a consultation slot with you for ${slot.date} at ${slot.startTime}.`,
          type: 'booking',
          isRead: false,
        });
      }
    } catch (notifErr) {
      console.error('Failed to create booking notification:', notifErr);
    }

    res.status(201).json({ message: 'Appointment booked successfully!', appointment });

  } catch (err) {
    await t.rollback();
    console.error('Error booking appointment:', err);
    res.status(500).json({ message: 'Error booking appointment.', error: err.message });
  }
};

// 8. Patient fetches their own appointments & prescriptions
exports.getPatientAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: DoctorProfile,
          include: [
            {
              model: User,
              attributes: ['name', 'email', 'phone'],
            },
          ],
        },
        {
          model: DoctorSlot,
          attributes: ['id', 'date', 'startTime', 'endTime'],
        },
        {
          model: Prescription,
          as: 'prescription',
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json(appointments);
  } catch (err) {
    console.error('Error fetching patient appointments:', err);
    res.status(500).json({ message: 'Error fetching patient appointments.', error: err.message });
  }
};

// 9. Cancel Appointment (Enforcing 24-hour restriction rule)
exports.cancelAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find appointment with slot
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: DoctorSlot },
        { model: DoctorProfile, include: [{ model: User, attributes: ['name', 'userId'] }] },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Verify ownership: only the booked patient or assigned doctor or admin can cancel
    const doctorProfile = await DoctorProfile.findOne({ where: { userId } });
    const isOwnerPatient = appointment.userId === userId;
    const isOwnerDoctor = doctorProfile && appointment.doctorId === doctorProfile.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwnerPatient && !isOwnerDoctor && !isAdmin) {
      await t.rollback();
      return res.status(403).json({ message: 'Unauthorized to cancel this appointment.' });
    }

    if (appointment.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({ message: 'Appointment is already cancelled.' });
    }

    if (appointment.status === 'completed') {
      await t.rollback();
      return res.status(400).json({ message: 'Cannot cancel an already completed appointment.' });
    }

    // Restriction check: no cancel within 24 hours (unless admin overrides)
    if (!isAdmin && appointment.DoctorSlot) {
      const slotDateTime = parseSlotDateTime(appointment.DoctorSlot.date, appointment.DoctorSlot.startTime);
      if (slotDateTime) {
        const now = new Date();
        const diffMs = slotDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24) {
          await t.rollback();
          return res.status(400).json({
            message: `Cancellation restriction: Appointments cannot be cancelled within 24 hours of scheduled time (Only ${Math.max(0, diffHours).toFixed(1)} hours remaining).`,
            hoursRemaining: diffHours,
          });
        }
      }
    }

    // Update appointment status to cancelled
    appointment.status = 'cancelled';
    await appointment.save({ transaction: t });

    // Release the doctor slot back to available so other patients can book
    if (appointment.DoctorSlot) {
      appointment.DoctorSlot.isBooked = false;
      await appointment.DoctorSlot.save({ transaction: t });
    }

    await t.commit();

    // Send cancellation notifications
    try {
      const slotInfo = appointment.DoctorSlot ? `${appointment.DoctorSlot.date} at ${appointment.DoctorSlot.startTime}` : '';
      await Notification.create({
        userId: appointment.userId,
        title: 'Appointment Cancelled',
        message: `Your appointment for ${slotInfo} has been cancelled successfully. The slot is released.`,
        type: 'booking',
        isRead: false,
      });
    } catch (notifErr) {
      console.error('Failed to send cancel notification:', notifErr);
    }

    res.json({ message: 'Appointment cancelled successfully and slot released.', appointment });
  } catch (err) {
    await t.rollback();
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ message: 'Error cancelling appointment.', error: err.message });
  }
};

// 10. Reschedule Suggestion: Find next available slot for the doctor if user is unavailable
exports.getRescheduleSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: DoctorSlot },
        { model: DoctorProfile, include: [{ model: User, attributes: ['name'] }] },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    if (appointment.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized to view rescheduling options for this appointment.' });
    }

    if (appointment.status !== 'booked') {
      return res.status(400).json({ message: `Cannot reschedule appointment with status: ${appointment.status}.` });
    }

    // 24-hour restriction check
    if (req.user.role !== 'admin' && appointment.DoctorSlot) {
      const slotDateTime = parseSlotDateTime(appointment.DoctorSlot.date, appointment.DoctorSlot.startTime);
      if (slotDateTime) {
        const now = new Date();
        const diffMs = slotDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24) {
          return res.status(400).json({
            message: `Rescheduling restriction: Appointments cannot be rescheduled within 24 hours of scheduled time (${Math.max(0, diffHours).toFixed(1)} hours remaining).`,
            hoursRemaining: diffHours,
          });
        }
      }
    }

    // Find all future available slots for this doctor
    const todayStr = new Date().toISOString().split('T')[0];
    const availableSlots = await DoctorSlot.findAll({
      where: {
        doctorId: appointment.doctorId,
        isBooked: false,
        id: { [Op.ne]: appointment.slotId },
        date: { [Op.gte]: todayStr },
      },
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
      limit: 10,
    });

    const nextAvailableSlot = availableSlots.length > 0 ? availableSlots[0] : null;

    res.json({
      currentAppointment: appointment,
      nextAvailableSlot,
      allAvailableSlots: availableSlots,
      message: nextAvailableSlot
        ? `Next available slot found on ${nextAvailableSlot.date} at ${nextAvailableSlot.startTime}. Confirm to reschedule.`
        : 'No alternative slots are currently available for this doctor.',
    });
  } catch (err) {
    console.error('Error fetching reschedule suggestions:', err);
    res.status(500).json({ message: 'Error checking reschedule options.', error: err.message });
  }
};

// 11. Confirm Rescheduling: auto-moves appointment to target/next slot on user confirmation
exports.confirmReschedule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { newSlotId } = req.body;
    const userId = req.user.id;

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: DoctorSlot },
        { model: DoctorProfile, include: [{ model: User, attributes: ['name'] }] },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!appointment) {
      await t.rollback();
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    if (appointment.userId !== userId && req.user.role !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Unauthorized to reschedule this appointment.' });
    }

    if (appointment.status !== 'booked') {
      await t.rollback();
      return res.status(400).json({ message: `Cannot reschedule appointment with status: ${appointment.status}.` });
    }

    // 24-hour restriction check
    if (req.user.role !== 'admin' && appointment.DoctorSlot) {
      const slotDateTime = parseSlotDateTime(appointment.DoctorSlot.date, appointment.DoctorSlot.startTime);
      if (slotDateTime) {
        const now = new Date();
        const diffMs = slotDateTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24) {
          await t.rollback();
          return res.status(400).json({
            message: `Rescheduling restriction: Cannot reschedule within 24 hours of scheduled time (${Math.max(0, diffHours).toFixed(1)} hours remaining).`,
            hoursRemaining: diffHours,
          });
        }
      }
    }

    // If newSlotId is provided, use that; otherwise auto-select the next available slot for the doctor
    let targetSlot = null;
    if (newSlotId) {
      targetSlot = await DoctorSlot.findOne({
        where: { id: newSlotId, doctorId: appointment.doctorId, isBooked: false },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      targetSlot = await DoctorSlot.findOne({
        where: {
          doctorId: appointment.doctorId,
          isBooked: false,
          id: { [Op.ne]: appointment.slotId },
          date: { [Op.gte]: todayStr },
        },
        order: [
          ['date', 'ASC'],
          ['startTime', 'ASC'],
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    }

    if (!targetSlot) {
      await t.rollback();
      return res.status(400).json({ message: 'Selected or next available slot is no longer available.' });
    }

    const previousSlotDate = appointment.DoctorSlot?.date;
    const previousSlotTime = appointment.DoctorSlot?.startTime;

    // Release old slot
    if (appointment.DoctorSlot) {
      appointment.DoctorSlot.isBooked = false;
      await appointment.DoctorSlot.save({ transaction: t });
    }

    // Book new slot
    targetSlot.isBooked = true;
    await targetSlot.save({ transaction: t });

    // Update appointment
    appointment.slotId = targetSlot.id;
    appointment.status = 'booked';
    await appointment.save({ transaction: t });

    await t.commit();

    // Send reschedule notification
    try {
      const doctorName = appointment.DoctorProfile?.User?.name || 'your doctor';
      await Notification.create({
        userId: appointment.userId,
        title: 'Appointment Rescheduled',
        message: `Your appointment with Dr. ${doctorName} was rescheduled from ${previousSlotDate} ${previousSlotTime} to ${targetSlot.date} at ${targetSlot.startTime}.`,
        type: 'booking',
        isRead: false,
      });
    } catch (notifErr) {
      console.error('Failed to create reschedule notification:', notifErr);
    }

    res.json({
      message: `Appointment successfully moved to next available slot: ${targetSlot.date} at ${targetSlot.startTime}.`,
      appointment,
      newSlot: targetSlot,
    });
  } catch (err) {
    await t.rollback();
    console.error('Error confirming reschedule:', err);
    res.status(500).json({ message: 'Error rescheduling appointment.', error: err.message });
  }
};

// 12. Doctor manually marks an appointment as completed
exports.completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: DoctorSlot },
        { model: DoctorProfile, include: [{ model: User, attributes: ['name', 'userId'] }] },
      ],
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    const doctorProfile = await DoctorProfile.findOne({ where: { userId } });
    const isOwnerDoctor = doctorProfile && appointment.doctorId === doctorProfile.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwnerDoctor && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized. Only the assigned doctor or administrator can mark this consultation as completed.' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ message: 'Appointment is already marked as completed.' });
    }

    appointment.status = 'completed';
    await appointment.save();

    // Trigger completion notification for patient
    try {
      const doctorName = appointment.DoctorProfile?.User?.name || 'Your Doctor';
      const slotTimeText = appointment.DoctorSlot ? `${appointment.DoctorSlot.date} at ${appointment.DoctorSlot.startTime}` : '';
      await Notification.create({
        userId: appointment.userId,
        title: 'Consultation Completed',
        message: `Dr. ${doctorName} has confirmed and completed your consultation (${slotTimeText}). Thank you for visiting!`,
        type: 'completion',
        isRead: false,
      });
    } catch (notifErr) {
      console.error('Failed to trigger completion notification:', notifErr);
    }

    res.json({
      message: 'Consultation slot successfully confirmed and marked as completed.',
      appointment,
    });
  } catch (err) {
    console.error('Error completing appointment:', err);
    res.status(500).json({ message: 'Error completing appointment.', error: err.message });
  }
};
