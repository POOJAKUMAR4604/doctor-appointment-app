require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('./models');

async function seedAdmin() {
  const adminEmail = process.argv[2] || 'admin@gmail.com';
  const adminPassword = process.argv[3] || 'admin123';
  const adminName = process.argv[4] || 'Admin';

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const [adminUser, created] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        phone: '9876543210'
      }
    });

    if (!created) {
      // If user exists, update password and role to admin
      adminUser.password = hashedPassword;
      adminUser.role = 'admin';
      adminUser.name = adminName;
      await adminUser.save();
      console.log(`\nSUCCESS: Existing user "${adminEmail}" updated as ADMIN!`);
    } else {
      console.log(`\nSUCCESS: New ADMIN user created successfully!`);
    }

    console.log('-----------------------------------------');
    console.log(`Email    : ${adminEmail}`);
    console.log(`Password : ${adminPassword}`);
    console.log(`Role     : admin`);
    console.log('-----------------------------------------\n');
  } catch (error) {
    console.error('Error creating/updating admin user:', error);
  } finally {
    process.exit();
  }
}

seedAdmin();
