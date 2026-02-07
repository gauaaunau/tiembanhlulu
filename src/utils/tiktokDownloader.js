// TikTok Video Downloader Utility
// Downloads TikTok videos without watermark via TikWM API

/**
 * Downloads a TikTok video without watermark using TikWM API (Keyless)
 * @param {string} tiktokUrl - Full TikTok video URL
 * @returns {Promise<{videoBlob: Blob, thumbnail: string}>} Video blob and thumbnail URL
 */
export const downloadTikTokVideo = async (tiktokUrl) => {
    try {
        // Step 1: Use TikWM API - Free, No Key required for basic usage
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`TikWM API failed with status ${response.status}`);
        }

        const resData = await response.json();

        if (resData.code !== 0 || !resData.data) {
            throw new Error(resData.msg || 'Không thể lấy dữ liệu từ TikTok');
        }

        const data = resData.data;
        // Preferred order: HD play -> Normal play
        const videoUrl = data.hdplay || data.play;
        const thumbnailUrl = data.cover;

        if (!videoUrl) {
            throw new Error('Không tìm thấy link video sạch');
        }

        // Step 2: Download video as blob
        // IMPORTANT: We use a CORS Proxy because TikTok CDNs usually block direct browser fetches
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(videoUrl)}`;

        const videoResponse = await fetch(proxyUrl);
        if (!videoResponse.ok) {
            // Fallback: Try without proxy if proxy fails
            const directResponse = await fetch(videoUrl).catch(() => null);
            if (!directResponse || !directResponse.ok) {
                throw new Error('Lỗi khi tải file video (CORS block)');
            }
            return {
                videoBlob: await directResponse.blob(),
                thumbnail: thumbnailUrl
            };
        }

        const videoBlob = await videoResponse.blob();

        return {
            videoBlob,
            thumbnail: thumbnailUrl
        };

    } catch (error) {
        console.error('TikTok download error:', error);
        throw new Error(`Không thể tải video: ${error.message}`);
    }
};

/**
 * Validates if a URL is a valid TikTok video URL
 */
export const isValidTikTokUrl = (url) => {
    // Handle both direct and shortened links
    const tiktokPattern = /tiktok\.com\//;
    return tiktokPattern.test(url) && url.length > 15;
};
