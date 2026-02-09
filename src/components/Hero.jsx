import { useState, useEffect } from 'react';
import './Hero.css';

export default function Hero() {
  const [logoUrl, setLogoUrl] = useState('');
  const [distance, setDistance] = useState(null);
  const [isDayTime, setIsDayTime] = useState(() => {
    const currentHour = new Date().getHours();
    return currentHour >= 6 && currentHour < 18;
  });
  const bakeryCoords = { lat: 10.817505, lng: 106.634351 }; // Estimated coordinates for 66/17 Tổ 23 KP.2A

  useEffect(() => {
    // Tự động lấy logo từ Facebook Page
    const facebookPageUsername = 'tiembanhlulu';
    const fbLogoUrl = `https://graph.facebook.com/${facebookPageUsername}/picture?type=large&width=500&height=500`;
    setLogoUrl(fbLogoUrl);

    // Tính khoảng cách
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const d = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          bakeryCoords.lat,
          bakeryCoords.lng
        );
        setDistance(d.toFixed(1));
      });
    }
  }, []);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return (
    <section className={`hero ${isDayTime ? 'day-theme' : 'night-theme'}`}>
      <div className="hero-content">
        <div className="hero-card">
          {logoUrl && (
            <div className="hero-logo-container">
              <img src={logoUrl} alt="LuLu Logo" className="logo-image-circular" />
            </div>
          )}

          <p className="hero-subtitle">
            Tiệm bánh ngọt xinh yêu
          </p>
          <p className="hero-description">
            Bánh ít ngọt phù hợp cho bé và gia đình. Đặt mới làm - Bánh mới mỗi ngày
          </p>
          <div className="hero-location-box">
            <div className="location-item">
              <span>74/11 Trần Thái Tông, P.15, Tân Bình, HCM</span>
            </div>
            {distance && (
              <div className="distance-info">
                Cách bạn <strong>{distance} km</strong>
              </div>
            )}
          </div>

          <div className="social-links">
            <a href="https://facebook.com/tiembanhlulu" target="_blank" rel="noopener noreferrer" title="Facebook">
              <img src="https://img.icons8.com/color/48/facebook-new.png" alt="FB" />
            </a>
            <a href="https://instagram.com/tiembanh.lulu" target="_blank" rel="noopener noreferrer" title="Instagram">
              <img src="https://img.icons8.com/color/48/instagram-new.png" alt="IG" />
            </a>
            <a href="https://tiktok.com/@tiembanh.lulu" target="_blank" rel="noopener noreferrer" title="TikTok">
              <img src="https://img.icons8.com/color/48/tiktok.png" alt="TT" />
            </a>
            <a href="https://zalo.me/0798341868" target="_blank" rel="noopener noreferrer" title="Zalo">
              <img src="https://img.icons8.com/color/48/zalo.png" alt="Zalo" />
            </a>
          </div>

          <div className="hero-buttons">
            <a
              href="https://maps.app.goo.gl/PD18KjCzbMka5sBE9"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Chỉ Đường Đến Tiệm
            </a>

            {/* Nút VÀO TIỆM mới */}
            <div className="enter-shop-container" onClick={() => {
              const gallery = document.querySelector('.gallery');
              if (gallery) {
                gallery.scrollIntoView({ behavior: 'smooth' });
              }
            }}>
              <img
                src="/enter-shop-button.png"
                alt="Vào Tiệm"
                className="enter-shop-btn"
              />
            </div>

          </div>

          <div className="theme-toggle-container">
            <button
              className="theme-toggle-btn"
              onClick={() => setIsDayTime(!isDayTime)}
              title={isDayTime ? "Chuyển sang Đêm" : "Chuyển sang Ngày"}
            >
              <span className="toggle-icon">{isDayTime ? '☀️' : '🌙'}</span>
              <span className="toggle-label">{isDayTime ? 'Ban Ngày' : 'Ban Đêm'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
