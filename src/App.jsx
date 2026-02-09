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
            {showEntrance && <EntranceOverlay onEnter={() => setShowEntrance(false)} />}

            {/* Main content loads after 3 seconds */}
            {isMainContentReady && (
              <>
                <Hero />
                <TikTokSection />
                <ProductGallery />
              </>
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
