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

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <a
                    href="/AdminLulucake/tools/bg-remover"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-block',
                        padding: '10px 20px',
                        backgroundColor: '#9C27B0',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: '5px',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                >
                    🪄 Công Cụ Tách Nền (Mới)
                </a>
            </div>

            <div className="admin-content" style={{ marginTop: '2rem' }}>
                <ProductManager />
            </div>
        </div>
    );
}
