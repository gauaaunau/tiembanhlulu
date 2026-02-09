import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductManager from './ProductManager';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const navigate = useNavigate();

    useEffect(() => {
        const auth = localStorage.getItem('lulu_auth');
        if (auth !== 'authenticated') {
            navigate('/AdminLulucake');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('lulu_auth');
        navigate('/');
    };

    return (
        <div className="admin-dashboard">
            <div className="admin-header">
                <h1 className="admin-title">🐻 Admin Panel - LuLu</h1>
                <div className="admin-actions">
                    <button className="btn btn-outline" onClick={() => navigate('/')}>
                        🏠 Xem Trang Chủ
                    </button>
                    <button className="btn btn-primary" onClick={handleLogout}>
                        🚪 Đăng Xuất
                    </button>
                </div>
            </div>

            <div className="admin-content" style={{ marginTop: '2rem' }}>
                <ProductManager />
            </div>
        </div>
    );
}
