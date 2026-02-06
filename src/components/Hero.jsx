import { useState, useEffect } from 'react';
import './Hero.css';

export default function Hero() {
  const [logoUrl, setLogoUrl] = useState('');
  const [distance, setDistance] = useState(null);
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
    <section className="hero">
      <div className="hero-content">
        <div className="hero-card">
          {logoUrl && (
            <div className="hero-logo-container">
              <img src={logoUrl} alt="LuLu Logo" className="logo-image-circular" />
            </div>
          )}

          <p className="hero-subtitle">
            🎂 Tiệm bánh ngọt xinh yêu của mẹ 🍰
          </p>
          <p className="hero-description">
            Bánh ít ngọt phù hợp cho bé và gia đình<br />
            Đặt mới làm - Bánh mới mỗi ngày
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
            <p className="direction-hint">nhấn nút chỉ đường để được chỉ đường</p>
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
          </div>

          <div className="scroll-indicator" onClick={() => {
            const gallery = document.querySelector('.gallery');
            if (gallery) {
              gallery.scrollIntoView({ behavior: 'smooth' });
            }
          }}>
            <span className="scroll-text">Xem mẫu bánh</span>
            <div className="mouse-wheel">
              <div className="wheel"></div>
            </div>
            <div className="arrow-down">
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
