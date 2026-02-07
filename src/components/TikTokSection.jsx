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
            if (tiktokSettings && tiktokSettings.videos) {
                // v6.0.0: Load self-hosted videos
                const validVideos = tiktokSettings.videos.filter(v => v && v.videoUrl);

                // Pad to always have 3 slots
                const padded = [null, null, null].map((_, i) => validVideos[i] || null);
                setVideos(padded);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

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
                                    <img src={video.thumbnailUrl} alt="TikTok video" className="video-thumbnail" />
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
                        <video
                            src={selectedVideo.videoUrl}
                            className="lightbox-player"
                            controls
                            autoPlay
                            style={{ width: '100%', height: '90vh', objectFit: 'contain' }}
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
