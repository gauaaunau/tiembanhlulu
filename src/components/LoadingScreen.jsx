import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = () => {
    const logoUrl = 'https://graph.facebook.com/tiembanhlulu/picture?type=large&width=500&height=500';

    return (
        <div className="loading-overlay">
            <div className="loading-content">
                <div className="logo-container">
                    <img src={logoUrl} alt="LuluCake Logo" className="bouncing-logo-circular" />
                    <div className="logo-shadow"></div>
                </div>
                <div className="loading-text">
                    <span className="dot-blink">Đợi</span>
                    <span className="dot-blink" style={{ animationDelay: '0.2s' }}> tiệm</span>
                    <span className="dot-blink" style={{ animationDelay: '0.4s' }}> xíu</span>
                    <div className="loading-dots">
                        <span className="dot-blink" style={{ animationDelay: '0.6s' }}>.</span>
                        <span className="dot-blink" style={{ animationDelay: '0.8s' }}>.</span>
                        <span className="dot-blink" style={{ animationDelay: '1.0s' }}>.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;
