import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Request, Response } from "express";

import bigInt from "big-integer";

export class TelegramStreamer {
  public client: TelegramClient | null = null;
  private apiId: number;
  private apiHash: string;
  private botToken: string;
  private isConnecting: boolean = false;

  constructor() {
    this.apiId = parseInt(process.env.TELEGRAM_API_ID || "36366791");
    this.apiHash = process.env.TELEGRAM_API_HASH || "e494913ccca499ce817eba1c660b0982";
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  }

  async init() {
    console.log("[Telegram Streamer] Init chaqirildi...");
    if (!this.apiId || !this.apiHash || !this.botToken) {
      console.warn("[Telegram Streamer] Kalitlar to'liq emas. API_ID/HASH/BOT_TOKEN kerak.");
      return false;
    }
    if (this.client || this.isConnecting) return true;

    this.isConnecting = true;
    console.log("[Telegram Streamer] TelegramClient ob'ekti yaratilmoqda...");
    const stringSession = new StringSession("");
    this.client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });

    try {
      console.log("[Telegram Streamer] Telegramga ulanish (start) jarayoni...");
      await this.client.start({
        botAuthToken: this.botToken,
      });
      console.log("[Telegram Streamer] Telegramga muvaffaqiyatli ulandi!");
      this.isConnecting = false;
      return true;
    } catch (err: any) {
      console.error("[Telegram Streamer] Telegramga ulanishda xato:", err.message);
      this.client = null;
      this.isConnecting = false;
      return false;
    }
  }

  async handleStream(req: Request, res: Response) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      return res.status(204).end();
    }
    if (!this.client) {
      const initialized = await this.init();
      if (!initialized || !this.client) {
         return res.status(503).send("Telegram Streaming Client ishlamayapti (Token kiritilmagan bo'lishi mumkin).");
      }
    }

    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).send("No url query parameter");

    try {
      const match = videoUrl.match(/t\.me\/(?:c\/)?([a-zA-Z0-9_\-\+]+)\/(\d+)/);
      if (!match) {
        console.warn("[Telegram Streamer] URL mos kelmadi:", videoUrl);
        return res.status(400).send("Invalid Telegram URL.");
      }

      let channelName: string | number = match[1];
      const messageId = parseInt(match[2]);

      console.log(`[Telegram Streamer] Surov keldi. MsgID: ${messageId}, Channel: ${channelName}`);

      // Handle private channels (t.me/c/12345/1)
      if (!isNaN(Number(channelName))) {
         // This is a private channel id. 
         // GramJS works best with -100 prefix for channels.
         // Note: Some channels might need different prefix or just string id.
         const cleanId = channelName.toString();
         channelName = Number("-100" + cleanId);
         console.log(`[Telegram Streamer] Private channel formatga o'tkazildi: ${channelName}`);
      }

      console.log("[Telegram Streamer] Xabar qidirilmoqda...");
      let messages;
      try {
        messages = await this.client.getMessages(channelName, { ids: [messageId] });
      } catch (getMsgErr: any) {
        console.error("[Telegram Streamer] getMessages xatosi:", getMsgErr.message);
        return res.status(500).send("Telegramdan xabarni olib bo'lmadi: " + getMsgErr.message);
      }

      if (!messages || messages.length === 0 || !messages[0]) {
        console.warn("[Telegram Streamer] Xabar topilmadi.");
        return res.status(404).send("Message not found or accessible. Bot kanalda admin emasmi?");
      }

      const media = messages[0].media;
      if (!media) {
        console.warn("[Telegram Streamer] Media topilmadi.");
        return res.status(404).send("Mediya topilmadi.");
      }

      console.log("[Telegram Streamer] Media topildi:", (media as any).className || "Document/Photo");

      // Handle various media types
      // @ts-ignore
      const document = media.document || media.photo || media; 
      if (!document) {
        return res.status(404).send("Not a document/video.");
      }

      const size = (document as any).size ? Number((document as any).size) : 
                   ((media as any).document && (media as any).document.size ? Number((media as any).document.size) : 0);
      let mimeType = (document as any).mimeType || ((media as any).document && (media as any).document.mimeType) || "video/mp4";
      
      // Force video/mp4 for common video extensions if generic
      if (mimeType === "application/octet-stream" || mimeType === "video/quicktime") {
        mimeType = "video/mp4";
      }

      console.log(`[Telegram Streamer] Media hajmi: ${size} bytes, MimeType: ${mimeType}`);
      
      const range = req.headers.range;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Accept-Ranges", "bytes");

      if (!range) {
        res.setHeader("Content-Length", size);
        res.setHeader("Content-Type", mimeType);
        
        const iterator = this.client.iterDownload({
          file: media,
          offset: bigInt(0),
          limit: size, 
          requestSize: 1024 * 512, // 512KB
        });
        
        for await (const chunk of iterator) {
          if (res.destroyed || (res as any).closed) break;
          res.write(chunk);
        }
        res.end();
        return;
      }

      // Range parsing
      const positions = range.replace(/bytes=/, "").split("-");
      const start = parseInt(positions[0], 10);
      const end = positions[1] && positions[1] !== "" ? parseInt(positions[1], 10) : size - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mimeType,
      });

      console.log(`[Telegram Stream] Streaming chunk: ${start} - ${end} (${chunksize} bytes)`);
      
      try {
        const iterator = this.client.iterDownload({
          file: media,
          offset: bigInt(start),
          limit: chunksize,
          requestSize: 512 * 1024,
        });

        for await (const chunk of iterator) {
          if (res.destroyed || (res as any).closed) break;
          res.write(chunk);
        }
        res.end();
      } catch (streamErr: any) {
        console.error("[Telegram Streamer] Stream iteration error:", streamErr.message);
        if (!res.destroyed && !(res as any).closed) res.end();
      }

    } catch (err: any) {
      console.error("[Telegram Streamer] Umumiy xato:", err.message);
      if (!res.headersSent) {
          res.status(500).send("Stream xatosi");
      } else {
          res.end();
      }
    }
  }
}

export const tgStreamer = new TelegramStreamer();
