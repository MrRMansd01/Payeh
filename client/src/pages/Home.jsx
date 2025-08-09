import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useSwipeable } from 'react-swipeable';
import Footer from '../components/Footer';
import './Home.css';

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
        <h3>Task Completed!</h3>
        <p className="task-title">{task.title}</p>
        <p className="task-time">Time: {task.time_start || 'N/A'}</p>
        <p className="task-points">+{getPoints(task.color)} Points</p>
        <button onClick={onClose} className="popup-close-btn">
          Great!
        </button>
      </div>
    </div>
  );
};

const TodoItem = ({ task, onComplete }) => {
  const handlers = useSwipeable({
    onSwipedRight: () => {
      if (!task.is_completed) {
        onComplete(task); // --- ارسال کل آبجکت تسک ---
      }
    },
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
      <div className={`todo-item-card ${task.is_completed ? 'completed' : ''}`}>
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
  const [completedTask, setCompletedTask] = useState(null); // --- استیت برای پاپ‌آپ ---
  const navigate = useNavigate();

  const getAuthToken = useCallback(() => {
    const sessionDataString = localStorage.getItem('supabaseSession');
    if (!sessionDataString) {
        navigate('/join');
        return null;
    }
    return JSON.parse(sessionDataString).access_token;
  }, [navigate]);

  useEffect(() => {
    const fetchTasks = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const response = await api.get('/tasks', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setTasks(response.data);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [getAuthToken]);

  const handleCompleteTask = async (taskToComplete) => { // --- دریافت کل آبجکت تسک ---
    const token = getAuthToken();
    if (!token) return;

    const originalTasks = tasks;
    setTasks(currentTasks =>
      currentTasks.map(task =>
        task.id === taskToComplete.id ? { ...task, is_completed: true } : task
      )
    );

    try {
        await api.patch(`/tasks/${taskToComplete.id}/complete`, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // --- نمایش پاپ‌آپ پس از موفقیت ---
        setCompletedTask(taskToComplete);
    } catch (error) {
        console.error("Error completing task:", error);
        setTasks(originalTasks);
        alert("Failed to update task.");
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
      {/* --- رندر کردن پاپ‌آپ --- */}
      <CompletionPopup task={completedTask} onClose={() => setCompletedTask(null)} />
    </div>
  );
};

export default Home;