import { useState, useEffect } from 'react';
import './EntranceOverlay.css';

const EntranceOverlay = ({ onEnter }) => {
    const [isDayTime, setIsDayTime] = useState(() => {
        const currentHour = new Date().getHours();
        return currentHour >= 6 && currentHour < 18;
    });

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
            imageUrl = isMobile ? '/bakery-day-mobile.jpg?v=3' : '/bakery-day.jpg?v=3';
        } else {
            imageUrl = isMobile ? '/bakery-night-mobile.jpg?v=3' : '/bakery-night.jpg?v=3';
        }

        bgImage.src = imageUrl;
        bgImage.onload = () => {
            setIsImageLoaded(true);
        };
    }, [isDayTime]);

    return (
        <div
            className={`entrance-overlay ${isDayTime ? 'day-theme' : 'night-theme'} ${isExiting ? 'fade-out' : ''}`}
            style={{
                opacity: isImageLoaded ? 1 : 1, // Always visible container
                backgroundColor: isImageLoaded ? 'transparent' : '#000', // Black bg while loading
                backgroundImage: isImageLoaded ? undefined : 'none' // No image while loading
            }}
        >
            {/* Show nothing or a simple spinner while loading image? 
                User said "Wait for image to finish loading". 
                For now, just black screen until image pops in. 
            */}

            {isImageLoaded && (
                <div className="entrance-content">
                    <div className="entrance-card">
                        {/* Text removed per request */}

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
