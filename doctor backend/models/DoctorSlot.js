const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const DoctorProfile = require('./DoctorProfile');

const DoctorSlot = sequelize.define('DoctorSlot', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  startTime: { type: DataTypes.STRING, allowNull: false }, // e.g., "10:00 AM"
  endTime: { type: DataTypes.STRING, allowNull: false },   // e.g., "10:30 AM"
  isBooked: { type: DataTypes.BOOLEAN, defaultValue: false },
});

DoctorProfile.hasMany(DoctorSlot, { foreignKey: 'doctorId', onDelete: 'CASCADE' });
DoctorSlot.belongsTo(DoctorProfile, { foreignKey: 'doctorId' });

module.exports = DoctorSlot;