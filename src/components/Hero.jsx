import { useState, useEffect } from 'react';
import './Hero.css';

export default function Hero() {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    // Tự động lấy logo từ Facebook Page
    const facebookPageUsername = 'tiembanhlulu';
    const fbLogoUrl = `https://graph.facebook.com/${facebookPageUsername}/picture?type=large&width=500&height=500`;
    setLogoUrl(fbLogoUrl);
  }, []);

  return (
    <section className="hero">
      <div className="hero-content">
        {/* Logo từ Facebook Page */}
        {logoUrl && (
          <div className="hero-logo">
            <img src={logoUrl} alt="LuLu Logo" className="logo-image" />
          </div>
        )}

        <div className="hero-card">
          <h1 className="hero-title">
            Tiệm Bánh LuLu
          </h1>
          <p className="hero-subtitle">
            🎂 Tiệm bánh ngọt xinh yêu của mẹ 🍰
          </p>
          <p className="hero-description">
            Bánh ít ngọt phù hợp cho bé và gia đình<br />
            Đặt mới làm - Bánh mới mỗi ngày
          </p>
          <div className="hero-contact">
            <div className="contact-item">
              <span className="icon">📞</span>
              <a href="tel:0798341868" className="contact-link">0798.341.868</a>
            </div>
            <div className="contact-item">
              <span className="icon">📍</span>
              <span>74/11 Trần Thái Tông, P.15, Tân Bình</span>
            </div>
          </div>
          <div className="hero-buttons">
            <a href="tel:0798341868" className="btn btn-primary">📞 Gọi Đặt Bánh</a>
            <a href="https://m.me/tiembanhlulu" target="_blank" rel="noopener noreferrer" className="btn btn-outline">💬 Nhắn Facebook</a>
          </div>
        </div>
      </div>
    </section>
  );
}
