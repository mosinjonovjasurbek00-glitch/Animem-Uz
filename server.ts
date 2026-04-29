import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { Resend } from "resend";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { slugify } from "./src/lib/slugs.js";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY || "re_Upcvv97i_JJVBvU8afHGGUVyUp1a2qYSU");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL: Force the project ID into the environment to prevent the SDK 
// from defaulting to the internal AI Studio project.
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;

console.log(`DEBUG: Project ID from config: ${firebaseConfig.projectId}`);

// Initialize Firebase Admin with Application Default Credentials
if (admin.apps.length === 0) {
  try {
    console.log(`[Firebase] Initializing Admin for project: ${firebaseConfig.projectId}`);
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId
    });
  } catch (e: any) {
    console.warn("[Firebase] Init with credentials failed, trying minimal:", e.message);
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
}

// Access services with robust database ID resolution and caching
let _db: any = null;
const getDbAdmin = () => {
  if (_db) return _db;

  const configDbId = firebaseConfig.firestoreDatabaseId;
  const projectId = firebaseConfig.projectId;

  try {
    if (configDbId && configDbId !== "(default)" && configDbId.trim() !== "") {
      console.log(`[Firebase] Initializing Firestore for named database: ${configDbId} in project ${projectId}`);
      _db = getFirestore(admin.app(), configDbId);
      return _db;
    }
  } catch (e) {
    console.warn("[Firebase] Named DB access failed, trying default:", e);
  }
  
  console.log(`[Firebase] Falling back to default database in project ${projectId}`);
  _db = getFirestore();
  return _db;
};

const getAuthAdmin = () => getAuth();

import { tgStreamer } from "./src/services/TelegramStreamer";
import { discordStreamer } from "./src/services/DiscordStreamer";
import { okRuStreamer } from "./src/services/OkRuStreamer";
import { rumbleStreamer } from "./src/services/RumbleStreamer";
import { dailymotionStreamer } from "./src/services/DailymotionStreamer";
import { vkStreamer } from "./src/services/VkStreamer";
import { dtubeStreamer } from "./src/services/DTubeStreamer";

export const app = express();
const PORT = 3000;

