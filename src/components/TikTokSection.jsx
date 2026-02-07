import { useState, useEffect, useRef } from 'react';
import './TikTokSection.css';
import { subscribeToItems } from '../utils/db';

export default function TikTokSection() {
    const [videos, setVideos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState(null);

    // Custom Player State
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {
        console.log("TikTokSection v6.1.6 - Live");
        const unsubscribe = subscribeToItems('settings', (items) => {
            const tiktokSettings = items.find(item => item.id === 'tiktok_featured');
            if (tiktokSettings && tiktokSettings.videos) {
                const validVideos = tiktokSettings.videos.filter(v => v && v.videoUrl);
                const padded = [null, null, null].map((_, i) => validVideos[i] || null);
                setVideos(padded);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const togglePlay = () => {
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const handleTimeUpdate = () => {
        setCurrentTime(videoRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
        setDuration(videoRef.current.duration);
    };

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        videoRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const toggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        videoRef.current.muted = newMuted;
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        videoRef.current.volume = val;
        if (val > 0) setIsMuted(false);
    };

    const formatTime = (time) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleFullscreen = () => {
        if (videoRef.current.requestFullscreen) {
            videoRef.current.requestFullscreen();
        } else if (videoRef.current.webkitRequestFullscreen) {
            videoRef.current.webkitRequestFullscreen();
        } else if (videoRef.current.msRequestFullscreen) {
            videoRef.current.msRequestFullscreen();
        }
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
                    <div
                        className="lightbox-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className="close-lightbox" onClick={() => setSelectedVideo(null)}>✕</button>

                        <div className="cute-player-wrapper">
                            <div className="video-main-area">
                                <video
                                    ref={videoRef}
                                    src={selectedVideo.videoUrl}
                                    className="lightbox-player"
                                    autoPlay
                                    playsInline
                                    webkit-playsinline="true"
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={handleLoadedMetadata}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onClick={togglePlay}
                                />

                                {/* Centered Play/Pause Big Icon on Pause - Still inside video area */}
                                {!isPlaying && (
                                    <div className="big-play-btn" onClick={togglePlay}>
                                        ▶
                                    </div>
                                )}
                            </div>

                            {/* Cute Custom Controls - Now outside/below video-main-area */}
                            <div className="cute-controls visible">
                                <div className="controls-top">
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 0}
                                        value={currentTime}
                                        onChange={handleSeek}
                                        className="cute-seeker"
                                    />
                                </div>

                                <div className="controls-bottom">
                                    <div className="controls-left">
                                        <button className="cute-btn play-btn" onClick={togglePlay}>
                                            {isPlaying ? '⏸' : '▶'}
                                        </button>
                                        <span className="cute-time">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </span>
                                    </div>

                                    <div className="controls-right">
                                        <div className="volume-container">
                                            <button className="cute-btn volume-btn" onClick={toggleMute}>
                                                {isMuted || volume === 0 ? '🔇' : '🔊'}
                                            </button>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={volume}
                                                onChange={handleVolumeChange}
                                                className="cute-volume-slider"
                                            />
                                        </div>
                                        <button className="cute-btn fullscreen-btn" onClick={toggleFullscreen}>
                                            ⛶
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
