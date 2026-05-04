import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import axios from "axios";
import { Resend } from "resend";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { slugify } from "./src/lib/slugs.js";

// CRITICAL: Force the project ID into the environment to prevent the SDK 
// from defaulting to the internal AI Studio project.
// This must be set before any firebase-admin modules are imported.
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;

const resend = new Resend(process.env.RESEND_API_KEY || "re_12JeyV4W_86o1wrUPcGEYbuP8eVU7imvt");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`DEBUG: Project ID from config: ${firebaseConfig.projectId}`);

// Initialize Firebase Admin with explicit configuration
if (admin.apps.length === 0) {
  try {
    const envFirebaseConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
    const projectId = envFirebaseConfig.projectId || firebaseConfig.projectId;
    
    console.log(`[Firebase] Initializing Admin for project: ${projectId}`);
    
    if (envFirebaseConfig.projectId && envFirebaseConfig.projectId !== firebaseConfig.projectId) {
      console.warn(`[Firebase] Project ID mismatch detected! Using environment's ${envFirebaseConfig.projectId} instead of config's ${firebaseConfig.projectId}`);
    }

    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.GCLOUD_PROJECT = projectId;

    admin.initializeApp({
      projectId: projectId
    });
  } catch (e: any) {
    console.error("[Firebase] Admin Initialization Error:", e.message);
  }
}

// Access services with robust database ID resolution
let _db: any = null;
const getDbAdmin = () => {
  if (_db) return _db;

  const configDbId = firebaseConfig.firestoreDatabaseId;
  const envFirebaseConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
  const envDbId = envFirebaseConfig.firestoreDatabaseId;

  // Prefer environment database ID if available
  const effectiveDbId = envDbId || configDbId;

  try {
    if (effectiveDbId && effectiveDbId !== "(default)" && effectiveDbId.trim() !== "") {
      console.log(`[Firebase] Attempting to use database: "${effectiveDbId}"`);
      _db = getFirestore(effectiveDbId);
      return _db;
    }
  } catch (e: any) {
    console.warn(`[Firebase] Failed to initialize database "${effectiveDbId}", falling back to default:`, e.message);
  }
  
  console.log(`[Firebase] Using default database`);
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

import { telegramNotificationService } from "./src/services/TelegramNotificationService.js";

// Global helper for Telegram notifications
// @ts-ignore
global.triggerTelegramCheck = async () => {
  try {
    console.log("[TelegramBridge] Starting check...");
    let db = getDbAdmin();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    let notificationsSnap;
    try {
      notificationsSnap = await db.collection('public_notifications')
        .where('createdAt', '>=', sevenDaysAgo)
        .where('sentToTelegram', '==', false)
        .get();
    } catch (e: any) {
      const errorMsg = e.message || '';
      console.warn(`[TelegramBridge] Primary attempt failed: ${errorMsg}`);
      
      // If it failed with NOT_FOUND or PERMISSION_DENIED, try the fallback
      if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('NOT_FOUND') || e.code === 7 || e.code === 5) {
        console.warn(`[TelegramBridge] Attempting default DB fallback...`);
        // We force standard getFirestore() which usually hits (default)
        const defaultDb = getFirestore();
        notificationsSnap = await defaultDb.collection('public_notifications')
          .where('createdAt', '>=', sevenDaysAgo)
          .where('sentToTelegram', '==', false)
          .get();
        // If this succeeds, update the cached _db for future calls
        _db = defaultDb;
      } else {
        throw e;
      }
    }

    console.log(`[TelegramBridge] Found ${notificationsSnap.size} pending notifications to send to Telegram`);

    if (notificationsSnap.empty) return;

    for (const docSnap of notificationsSnap.docs) {
      const data = docSnap.data();
      console.log(`[TelegramBridge] Sending Telegram message for: ${data.title}`);
      await telegramNotificationService.sendNotification({
        title: data.title,
        message: data.message,
        posterUrl: data.posterUrl,
        animeId: data.animeId,
        type: data.type || 'anime'
      });

      // Mark as sent
      await docSnap.ref.update({ sentToTelegram: true });
      console.log(`[TelegramBridge] Successfully marked notification ${docSnap.id} as sent`);
    }
  } catch (error) {
    console.error("[TelegramBridge] CRITICAL error during check:", error);
  }
};

