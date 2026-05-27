import React, { useState, useEffect } from 'react';
import api from '../api';
import { useSwipeable } from 'react-swipeable';
import Footer from '../components/Footer';
import './Home.css';

const toYYYYMMDD = (date) => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const formatDatePersian = (date, options = {}) => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fa-IR', { calendar: 'persian', ...options });
};

const formatShortJalaliYYMMDD = (date) => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const s = date.toLocaleDateString('fa-IR', {
    calendar: 'persian',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
  return s.replace(/\//g, ':');
};

// --- کامپوننت پاپ‌آپ با قابلیت بازخورد ---
const CompletionPopup = ({ task, onClose, onSubmitFeedback }) => {
  const [feedback, setFeedback] = useState('');
  if (!task) return null;

  const getPoints = (color) => {
    switch (color) {
      case '1': return 10;
      case '2': return 20;
      case '3': return 30;
      default: return 0;
    }
  };

  const handleSubmit = () => {
    onSubmitFeedback(task.id, feedback);
    onClose();
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()}>
        <h3>Task Completed!</h3>
        <p className="task-title">{task.title}</p>
        <p className="task-points">+{getPoints(task.color)} Points</p>
        
        <div className="feedback-form">
          <label htmlFor="feedback-text">How was this task?</label>
          <textarea
            id="feedback-text"
            placeholder="Share your thoughts..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          ></textarea>
        </div>

        <button onClick={handleSubmit} className="popup-submit-btn">
          Submit Feedback
        </button>
      </div>
    </div>
  );
};


const TodoItem = ({ task, onComplete }) => {
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);

  const handlers = useSwipeable({
    onSwiping: (e) => setSwipeDeltaX(e.deltaX),
    onSwipedRight: () => {
      setSwipeDeltaX(0);
      if (!task.is_completed) {
        onComplete(task);
      }
    },
    onSwipedLeft: () => {
      // در صفحه Home فعلاً فقط تکمیل تسک داریم، پس روی سوییپ به چپ فقط کارت را برمی‌گردانیم
      setSwipeDeltaX(0);
    },
    onSwiped: () => setSwipeDeltaX(0),
    trackMouse: true,
    preventDefaultTouchmoveEvent: true,
  });

  const formatTaskDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  const getTaskColor = (color) => {
    switch (color) {
      case '1': return '#2BBA90'; // Green
      case '2': return '#ECB800'; // Yellow
      case '3': return '#EC0000'; // Red
      default: return '#888';
    }
  };

  return (
    <div {...handlers} className="todo-item-wrapper">
      <div className="swipe-background">
        <span>✓ Completed</span>
      </div>
      <div
        className={`todo-item-card ${task.is_completed ? 'completed' : ''}`}
        style={{
          transform: `translateX(${swipeDeltaX}px)`,
          transition: swipeDeltaX === 0 ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' : 'none',
        }}
      >
        <div className="task-color-indicator" style={{ backgroundColor: getTaskColor(task.color) }}></div>
        <div className="task-details">
          <p className="task-title">{task.title}</p>
          <div className="task-meta">
            <span className="task-date">{formatTaskDate(task.date)}</span>
            <p className="task-time">{task.time_start}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedTask, setCompletedTask] = useState(null);
  const [today] = useState(() => new Date());

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await api.get('/tasks', {
          params: { date: toYYYYMMDD(today) },
        });
        setTasks(response.data);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const handleCompleteTask = async (taskToComplete) => {
    const originalTasks = tasks;
    setTasks(currentTasks =>
      currentTasks.map(task =>
        task.id === taskToComplete.id ? { ...task, is_completed: true } : task
      )
    );

    try {
        await api.patch(`/tasks/${taskToComplete.id}/complete`);
        setCompletedTask(taskToComplete);
    } catch (error) {
        console.error("Error completing task:", error);
        setTasks(originalTasks);
        alert("Failed to update task.");
    }
  };

  const handleSubmitFeedback = async (taskId, feedback) => {
    if (!feedback.trim()) return;

    try {
      await api.post(`/tasks/${taskId}/feedback`, { feedback });
      alert("Feedback submitted successfully!");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Failed to submit feedback.");
    }
  };

  return (
    <div className="page-container">
      <div className="home-layout">
        <div className="home-main-content">
          <div className="todo-list-card">
            <header className="todo-header"><h1>To-Do</h1></header>
            <div className="todo-list">
              {loading ? (
                <p className="loading-message">Loading tasks...</p>
              ) : tasks.length > 0 ? (
                tasks.map(task =>
                  <TodoItem key={task.id} task={task} onComplete={handleCompleteTask} />
                )
              ) : (
                <p className="empty-message">No tasks found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
      <CompletionPopup 
        task={completedTask} 
        onClose={() => setCompletedTask(null)}
        onSubmitFeedback={handleSubmitFeedback}
      />
    </div>
  );
};

export default Home;