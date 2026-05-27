import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { useSwipeable } from 'react-swipeable';
import Footer from '../components/Footer';
import './Calendar.css';

// --- کامپوننت جدید برای پاپ‌آپ ---
const CompletionPopup = ({ task, onClose }) => {
  if (!task) return null;

  // تابعی برای محاسبه امتیاز بر اساس سختی (رنگ)
  const getPoints = (color) => {
    switch (color) {
      case '1': return 10;
      case '2': return 20;
      case '3': return 30;
      default: return 0;
    }
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()}>
        <h3>تسک انجام شد!</h3>
        <p className="task-title">{task.title}</p>
        <p className="task-time">زمان: {task.time_start || '—'}</p>
        <p className="task-points">+{getPoints(task.color)} امتیاز</p>
        <button onClick={onClose} className="popup-close-btn">
          عالی!
        </button>
      </div>
    </div>
  );
};


// توابع کمکی — تقویم شمسی (ایرانی)
const addDays = (date, days) => { const r = new Date(date); r.setDate(r.getDate() + days); return r; };
// تاریخ میلادی به فرمت YYYY-MM-DD (بر اساس زمان محلی، نه UTC)
const toYYYYMMDD = (date) => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
const getTaskPoints = (color) => ({ '1': 10, '2': 20, '3': 30 }[color] || 0);

// فرمت تاریخ به شمسی (fa-IR با تقویم persian)
const faOpt = (opts) => ({ locale: 'fa-IR', calendar: 'persian', ...opts });
const isValidDate = (d) => d && d instanceof Date && !Number.isNaN(d.getTime());
const formatDatePersian = (date, options = {}) =>
  isValidDate(date) ? date.toLocaleDateString('fa-IR', faOpt(options)) : '—';
// شروع هفته از شنبه
const getWeekStartOffset = (date) => (date.getDay() + 1) % 7;

// نمایش تاریخ شمسی به صورت «سال نام‌ماه روز»
const formatPersianYMD = (date) => {
  if (!isValidDate(date)) return '—';
  const [jy, jm, jd] = gregorianToJalali(date);
  const monthIndex = Math.min(Math.max((jm || 1) - 1, 0), PERSIAN_MONTH_NAMES.length - 1);
  const monthName = PERSIAN_MONTH_NAMES[monthIndex];
  return `${jy} ${monthName} ${jd}`;
};

// تبدیل میلادی به شمسی با Intl (دقیق، با اعداد لاتین برای جلوگیری از خطا)
function gregorianToJalali(date) {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date);
    const get = (type) => {
      const value = parts.find((p) => p.type === type)?.value ?? '';
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? n : NaN;
    };
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return [1403, 1, 1];
    }
    return [y, m, d];
  } catch (e) {
    return [1403, 1, 1];
  }
}
function jalaliToGregorian(jy, jm, jd) {
  // استفاده از فرمت‌کننده برای پیدا کردن اختلاف روزها
  const date = new Date(jy + 621, jm - 1, jd + 1);
  // تنظیم دقیق با استفاده از متد بازگشتی (یک تقریب مهندسی برای وب)
  for (let i = 0; i < 5; i++) {
    const [y, m, d] = gregorianToJalali(date);
    const diff = (jy - y) * 372 + (jm - m) * 31 + (jd - d);
    if (diff === 0) break;
    date.setDate(date.getDate() + diff);
  }
  return date;
}

