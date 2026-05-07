import React, { useState, useEffect } from 'react';
import { Bell, X, Sparkles, MessageSquare, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Language, useTranslation } from '../i18n';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'welcome' | 'update' | 'info';
  timestamp: number;
}

interface NotificationMenuProps {
  language?: Language;
}

export default function NotificationMenu({ language = 'uz' }: NotificationMenuProps) {
  const t = useTranslation(language);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    // 1. Load from localStorage
    const saved = localStorage.getItem('app_notifications');
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
    let initialNotifs: AppNotification[] = saved ? JSON.parse(saved) : [];

    // 2. Check for Welcome message
    const hasWelcomed = localStorage.getItem('has_welcomed');
    if (!hasWelcomed) {
      const welcome: AppNotification = {
        id: 'welcome-' + Date.now(),
        title: t('welcomeTitle'),
        message: t('welcomeMessage'),
        type: 'welcome',
        timestamp: Date.now()
      };
      if (!initialNotifs.some(n => n.type === 'welcome')) {
        initialNotifs = [welcome, ...initialNotifs];
        setHasNew(true);
      }
      localStorage.setItem('has_welcomed', 'true');
    }

    // 3. Listen for global updates (optional, from Firestore)
    const q = query(collection(db, 'public_notifications'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const newNotif: AppNotification = {
            id: change.doc.id,
            title: data.title || t('newNotification'),
            message: data.message || '',
            type: 'update',
            timestamp: typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : Date.now()
          };

          setNotifications(prev => {
            if (prev.some(n => n.id === newNotif.id) || dismissedIds.includes(newNotif.id)) return prev;
            const updated = [newNotif, ...prev];
            localStorage.setItem('app_notifications', JSON.stringify(updated.slice(0, 20)));
            setHasNew(true);
            return updated;
          });
        }
      });
    });

    setNotifications(initialNotifs.filter(n => !dismissedIds.includes(n.id)));
    
    return () => unsubscribe();
  }, []);

  const dismissNotification = (id: string) => {
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
    dismissedIds.push(id);
    localStorage.setItem('dismissed_notifications', JSON.stringify(dismissedIds));
    
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem('app_notifications', JSON.stringify(updated));
    
    if (updated.length === 0) setHasNew(false);
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setHasNew(false);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        className={cn(
          "w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all relative border",
          isOpen ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
        )}
      >
        <Bell size={16} className="sm:w-5 sm:h-5" />
        {hasNew && notifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 border-2 border-[#020202] rounded-full animate-bounce shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[110]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed left-4 right-4 top-20 sm:absolute sm:inset-x-auto sm:top-full sm:mt-4 sm:right-0 sm:w-[380px] z-[120]"
            >
              <div className="bg-black border border-white/20 rounded-[2.5rem] shadow-[0_20px_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col max-h-[500px] backdrop-blur-3xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.04]">
                  <h3 className="text-white font-black text-sm uppercase tracking-tighter">{t('notifications')}</h3>
                  <span className="text-[10px] font-black text-red-400 px-3 py-1 bg-red-500/10 rounded-full">{notifications.length} {t('msgCount')}</span>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-700">
                        <Bell size={32} />
                      </div>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{t('noMessages')}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          className="p-5 border-b border-white/5 hover:bg-white/[0.05] transition-colors relative group"
                        >
                          <div className="flex gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                              notif.type === 'welcome' ? "bg-indigo-600/30 border-indigo-500/30 text-indigo-400" :
                              notif.type === 'update' ? "bg-amber-600/30 border-amber-500/30 text-amber-400" :
                              "bg-white/10 border-white/20 text-slate-400"
                            )}>
                              {notif.type === 'welcome' ? <Sparkles size={18} /> : 
                               notif.type === 'update' ? <MessageSquare size={18} /> : 
                               <Info size={18} />}
                            </div>
                            <div className="flex-1 min-w-0 pr-6">
                              <h4 className="text-white font-black text-[11px] uppercase tracking-tight mb-1">{notif.title}</h4>
                              <p className="text-slate-200 text-[10px] font-medium leading-relaxed">{notif.message}</p>
                              <span className="text-[8px] font-black text-slate-500 uppercase mt-2 block">
                                {new Date(notif.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => dismissNotification(notif.id)}
                            className="absolute top-5 right-5 text-slate-600 hover:text-red-500 transition-colors p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {notifications.length > 0 && (
                  <div className="p-4 bg-white/[0.04] text-center border-t border-white/5">
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] hover:text-white transition-colors"
                    >
                      {t('close')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
