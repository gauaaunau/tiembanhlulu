import { useState, useEffect } from 'react';
import './EntranceOverlay.css';

const EntranceOverlay = ({ onEnter }) => {

    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const handleEnter = () => {
        setIsExiting(true);
        setTimeout(() => {
            onEnter();
        }, 800);
    };

    useEffect(() => {
        // Lock scroll while entrance is active
        document.body.style.overflow = 'hidden';

        const bgImage = new Image();
        const isMobile = window.innerWidth <= 768;
        // Forced to Day per user request
        const imageUrl = isMobile ? '/bakery-day-mobile.jpg' : '/bakery-day.jpg';

        bgImage.onload = () => {
            setIsImageLoaded(true);
        };

        bgImage.onerror = () => {
            setIsImageLoaded(true);
        };

        bgImage.src = imageUrl;

        const timer = setTimeout(() => {
            setIsImageLoaded(true);
        }, 2000);

        return () => {
            clearTimeout(timer);
            // Restore scroll when overlay is gone
            document.body.style.overflow = 'auto';
        };
    }, []);

    return (
        <div className={`entrance-overlay ${isExiting ? 'fade-out' : ''}`}>
            {/* Day Theme forced */}
            <div
                className={`entrance-bg day-theme ${isImageLoaded ? 'loaded' : ''}`}
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntranceOverlay;
