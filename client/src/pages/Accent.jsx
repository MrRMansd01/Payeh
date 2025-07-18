import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Footer from '../components/Footer';
import './Accent.css';

const Accent = () => {
    const navigate = useNavigate();
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    const getAuthToken = useCallback(() => {
        const sessionDataString = localStorage.getItem('supabaseSession');
        if (!sessionDataString) {
            navigate('/join');
            return null;
        }
        return JSON.parse(sessionDataString).access_token;
    }, [navigate]);

    useEffect(() => {
        const fetchProfile = async () => {
            const token = getAuthToken();
            if (!token) return;

            try {
                const response = await api.get('/profile/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setUserInfo(response.data);
            } catch (error) {
                console.error("Error fetching user profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [getAuthToken]);

    const handleLogout = async () => {
        const token = getAuthToken();
        if (!token) return;

        try {
            await api.post('/auth/logout', {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            localStorage.removeItem('supabaseSession');
            navigate('/join');
        }
    };

    if (loading) {
        return <div className="page-container"><p className="loading-text">Loading Profile...</p></div>;
    }

    return (
        <div className="page-container">
            <div className="content-wrap">
                <header className="accent-header">
                    <h1>Profile</h1>
                </header>
                {userInfo ? (
                    <div className="profile-card">
                        <img src={userInfo.avatar_url || 'https://placehold.co/60x60/E6A4B4/FFFFFF?text=A'} alt="avatar" className="profile-avatar" />
                        <div className="profile-info">
                            <p className="profile-name">{userInfo.name || userInfo.username}</p>
                            <p className="profile-email">{userInfo.email}</p>
                        </div>
                        <button onClick={() => navigate('/my-account')} className="edit-button">Edit</button>
                    </div>
                ) : (
                    <p>Could not load profile information.</p>
                )}

                <div className="options-section">
                    <div className="option-item" onClick={() => navigate('/my-account')}><span>My Account</span><span>{'>'}</span></div>
                    <div className="option-item" onClick={() => navigate('/saved-beneficiary')}><span>Gems and Point</span><span>{'>'}</span></div>
                    <div className="option-item"><span>Notifications</span><input type="checkbox" className="toggle-switch"/></div>
                    <div className="option-item red" onClick={handleLogout}>
                        <span>Logout</span>
                        <span>{'>'}</span>
                    </div>
                </div>
                 <div className='titel'>More</div>
                <div className="More-section">
                    <div className="option-item"><span>Help & Support</span><span>{'>'}</span></div>
                    <div className="option-item" onClick={() => navigate('/about-app')}><span>About App</span><span>{'>'}</span></div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Accent;
