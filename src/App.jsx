import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Hero from './components/Hero';
import TikTokSection from './components/TikTokSection';
import ProductGallery from './components/ProductGallery';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import BackgroundRemover from './components/BackgroundRemover';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="app">
            <Hero />
            <TikTokSection />
            <ProductGallery />
          </div>
        } />
        <Route path="/AdminLulucake" element={<AdminLogin />} />
        <Route path="/AdminLulucake/dashboard" element={<AdminDashboard />} />
        <Route path="/AdminLulucake/tools/bg-remover" element={<BackgroundRemover />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
