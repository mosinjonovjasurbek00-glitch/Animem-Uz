import React, { useState, useRef } from 'react';
import { 
  loginWithGoogle, 
  signInWithEmailAndPassword as firebaseSignIn, 
  createUserWithEmailAndPassword as firebaseSignUp,
  updateProfile,
  syncUserToFirestore,
  auth,
  sendPasswordResetEmail
} from '../firebase';
import { Loader2, X, Mail, Lock, User, ArrowRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation, Language } from '../i18n';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

interface AuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
  language?: Language;
}

type AuthMode = 'login' | 'signup' | 'select' | 'forgot';

export const AuthModal = ({ onSuccess, onClose, language = 'uz' }: AuthModalProps) => {
  const t = useTranslation(language);
  const [mode, setMode] = useState<AuthMode>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const TURNSTILE_SITE_KEY = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '0x4AAAAAAC_bMoaIUWmn54Wj';

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode !== 'forgot' && !turnstileToken) {
      setError("Iltimos, robot emasligingizni tasdiqlang");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // 1. Verify captcha on server-side
      if (mode !== 'forgot') {
        const verifyRes = await fetch('/api/verify-turnstile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken })
        });
        
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          throw new Error(verifyData.message || "Captcha tekshiruvi xatosi");
        }
      }

      // 2. Proceed with Firebase Auth
      if (mode === 'signup') {
        if (!username) throw new Error("Iltimos, foydalanuvchi nomini kiriting");
        const result = await firebaseSignUp(auth, email, password);
        await updateProfile(result.user, { displayName: username });
        await syncUserToFirestore(result.user);
      } else if (mode === 'login') {
        const result = await firebaseSignIn(auth, email, password);
        await syncUserToFirestore(result.user);
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setMessage("Parolni tiklash havolasi emailingizga yuborildi!");
        setTimeout(() => setMode('login'), 3000);
        return;
      }
      onSuccess();
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/user-not-found') msg = 'Foydalanuvchi topilmadi';
      if (err.code === 'auth/wrong-password') msg = 'Parol noto\'g\'ri';
      if (err.code === 'auth/email-already-in-use') msg = 'Ushbu email allaqachon ro\'yxatdan o\'tgan';
      if (err.code === 'auth/weak-password') msg = 'Parol juda kuchsiz (kamida 6 ta belgi)';
      if (err.code === 'auth/invalid-email') msg = 'Email manzili noto\'g\'ri';
      
      setError(msg);
      // Reset turnstile on error
      turnstileRef.current?.reset();
      setTurnstileToken(null);
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

        {mode !== 'select' && (
          <button 
            onClick={() => {
              setMode('select');
              setError(null);
              setMessage(null);
              setTurnstileToken(null);
              turnstileRef.current?.reset();
            }} 
            className="absolute top-6 left-6 p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full z-20"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div className="mb-8 mt-4">
          <h2 className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center justify-center gap-2">
            Animem<span className="text-red-500"> Uz</span>
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-3 font-bold">
            {mode === 'select' ? t('signInOrCreateAccount') : 
             mode === 'login' ? 'Tizimga kirish' : 
             mode === 'signup' ? 'Ro\'yxatdan o\'tish' : 'Parolni tiklash'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'select' ? (
            <motion.div 
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
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

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">yoki</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <button 
                onClick={() => setMode('login')}
                className="glass h-14 w-full rounded-2xl flex items-center justify-center hover:bg-white hover:text-black transition-all border-white/5 gap-4 group"
              >
                <Mail size={18} className="text-red-500" />
                <span className="text-xs font-black uppercase tracking-widest leading-none">Email orqali kirish</span>
              </button>

              <button 
                onClick={() => setMode('signup')}
                className="w-full mt-4 text-[10px] text-slate-500 hover:text-white uppercase tracking-widest font-bold transition-colors"
              >
                Hisobingiz yo'qmi? <span className="text-red-500 ml-1">Ro'yxatdan o'tish</span>
              </button>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleEmailAuth}
              className="space-y-4"
            >
              {mode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="Foydalanuvchi nomi"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-xs font-medium focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                </div>
              )}
              
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="email" 
                  placeholder="Email manzili"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-xs font-medium focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>

              {mode !== 'forgot' && (
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="password" 
                    placeholder="Parol"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-xs font-medium focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                </div>
              )}

              {mode === 'login' && (
                <div className="text-right">
                  <button 
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setTurnstileToken(null);
                      turnstileRef.current?.reset();
                    }}
                    className="text-[10px] text-slate-500 hover:text-white transition-colors"
                  >
                    Parolni unutdingizmi?
                  </button>
                </div>
              )}
              
              {mode !== 'forgot' && (
                <div className="flex justify-center py-2">
                  <Turnstile 
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY} 
                    onSuccess={(token) => {
                      setTurnstileToken(token);
                      setError(null);
                    }}
                    onError={() => {
                      setError("Captcha yuklashda xatolik yuz berdi");
                      setTurnstileToken(null);
                    }}
                    onExpire={() => {
                      setTurnstileToken(null);
                    }}
                    options={{
                      theme: 'dark',
                      size: 'normal',
                    }}
                  />
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Kirish' : mode === 'signup' ? 'Ro\'yxatdan o\'tish' : 'Yuborish'}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-500">
                {mode === 'login' ? 'Hisobingiz yo\'qmi?' : 'Hisobingiz bormi?'}
                <button 
                  type="button" 
                  onClick={() => {
                    setMode(mode === 'login' ? 'signup' : 'login');
                    setError(null);
                    setTurnstileToken(null);
                    turnstileRef.current?.reset();
                  }}
                  className="text-red-500 ml-2 font-bold hover:underline"
                >
                  {mode === 'login' ? 'Ro\'yxatdan o\'tish' : 'Kirish'}
                </button>
              </p>
            </motion.form>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center text-red-500 text-[10px] font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20"
          >
            {error}
          </motion.div>
        )}

        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center text-green-500 text-[10px] font-bold bg-green-500/10 p-3 rounded-xl border border-green-500/20"
          >
            {message}
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
