const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const DoctorProfile = sequelize.define('DoctorProfile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  specialization: { type: DataTypes.STRING, allowNull: false },
  experienceYears: { type: DataTypes.INTEGER, allowNull: false },
  consultationFee: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  certificateUrl: { type: DataTypes.STRING, allowNull: false },
  isApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
  rejectionReason: { type: DataTypes.TEXT },
  bio: { type: DataTypes.TEXT },
});

User.hasOne(DoctorProfile, { foreignKey: 'userId', onDelete: 'CASCADE' });
DoctorProfile.belongsTo(User, { foreignKey: 'userId' });

module.exports = DoctorProfile;
