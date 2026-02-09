import { useState, useEffect, useRef } from 'react';
import './TikTokSection.css';
import { subscribeToItems } from '../utils/db';

// Professional SVG Icon Components
const PlayIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M8 5v14l11-7z" />
    </svg>
);

const PauseIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

const SurprisePlayPause = ({ isPlaying }) => (
    <div className={`surprise-btn-icon ${isPlaying ? 'is-playing' : 'is-paused'}`}>
        <svg viewBox="0 0 100 100" className="surprise-svg">
            <path className="surprise-path-1" d="M30,20 L30,80 L50,80 L50,20 Z" />
            <path className="surprise-path-2" d="M60,20 L60,80 L80,80 L80,20 Z" />
        </svg>
    </div>
);

const VolumeIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
);

const MuteIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
);

const FullscreenIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
);

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

    useEffect(() => {
        console.log("TikTokSection v6.1.7 - Live");
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
        <section className="tiktok-section" style={{ padding: '2rem', margin: '2rem auto', maxWidth: '1200px' }}>
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
                                    <img src={video.thumbnailUrl} alt="TikTok video" className="video-thumbnail" loading="lazy" />
                                    <div className="play-overlay">
                                        <div className="play-icon-svg">
                                            <PlayIcon />
                                        </div>
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
                        <button className="close-lightbox" onClick={() => setSelectedVideo(null)}>
                            <CloseIcon />
                        </button>

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

                                {/* Centered Play Big Icon on Pause */}
                                {!isPlaying && (
                                    <div className="big-play-btn surprise-elastic" onClick={togglePlay}>
                                        <SurprisePlayPause isPlaying={false} />
                                    </div>
                                )}
                            </div>

                            {/* Cute Custom Controls */}
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
                                        <button className="cute-btn play-btn surprise-elastic" onClick={togglePlay}>
                                            <SurprisePlayPause isPlaying={isPlaying} />
                                        </button>
                                        <span className="cute-time">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </span>
                                    </div>

                                    <div className="controls-right">
                                        <div className="volume-container">
                                            <button className="cute-btn volume-btn" onClick={toggleMute}>
                                                {isMuted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
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
                                            <FullscreenIcon />
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
