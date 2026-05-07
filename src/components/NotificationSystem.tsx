import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Sparkles, X, ChevronRight, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, useTranslation } from '../i18n';

interface NotificationDoc {
  id: string;
  type: 'anime' | 'episode';
  title: string;
  message: string;
  posterUrl?: string;
  animeId: string;
  createdAt: Timestamp;
}

interface NotificationSystemProps {
  language?: Language;
}

export default function NotificationSystem({ language = 'uz' }: NotificationSystemProps) {
  const t = useTranslation(language);
  const [lastNotification, setLastNotification] = useState<NotificationDoc | null>(null);
  const [show, setShow] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    // We only want to show notifications created AFTER the session started
    const sessionStartTime = Timestamp.now();

    const q = query(
      collection(db, 'public_notifications'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;

      const newNotif = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as NotificationDoc;

      // Skip showing if it's an old notification or if we are just initializing
      if (isFirstLoad) {
        setIsFirstLoad(false);
        return;
      }

      // Check if notification is truly new (created after our session started)
      const notifTime = typeof (newNotif.createdAt as any)?.toMillis === 'function' ? (newNotif.createdAt as any).toMillis() : 0;
      const sessionTime = typeof (sessionStartTime as any)?.toMillis === 'function' ? (sessionStartTime as any).toMillis() : 0;
      
      if (notifTime < sessionTime) return;

      setLastNotification(newNotif);
      setShow(true);

      // Auto hide after 8 seconds
      const timer = setTimeout(() => {
        setShow(false);
      }, 8000);

      return () => clearTimeout(timer);
    });

    return () => unsubscribe();
  }, [isFirstLoad]);

  return (
    <AnimatePresence>
      {show && lastNotification && (
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, x: 20 }}
          className="fixed bottom-6 right-6 z-[999] w-[320px] sm:w-[380px]"
        >
          <div className="bg-black/95 overflow-hidden rounded-[2rem] shadow-[0_30px_120px_rgba(0,0,0,1)] border border-white/20 flex flex-col relative backdrop-blur-3xl">
            {/* Progress Bar */}
            <motion.div 
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 8, ease: "linear" }}
              className="h-1 bg-red-500 absolute top-0 left-0 z-10"
            />

            <div className="p-5 flex gap-4 pt-6">
              {/* Poster or Icon */}
              <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5 shadow-2xl">
                {lastNotification.posterUrl ? (
                  <img 
                    src={lastNotification.posterUrl} 
                    alt={lastNotification.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-red-500">
                    <Sparkles size={24} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">{t('new')} {lastNotification.type === 'anime' ? t('newAnime') : t('episode')}</span>
                </div>
                
                <h4 className="text-white font-black text-sm uppercase tracking-tight truncate mb-1">
                  {lastNotification.title}
                </h4>
                
                <p className="text-slate-200 text-[10px] font-medium leading-relaxed line-clamp-2 text-shadow-sm">
                  {lastNotification.message}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <button 
                    onClick={() => {
                        setShow(false);
                        window.location.reload(); 
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                  >
                    <Play size={12} fill="currentColor" /> {t('watch')}
                  </button>
                  <button 
                    onClick={() => setShow(false)}
                    className="text-slate-500 hover:text-white transition-colors p-2 bg-white/5 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
