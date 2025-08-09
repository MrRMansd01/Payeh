import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useSwipeable } from 'react-swipeable';
import Footer from '../components/Footer';
import './Home.css';

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
  const handlers = useSwipeable({
    onSwipedRight: () => {
      if (!task.is_completed) {
        onComplete(task);
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
  const [completedTask, setCompletedTask] = useState(null);
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

  const handleCompleteTask = async (taskToComplete) => {
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
        setCompletedTask(taskToComplete);
    } catch (error) {
        console.error("Error completing task:", error);
        setTasks(originalTasks);
        alert("Failed to update task.");
    }
  };

  const handleSubmitFeedback = async (taskId, feedback) => {
    const token = getAuthToken();
    if (!token || !feedback.trim()) return;

    try {
      await api.post(`/tasks/${taskId}/feedback`, 
        { feedback },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
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