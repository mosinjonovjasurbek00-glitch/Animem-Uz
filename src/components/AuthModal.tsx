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

interface AuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
  language?: Language;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export const AuthModal = ({ onSuccess, onClose, language = 'uz' }: AuthModalProps) => {
  const t = useTranslation(language);
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // Proceed with Firebase Auth
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
        className="absolute inset-0 bg-[#0B0B14]/95 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]"
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
          {mode === 'login' || mode === 'signup' || mode === 'forgot' ? (
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
                    }}
                    className="text-[10px] text-slate-500 hover:text-white transition-colors"
                  >
                    Parolni unutdingizmi?
                  </button>
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
