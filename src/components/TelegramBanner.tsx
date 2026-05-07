import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X } from 'lucide-react';

export const TelegramBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show banner after a short delay on mount
    const timer = setTimeout(() => {
      // Check session storage so it only shows once per session, 
      // or if the user explicitly wants it every time "every time user enters site"
      // I'll stick to every session/mount for now as requested "har safar kirganda"
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed top-20 right-4 sm:right-8 z-[200] w-[calc(100vw-32px)] sm:w-[380px]"
        >
          <div className="relative bg-[#12121F]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full" />
            
            <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all z-10"
            >
              <X size={16} />
            </button>

            <div className="flex gap-5">
              <div className="shrink-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Send className="text-white fill-white/20 translate-x-[-1px] translate-y-[1px]" size={28} />
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">
                  Telegram kanalimiz
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4">
                  Yangi animelar va xabarlardan birinchi bo'lib xabardor bo'ling!
                </p>
                
                <a
                  href="https://t.me/animemuz1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 bg-[#FF8C00] hover:bg-[#FF7F00] text-black font-black text-center text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#FF8C00]/20 active:scale-95"
                >
                  Obuna bo'lish
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
