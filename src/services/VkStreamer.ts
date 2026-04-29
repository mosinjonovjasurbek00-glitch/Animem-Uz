import axios from "axios";

export const vkStreamer = {
  async getDirectUrl(vkUrl: string): Promise<string | null> {
    try {
      console.log(`[VK Video] Fetching URL for: ${vkUrl}`);
      
      const response = await axios.get(vkUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Referer': 'https://vk.com/',
            'Origin': 'https://vk.com'
        }
      });

      // Try multiple regex patterns to capture video URL from player params
      const patterns = [
        /url1080["']\s*:\s*["']([^"']+)["']/,
        /url720["']\s*:\s*["']([^"']+)["']/,
        /url480["']\s*:\s*["']([^"']+)["']/,
        /url360["']\s*:\s*["']([^"']+)["']/,
        /url240["']\s*:\s*["']([^"']+)["']/,
        /hls["']\s*:\s*["']([^"']+)["']/
      ];

      for (const pattern of patterns) {
        const match = response.data.match(pattern);
        if (match) {
          const directUrl = match[1].replace(/\\/g, '');
          console.log(`[VK Video] Found direct URL: ${directUrl.substring(0, 50)}...`);
          return directUrl;
        }
      }

      console.error("[VK Video] Could not extract direct URL.");
      return null;
    } catch (error) {
      console.error("[VK Video] Error extracting video URL:", error);
      return null;
    }
  }
};