// به‌دست‌آوردن تعداد روزهای یک ماه شمسی به‌صورت پایدار (بدون استفاده از روز ۰)
function getJalaliMonthLength(jy, jm) {
  // حداکثر ۳۱ روز؛ از ۳۱ به پایین تست می‌کنیم تا به آخرین روز معتبر برسیم
  for (let probe = 31; probe >= 28; probe--) {
    const g = jalaliToGregorian(jy, jm, probe);
    const [, m, d] = gregorianToJalali(g);
    if (m === jm) return d;
  }
  // حالت پشتیبان؛ نباید برسیم اینجا ولی برای اطمینان
  return 29;
}
const PERSIAN_MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const PERSIAN_WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// پاپ‌اور تقویم شمسی برای انتخاب تاریخ
const PersianCalendarPicker = ({ selectedDate, onSelect, onClose }) => {
  const today = new Date();
  const d = isValidDate(selectedDate) ? selectedDate : today;

  // استخراج سال و ماه فعلی از روی تاریخ انتخاب شده
  const [jy, jm] = gregorianToJalali(d);

  // وضعیت نمایش ماه و سال در پاپ‌آپ (ممکن است کاربر ماه را جابجا کند)
  const [[viewJy, viewJm], setView] = useState([jy, jm]);

  // ۱. محاسبه اولین روز ماه برای پیدا کردن نقطه شروع در جدول
  const firstDayOfMonth = jalaliToGregorian(viewJy, viewJm, 1);
  const startWeekday = isValidDate(firstDayOfMonth)
    ? (firstDayOfMonth.getDay() + 1) % 7
    : 0;

  // ۲. محاسبه تعداد روزهای ماه (بدون استفاده از روز ۰؛ پایدار برای مهر تا اسفند)
  const daysInMonth = getJalaliMonthLength(viewJy, viewJm);

  const prevMonth = () => {
    if (viewJm === 1) setView([viewJy - 1, 12]);
    else setView([viewJy, viewJm - 1]);
  };

  const nextMonth = () => {
    if (viewJm === 12) setView([viewJy + 1, 1]);
    else setView([viewJy, viewJm + 1]);
  };

  const cells = [];
  // پر کردن فضاهای خالی اول ماه (مثلاً اگر ماه از دوشنبه شروع شود)
  for (let i = 0; i < startWeekday; i++) cells.push({ empty: true });

  // ایجاد دکمه‌های روزهای ماه
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = jalaliToGregorian(viewJy, viewJm, day);
    cells.push({ empty: false, jd: day, date: cellDate });
  }

  const selectedStr = toYYYYMMDD(d);

  return createPortal(
    <>
      <div className="persian-picker-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="persian-picker-popover">
        <div className="persian-picker-header">
          <button type="button" className="persian-picker-nav" onClick={prevMonth}>
            ‹
          </button>
          <span className="persian-picker-title">
            {PERSIAN_MONTH_NAMES[viewJm - 1]} {viewJy}
          </span>
          <button type="button" className="persian-picker-nav" onClick={nextMonth}>
            ›
          </button>
        </div>
        <div className="persian-picker-weekdays">
          {PERSIAN_WEEKDAY_SHORT.map((w, i) => (
            <span key={i} className="persian-picker-weekday">
              {w}
            </span>
          ))}
        </div>
        <div className="persian-picker-grid">
          {cells.map((cell, i) =>
            cell.empty ? (
              <span key={i} className="persian-picker-day empty" />
            ) : (
              <button
                key={i}
                type="button"
                className={`persian-picker-day ${
                  toYYYYMMDD(cell.date) === selectedStr ? 'active' : ''
                }`}
                onClick={() => {
                  onSelect(cell.date);
                  onClose();
                }}
              >
                {cell.jd}
              </button>
            )
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

// مودال اقدام تسک (نمای وسط صفحه مثل پاپ‌آپ «تسک انجام شد»؛ توضیحات قابل ویرایش)
const TaskActionModal = ({ task, onClose, onDelete, onIncomplete, onUpdateTask }) => {
  const [description, setDescription] = useState(task?.description ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) setDescription(task.description ?? '');
  }, [task]);

  if (!task) return null;
  const points = getTaskPoints(task.color);
  const timeLabel = task.time_end ? `${task.time_start} – ${task.time_end}` : (task.time_start || '—');

  const handleSaveDescription = async () => {
    if (description === (task.description ?? '')) return;
    setSaving(true);
    try {
      await onUpdateTask(task.id, { description });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete(task.id);
    onClose();
  };
  const handleIncomplete = () => {
    onIncomplete(task);
    onClose();
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card task-action-popup-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header task-action-popup-header">
          <h2 className="task-action-popup-title">{task.title}</h2>
          <button type="button" className="close-button" onClick={onClose}>×</button>
        </header>
        <div className="task-action-modal-body">
          <div className="task-action-row">
            <span className="task-action-label">امتیاز</span>
            <span className="task-action-value task-action-points">{points} امتیاز</span>
          </div>
          <div className="task-action-row">
            <span className="task-action-label">زمان</span>
            <span className="task-action-value">{timeLabel}</span>
          </div>
          <div className="task-action-row task-action-description">
            <span className="task-action-label">توضیحات</span>
            <textarea
              className="task-action-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات تسک..."
              rows={3}
            />
            {saving && <span className="task-action-saving">در حال ذخیره...</span>}
          </div>
        </div>
        <div className="task-action-modal-actions">
          <button type="button" onClick={handleSaveDescription} disabled={saving} className="task-action-btn task-action-submit">
            ثبت
          </button>
          <button type="button" onClick={handleDelete} className="task-action-btn task-action-delete">
            پاک کردن
          </button>
          {task.is_completed && (
            <button type="button" onClick={handleIncomplete} className="task-action-btn task-action-incomplete">
              کامل نکرد
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// کامپوننت مودال افزودن تسک (بدون تغییر)
const AddTaskModal = ({ onClose, onAddTask, selectedDate }) => {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title) return alert("Please enter a title.");
    onAddTask({
      title,
      time_start: startTime || 'Any Time',
      time_end: endTime || null,
      color: selectedCategory.toString(),
      date: toYYYYMMDD(selectedDate),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>تسک جدید برای {formatDatePersian(selectedDate, { month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </header>
        <form onSubmit={handleSubmit} className="add-task-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter task title"/>
          </div>
          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="start-time">Start time</label>
              <input type="time" id="start-time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="end-time">End time</label>
              <input type="time" id="end-time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Category</label>
            <div className="category-selector">
              <button type="button" className={`cat-btn cat-1 ${selectedCategory === 1 ? 'active' : ''}`} onClick={() => setSelectedCategory(1)}>score 1</button>
              <button type="button" className={`cat-btn cat-2 ${selectedCategory === 2 ? 'active' : ''}`} onClick={() => setSelectedCategory(2)}>score 2</button>
              <button type="button" className={`cat-btn cat-3 ${selectedCategory === 3 ? 'active' : ''}`} onClick={() => setSelectedCategory(3)}>score 3</button>
            </div>
          </div>
          <button type="submit" className="create-task-button">Create New Task</button>
        </form>
      </div>
    </div>
  );
};

// کامپوننت آیتم تسک با کشیدن واکنشی (کارت با انگشت حرکت می‌کند)
const CalendarTaskItem = ({ task, onComplete, onDelete, onOpenTaskModal }) => {
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);

  const resetSwipe = useCallback(() => {
    requestAnimationFrame(() => setSwipeDeltaX(0));
  }, []);

  const handlers = useSwipeable({
    onSwiping: (e) => setSwipeDeltaX(e.deltaX),
    onSwipedRight: () => {
      resetSwipe();
      if (!task.is_completed) onComplete(task);
    },
    onSwipedLeft: () => {
      resetSwipe();
      onOpenTaskModal(task);
    },
    onSwiped: resetSwipe,
    trackMouse: true,
    preventDefaultTouchmoveEvent: true,
  });
  const getTaskColor = (color) => ({'1': '#2BBA90', '2': '#ECB800', '3': '#EC0000'}[color] || '#2BBA90');

  const timeLabel = task.time_end
    ? `${task.time_start} – ${task.time_end}`
    : task.time_start;

  return (
    <div {...handlers} className="calendar-task-item-wrapper">
      <div className="swipe-action-background complete">✓ Complete</div>
      <div className="swipe-action-background info">ℹ اطلاعات</div>
      <div
        className={`calendar-task-item ${task.is_completed ? 'completed' : ''}`}
        style={{
          transform: `translateX(${swipeDeltaX}px)`,
          transition: swipeDeltaX === 0 ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' : 'none',
        }}
      >
        <div className="task-color-indicator" style={{backgroundColor: getTaskColor(task.color)}}></div>
        <div className="task-item-details">
          <p className="task-item-title">{task.title}</p>
          <p className="task-item-time">{timeLabel}</p>
        </div>
      </div>
    </div>
  );
};

// کامپوننت اصلی صفحه تقویم
const Calendar = () => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [taskForActionModal, setTaskForActionModal] = useState(null);
    const [completedTask, setCompletedTask] = useState(null);
    const [showPersianPicker, setShowPersianPicker] = useState(false);
    const dateInputRef = useRef(null);

    const fetchTasksByDate = useCallback(async (date) => {
        const dateStr = toYYYYMMDD(date);
        try {
            const response = await api.get(`/tasks`, {
                params: { date: dateStr }
            });
            setTasks(response.data);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    }, []);

    useEffect(() => {
        fetchTasksByDate(selectedDate);
    }, [selectedDate, fetchTasksByDate]);

    const handleAddTask = async (newTaskData) => {
        try {
            const response = await api.post('/tasks', newTaskData);
            setTasks(prevTasks => [...prevTasks, response.data]);
        } catch (error) {
            console.error("Error adding task:", error);
            alert("Failed to add task.");
        }
    };

    const handleCompleteTask = async (taskToComplete) => {
        try {
            const response = await api.patch(`/tasks/${taskToComplete.id}/complete`, {});
            setTasks(tasks.map(t => t.id === taskToComplete.id ? response.data : t));
            setCompletedTask(taskToComplete);
        } catch (error) {
            console.error("Error completing task:", error);
        }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await api.delete(`/tasks/${taskId}`);
            setTasks(tasks.filter(t => t.id !== taskId));
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    };

    const handleIncompleteTask = async (taskToIncomplete) => {
        try {
            const response = await api.patch(`/tasks/${taskToIncomplete.id}/incomplete`, {});
            setTasks(prev => prev.map(t => t.id === taskToIncomplete.id ? response.data : t));
        } catch (error) {
            console.error("Error marking task incomplete:", error);
        }
    };

    const handleUpdateTask = async (taskId, payload) => {
        try {
            const response = await api.patch(`/tasks/${taskId}`, payload);
            setTasks(prev => prev.map(t => t.id === taskId ? response.data : t));
        } catch (error) {
            console.error("Error updating task:", error);
        }
    };

    const weekStart = addDays(selectedDate, -getWeekStartOffset(selectedDate));
    const week = Array.from({ length: 7 }).map((_, i) => {
        const fullDate = addDays(weekStart, i);
        return {
            dayName: formatDatePersian(fullDate, { weekday: 'short' }),
            dayNumber: formatDatePersian(fullDate, { day: 'numeric' }),
            fullDate,
        };
    });

    return (
            <div className="calendar-content">
                <header className="calendar-header">
                    <div>
                        <p>{formatDatePersian(selectedDate, { weekday: 'long' })}</p>
                        <h3>{formatPersianYMD(selectedDate)}</h3>
                    </div>
                    <button
                        type="button"
                        ref={dateInputRef}
                        className="calendar-icon-button"
                        onClick={() => setShowPersianPicker((v) => !v)}
                        aria-label="انتخاب تاریخ"
                    >
                        🗓️
                    </button>
                </header>
                {showPersianPicker && (
                    <PersianCalendarPicker
                        selectedDate={selectedDate}
                        onSelect={setSelectedDate}
                        onClose={() => setShowPersianPicker(false)}
                        anchorRef={dateInputRef}
                    />
                )}
                <div className="week-view-container">
                    {week.map((day, index) => (
                        <div key={index} className={`day-item ${toYYYYMMDD(day.fullDate) === toYYYYMMDD(selectedDate) ? 'active' : ''}`} onClick={() => setSelectedDate(day.fullDate)}>
                            <span className="day-name">{day.dayName}</span>
                            <span className="day-number">{day.dayNumber}</span>
                        </div>
                    ))}
                </div>
                <div className="calendar-task-list-container">
                    <div className="task-list-scrollable">
                        {tasks.length > 0 ? tasks.map(task => (
                            <CalendarTaskItem key={task.id} task={task} onComplete={handleCompleteTask} onDelete={handleDeleteTask} onOpenTaskModal={setTaskForActionModal} />
                         )) : <p className="empty-message">برای این روز تسکی نیست.</p>}
                    </div>
                </div>
            <button className="fab" onClick={() => setIsModalOpen(true)}>+</button>
            {isModalOpen && createPortal(
              <div className="calendar-modal-portal" style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
                <AddTaskModal onClose={() => setIsModalOpen(false)} onAddTask={handleAddTask} selectedDate={selectedDate} />
              </div>,
              document.body
            )}
            {taskForActionModal && createPortal(
              <div className="calendar-modal-portal" style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
                <TaskActionModal
                  task={taskForActionModal}
                  onClose={() => setTaskForActionModal(null)}
                  onDelete={handleDeleteTask}
                  onIncomplete={handleIncompleteTask}
                  onUpdateTask={handleUpdateTask}
                />
              </div>,
              document.body
            )}
            <Footer />
            <CompletionPopup task={completedTask} onClose={() => setCompletedTask(null)} />
        </div>
    );
};

export default Calendar;