const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, DoctorProfile } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_medqueue_2026';

// Register User or Doctor
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone, specialization, experienceYears, consultationFee, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      phone,
    });

    // If role is doctor, create doctor profile
    if (role === 'doctor') {
      const certFile = req.file || (req.files && req.files.find(f => f.fieldname === 'certificate' || f.fieldname === 'medicalCertificate')) || (req.files && req.files[0]);
      if (!certFile) {
        return res.status(400).json({ message: 'Doctor certificate is required.' });
      }

      await DoctorProfile.create({
        userId: user.id,
        specialization,
        experienceYears: experienceYears || 1,
        consultationFee: consultationFee || 50,
        certificateUrl: certFile.path,
        bio: bio || '',
        isApproved: false,
      });
    }

    res.status(201).json({ message: 'Registration successful!', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Verify doctor approval status if logging in as a doctor
    let doctorProfile = null;
    if (user.role === 'doctor') {
      doctorProfile = await DoctorProfile.findOne({ where: { userId: user.id } });
      if (doctorProfile) {
        // If the profile has been rejected by admin
        if (!doctorProfile.isApproved && doctorProfile.rejectionReason) {
          return res.status(403).json({
            message: `Doctor application rejected: ${doctorProfile.rejectionReason}`,
            isRejected: true,
            rejectionReason: doctorProfile.rejectionReason,
            doctorName: user.name,
          });
        }

        // If the profile is still pending admin review
        if (!doctorProfile.isApproved) {
          return res.status(403).json({
            message: 'Your doctor profile is still pending administrative verification.',
            isPending: true,
            doctorName: user.name,
          });
        }
      }
    }

    // Generate JWT Token
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      doctorProfile: doctorProfile || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
};

// Get current user and profile status
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'role', 'phone'],
      include: [{ model: DoctorProfile }],
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const doctorProfile = user.DoctorProfile;
    if (user.role === 'doctor' && doctorProfile) {
      if (!doctorProfile.isApproved && doctorProfile.rejectionReason) {
        return res.status(403).json({
          message: `Doctor application rejected: ${doctorProfile.rejectionReason}`,
          isRejected: true,
          rejectionReason: doctorProfile.rejectionReason,
          doctorName: user.name,
        });
      }
      if (!doctorProfile.isApproved) {
        return res.status(403).json({
          message: 'Your doctor profile is pending administrative verification.',
          isPending: true,
          doctorName: user.name,
        });
      }
    }

    res.json({
      user,
      doctorProfile: doctorProfile || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching profile.', error: err.message });
  }
};
