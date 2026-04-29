import { Request, Response } from "express";
import axios from "axios";

export class OkRuStreamer {
  async handleStream(req: Request, res: Response) {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).send("No url query parameter");

    try {
      // OK.ru video ID ni aniqlash
      let videoId = "";
      const match = videoUrl.match(/video\/(\d+)/) || videoUrl.match(/v=(\d+)/) || videoUrl.match(/embed\/(\d+)/);
      if (match) videoId = match[1];

      if (!videoId) return res.status(400).send("Invalid OK.ru URL");

      // Embed sahifasini tekshirish
      const embedUrl = `https://ok.ru/videoembed/${videoId}`;
      
      // OK.ru odatda iframe orqali yaxshi ishlaydi. 
      // Lekin biz uni iframe-ga yo'naltiramiz yoki proxy qilamiz.
      res.redirect(embedUrl);

    } catch (err: any) {
      console.error("[OK.ru Streamer] Error:", err.message);
      res.status(500).send("OK.ru xatoligi: " + err.message);
    }
  }
}

export const okRuStreamer = new OkRuStreamer();
