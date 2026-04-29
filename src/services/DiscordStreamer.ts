import { Request, Response } from "express";
import axios from "axios";

export class DiscordStreamer {
  async handleStream(req: Request, res: Response) {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).send("No url query parameter");

    // Faqat discord linklarini tekshirish
    if (!videoUrl.includes("discordapp.com") && !videoUrl.includes("discordapp.net")) {
        return res.status(400).send("Faqat Discord linklari ruxsat etilgan.");
    }

    try {
      const range = req.headers.range;
      
      const config: any = {
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      };

      if (range) {
        config.headers.Range = range;
      }

      const response = await axios.get(videoUrl, config);

      // CORS va headerlarni o'rnatish
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      res.setHeader("Content-Type", response.headers['content-type'] || 'video/mp4');
      res.setHeader("Accept-Ranges", "bytes");

      if (response.headers['content-range']) {
        res.setHeader("Content-Range", response.headers['content-range']);
        res.status(206);
      } else if (response.headers['content-length']) {
        res.setHeader("Content-Length", response.headers['content-length']);
      }

      response.data.pipe(res);

      res.on('close', () => {
        response.data.destroy();
      });

    } catch (err: any) {
      console.error("[Discord Streamer] Error:", err.message);
      res.status(500).send("Discorddan yuklashda xato: " + err.message);
    }
  }
}

export const discordStreamer = new DiscordStreamer();