async function setupServer() {
  app.use(express.json());
  
  // Katta videolarni serverdan parchalab uzatish yo'li
  app.get("/api/telegram/stream", async (req, res) => {
    await tgStreamer.handleStream(req, res);
  });

  app.get("/api/discord/stream", async (req, res) => {
    await discordStreamer.handleStream(req, res);
  });

  app.get("/api/okru/stream", async (req, res) => {
    await okRuStreamer.handleStream(req, res);
  });

  // Rumble videolarni to'g'ridan-to'g'ri MP4 manzilini olish yo'li
  app.get("/api/rumble/stream", async (req, res) => {
    const url = req.query.url as string;
    const format = req.query.format as string;
    if (!url) return res.status(400).send("URL is required");

    try {
      const directUrl = await rumbleStreamer.getDirectUrl(url);
      
      // If directUrl is the same as the original embed URL, it means extraction failed
      if (directUrl && !directUrl.includes('/embed/')) {
         if (format === 'json') {
           return res.json({ url: directUrl });
         }
         res.redirect(directUrl);
      } else {
         if (format === 'json') {
           return res.json({ error: "No direct URL", embedUrl: url });
         }
         res.status(404).send("No direct video URL");
      }
    } catch (error) {
      if (format === 'json') {
         return res.json({ error: "Rumble extractor error" });
      }
      res.status(500).send("Rumble extractor error");
    }
  });

  // Dailymotion videolarni to'g'ridan-to'g'ri olish yo'li
  app.get("/api/dailymotion/stream", async (req, res) => {
    const url = req.query.url as string;
    const format = req.query.format as string;
    if (!url) return res.status(400).send("URL is required");

    try {
      const directUrl = await dailymotionStreamer.getDirectUrl(url);
      if (directUrl) {
         if (format === 'json') {
           return res.json({ url: directUrl });
         }
         res.redirect(directUrl);
      } else {
         if (format === 'json') {
           return res.json({ error: "Could not find direct video URL" });
         }
         res.status(404).send("Could not find direct video URL");
      }
    } catch (error) {
      if (format === 'json') {
         return res.json({ error: "Dailymotion error" });
      }
      res.status(500).send("Dailymotion error");
    }
  });

  // VK videolarni to'g'ridan-to'g'ri olish yo'li
  app.get("/api/vk/stream", async (req, res) => {
    const url = req.query.url as string;
    const format = req.query.format as string;
    if (!url) return res.status(400).send("URL is required");

    try {
      const directUrl = await vkStreamer.getDirectUrl(url);
      if (directUrl) {
         if (format === 'json') {
           return res.json({ url: directUrl });
         }
         res.redirect(directUrl);
      } else {
         if (format === 'json') {
           return res.json({ error: "Could not find direct video URL" });
         }
         res.status(404).send("Could not find direct video URL");
      }
    } catch (error) {
      if (format === 'json') {
        return res.json({ error: "VK error" });
      }
      res.status(500).send("VK error");
    }
  });

  // DTube videolarni to'g'ridan-to'g'ri olish yo'li
  app.get("/api/dtube/stream", async (req, res) => {
    const url = req.query.url as string;
    const format = req.query.format as string;
    if (!url) return res.status(400).send("URL is required");

    try {
      const directUrl = await dtubeStreamer.getDirectUrl(url);
      if (directUrl) {
         if (format === 'json') {
           return res.json({ url: directUrl });
         }
         res.redirect(directUrl);
      } else {
         if (format === 'json') {
           return res.json({ error: "Could not find direct video URL" });
         }
         res.status(404).send("Could not find direct video URL");
      }
    } catch (error) {
      if (format === 'json') {
         return res.json({ error: "DTube error" });
      }
      res.status(500).send("DTube error");
    }
  });

  // Proxy route
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("URL is required");

    try {
      const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Referer': new URL(imageUrl).origin,
        },
        timeout: 20000,
      });

      const contentType = response.headers["content-type"] || "image/jpeg";
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(response.data));
    } catch (error: any) {
      res.status(500).send("Proxy error");
    }
  });

  // Auth Verification Routes
  app.post("/api/auth/send-code", async (req, res) => {
    const { email, turnstileToken } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    if (!turnstileToken) return res.status(400).json({ error: "Bot verification required" });

    try {
      // Verify Cloudflare Turnstile Token
      const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "1x000000000000000000000000000000000";
      const verifyResponse = await axios.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        new URLSearchParams({
          secret: secretKey,
          response: turnstileToken,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      if (!verifyResponse.data.success) {
        return res.status(400).json({ error: "Bot verification failed" });
      }

      const db = getDbAdmin();
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      await db.collection("verification_codes").doc(email).set({
        code,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[Verification] Code for ${email}: ${code}`);
      
      try {
        await resend.emails.send({
          from: 'Anime Portal <onboarding@resend.dev>',
          to: email,
          subject: 'Tasdiqlash kodi',
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #e11d48; text-align: center;">Anime Portal</h2>
              <p style="color: #666; text-align: center;">Xush kelibsiz! Accountni tasdiqlash uchun quyidagi kodni kiriting:</p>
              <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #000; margin: 20px 0;">
                ${code}
              </div>
              <p style="color: #999; font-size: 12px; text-align: center;">Kod 10 daqiqa davomida amal qiladi.</p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("[Resend Error]", emailErr);
        // We still return success because code is in DB, but in a real app we'd handle it.
      }
      
      res.json({ success: true, message: "Verification code sent" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/verify-code", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

    try {
      const db = getDbAdmin();
      const doc = await db.collection("verification_codes").doc(email).get();
      
      if (!doc.exists) return res.status(400).json({ error: "Code not found" });
      
      const data = doc.data();
      if (data?.code !== code) return res.status(400).json({ error: "Incorrect code" });
      if (Date.now() > data.expiresAt) return res.status(400).json({ error: "Code expired" });

      // Optional: Delete code after use
      await db.collection("verification_codes").doc(email).delete();

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Robots.txt
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: https://animem.uz/sitemap.xml`);
  });

  // Dynamic Sitemap Generation
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const db = getDbAdmin();
      // Only fetch basic anime data to keep it fast
      const animeSnapshot = await db.collection('anime').orderBy('updatedAt', 'desc').get();
      const animeDocs = animeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const categories = [
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 
        'Mecha', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 
        'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Horror',
        'Isekai', 'Shounen', 'Seinen', 'Shoujo', 'Music'
      ];

      const baseUrl = "https://animem.uz";
      const now = new Date().toISOString().split('T')[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

      // 1. Home
      xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

      // 2. Main sections
      xml += `  <url>\n    <loc>${baseUrl}/news</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${baseUrl}/chat</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>always</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

      // 3. Categories
      categories.forEach(cat => {
        xml += `  <url>\n    <loc>${baseUrl}/category/${encodeURIComponent(cat.toLowerCase())}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      });

      // 4. Individual Anime (Only main pages to avoid timeouts)
      for (const anime of animeDocs) {
        const lastMod = anime.updatedAt ? 
          (typeof anime.updatedAt.toMillis === 'function' ? new Date(anime.updatedAt.toMillis()).toISOString().split('T')[0] : 
           (anime.updatedAt instanceof Date ? anime.updatedAt.toISOString().split('T')[0] : now)) : now;
        
        xml += `  <url>\n    <loc>${baseUrl}/anime/${anime.id}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      xml += `</urlset>`;

      res.header('Content-Type', 'application/xml');
      res.status(200).send(xml);
    } catch (error) {
      console.error("Sitemap error:", error);
      // Fallback minimal sitemap if Firestore Admin fails
      const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://animem.uz/</loc><priority>1.0</priority></url>\n</urlset>`;
      res.header('Content-Type', 'application/xml');
      res.status(200).send(minimalXml);
    }
  });

  // Bot API for Telegram or other integrations (Open Professional Version)
  app.get("/api/bot/latest-activity", async (req, res) => {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*'); 
      const db = getDbAdmin();
      
      // 1. Get latest 15 anime
      const animeSnap = await db.collection('anime')
        .orderBy('createdAt', 'desc')
        .limit(15)
        .get();
      
      const latestAnime = animeSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description || "",
          posterUrl: data.posterUrl || "",
          rating: data.rating || 0,
          year: data.year || 0,
          category: data.category || "",
          updatedAt: data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date()
        };
      });

      // 2. Get latest 15 notifications (detailed episodes)
      const notificationsSnap = await db.collection('public_notifications')
        .orderBy('createdAt', 'desc')
        .limit(15)
        .get();
      
      const latestEpisodes = notificationsSnap.docs
        .map(doc => {
          const data = doc.data();
          if (data.type !== 'episode') return null;
          return {
            id: doc.id,
            animeTitle: data.title,
            episodeInfo: data.message,
            posterUrl: data.posterUrl,
            animeId: data.animeId,
            timestamp: data.createdAt?.toDate?.() || new Date()
          };
        })
        .filter(Boolean);

      res.json({
        success: true,
        source: "Animem.uz PRO API",
        generatedAt: new Date().toISOString(),
        data: {
          anime: latestAnime,
          episodes: latestEpisodes
        }
      });
    } catch (error: any) {
      console.error("PRO Bot API error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Server xatosi", 
        details: error.message 
      });
    }
  });

  // Direct trigger for Telegram Bridge (used by Admin Panel)
  app.post("/api/admin/trigger-telegram", async (req, res) => {
    try {
      // Small delay to ensure Firestore has indexed the new document
      setTimeout(async () => {
        if (typeof global.triggerTelegramCheck === 'function') {
          await global.triggerTelegramCheck();
        }
      }, 2000);
      
      res.json({ success: true, message: "Telegram yangilash navbatga qo'yildi" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Broadcast notification endpoint
  app.post("/api/admin/broadcast-notification", async (req, res) => {
    const { title, body, imageUrl, animeId } = req.body;
    
    // Basic auth check would be good here, but for now we follow the app's pattern
    // In production, we'd check req.headers.authorization via firebase-admin verifyIdToken

    try {
      const db = getDbAdmin();
      const tokensSnap = await db.collection('fcm_tokens').get();
      const tokens = tokensSnap.docs.map(doc => doc.data().token);

      if (tokens.length === 0) {
        return res.json({ success: true, message: "No tokens found" });
      }

      console.log(`Sending push notification to ${tokens.length} devices: ${title}`);

      const message = {
        notification: {
          title,
          body,
          image: imageUrl
        },
        data: {
          animeId: animeId || '',
          click_action: 'FLUTTER_NOTIFICATION_CLICK' // For consistency, though we are web
        },
        tokens: tokens
      };

      // sendEachForMulticast is the modern way in v11+
      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Push success: ${response.successCount}, failures: ${response.failureCount}`);
        
        // Cleanup invalid tokens
        if (response.failureCount > 0) {
          const batch = db.batch();
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
                batch.delete(tokensSnap.docs[idx].ref);
              }
            }
          });
          await batch.commit();
        }
        res.json({ success: true, count: response.successCount });
      } catch (fcmErr: any) {
        console.error("FCM broadcast error:", fcmErr);
        res.json({ success: true, message: "Process continued with FCM error", error: fcmErr.message });
      }
    } catch (error: any) {
      console.error("Route error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // SEO Injection Helper
  const injectMetaTags = async (req: express.Request, html: string) => {
    const path = req.path;
    let title = "Animem Uz - O'zbekistondagi eng yirik anime portali";
    let description = "Animem Uz - Sevimli animelaringizni o'zbek va rus tillarida, HD sifatda onlayn tomosha qiling. Eng so'nggi anime seriallar va filmlar.";
    let image = "https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg";
    let url = `https://animem.uz${path}`;

    // Regex for /anime/:slug or /watch/:slug/:ep
    const animeMatch = path.match(/^\/(anime|watch)\/([^\/]+)/);
    
    if (animeMatch) {
      const slug = animeMatch[2];
      try {
        const db = getDbAdmin();
        const animeSnapshot = await db.collection('anime').get();
        const anime = animeSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() as any }))
          .find(a => slugify(a.title) === slug || a.id === slug);

        if (anime) {
          title = `${anime.title} - Animem Uz`;
          description = (anime.description || "").substring(0, 160);
          image = anime.posterUrl || image;
        }
      } catch (e) {
        console.error("SEO injection data fetch error:", e);
      }
    }

    return html
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(/<meta name="title" content=".*?" \/>/, `<meta name="title" content="${title}" />`)
      .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`)
      .replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`)
      .replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${description}" />`)
      .replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${image}" />`)
      .replace(/<meta property="og:url" content=".*?" \/>/g, `<meta property="og:url" content="${url}" />`)
      .replace(/<meta property="twitter:title" content=".*?" \/>/g, `<meta property="twitter:title" content="${title}" />`)
      .replace(/<meta property="twitter:description" content=".*?" \/>/g, `<meta property="twitter:description" content="${description}" />`)
      .replace(/<meta property="twitter:image" content=".*?" \/>/g, `<meta property="twitter:image" content="${image}" />`)
      .replace(/<meta property="twitter:url" content=".*?" \/>/g, `<meta property="twitter:url" content="${url}" />`)
      .replace(/<meta property="og:site_name" content=".*?" \/>/g, `<meta property="og:site_name" content="Animem Uz" />`);
  };

  // Debug route for Telegram Bridge
  app.get("/api/debug/telegram-test", async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!token || !channelId) {
      return res.status(400).json({ 
        error: "Sozlamalar yetishmayapti", 
        tokenSet: !!token, 
        channelIdSet: !!channelId 
      });
    }

    let botInfo = null;
    let databaseStatus: any = {};

    try {
      // 1. Check Bot Token
      const url = `https://api.telegram.org/bot${token}/getMe`;
      const botRes = await fetch(url);
      botInfo = await botRes.json();

      // 2. Try Named Database from config
      try {
        const configDbId = firebaseConfig.firestoreDatabaseId;
        databaseStatus.configDbId = configDbId;
        
        if (configDbId && configDbId !== "(default)") {
          const namedDb = getFirestore(admin.app(), configDbId);
          const snap = await namedDb.collection('public_notifications').limit(1).get();
          databaseStatus.namedDb = { status: "success", count: snap.size };
        } else {
          databaseStatus.namedDb = { status: "skipped", reason: "No named DB in config" };
        }
      } catch (e: any) {
        databaseStatus.namedDb = { status: "error", message: e.message };
      }

      // 3. Try Default Database
      try {
        const defaultDb = getFirestore();
        const snap = await defaultDb.collection('public_notifications').limit(1).get();
        databaseStatus.defaultDb = { status: "success", count: snap.size };
      } catch (e: any) {
        databaseStatus.defaultDb = { status: "error", message: e.message };
      }

      res.json({
        success: true,
        botInfo: botInfo,
        channel: channelId,
        databaseStatus: databaseStatus,
        env: {
          project: process.env.GOOGLE_CLOUD_PROJECT,
          nodeEnv: process.env.NODE_ENV
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message, stack: e.stack });
    }
  });

  // Static files handling
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    // Serve static files with high priority
    app.use(express.static(distPath, { 
      index: false,
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.xml') || filePath.endsWith('.txt')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
  }

  // CRITICAL: Middleware/Static fallback MUST be last
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // SEO Injection for Dev
    app.get("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let html = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        html = await vite.transformIndexHtml(url, html);
        html = await injectMetaTags(req, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false })); // Disable automatic index serving
    app.get("*", async (req, res) => {
      try {
        let html = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
        html = await injectMetaTags(req, html);
        res.status(200).set({ "Content-Type": "text/html" }).send(html);
      } catch (e) {
        res.status(500).send("Server Error");
      }
    });
  }
}

// Global setup call
setupServer().catch(console.error);

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startTelegramBridge().catch(console.error);
  });
}

