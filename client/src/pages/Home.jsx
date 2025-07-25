import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useSwipeable } from 'react-swipeable';
import Footer from '../components/Footer';
import './Home.css';

const TodoItem = ({ task, onComplete }) => {
  const handlers = useSwipeable({
    onSwipedRight: () => {
      if (!task.is_completed) {
        onComplete(task.id);
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

  const handleCompleteTask = async (taskId) => {
    const token = getAuthToken();
    if (!token) return;

    const originalTasks = tasks;
    setTasks(currentTasks =>
      currentTasks.map(task =>
        task.id === taskId ? { ...task, is_completed: true } : task
      )
    );

    try {
        await api.patch(`/tasks/${taskId}/complete`, {}, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
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
    </div>
  );
};

export default Home;
