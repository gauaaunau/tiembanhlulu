import React, { useState, useEffect } from 'react';

const HangingDecor = () => {
    const [positions, setPositions] = useState([]);

    useEffect(() => {
        // Generate random positions only once on mount to avoid re-renders
        const newPositions = [
            { left: Math.random() * 20 + 5, version: 1 },   // Left side (5-25%)
            { left: Math.random() * 20 + 40, version: 2 },  // Center (40-60%)
            { left: Math.random() * 20 + 75, version: 3 }   // Right side (75-95%)
        ];
        setPositions(newPositions);
    }, []);

    if (positions.length === 0) return null;

    return (
        <div className="hanging-decor-container" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '0', // Don't block clicks
            zIndex: 9999, // On top of everything
            pointerEvents: 'none' // Allow clicks through
        }}>
            {positions.map((pos, index) => (
                <div
                    key={index}
                    className={`hanging-plant plant-${pos.version}`}
                    style={{
                        position: 'absolute',
                        top: -20, // Slightly off-screen start
                        left: `${pos.left}%`,
                        width: '150px', // Adjust based on image
                        height: '200px',
                        backgroundImage: 'url(/hanging-plants.png)',
                        backgroundSize: '300% 100%', // Assume 3 pots side-by-side
                        backgroundPosition: `${(pos.version - 1) * 50}% 0`, // Shift to show 1st, 2nd, 3rd pot (0%, 50%, 100%)
                        transformOrigin: 'top center',
                        animation: `sway ${3 + Math.random() * 2}s ease-in-out infinite alternate`,
                        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.2))'
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes sway {
                    0% { transform: rotate(-2deg); }
                    100% { transform: rotate(2deg); }
                }
                @media (max-width: 768px) {
                    .hanging-plant {
                        width: 100px !important;
                        height: 140px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default HangingDecor;
