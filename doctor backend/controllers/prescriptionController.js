const { Prescription, Appointment, DoctorProfile, User, Notification } = require('../models');

// 1. Doctor creates a prescription for an appointment
exports.createPrescription = async (req, res) => {
  try {
    const { appointmentId, diagnosis, medicines, instructions } = req.body;

    const appointment = await Appointment.findByPk(appointmentId, {
      include: [{ model: DoctorProfile }]
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found.' });
    }

    // Verify logged-in doctor owns this appointment
    const doctorProfile = await DoctorProfile.findOne({ where: { userId: req.user.id } });
    if (!doctorProfile || appointment.doctorId !== doctorProfile.id) {
      return res.status(403).json({ message: 'Unauthorized to write prescription for this appointment.' });
    }

    const prescription = await Prescription.create({
      appointmentId,
      diagnosis,
      medicines,
      instructions,
    });

    // Update appointment status to completed and record text
    appointment.status = 'completed';
    appointment.prescriptionText = diagnosis + '\n' + medicines + (instructions ? '\n' + instructions : '');
    await appointment.save();

    // Trigger completion notification for patient
    try {
      const docUser = await User.findByPk(doctorProfile.userId);
      const doctorName = docUser ? docUser.name : 'Your Doctor';
      await Notification.create({
        userId: appointment.userId,
        title: 'Consultation Completed',
        message: `Your appointment with Dr. ${doctorName} has been marked completed and a digital prescription was issued.`,
        type: 'completion',
        isRead: false,
      });
    } catch (notifErr) {
      console.error('Failed to trigger completion notification:', notifErr);
    }

    res.status(201).json({ message: 'Prescription created successfully!', prescription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating prescription.', error: err.message });
  }
};

// 2. Patient or Doctor views a prescription
exports.getPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const prescription = await Prescription.findOne({ where: { appointmentId } });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found.' });
    }

    res.json(prescription);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching prescription.', error: err.message });
  }
};
