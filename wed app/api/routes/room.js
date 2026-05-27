const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { authMiddleware } = require('./auth');

// آواتار placeholder با پشتیبانی فارسی/یونیکد (SVG با UTF-8)
const placeholderAvatar = (username) => {
    const raw = (username || '?').charAt(0);
    const char = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // فونت‌های دارای حروف فارسی/عربی: Tahoma, Segoe UI, Arial
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#E6A4B4"/><text x="20" y="28" font-size="20" text-anchor="middle" fill="white" font-family="Tahoma, Segoe UI, Arial, sans-serif">${char}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

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

// تبدیل Date به استرینگ YYYY-MM-DD (UTC)
const toYYYYMMDD = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// @route   GET /api/room/data
// @desc    دریافت اطلاعات جدول امتیازات با محاسبه پویا (فقط دانش‌آموزان همان مدرسه)
// @access  Private
router.get('/data', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // ۱. پروفایل کاربر فعلی برای تشخیص مدرسه (manager_id)
        const { data: currentProfile, error: currentProfileError } = await supabase
            .from('profiles')
            .select('id, manager_id')
            .eq('id', userId)
            .single();

        if (currentProfileError || !currentProfile) {
            return res.status(403).json({ error: 'Profile not found' });
        }

        // مدرسه = همان manager_id؛ اگر کاربر خودش مدیر است، manager_id خودش
        const schoolManagerId = currentProfile.manager_id || currentProfile.id;

        // ۲. فقط پروفایل‌های دانش‌آموزان همین مدرسه (role=student و manager_id همان مدرسه)
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('manager_id', schoolManagerId)
            .eq('role', 'student');

        if (profilesError) throw profilesError;

        const schoolUserIds = (profiles || []).map(p => p.id);
        if (schoolUserIds.length === 0) {
            return res.json({
                leaderboard: { time: [], score: [] },
                stats: { completed: 0, pending: 0, totalTime: '0m' }
            });
        }

        // ۳. فقط تسک‌های تکمیل‌شدهٔ کاربران همین مدرسه
        const { data: completedTasks, error: tasksError } = await supabase
            .from('tasks')
            .select('user_id, time_start, time_end, color')
            .eq('is_completed', true)
            .in('user_id', schoolUserIds);

        if (tasksError) throw tasksError;

        // ۴. محاسبه مجموع زمان و امتیاز برای هر کاربر (فقط همین مدرسه)
        const userStats = {};
        for (const task of completedTasks || []) {
            if (!userStats[task.user_id]) {
                userStats[task.user_id] = { totalTime: 0, totalScore: 0 };
            }
            userStats[task.user_id].totalTime += calculateDurationInMinutes(task.time_start, task.time_end);
            userStats[task.user_id].totalScore += (Number(task.color) || 0) * 10; // امتیاز بر اساس رنگ
        }

        // ۵. ادغام اطلاعات (فقط پروفایل‌های همین مدرسه)
        const combinedData = profiles.map(profile => ({
            ...profile,
            total_time_minutes: userStats[profile.id]?.totalTime || 0,
            score: userStats[profile.id]?.totalScore || 0,
        }));

        // ۶. ساخت جدول امتیازات (لیدربورد فقط دانش‌آموزان همین مدرسه — همه، بدون محدودیت تعداد)
        const timeLeaderboard = [...combinedData]
            .sort((a, b) => b.total_time_minutes - a.total_time_minutes)
            .map(p => ({
                name: p.username,
                value: formatMinutes(p.total_time_minutes),
                avatarUrl: p.avatar_url || placeholderAvatar(p.username)
            }));

        const scoreLeaderboard = [...combinedData]
            .sort((a, b) => b.score - a.score)
            .map(p => ({
                name: p.username,
                value: `${p.score} pts`,
                avatarUrl: p.avatar_url || placeholderAvatar(p.username)
            }));

        // ۷. آمار ۳۰ روز گذشته برای همان کاربر فعلی (نوار بالا)
        const now = new Date();
        const thirtyDaysAgo = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - 30
        ));

        const last30StartStr = toYYYYMMDD(thirtyDaysAgo);
        const todayStr = toYYYYMMDD(now);

        const { data: myRecentTasks, error: myRecentTasksError } = await supabase
            .from('tasks')
            .select('is_completed, date, time_start, time_end')
            .eq('user_id', userId)
            .gte('date', last30StartStr)
            .lte('date', todayStr);

        if (myRecentTasksError) throw myRecentTasksError;

        let completedCount = 0;
        let pendingCount = 0;
        let totalMinutes = 0;

        const accumulateStats = (tasks) => {
            for (const task of tasks || []) {
                if (task.is_completed) {
                    completedCount += 1;
                    totalMinutes += calculateDurationInMinutes(task.time_start, task.time_end);
                } else {
                    pendingCount += 1;
                }
            }
        };

        accumulateStats(myRecentTasks);

        // اگر در ۳۰ روز گذشته هیچ داده‌ای نبود، همه‌ی تسک‌ها را مبنا قرار بده
        if (completedCount === 0 && pendingCount === 0) {
            const { data: myAllTasks, error: myAllTasksError } = await supabase
                .from('tasks')
                .select('is_completed, date, time_start, time_end')
                .eq('user_id', userId);

            if (myAllTasksError) throw myAllTasksError;

            accumulateStats(myAllTasks);
        }

        res.json({
            leaderboard: { time: timeLeaderboard, score: scoreLeaderboard },
            stats: {
                completed: completedCount,
                pending: pendingCount,
                totalTime: formatMinutes(totalMinutes)
            }
        });

    } catch (error) {
        console.error("Error fetching dynamic room data:", error);
        res.status(500).json({ error: 'Failed to fetch room data' });
    }
});

module.exports = router;