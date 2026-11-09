const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Setting = sequelize.define('Setting', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  commissionPercentage: { type: DataTypes.DECIMAL(5, 2), defaultValue: 10.00 },
  appName: { type: DataTypes.STRING, defaultValue: 'DoctorAppointment' },
  logoUrl: { type: DataTypes.STRING },
});

module.exports = Setting;