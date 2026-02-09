import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Hero from './components/Hero';
import EntranceOverlay from './components/EntranceOverlay';
import TikTokSection from './components/TikTokSection';
import ProductGallery from './components/ProductGallery';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [showEntrance, setShowEntrance] = useState(true);
  const [isMainContentReady, setIsMainContentReady] = useState(false);

  // Day/Night Logic
  const [isDayTime, setIsDayTime] = useState(() => {
    const currentHour = new Date().getHours();
    return currentHour >= 6 && currentHour < 18;
  });

  useEffect(() => {
    // Delay loading main content by 3 seconds to prioritize Entrance Overlay
    const timer = setTimeout(() => {
      setIsMainContentReady(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Background Image Path
  const getBackgroundImage = () => {
    const isMobile = window.innerWidth <= 768;
    if (isDayTime) {
      return isMobile ? '/bakery-day-mobile.jpg' : '/bakery-day.jpg';
    } else {
      return isMobile ? '/bakery-night-mobile.jpg' : '/bakery-night.jpg';
    }
  };



  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="app">
            {/* Fixed Background Layer */}
            {/* Fixed Background Layer */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundImage: `url(${getBackgroundImage()})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                zIndex: -2, // Moved further back
                transition: 'background-image 1s ease-in-out'
              }}
            />

            {/* Global Glass Overlay */}
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.2)', // Slight dark tint for contrast
                backdropFilter: 'blur(8px)', // Global blur
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: -1,
                pointerEvents: 'none' // Let clicks pass through
              }}
            />

            {showEntrance && (
              <EntranceOverlay
                onEnter={() => setShowEntrance(false)}
                isDayTime={isDayTime} // Pass state down
              />
            )}

            {/* Main content loads after 3 seconds */}
            {isMainContentReady && (
              <div className="main-content-glass" style={{
                position: 'relative',
                zIndex: 1,
                // Add padding to ensure content doesn't stick to edges if needed, 
                // but components like Hero handle their own layout.
              }}>
                <Hero />
                <TikTokSection />
                <ProductGallery />
              </div>
            )}
          </div>
        } />
        <Route path="/AdminLulucake" element={<AdminLogin />} />
        <Route path="/AdminLulucake/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
