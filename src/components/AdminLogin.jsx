import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

export default function AdminLogin() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();

        if (password === '123321') {
            localStorage.setItem('lulu_auth', 'authenticated');
            navigate('/AdminLulucake/dashboard');
        } else {
            setError('❌ Mật khẩu không đúng!');
            setPassword('');
        }
    };

    return (
        <div className="admin-login">
            <div className="login-card">
                <h1 className="login-title">🔐 Admin LuLu</h1>
                <p className="login-subtitle">Đăng nhập để quản lý sản phẩm</p>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <input
                            type="password"
                            className="password-input"
                            placeholder="Nhập mật khẩu..."
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            autoFocus
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <button type="submit" className="btn btn-primary login-btn">
                        Đăng Nhập
                    </button>
                </form>

                <button
                    className="btn btn-outline back-btn"
                    onClick={() => navigate('/')}
                >
                    ← Về Trang Chủ
                </button>
            </div>
        </div>
    );
}
