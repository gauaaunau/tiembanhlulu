import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Hero from './components/Hero';
import ProductGallery from './components/ProductGallery';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div className="app">
            <Hero />
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
