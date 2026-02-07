import { useState, useEffect } from 'react';
import './TikTokSection.css';
import { subscribeToItems } from '../utils/db';

export default function TikTokSection() {
    const [links, setLinks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedUrl, setSelectedUrl] = useState(null);

    useEffect(() => {
        const unsubscribe = subscribeToItems('settings', (items) => {
            const tiktokSettings = items.find(item => item.id === 'tiktok_featured');
            if (tiktokSettings && tiktokSettings.urls) {
                // Always maintain 3 slots, pad with null if needed
                const rawUrls = tiktokSettings.urls;
                const padded = [null, null, null].map((_, i) => rawUrls[i] || null);
                setLinks(padded);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getEmbedUrl = (url) => {
        if (!url) return null;
        const match = url.match(/\/video\/(\d+)/);
        if (match && match[1]) {
            return `https://www.tiktok.com/embed/v2/${match[1]}?autoPlay=1`;
        }
        return null;
    };

    if (isLoading || links.every(l => !l)) return null;

    return (
        <section className="tiktok-section">
            <div className="section-header">
                <h2 className="section-title">✨ Video TikTok Mới</h2>
                <p className="section-subtitle">Chạm vào video để xem khoảnh khắc ngọt ngào 🍰</p>
            </div>

            <div className="tiktok-grid">
                {links.map((url, index) => (
                    <div
                        key={index}
                        className={`tiktok-play-card ${!url ? 'empty-slot' : ''}`}
                        onClick={() => url && setSelectedUrl(url)}
                    >
                        <div className="thumbnail-wrapper glass-card">
                            <div className="placeholder-content">
                                <img
                                    src="https://img.icons8.com/?size=512&id=118638&format=png"
                                    alt="TikTok"
                                    className="placeholder-logo"
                                    style={{ opacity: !url ? 0.2 : 0.8 }}
                                />
                            </div>
                            {url && (
                                <div className="play-overlay">
                                    <span className="play-icon">▶</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Lightbox / Modal */}
            {selectedUrl && (
                <div className="tiktok-lightbox" onClick={() => setSelectedUrl(null)}>
                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <button className="close-lightbox" onClick={() => setSelectedUrl(null)}>✕</button>
                        <div className="lightbox-video-container">
                            <iframe
                                src={getEmbedUrl(selectedUrl)}
                                className="lightbox-player"
                                allowFullScreen
                                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
