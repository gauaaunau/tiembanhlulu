// TikTok Video Downloader Utility
// Downloads TikTok videos without watermark using direct CDN URLs

/**
 * Downloads a TikTok video without watermark
 * @param {string} tiktokUrl - Full TikTok video URL (e.g., https://www.tiktok.com/@user/video/1234567890)
 * @returns {Promise<{videoBlob: Blob, thumbnail: string}>} Video blob and thumbnail URL
 */
export const downloadTikTokVideo = async (tiktokUrl) => {
    try {
        // Step 1: Get video metadata from TikTok oEmbed API
        const oembedResponse = await fetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`
        );

        if (!oembedResponse.ok) {
            throw new Error('Failed to fetch TikTok metadata');
        }

        const metadata = await oembedResponse.json();
        const thumbnailUrl = metadata.thumbnail_url;

        // Step 2: Extract video ID from URL
        const videoIdMatch = tiktokUrl.match(/\/video\/(\d+)/);
        if (!videoIdMatch) {
            throw new Error('Invalid TikTok URL format');
        }
        const videoId = videoIdMatch[1];

        // Step 3: Try multiple TikTok CDN endpoints to get direct video URL
        // TikTok stores videos on multiple CDNs, we'll try common patterns
        const cdnAttempts = [
            // Method 1: Use TikTok's direct download API (used by SnapTik)
            async () => {
                const apiUrl = `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (data?.aweme_list?.[0]?.video?.download_addr?.url_list?.[0]) {
                    return data.aweme_list[0].video.download_addr.url_list[0];
                }
                return null;
            },

            // Method 2: Use TikTok's playback URL (alternative CDN)
            async () => {
                const apiUrl = `https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (data?.aweme_list?.[0]?.video?.play_addr?.url_list?.[0]) {
                    return data.aweme_list[0].video.play_addr.url_list[0];
                }
                return null;
            },

            // Method 3: Fallback - try to scrape from TikTok web page
            async () => {
                const response = await fetch(tiktokUrl);
                const html = await response.text();

                // Look for video URL in page source
                const videoUrlMatch = html.match(/"downloadAddr":"([^"]+)"/);
                if (videoUrlMatch) {
                    return videoUrlMatch[1].replace(/\\u002F/g, '/');
                }
                return null;
            }
        ];

        // Try each method until one succeeds
        let directVideoUrl = null;
        for (const attempt of cdnAttempts) {
            try {
                directVideoUrl = await attempt();
                if (directVideoUrl) break;
            } catch (err) {
                console.warn('CDN attempt failed:', err);
                continue;
            }
        }

        if (!directVideoUrl) {
            throw new Error('Could not extract video URL from any CDN');
        }

        // Step 4: Download the video as a blob
        const videoResponse = await fetch(directVideoUrl);
        if (!videoResponse.ok) {
            throw new Error('Failed to download video from CDN');
        }

        const videoBlob = await videoResponse.blob();

        return {
            videoBlob,
            thumbnail: thumbnailUrl
        };

    } catch (error) {
        console.error('TikTok download error:', error);
        throw new Error(`Failed to download TikTok video: ${error.message}`);
    }
};

/**
 * Validates if a URL is a valid TikTok video URL
 */
export const isValidTikTokUrl = (url) => {
    const tiktokPattern = /^https?:\/\/(www\.|vm\.)?tiktok\.com\/.+\/video\/\d+/;
    return tiktokPattern.test(url);
};
