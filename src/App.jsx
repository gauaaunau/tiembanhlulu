// sweet_pantry v10.2.1 - Build Trigger
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

  // Day/Night Background Logic - Automatic switching
  const [isDayTime, setIsDayTime] = useState(() => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  });

  useEffect(() => {
    // Check background time every minute
    const interval = setInterval(() => {
      const hour = new Date().getHours();
      setIsDayTime(hour >= 6 && hour < 18);
    }, 60000);

    // GLOBAL ZOOM LOCK (v10.2.0)
    const blockZoom = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const blockWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // Passive: false is required to preventDefault
    document.addEventListener('touchstart', blockZoom, { passive: false });
    document.addEventListener('wheel', blockWheel, { passive: false });

    // Delay loading main content by 3 seconds
    const timer = setTimeout(() => {
      setIsMainContentReady(true);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      document.removeEventListener('touchstart', blockZoom);
      document.removeEventListener('wheel', blockWheel);
    };
  }, []);

  // Background Image Path
  const getBackgroundImage = () => {
    const isMobile = window.innerWidth <= 768;
    return isMobile ? '/bakery-day-mobile.jpg' : '/bakery-day.jpg';
  };



  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="app" style={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
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
              />
            )}

            {/* Main content loads after 3 seconds */}
            {isMainContentReady && (
              <div className="main-content-glass" style={{
                position: 'relative',
                zIndex: 1,
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
