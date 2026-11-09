const { Op } = require('sequelize');
const { DoctorProfile, User, Setting, Appointment, DoctorSlot } = require('../models');

// 1. Get all unapproved or all doctors
exports.getAllDoctors = async (req, res) => {
  try {
    const doctors = await DoctorProfile.findAll({
      include: [{ model: User, attributes: ['id', 'name', 'email', 'phone', 'createdAt'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching doctors.', error: err.message });
  }
};

// 2. Approve a doctor
exports.approveDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await DoctorProfile.findByPk(doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    doctor.isApproved = true;
    doctor.rejectionReason = null;
    await doctor.save();

    res.json({ message: 'Doctor approved successfully!', doctor });
  } catch (err) {
    res.status(500).json({ message: 'Error approving doctor.', error: err.message });
  }
};

// 3. Reject a doctor with review note
exports.rejectDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { reason } = req.body;
    const doctor = await DoctorProfile.findByPk(doctorId);

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found.' });
    }

    doctor.isApproved = false;
    doctor.rejectionReason = reason || 'Credentials could not be verified.';
    await doctor.save();

    res.json({ message: 'Doctor application rejected and review noted successfully!', doctor });
  } catch (err) {
    res.status(500).json({ message: 'Error rejecting doctor.', error: err.message });
  }
};

// 4. Update global settings (Commission percentage, app name, etc.)
exports.updateSettings = async (req, res) => {
  try {
    const { commissionPercentage, appName } = req.body;
    let setting = await Setting.findOne();

    if (!setting) {
      setting = await Setting.create({ commissionPercentage, appName });
    } else {
      if (commissionPercentage !== undefined) setting.commissionPercentage = commissionPercentage;
      if (appName) setting.appName = appName;
      await setting.save();
    }

    res.json({ message: 'Settings updated successfully!', setting });
  } catch (err) {
    res.status(500).json({ message: 'Error updating settings.', error: err.message });
  }
};

// 5. Get global settings
exports.getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({ commissionPercentage: 10.0, appName: 'MedQueue Pro' });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching settings.', error: err.message });
  }
};

// 6. Get all registered users (patients & doctors)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'phone', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users.', error: err.message });
  }
};

// 7. Get all appointments with patient and doctor details
exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: DoctorProfile,
          include: [
            {
              model: User,
              attributes: ['id', 'name', 'email', 'phone']
            }
          ]
        },
        {
          model: DoctorSlot,
          attributes: ['id', 'date', 'startTime', 'endTime']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching appointments.', error: err.message });
  }
};

// 8. Get complete Admin Dashboard summary stats & recent items (100% Live DB Queries)
exports.getDashboardStats = async (req, res) => {
  try {
    // Total users excluding admin
    const totalUsersCount = await User.count({ where: { role: { [Op.ne]: 'admin' } } });
    
    // Total patients specifically (role is 'user' in PostgreSQL ENUM)
    const totalPatientsCount = await User.count({ where: { role: 'user' } });

    // Total doctors registered in DoctorProfile
    const totalDoctorsCount = await DoctorProfile.count();

    // Active / approved doctors
    const activeDoctorsCount = await DoctorProfile.count({ where: { isApproved: true } });
    
    // Pending doctor approvals
    const pendingApprovalsCount = await DoctorProfile.count({ 
      where: { 
        isApproved: false,
        [Op.or]: [
          { rejectionReason: null },
          { rejectionReason: '' }
        ]
      } 
    });

    // Total appointments all time
    const totalAppointmentsCount = await Appointment.count();

    // Today's date string YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    // Today's appointments (joined with DoctorSlot date)
    const todayAppointmentsCount = await Appointment.count({
      include: [
        {
          model: DoctorSlot,
          where: { date: todayStr },
          required: true
        }
      ]
    });

    // This week appointments
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeekAppointmentsCount = await Appointment.count({
      where: {
        createdAt: {
          [Op.gte]: oneWeekAgo
        }
      }
    });

    // Current month revenue & commission
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthAppointments = await Appointment.findAll({
      where: {
        createdAt: {
          [Op.gte]: startOfMonth
        }
      },
      attributes: ['totalAmount', 'adminCommission', 'consultationFee']
    });

    let monthRevenue = 0;
    let monthCommission = 0;
    monthAppointments.forEach(app => {
      monthRevenue += parseFloat(app.totalAmount || 0);
      monthCommission += parseFloat(app.adminCommission || 0);
    });

    // If month revenue is 0, also compute all-time revenue as helpful fallback
    let allTimeRevenue = monthRevenue;
    if (monthRevenue === 0) {
      const allApps = await Appointment.findAll({
        attributes: ['totalAmount', 'adminCommission']
      });
      allApps.forEach(app => {
        allTimeRevenue += parseFloat(app.totalAmount || 0);
      });
    }

    // Commission percentage
    let setting = await Setting.findOne();
    const commissionPercentage = setting ? parseFloat(setting.commissionPercentage) : 10;

    // Recent 5 appointments
    const recentAppointments = await Appointment.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'email']
        },
        {
          model: DoctorProfile,
          include: [
            {
              model: User,
              attributes: ['name']
            }
          ]
        },
        {
          model: DoctorSlot,
          attributes: ['date', 'startTime', 'endTime']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // Recent 5 users
    const recentUsers = await User.findAll({
      where: { role: { [Op.ne]: 'admin' } },
      attributes: ['id', 'name', 'email', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.json({
      stats: {
        totalUsers: totalUsersCount,
        totalPatients: totalPatientsCount,
        totalDoctors: totalDoctorsCount,
        activeDoctors: activeDoctorsCount,
        totalAppointments: totalAppointmentsCount,
        todayAppointments: todayAppointmentsCount,
        monthRevenue: monthRevenue > 0 ? monthRevenue : allTimeRevenue,
        pendingApprovals: pendingApprovalsCount,
        thisWeekAppointments: thisWeekAppointmentsCount,
        monthCommission,
        commissionPercentage
      },
      recentAppointments,
      recentUsers
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Error fetching dashboard stats.', error: err.message });
  }
};
