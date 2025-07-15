const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// فایل‌های مسیرها
const { router: authRoutes } = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const roomRoutes = require('./routes/room');
const profileRoutes = require('./routes/profile');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// ثبت مسیرها
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/room', roomRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);

// این خط برای اجرای محلی است و در Vercel استفاده نمی‌شود
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// این خط مهم‌ترین تغییر است: اپلیکیشن را اکسپورت کنید
module.exports = app;
