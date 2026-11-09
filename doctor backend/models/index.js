const sequelize = require('../config/database');
const User = require('./User');
const DoctorProfile = require('./DoctorProfile');
const DoctorSlot = require('./DoctorSlot');
const Appointment = require('./Appointment');
const Prescription = require('./prescription');
const Notification = require('./Notification');
const Setting = require('./Setting');

// Associations for Prescription
Appointment.hasOne(Prescription, { foreignKey: 'appointmentId', as: 'prescription' });
Prescription.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

module.exports = {
  sequelize,
  User,
  DoctorProfile,
  DoctorSlot,
  Appointment,
  Prescription,
  Notification,
  Setting,
};
