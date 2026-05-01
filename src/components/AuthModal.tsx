import React, { useState } from 'react';
import { loginWithGoogle } from '../firebase';
import { Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation, Language } from '../i18n';

interface AuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
  language?: Language;
}

export const AuthModal = ({ onSuccess, onClose, language = 'uz' }: AuthModalProps) => {
  const t = useTranslation(language);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      setError(`${t('errorOccurred')}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 text-white text-center">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass w-full max-w-sm rounded-[2.5rem] relative overflow-hidden shadow-[0_0_100px_rgba(220,38,38,0.2)] flex flex-col p-8 sm:p-10"
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full z-20"
          title={t('close')}
        >
          <X size={20} />
        </button>

        <div className="mb-10 mt-4">
          <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center justify-center gap-2">
            Animem<span className="text-red-500"> Uz</span>
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-3 font-bold">
            {t('signInOrCreateAccount')}
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="glass h-14 w-full rounded-2xl flex items-center justify-center hover:bg-white hover:text-black transition-all border-white/5 gap-4 group"
          >
            {loading ? (
              <Loader2 className="animate-spin text-red-500" size={20} />
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                <span className="text-xs font-black uppercase tracking-widest leading-none">Google orqali kirish</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center text-red-500 text-[10px] font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20"
          >
            {error}
          </motion.div>
        )}

        <p className="mt-10 text-[9px] text-slate-600 uppercase tracking-[0.2em] leading-relaxed">
          Tizimga kirish orqali siz bizning <br/>
          <span className="text-slate-400">foydalanish shartlariga</span> rozilik bildirasiz
        </p>
      </motion.div>
    </div>
  );
};
