const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const DoctorProfile = require('./DoctorProfile');
const DoctorSlot = require('./DoctorSlot');

const Appointment = sequelize.define('Appointment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  status: { 
    type: DataTypes.ENUM('booked', 'completed', 'cancelled', 'rescheduled'), 
    defaultValue: 'booked' 
  },
  consultationFee: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  adminCommission: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  prescriptionText: { type: DataTypes.TEXT },
});

User.hasMany(Appointment, { foreignKey: 'userId' });
Appointment.belongsTo(User, { foreignKey: 'userId' });

DoctorProfile.hasMany(Appointment, { foreignKey: 'doctorId' });
Appointment.belongsTo(DoctorProfile, { foreignKey: 'doctorId' });

DoctorSlot.hasOne(Appointment, { foreignKey: 'slotId' });
Appointment.belongsTo(DoctorSlot, { foreignKey: 'slotId' });

module.exports = Appointment;