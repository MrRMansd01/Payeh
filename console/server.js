const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();

// Sample user data (in a real app, this would be in a database)
const users = [
    {
        id: 1,
        name: 'admin',
        email: 'admin@example.com',
        // Plain password for testing only
        password: 'admin123'
    },
    {
        id: 2,
        name: 'test',
        email: 'test@example.com',
        // Plain password for testing only
        password: 'test123'
    }
];

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false, 
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// Enable session debugging
app.use((req, res, next) => {
    console.log('Session:', req.session);
    next();
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// اتصال سوپربیس از .env (امن؛ کلید در سرور می‌ماند و به کلاینت فقط برای استفاده در مرورگر داده می‌شود)
app.get('/api/supabase-config', (req, res) => {
  const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!anonKey) {
    return res.status(500).json({ error: 'SUPABASE_ANON_KEY در .env تنظیم نشده است.' });
  }
  res.json({ url, anonKey });
});

// Routes
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post('/login', (req, res) => {
    const { name, password } = req.body;
    
    // Simple validation
    if (!name || !password) {
        return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    }
    
    // For demo purposes, hardcoded credentials
    if (name === 'admin' && password === 'admin123') {
        // Regenerate session to prevent session fixation
        req.session.regenerate(function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطا در ایجاد جلسه' });
            }
            
            // Store user info in session
            req.session.user = {
                id: 1,
                name: 'admin',
                name: 'مدیر سیستم'
            };
            
            // Save the session explicitly
            req.session.save(function(err) {
                if (err) {
                    return res.status(500).json({ error: 'خطا در ذخیره جلسه' });
                }
                
                return res.json({ success: true, user: req.session.user });
            });
        });
    } else {
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'خطا در خروج از سیستم' });
        }
        
        res.redirect('/login.html');
    });
});

// Register route
app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    // Simple validation
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'تمام فیلدها الزامی هستند' });
    }
    
    try {
        // Forward registration to client-side Supabase
        // Since Supabase auth is handled client-side, we'll just return success
        // The actual registration will happen in the browser using Supabase JS client
        return res.json({ 
            success: true, 
            message: 'لطفا با استفاده از Supabase در سمت کلاینت ثبت‌نام کنید' 
        });
    } catch (error) {
        console.error('Error in registration:', error);
        return res.status(500).json({ error: 'خطا در ثبت‌نام. لطفا دوباره تلاش کنید.' });
    }
});

// Main route
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    // تغییر در این خط: کاربر به جای index.html به home.html هدایت می‌شود
    res.sendFile(path.join(__dirname, 'home.html'));
});

// API route to check authentication status
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        return res.json({ 
            authenticated: true, 
            user: req.session.user 
        });
    } else {
        return res.json({ 
            authenticated: false 
        });
    }
});

const PORT = 4001;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
