import { useState, useEffect } from 'react';
import './EntranceOverlay.css';

const EntranceOverlay = ({ onEnter, isDayTime, setIsDayTime }) => {

    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const handleEnter = () => {
        setIsExiting(true);
        setTimeout(() => {
            onEnter();
        }, 800);
    };

    useEffect(() => {
        const bgImage = new Image();
        const isMobile = window.innerWidth <= 768;
        let imageUrl = '';

        if (isDayTime) {
            imageUrl = isMobile ? '/bakery-day-mobile.jpg' : '/bakery-day.jpg';
        } else {
            imageUrl = isMobile ? '/bakery-night-mobile.jpg' : '/bakery-night.jpg';
        }

        bgImage.onload = () => {
            setIsImageLoaded(true);
        };

        bgImage.onerror = () => {
            // Fallback if image fails
            setIsImageLoaded(true);
        };

        bgImage.src = imageUrl;

        // Fallback safety timer
        const timer = setTimeout(() => {
            setIsImageLoaded(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, [isDayTime]);

    return (
        <div className={`entrance-overlay ${isExiting ? 'fade-out' : ''}`}>
            {/* Background Image Element - Fades in over black */}
            <div
                className={`entrance-bg ${isDayTime ? 'day-theme' : 'night-theme'} ${isImageLoaded ? 'loaded' : ''}`}
            ></div>

            {isImageLoaded && (
                <div className="entrance-content">
                    <div className="entrance-card">
                        <div className="enter-shop-container" onClick={handleEnter}>
                            <img
                                src="/enter-shop-button.png"
                                alt="Vào Tiệm"
                                className="enter-shop-btn"
                            />
                        </div>

                        {/* Add Day/Night Toggle for Entrance */}
                        <button
                            className="entrance-theme-toggle"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDayTime(!isDayTime);
                            }}
                            title={isDayTime ? "Chuyển sang Đêm" : "Chuyển sang Ngày"}
                        >
                            {isDayTime ? '☀️ Chuyển sang Đêm' : '🌙 Chuyển sang Ngày'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntranceOverlay;
