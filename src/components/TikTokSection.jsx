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
                if (urls.length > 0) {
                    fetchVideoThumbnails(urls);
                } else {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchVideoThumbnails = async (urls) => {
        const videoData = await Promise.all(urls.slice(0, 3).map(async (url) => {
            try {
                const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
                if (res.ok) {
                    const data = await res.json();
                    return {
                        url,
                        thumbnail: data.thumbnail_url || 'https://img.icons8.com/?size=512&id=118638&format=png'
                    };
                }
            } catch (err) {
                console.warn('Thumbnail fetch failed:', err);
            }
            return {
                url,
                thumbnail: 'https://img.icons8.com/?size=512&id=118638&format=png'
            };
        }));

        // Pad to always have 3 slots
        const padded = [null, null, null].map((_, i) => videoData[i] || null);
        setVideos(padded);
        setIsLoading(false);
    };

    const getEmbedUrl = (url) => {
        if (!url) return null;
        const match = url.match(/\/video\/(\d+)/);
        if (match && match[1]) {
            return `https://www.tiktok.com/embed/v2/${match[1]}`;
        }
        return null;
    };

    if (isLoading || videos.every(v => !v)) return null;

    return (
        <section className="tiktok-section">
            <div className="tiktok-grid">
                {videos.map((video, index) => (
                    <div
                        key={index}
                        className={`tiktok-play-card ${!video ? 'empty-slot' : ''}`}
                        onClick={() => video && setSelectedVideo(video)}
                    >
                        <div className="thumbnail-wrapper">
                            {video ? (
                                <>
                                    <img src={video.thumbnail} alt="TikTok video" className="video-thumbnail" />
                                    <div className="play-overlay">
                                        <span className="play-icon">▶</span>
                                    </div>
                                </>
                            ) : (
                                <div className="empty-placeholder">
                                    <img
                                        src="https://img.icons8.com/?size=512&id=118638&format=png"
                                        alt="TikTok"
                                        className="placeholder-logo"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {selectedVideo && (
                <div className="tiktok-lightbox" onClick={() => setSelectedVideo(null)}>
                    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <button className="close-lightbox" onClick={() => setSelectedVideo(null)}>✕</button>
                        <iframe
                            src={getEmbedUrl(selectedVideo.url)}
                            className="lightbox-player"
                            allowFullScreen
                            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        ></iframe>
                    </div>
                </div>
            )}
        </section>
    );
}
