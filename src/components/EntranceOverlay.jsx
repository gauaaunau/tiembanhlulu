import { useState, useEffect } from 'react';
import './EntranceOverlay.css';

const EntranceOverlay = ({ onEnter }) => {
    const [isDayTime, setIsDayTime] = useState(() => {
        const currentHour = new Date().getHours();
        return currentHour >= 6 && currentHour < 18;
    });

    const [isExiting, setIsExiting] = useState(false);

    const handleEnter = () => {
        setIsExiting(true);
        setTimeout(() => {
            onEnter();
        }, 800); // Wait for exit animation
    };

    return (
        <div className={`entrance-overlay ${isDayTime ? 'day-theme' : 'night-theme'} ${isExiting ? 'fade-out' : ''}`}>
            <div className="entrance-content">
                <div className="entrance-card">
                    <h1 className="entrance-title">Tiệm Bánh LuLu</h1>
                    <p className="entrance-subtitle">Chào mừng bạn đến với thế giới ngọt ngào!</p>

                    <div className="enter-shop-container" onClick={handleEnter}>
                        <img
                            src="/enter-shop-button.png"
                            alt="Vào Tiệm"
                            className="enter-shop-btn"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EntranceOverlay;