async function setupServer() {
  app.use(express.json());

  // Cloudflare Turnstile verification
  app.post("/api/verify-turnstile", async (req, res) => {
    const { token } = req.body;
    const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

    if (!token) {
      return res.status(400).json({ success: false, message: "Captcha tokeni talab qilinadi" });
    }

    try {
      const formData = new URLSearchParams();
      formData.append('secret', secretKey || '0x4AAAAAAC_bMjdxOF0heoEKSApYVqf_fu4');
      formData.append('response', token);

      const result = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        formData.toString()
      );

      if (result.data.success) {
        res.json({ success: true });
      } else {
        res.status(403).json({ success: false, message: "Captcha tekshiruvi muvaffaqiyatsiz bo'ldi", errors: result.data['error-codes'] });
      }
    } catch (error) {
      console.error("[Captcha] Verify error:", error);
      res.status(500).json({ success: false, message: "Ichki server xatosi" });
    }
  });
  
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

  // Debug route for Firebase availability
  app.get("/api/debug/firebase-check", async (req, res) => {
    try {
      const db = getDbAdmin();
      // List collections as a proxy check for access
      const collections = await db.listCollections();
      const collectionNames = collections.map((c: any) => c.id);
      
      const config = {
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        authDomain: firebaseConfig.authDomain
      };

      // Try to list ALL databases if possible via admin
      let databases: any[] = [];
      try {
        // This might require different permissions, but useful to try
        const client = admin.firestore();
        // @ts-ignore
        if (typeof client.listDatabases === 'function') {
           // @ts-ignore
           databases = await client.listDatabases();
        }
      } catch (dbErr) {
        console.warn("Could not list databases:", dbErr);
      }

      res.json({
        success: true,
        config,
        collections: collectionNames,
        databases: databases.map((d: any) => d.id || d.name),
        env: {
          GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
          NODE_ENV: process.env.NODE_ENV
        }
      });
    } catch (error: any) {
      console.error("[Firebase Check Error]", error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        code: error.code,
        config: {
          projectId: firebaseConfig.projectId,
          databaseId: firebaseConfig.firestoreDatabaseId
        }
      });
    }
  });

  // Robots.txt
  app.get("/robots.txt", (req, res) => {
    const host = req.get('host') || "animem.uz";
    const protocol = req.protocol === 'http' && host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    res.type("text/plain");
    res.send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${baseUrl}/sitemap.xml`);
  });

  // Dynamic Sitemap Generation
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const db = getDbAdmin();
      const host = req.get('host') || "animem.uz";
      const protocol = req.protocol === 'http' && host.includes('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;
      
      console.log(`[Sitemap] Generating for ${baseUrl}...`);

      // Only fetch basic anime data, limit to 2000 to prevent timeouts
      const animeSnapshot = await db.collection('anime')
        .orderBy('updatedAt', 'desc')
        .limit(2000)
        .get();
      
      const animeDocs = animeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const categories = [
        'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 
        'Mecha', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 
        'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Horror',
        'Isekai', 'Shounen', 'Seinen', 'Shoujo', 'Music'
      ];

      const now = new Date().toISOString().split('T')[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      // 1. Home
      xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

      // 2. Main sections
      xml += `  <url>\n    <loc>${baseUrl}/news</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${baseUrl}/chat</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>always</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

      // 3. Categories
      categories.forEach(cat => {
        xml += `  <url>\n    <loc>${baseUrl}/category/${encodeURIComponent(cat.toLowerCase())}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      });

      // 4. Individual Anime
      for (const anime of animeDocs) {
        let lastMod = now;
        try {
          if (anime.updatedAt) {
            if (typeof anime.updatedAt.toMillis === 'function') {
              lastMod = new Date(anime.updatedAt.toMillis()).toISOString().split('T')[0];
            } else if (anime.updatedAt instanceof Date) {
              lastMod = anime.updatedAt.toISOString().split('T')[0];
            } else if (typeof anime.updatedAt === 'number') {
              lastMod = new Date(anime.updatedAt).toISOString().split('T')[0];
            }
          }
        } catch (e) {
          lastMod = now;
        }
        
        xml += `  <url>\n    <loc>${baseUrl}/anime/${anime.id}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      xml += `</urlset>`;

      res.header('Content-Type', 'application/xml');
      res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.status(200).send(xml);
    } catch (error) {
      console.error("Sitemap error:", error);
      const host = req.get('host') || "animem.uz";
      const baseUrl = `https://${host}`;
      const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${baseUrl}/</loc><priority>1.0</priority></url>\n</urlset>`;
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
          // @ts-ignore
          await global.triggerTelegramCheck();
        }
      }, 2000);
      
      res.json({ success: true, message: "Telegram yangilash navbatga qo'yildi" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Debug test for Telegram
  app.get("/api/admin/test-telegram", async (req, res) => {
    try {
      await telegramNotificationService.sendNotification({
        title: "TEST NOTIFICATION",
        message: "Bu robotning ishlashini tekshirish uchun test xabari.",
        animeId: "test",
        type: 'anime'
      });
      res.json({ success: true, message: "Test xabari Telegramga yuborildi (loglarni tekshiring)" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Broadcast notification endpoint
  app.post("/api/admin/broadcast-notification", async (req, res) => {
    const { title, body, imageUrl, animeId } = req.body;
    
    try {
      const db = getDbAdmin();
      const tokensSnap = await db.collection('fcm_tokens').get();
      const tokens = tokensSnap.docs.map(doc => doc.data().token);

      if (tokens.length === 0) {
        return res.json({ success: true, message: "No tokens found" });
      }

      const message = {
        notification: { title, body, image: imageUrl },
        data: { animeId: animeId || '' },
        tokens: tokens
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
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
        res.json({ success: true, message: "Process continued with FCM error", error: fcmErr.message });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start periodic check
  setInterval(() => {
    if (typeof global.triggerTelegramCheck === 'function') {
      // @ts-ignore
      global.triggerTelegramCheck().catch(console.error);
    }
  }, 60000); // Every 1 minute

  // Initial check
  setTimeout(() => {
    if (typeof global.triggerTelegramCheck === 'function') {
      // @ts-ignore
      global.triggerTelegramCheck().catch(console.error);
    }
  }, 5000);

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
  });
}

export default app;
