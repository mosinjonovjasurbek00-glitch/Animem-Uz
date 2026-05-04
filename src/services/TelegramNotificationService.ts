import axios from 'axios';

interface TelegramNotification {
  title: string;
  message: string;
  posterUrl?: string;
  animeId: string;
  type: 'anime' | 'episode';
}

export class TelegramNotificationService {
  private botToken: string = '';
  private channelId: string = '';

  constructor() {}

  private getBotToken(): string {
    return process.env.TELEGRAM_BOT_TOKEN || '8691724835:AAH_mhOtbNj-wwJCeuVLsTSzVLd9rsfjhx4';
  }

  private getChannelId(): string {
    return process.env.TELEGRAM_CHANNEL_ID || '@animem_uz1';
  }

  private isConfigured(): boolean {
    return !!this.getBotToken() && !!this.getChannelId();
  }

  async sendNotification(notif: TelegramNotification) {
    const token = this.getBotToken();
    const channel = this.getChannelId();

    if (!token || !channel) {
      console.warn('[TelegramBot] Service not configured. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID');
      return;
    }

    const baseUrl = 'https://animem.uz';
    const watchUrl = `${baseUrl}/anime/${notif.animeId}`;
    
    let caption = '';
    
    if (notif.type === 'anime') {
      caption = `🆕 <b>YANGI ANIME!</b>\n\n` +
                `🎬 <b>${notif.title}</b>\n` +
                `📝 ${notif.message}\n\n` +
                `🍿 <b>Hoziroq tomosha qiling:</b>\n` +
                `🔗 <a href="${watchUrl}">${baseUrl}</a>\n\n` +
                `#yangi #anime #animemuz`;
    } else {
      caption = `🆕 <b>YANGI QISM!</b>\n\n` +
                `🎬 <b>${notif.title}</b>\n` +
                `✨ ${notif.message}\n\n` +
                `🍿 <b>Tomosha qilish:</b>\n` +
                `🔗 <a href="${watchUrl}">${baseUrl}</a>\n\n` +
                `#yangi_qism #anime #animemuz`;
    }

    try {
      if (notif.posterUrl) {
        // Send as photo
        await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, {
          chat_id: channel,
          photo: notif.posterUrl,
          caption: caption,
          parse_mode: 'HTML'
        });
      } else {
        // Send as message
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: channel,
          text: caption,
          parse_mode: 'HTML'
        });
      }
      console.log(`[TelegramBot] Notification sent for: ${notif.title} to ${channel}`);
    } catch (error: any) {
      console.error('[TelegramBot] Failed to send notification:', error.response?.data || error.message);
    }
  }
}

export const telegramNotificationService = new TelegramNotificationService();
