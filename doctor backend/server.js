const express = require('express');
const cors = require('cors');

require('dotenv').config();

const { sequelize } = require('./models');
const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { startNotificationScheduler } = require('./services/reminderScheduler');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/notifications', notificationRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Doctor Appointment API is running successfully!' });
});

const PORT = process.env.PORT || 5000;

// Connect Database & Start Server
sequelize.authenticate()
  .then(() => {
    console.log('PostgreSQL Database connected successfully.');
    // sync({ alter: true }) updates table structures if models change
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      // Start background cron scheduler for 1-day, 1-hour, and 15-minute reminders
      startNotificationScheduler();
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });