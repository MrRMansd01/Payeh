import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../api'; 
import Footer from '../components/Footer';
import './ChatHome.css';

const AddChannelModal = ({ onClose, onAddChannel }) => {
    const [channelName, setChannelName] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [users, setUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
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
        const fetchUsers = async () => {
            const token = getAuthToken();
            if (!token) return;
            try {
                const response = await axios.get('http://localhost:3001/api/channels/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setUsers(response.data);
            } catch (error) {
                console.error("Error fetching users for modal:", error);
            }
        };
        fetchUsers();
    }, [getAuthToken]);

    const handleUserToggle = (userId) => {
        const newSelection = new Set(selectedUserIds);
        if (newSelection.has(userId)) {
            newSelection.delete(userId);
        } else {
            newSelection.add(userId);
        }
        setSelectedUserIds(newSelection);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!channelName) return alert("Please enter a channel name.");
        onAddChannel({ name: channelName, member_ids: Array.from(selectedUserIds), image_url: imageUrl });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="modal-header">
                    <h2>Create Private Chat</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </header>
                <form onSubmit={handleSubmit} className="add-channel-form">
                    <div className="form-group">
                        <label htmlFor="channel-name">Chat Name</label>
                        <input type="text" id="channel-name" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="e.g., Project Spooder"/>
                    </div>
                    <div className="form-group">
                        <label htmlFor="imageUrl">Image URL (Optional)</label>
                        <input type="text" id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.png"/>
                    </div>
                    <div className="form-group">
                        <label>Select Members</label>
                        <div className="user-list">
                            {users.map(user => (
                                <div key={user.id} className="user-item" onClick={() => handleUserToggle(user.id)}>
                                    <input type="checkbox" checked={selectedUserIds.has(user.id)} readOnly/>
                                    <img src={user.avatar_url || `https://placehold.co/30x30/ccc/fff?text=${user.username.charAt(0)}`} alt={user.username} className="user-avatar-small" />
                                    <span>{user.username}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="create-channel-button">Create Chat</button>
                </form>
            </div>
        </div>
    );
};

const ChatHome = () => {
    const navigate = useNavigate();
    const [allChannels, setAllChannels] = useState([]);
    const [filteredChannels, setFilteredChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchChannels = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/channels');
            setAllChannels(response.data);
            setFilteredChannels(response.data);
        } catch (error) {
            if (error.response?.status !== 401) {
                console.error("Error fetching channels:", error);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    useEffect(() => {
        const results = allChannels.filter(channel =>
            channel.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredChannels(results);
    }, [searchTerm, allChannels]);

    const handleAddChannel = async (newChannelData) => {
        try {
            await api.post('/channels', newChannelData);
            fetchChannels();
        } catch (error) {
            if (error.response?.status !== 401) {
                console.error("Error creating channel:", error);
            }
        }
    };

    const handleChannelClick = (channel) => {
        // --- اصلاح اصلی اینجاست ---
        // اطلاعات نام و عکس کانال را در state به مسیر جدید پاس می‌دهیم
        navigate(`/chat/${channel.id}`, { 
            state: { 
                channelName: channel.name, 
                channelImage: channel.imageUrl 
            } 
        });
    };

    return (
        <div className="page-container">
            <div className="chat-home-content">
                <header className="chat-home-header">
                    <h1>Chatroom</h1>
                    <input 
                        type="text" 
                        placeholder="Search chats..." 
                        className="search-bar"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </header>
                <div className="channel-list">
                    {loading ? <p>Loading channels...</p> : 
                    filteredChannels.map(channel => (
                        // --- اصلاح اصلی اینجاست ---
                        // از تابع جدید برای کلیک استفاده می‌کنیم
                        <div key={channel.id} className="channel-item" onClick={() => handleChannelClick(channel)}>
                            <img src={channel.imageUrl || `https://placehold.co/50x50/7B66FF/FFFFFF?text=${channel.name.substring(0,2)}`} alt={channel.name} className="channel-avatar" />
                            <p className="channel-name">{channel.name}</p>
                        </div>
                    ))}
                </div>
            </div>
            <button className="fab" onClick={() => setIsModalOpen(true)}>+</button>
            {isModalOpen && <AddChannelModal onClose={() => setIsModalOpen(false)} onAddChannel={handleAddChannel} />}
            <Footer />
        </div>
    );
};

export default ChatHome;
