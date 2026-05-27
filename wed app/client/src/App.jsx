import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// وارد کردن تمام کامپوننت‌های صفحات
import Join from './pages/Join';
import Registration from './pages/Registration';
import Home from './pages/Home';
import Room from './pages/Room';
import Calendar from './pages/Calendar';
import ChatHome from './pages/ChatHome';
import ChatRoom from './pages/ChatRoom';
import Accent from './pages/Accent';
import MyAccount from './pages/MyAccount';
import SavedBeneficiary from './pages/SavedBeneficiary';
import AboutApp from './pages/AboutApp';

// وارد کردن استایل‌های عمومی برنامه
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // بررسی وضعیت سشن فعلی
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // گوش دادن به تغییرات وضعیت احراز هویت
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    // می‌توانید یک اسپینر لودینگ زیبا اینجا قرار دهید
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* مسیرهای عمومی */}
          <Route path="/join" element={!session ? <Join /> : <Navigate to="/home" />} />
          <Route path="/register" element={!session ? <Registration /> : <Navigate to="/home" />} />

          {/* مسیرهای خصوصی که نیاز به لاگین دارند */}
          <Route path="/home" element={session ? <Home /> : <Navigate to="/join" />} />
          <Route path="/room" element={session ? <Room /> : <Navigate to="/join" />} />
          <Route path="/calendar" element={session ? <Calendar /> : <Navigate to="/join" />} />
          <Route path="/chat" element={session ? <ChatHome /> : <Navigate to="/join" />} />
          <Route path="/chat/:channelId" element={session ? <ChatRoom /> : <Navigate to="/join" />} />
          <Route path="/accent" element={session ? <Accent /> : <Navigate to="/join" />} />
          <Route path="/my-account" element={session ? <MyAccount /> : <Navigate to="/join" />} />
          <Route path="/saved-beneficiary" element={session ? <SavedBeneficiary /> : <Navigate to="/join" />} />
          <Route path="/about-app" element={session ? <AboutApp /> : <Navigate to="/join" />} />
          
          {/* مسیر پیش‌فرض */}
          <Route path="/" element={<Navigate to={session ? "/home" : "/join"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;