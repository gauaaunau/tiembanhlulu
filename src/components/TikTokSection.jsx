import { useState, useEffect } from 'react';
import './TikTokSection.css';
import { subscribeToItems } from '../utils/db';

export default function TikTokSection() {
    const [videos, setVideos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState(null);

    useEffect(() => {
        const unsubscribe = subscribeToItems('settings', (items) => {
            const tiktokSettings = items.find(item => item.id === 'tiktok_featured');
            if (tiktokSettings && tiktokSettings.urls) {
                const urls = tiktokSettings.urls.filter(url => url && url.trim() !== '');
                fetchVideoData(urls);
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchVideoData = async (urls) => {
        const data = await Promise.all(urls.map(async (url) => {
            try {
                // Try fetching oEmbed data (CORS might be an issue, but worth a try)
                const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
                if (res.ok) {
                    const json = await res.json();
                    return {
                        url,
                        title: json.title || 'Video từ TikTok',
                        thumbnail: json.thumbnail_url,
                        author: json.author_name
                    };
                }
            } catch (err) {
                console.warn('oEmbed fetch failed:', err);
            }
            // Fallback if oEmbed fails
            return {
                url,
                title: 'Click để xem video TikTok',
                thumbnail: 'https://img.icons8.com/?size=512&id=118638&format=png', // Big TikTok Logo
                author: '@tiembanh.lulu'
            };
        }));
        setVideos(data);
        setIsLoading(false);
    };

    const getEmbedUrl = (url) => {
        const match = url.match(/\/video\/(\d+)/);
        if (match && match[1]) {
            return `https://www.tiktok.com/embed/v2/${match[1]}?autoPlay=1`;
        }
        return null;
    };

    if (isLoading || videos.length === 0) return null;

    return (
        <section className="tiktok-section">
            <div className="section-header">
                <h2 className="section-title">✨ Video TikTok Mới</h2>
                <p className="section-subtitle">Chạm vào video để xem trọn khoảnh khắc ngọt ngào 🍰</p>
            </div>

            <div className="tiktok-grid">
                {videos.map((vid, index) => (
                    <div
                        key={index}
                        className="tiktok-play-card glass-card"
                        onClick={() => setSelectedVideo(vid)}
                    >
                        <div className="thumbnail-wrapper">
                            <img src={vid.thumbnail} alt={vid.title} className="video-thumbnail" />
                            <div className="play-overlay">
                                <span className="play-icon">▶</span>
                            </div>
                        </div>
                        <div className="video-info">
                            <p className="video-author">{vid.author}</p>
                            <p className="video-title-text">{vid.title}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Lightbox / Modal */}
            {selectedVideo && (
                <div className="tiktok-lightbox" onClick={() => setSelectedVideo(null)}>
                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <button className="close-lightbox" onClick={() => setSelectedVideo(null)}>✕</button>
                        <div className="lightbox-video-container">
                            <iframe
                                src={getEmbedUrl(selectedVideo.url)}
                                className="lightbox-player"
                                allowFullScreen
                                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                            ></iframe>
                        </div>
                    </div>
                </div>
            )}

            <div className="section-footer">
                <p className="footer-hint">💡 Shop cập nhật video mới mỗi ngày, cả nhà nhớ ghé xem nha!</p>
            </div>
        </section>
    );
}
