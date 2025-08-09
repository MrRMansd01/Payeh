const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authMiddleware } = require('./auth');

// تابع کمکی برای تبدیل دقایق به فرمت "ساعت و دقیقه"
const formatMinutes = (minutes) => {
    if (!minutes || minutes < 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
};

// --- تابع هوشمند برای پردازش فرمت‌های مختلف زمان ---
const parseTimeToMinutes = (timeString) => {
    if (!timeString) return 0;

    // Handle ISO 8601 format (e.g., "1899-12-30T07:34:16.000Z")
    if (timeString.includes('T')) {
        const date = new Date(timeString);
        return date.getUTCHours() * 60 + date.getUTCMinutes();
    }

    // Handle "h:mm A" format (e.g., "7:49 PM")
    const pmMatch = timeString.match(/(\d{1,2}):(\d{2})\s*PM/i);
    if (pmMatch) {
        let hours = parseInt(pmMatch[1], 10);
        if (hours !== 12) hours += 12;
        return hours * 60 + parseInt(pmMatch[2], 10);
    }

    const amMatch = timeString.match(/(\d{1,2}):(\d{2})\s*AM/i);
    if (amMatch) {
        let hours = parseInt(amMatch[1], 10);
        if (hours === 12) hours = 0; // Midnight case
        return hours * 60 + parseInt(amMatch[2], 10);
    }

    // Handle "HH:mm" format (e.g., "16:09")
    const hhmmMatch = timeString.match(/^(\d{2}):(\d{2})$/);
    if (hhmmMatch) {
        return parseInt(hhmmMatch[1], 10) * 60 + parseInt(hhmmMatch[2], 10);
    }

    console.warn("Unrecognized time format:", timeString);
    return 0; // Return 0 for unrecognized formats
};


// تابع کمکی برای محاسبه اختلاف زمان
const calculateDurationInMinutes = (timeStart, timeEnd) => {
    if (!timeStart || !timeEnd) return 0;
    const startMinutes = parseTimeToMinutes(timeStart);
    const endMinutes = parseTimeToMinutes(timeEnd);
    if (endMinutes < startMinutes) return 0;
    return endMinutes - startMinutes;
};

// @route   GET /api/room/data
// @desc    دریافت اطلاعات جدول امتیازات با محاسبه پویا
// @access  Private
router.get('/data', authMiddleware, async (req, res) => {
    try {
        // ۱. دریافت تمام تسک‌های تکمیل شده
        const { data: completedTasks, error: tasksError } = await supabase
            .from('tasks')
            .select('user_id, time_start, time_end, color')
            .eq('is_completed', true);

        if (tasksError) throw tasksError;

        // ۲. محاسبه مجموع زمان و امتیاز برای هر کاربر
        const userStats = {};
        for (const task of completedTasks) {
            if (!userStats[task.user_id]) {
                userStats[task.user_id] = { totalTime: 0, totalScore: 0 };
            }
            userStats[task.user_id].totalTime += calculateDurationInMinutes(task.time_start, task.time_end);
            userStats[task.user_id].totalScore += (Number(task.color) || 0) * 10; // امتیاز بر اساس رنگ
        }

        // ۳. دریافت تمام پروفایل‌ها
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url');

        if (profilesError) throw profilesError;

        // ۴. ادغام اطلاعات
        const combinedData = profiles.map(profile => ({
            ...profile,
            total_time_minutes: userStats[profile.id]?.totalTime || 0,
            score: userStats[profile.id]?.totalScore || 0,
        }));

        // ۵. ساخت جدول امتیازات
        const timeLeaderboard = [...combinedData]
            .sort((a, b) => b.total_time_minutes - a.total_time_minutes)
            .slice(0, 5)
            .map(p => ({
                name: p.username,
                value: formatMinutes(p.total_time_minutes),
                avatarUrl: p.avatar_url || `https://placehold.co/40x40/E6A4B4/FFFFFF?text=${p.username.charAt(0)}`
            }));

        const scoreLeaderboard = [...combinedData]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(p => ({
                name: p.username,
                value: `${p.score} pts`,
                avatarUrl: p.avatar_url || `https://placehold.co/40x40/E6A4B4/FFFFFF?text=${p.username.charAt(0)}`
            }));

        res.json({
            leaderboard: { time: timeLeaderboard, score: scoreLeaderboard },
            stats: { completed: 0, pending: 0, totalTime: '0m' } // این بخش بعدا می‌تواند کامل شود
        });

    } catch (error) {
        console.error("Error fetching dynamic room data:", error);
        res.status(500).json({ error: 'Failed to fetch room data' });
    }
});

module.exports = router;