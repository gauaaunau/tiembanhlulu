import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Hero from './components/Hero';
import EntranceOverlay from './components/EntranceOverlay';
import TikTokSection from './components/TikTokSection';
import ProductGallery from './components/ProductGallery';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [showEntrance, setShowEntrance] = useState(true);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="app">
            {showEntrance && <EntranceOverlay onEnter={() => setShowEntrance(false)} />}
            <Hero />
            <TikTokSection />
            <ProductGallery />
          </div>
        } />
        <Route path="/AdminLulucake" element={<AdminLogin />} />
        <Route path="/AdminLulucake/dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
