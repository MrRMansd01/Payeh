import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Footer from '../components/Footer';
import './Room.css';

// آواتار placeholder با پشتیبانی فارسی (ساخته شده در مرورگر تا یونیکد درست نمایش داده شود)
const getPlaceholderAvatar = (name) => {
  const char = (name || '?').charAt(0);
  const escaped = char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#E6A4B4"/><text x="20" y="28" font-size="20" text-anchor="middle" fill="white" font-family="Tahoma, Segoe UI, Arial, sans-serif">${escaped}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

// کامپوننت تایمر پومودورو
const PomodoroTimer = ({ onSessionComplete }) => {
  const FOCUS_TIME = 25;
  const BREAK_TIME = 5;

  const [focusDuration, setFocusDuration] = useState(FOCUS_TIME);
  const [breakDuration, setBreakDuration] = useState(BREAK_TIME);
  const [minutes, setMinutes] = useState(FOCUS_TIME);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempFocus, setTempFocus] = useState(FOCUS_TIME);
  const [tempBreak, setTempBreak] = useState(BREAK_TIME);

  useEffect(() => {
    let interval = null;
    if (isActive) {
      interval = setInterval(() => {
        if (seconds > 0) {
          setSeconds(s => s - 1);
        } else if (minutes > 0) {
          setMinutes(m => m - 1);
          setSeconds(59);
        } else {
          if (!isBreak) {
            // ارسال مدت واقعی تمرکز و امتیاز ثابت (در صورت نیاز بعداً می‌توان امتیاز را پویا کرد)
            onSessionComplete(focusDuration, 10);
          }
          const newIsBreak = !isBreak;
          setIsBreak(newIsBreak);
          setMinutes(newIsBreak ? breakDuration : focusDuration);
          setSeconds(0);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds, minutes, isBreak, onSessionComplete, focusDuration, breakDuration]);

  const totalDuration = (isBreak ? breakDuration : focusDuration) * 60;
  const timeRemaining = minutes * 60 + seconds;
  const fractionRemaining = totalDuration > 0 ? timeRemaining / totalDuration : 0;
  const dashOffset = (1 - fractionRemaining) * 283; // 0 = دایره پر، 283 = دایره خالی

  const handleOpenSettings = () => {
    if (isActive) return; // حین اجرا اجازه ویرایش نداریم
    setTempFocus(focusDuration);
    setTempBreak(breakDuration);
    setShowSettings(true);
  };

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const handleApplySettings = (e) => {
    e.preventDefault();
    // محدود کردن داخل چارچوب پومودورو (۱۵ تا ۶۰ دقیقه تمرکز، ۳ تا ۱۵ دقیقه استراحت)
    const nextFocus = clamp(Number(tempFocus) || FOCUS_TIME, 15, 60);
    const nextBreak = clamp(Number(tempBreak) || BREAK_TIME, 3, 15);

    setFocusDuration(nextFocus);
    setBreakDuration(nextBreak);

    // اگر تایمر متوقف است، از ابتدا با تنظیمات جدید شروع شود
    if (!isActive) {
      setIsBreak(false);
      setMinutes(nextFocus);
      setSeconds(0);
    }

    setShowSettings(false);
  };

  return (
    <div className="pomodoro-timer">
      <div className="timer-circle-container" onClick={handleOpenSettings}>
        <svg className="timer-svg" viewBox="0 0 100 100">
          <circle className="timer-background" cx="50" cy="50" r="45"></circle>
          <circle 
            className={`timer-progress ${isBreak ? 'break' : 'focus'}`} 
            cx="50" cy="50" r="45"
            strokeDasharray="283"
            strokeDashoffset={dashOffset}
          ></circle>
        </svg>
        <div className="timer-text">
          <div className="time-display">{`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`}</div>
          <div className="time-label">{isBreak ? 'Break' : 'Focus'}</div>
        </div>
      </div>
      <button
        onClick={() => setIsActive(!isActive)}
        className={`timer-button ${isActive ? 'is-active' : isBreak ? 'is-break' : 'is-focus'}`}
      >
        {isActive ? 'Pause' : isBreak ? 'Start Break' : 'Start Focus'}
      </button>

      {showSettings && (
        <div className="timer-settings-overlay" onClick={() => !isActive && setShowSettings(false)}>
          <div className="timer-settings-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust Pomodoro</h3>
            <p className="timer-settings-caption">
              تنظیم زمان‌ها در چارچوب تکنیک پومودورو (فقط محدوده‌های مجاز).
            </p>
            <form onSubmit={handleApplySettings} className="timer-settings-form">
              <label className="timer-settings-field">
                <span>Focus (minutes)</span>
                <input
                  type="number"
                  min="15"
                  max="60"
                  step="5"
                  value={tempFocus}
                  onChange={(e) => setTempFocus(e.target.value)}
                />
              </label>
              <label className="timer-settings-field">
                <span>Break (minutes)</span>
                <input
                  type="number"
                  min="3"
                  max="15"
                  step="1"
                  value={tempBreak}
                  onChange={(e) => setTempBreak(e.target.value)}
                />
              </label>
              <div className="timer-settings-actions">
                <button
                  type="button"
                  className="timer-settings-cancel"
                  onClick={() => setShowSettings(false)}
                >
                  لغو
                </button>
                <button type="submit" className="timer-settings-save">
                  ذخیره
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// کامپوننت اصلی صفحه
const Room = () => {
  const [leaderboard, setLeaderboard] = useState({ time: [], score: [] });
  const [stats, setStats] = useState({
    completed: 0,
    pending: 0,
    totalTime: '0m',
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get('/room/data');
      setLeaderboard(response.data.leaderboard);
      const apiStats = response.data.stats || {};
      setStats({
        completed: apiStats.completed ?? 0,
        pending: apiStats.pending ?? 0,
        totalTime: apiStats.totalTime ?? '0m',
      });
    } catch (error) {
      console.error("Error fetching room data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSessionComplete = async (duration, points) => {
    try {
      await api.post('/room/complete-session', { duration, points });
      fetchData();
    } catch (error) {
      console.error("Error completing session:", error);
    }
  };

  return (
      <div className="room-content">
        <header className="room-header">
          <h1>Pomodoro Timer</h1>
        </header>
        <div className="timer-and-stats-container">
          <PomodoroTimer onSessionComplete={handleSessionComplete} />
        </div>
        {loading ? <p>Loading stats...</p> : (
          <div className="stats-bar">
            <div className="stat-item"><span className="stat-value green">{stats.completed}</span><span className="stat-label">Completed</span></div>
            <div className="stat-divider"></div>
            <div className="stat-item"><span className="stat-value yellow">{stats.pending}</span><span className="stat-label">Pending</span></div>
            <div className="stat-divider"></div>
            <div className="stat-item"><span className="stat-value black">{stats.totalTime}</span><span className="stat-label">Total Time</span></div>
          </div>
        )}
        {loading ? <p>Loading leaderboard...</p> : (
          <div className="leaderboard-card">
            <h2>Leaderboard</h2>
            <div className="leaderboard-section">
              <h3>Time</h3>
              <div className="leaderboard-list">
                {leaderboard.time.map((user, index) => (
                  <div key={index} className="leaderboard-row">
                    <div className="user-info"><img src={user.avatarUrl?.startsWith('http') ? user.avatarUrl : getPlaceholderAvatar(user.name)} alt={user.name} className="avatar" /><span>{user.name}</span></div>
                    <span className="user-metric">{user.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="leaderboard-section">
              <h3>Score</h3>
              <div className="leaderboard-list">
                {leaderboard.score.map((user, index) => (
                  <div key={index} className="leaderboard-row">
                    <div className="user-info"><img src={user.avatarUrl?.startsWith('http') ? user.avatarUrl : getPlaceholderAvatar(user.name)} alt={user.name} className="avatar" /><span>{user.name}</span></div>
                    <span className="user-metric">{user.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      <Footer />
    </div>
  );
};

export default Room;