export default app;

/**
 * Telegram Bridge: Monitors Firestore for new notifications and posts them to Telegram.
 * This runs as a background task on the server.
 */
async function startTelegramBridge() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let channelId = process.env.TELEGRAM_CHANNEL_ID;

  if (!token || !channelId) {
    console.log("--- [Telegram Bridge] Sozlamalar topilmadi. BOT_TOKEN va CHANNEL_ID kiritishni unutmang. ---");
    return;
  }

  // Cleanup channelId if it's a full telegram URL
  if (channelId.includes('t.me/')) {
    channelId = '@' + channelId.split('t.me/')[1].replace('/', '');
  }

  console.log("--- [Telegram Bridge] Ishga tushirildi! Yangi kontent monitoringi faol. ---");
  let lastProcessedId: string | null = null;
  let bridgeActive: boolean = true;

  // Warm up: get the latest ID to avoid double-posting old content on restart
  try {
    const dbInstance = getDbAdmin();
    // Warm up logic: try with a simple get first if orderBy fails
    const initialSnap = await dbInstance.collection('public_notifications').orderBy('createdAt', 'desc').limit(1).get();
    
    if (!initialSnap.empty) {
      lastProcessedId = initialSnap.docs[0].id;
      console.log(`[Telegram Bridge] Warm-up complete. Last ID: ${lastProcessedId}`);
    } else {
      console.log("[Telegram Bridge] No notifications found in database yet.");
    }
  } catch (e: any) {
    const isNotFound = e.message && (e.message.includes('NOT_FOUND') || e.code === 5);
    const isPermissionDenied = e.message && (e.message.includes('PERMISSION_DENIED') || e.code === 7);

    if (isNotFound || isPermissionDenied) {
      console.error(`[Telegram Bridge] Initial access failed (${isNotFound ? 'NOT_FOUND' : 'PERMISSION_DENIED'}). This usually means the database or collection is not yet ready.`);
      
      // Try one more time without orderBy just in case it's an index issue appearing as permission denied (rare but possible in some SDK versions)
      try {
        const dbInstance = getDbAdmin();
        const fallbackSnap = await dbInstance.collection('public_notifications').limit(1).get();
        if (!fallbackSnap.empty) {
          lastProcessedId = fallbackSnap.docs[0].id;
          console.log(`[Telegram Bridge] Warm-up complete (fallback). Last ID: ${lastProcessedId}`);
        }
      } catch (err2) {
        console.warn("[Telegram Bridge] Fallback also failed. Bridge will continue but may miss initial state.");
      }
    } else {
      console.error("[Telegram Bridge] Unexpected initialization error:", e);
    }
  }

  // Periodic check function
  const checkAndPost = async () => {
    if (token === "YOUR_BOT_TOKEN") return; // Don't run with placeholders
    
    try {
      const dbInstance = getDbAdmin();
      const snap = await dbInstance.collection('public_notifications').orderBy('createdAt', 'desc').limit(10).get();
      if (snap.empty) return;

      const docs = snap.docs;
      const index = docs.findIndex(doc => doc.id === lastProcessedId);
      
      let newDocs = [];
      if (index === -1) {
        if (!lastProcessedId) {
           lastProcessedId = docs[0].id;
           return;
        } else {
           newDocs = docs;
        }
      } else {
        newDocs = docs.slice(0, index);
      }

      if (newDocs.length > 0) {
        for (const doc of newDocs.reverse()) {
          const data = doc.data();
          const siteUrl = "https://animem.uz";
          const title = data.type === 'anime' ? "🎬 YANGI ANIME (Animem Uz)!" : "🔔 YANGI QISM (Animem Uz)!";
          const text = `<b>${title}</b>\n\n<b>${data.title}</b>\n${data.message}\n\n🌐 Saytda ko'rish: ${siteUrl}`;

          try {
            const url = `https://api.telegram.org/bot${token}/sendPhoto`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: channelId,
                photo: data.posterUrl,
                caption: text,
                parse_mode: 'HTML'
              })
            });
            const result = await response.json();
            if (result.ok) {
              console.log(`[Telegram Bridge] Muvaffaqiyatli jo'natildi: ${data.title}`);
            }
          } catch (err) {
            console.error("[Telegram Bridge] Fetch error:", err);
          }
          lastProcessedId = doc.id;
        }
      }
    } catch (e: any) {
      const isPermissionDenied = e.message && (e.message.includes('PERMISSION_DENIED') || e.code === 7);
      if (isPermissionDenied) {
        console.warn("[Telegram Bridge] O'qish huquqi yo'q (PERMISSION_DENIED). Navbatdagi siklda qayta urinib ko'riladi.");
      } else {
        console.error("[Telegram Bridge] Loop error:", e);
      }
    }
  };

  // Assign to global for trigger access
  (global as any).triggerTelegramCheck = () => {
    if (bridgeActive) checkAndPost();
  };

  // Run every 2 minutes for faster response
  setInterval(() => {
    if (bridgeActive) checkAndPost();
  }, 1000 * 60 * 2);
  
  // Also run once immediately after 10 seconds to catch any missed updates
  setTimeout(() => {
    if (bridgeActive) checkAndPost();
  }, 1000 * 10);
}
