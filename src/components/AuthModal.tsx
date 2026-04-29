import React, { useState, useEffect, useRef } from 'react';
import { auth, db, loginWithGoogle, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, syncUserToFirestore } from '../firebase';
import { Mail, Lock, User, Loader2, X, ArrowLeft, ShieldCheck, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { useTranslation, Language } from '../i18n';
import { ConfirmationResult } from 'firebase/auth';

import ReCAPTCHA from 'react-google-recaptcha';

interface AuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
  language?: Language;
}

type AuthMode = 'login' | 'register' | 'verify' | 'code-verify' | 'complete-registration';

const AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
];

export const AuthModal = ({ onSuccess, onClose, language = 'uz' }: AuthModalProps) => {
  const t = useTranslation(language);
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const sendAuthCode = async (targetEmail: string) => {
    if (!recaptchaToken) {
      setError(t('errorSystem')); 
      return false;
    }
    try {
      const response = await axios.post('/api/auth/send-code', { email: targetEmail, recaptchaToken });
      if (response.data.success) {
        setResendTimer(60);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("Failed to send code:", err);
      // Reset token and widget on error
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
      setError(err.response?.data?.error || t('errorSystem'));
      return false;
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error("Google Login Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(t('authDomainError'));
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError(t('popupClosedError'));
      } else if (err.code === 'auth/popup-blocked') {
        setError(t('popupBlockedError'));
      } else {
        setError(`${t('errorOccurred')}: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaptchaToken) {
      setError(t('errorSystem')); // Should be "Verification required"
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.message?.includes('Could not reach Cloud Firestore backend') || err.code === 'unavailable') {
        setError(
          <div className="text-center space-y-2">
            <p>{t('dbConnectionError')}</p>
            <p className="text-[10px] opacity-70">{t('dbOfflineError')}</p>
          </div>
        );
        return;
      }
      const errMsg = err.response?.data?.error || err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(t('invalidLoginError'));
      } else {
        setError(errMsg || t('genericLoginError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaptchaToken) {
      setError(t('errorSystem'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sent = await sendAuthCode(email);
      if (sent) {
        setMode('code-verify');
      } else {
        setError(t('errorSystem'));
      }
    } catch (err: any) {
      console.error("Register error:", err);
      setError(t('errorRegister'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/auth/verify-code', { email, code: verificationCode });
      if (response.data.success) {
        setMode('complete-registration');
      }
    } catch (err: any) {
      console.error("Code verify error:", err);
      setError(t('invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('passwordsNoMatchError'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await syncUserToFirestore(result.user);
      onSuccess();
    } catch (err: any) {
      console.error("Profile creation error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError(t('errorSystem'));
      } else {
        setError(t('errorRegister'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    await sendAuthCode(email);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      <div id="recaptcha-container"></div>
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
        className="glass w-full max-w-sm rounded-[2.5rem] relative overflow-hidden shadow-[0_0_100px_rgba(220,38,38,0.2)] flex flex-col max-h-[90vh]"
      >
        {/* Header Actions */}
        <div className="flex items-center justify-between p-6 pb-0 relative z-10">
          {mode !== 'login' ? (
            <button 
              onClick={() => setMode('login')} 
              className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full"
              title={t('back')}
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-9" /> // Spacer
          )}
          
          <button 
            onClick={onClose} 
            className="p-2 -mr-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full"
            title={t('close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-8 pt-4 sm:p-10 sm:pt-4 custom-scrollbar">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
                 <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white">
                   Animem<span className="text-red-500"> Uz</span>
                 </h2>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em] font-black">
              {mode === 'login' ? t('loginModeTitle') : 
               mode === 'register' ? t('registerModeTitle') : 
               mode === 'code-verify' ? t('enterCode') :
               mode === 'complete-registration' ? t('editProfile') :
               t('verifyModeTitle')}
            </p>
          </div>

        <AnimatePresence mode="wait">
          {mode === 'verify' ? (
            <motion.div 
              key="verify-state"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck size={40} className="text-red-500" />
              </div>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                {t('verificationSent')}
              </p>
              <button 
                onClick={() => setMode('login')}
                className="glass-button w-full py-4 text-[10px] flex items-center justify-center gap-2 border-red-500/20 text-red-400"
              >
                <ArrowLeft size={16} /> {t('backToLogin')}
              </button>
            </motion.div>
          ) : mode === 'code-verify' ? (
            <motion.div 
              key="code-verify-state"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail size={32} className="text-red-500" />
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                  {t('codeSentTo').replace('{{email}}', email)}
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="123456"
                    maxLength={6}
                    className="glass-input w-full pl-12 h-14 bg-white/[0.02] border-white/5 focus:border-red-500/30 text-white text-center text-2xl font-black tracking-[0.5em]"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="glass-button-primary w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-red-600 hover:bg-red-500 shadow-red-600/20">
                  {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : t('verify')}
                </button>
              </form>

              <div className="text-center">
                <button 
                  onClick={handleResendCode}
                  disabled={resendTimer > 0 || loading}
                  className={`text-[9px] font-black uppercase tracking-widest transition-colors ${resendTimer > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-red-400'}`}
                >
                  {resendTimer > 0 
                    ? t('waitResend').replace('{{time}}', resendTimer.toString()) 
                    : t('resendCode')}
                </button>
              </div>

              <button 
                onClick={() => setMode('register')}
                className="glass-button w-full py-3 text-[9px] flex items-center justify-center gap-2 border-white/5 text-slate-500"
              >
                <ArrowLeft size={14} /> {t('back')}
              </button>
            </motion.div>
          ) : mode === 'complete-registration' ? (
            <motion.div 
              key="complete-registration-state"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User size={32} className="text-red-500" />
                </div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                  {t('editProfile')}
                </p>
              </div>

              <form onSubmit={handleFinalizeRegistration} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    placeholder={t('fullName')}
                    className="glass-input w-full pl-12 h-14 bg-white/[0.02] border-white/5 focus:border-red-500/30"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="password" 
                    placeholder={t('passwordTitle')}
                    className="glass-input w-full pl-12 h-14 bg-white/[0.02] border-white/5 focus:border-red-500/30"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="password" 
                    placeholder={t('confirmPassword')}
                    className="glass-input w-full pl-12 h-14 bg-white/[0.02] border-white/5 focus:border-red-500/30"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="glass-button-primary w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-red-600 hover:bg-red-500 shadow-red-600/20">
                  {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : t('signUp')}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {mode === 'login' && (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-400" size={18} />
                    <input 
                      type="email" 
                      placeholder={t('emailAddressTitle')}
                      className="glass-input w-full pl-12 h-14 bg-white/[0.02] border-white/5 focus:border-red-500/30 text-white"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-400" size={18} />
                    <input 
                      type="password" 
                      placeholder={t('passwordTitle')}
                      className="glass-input w-full pl-12 h-14 bg-white/[0.02] border-white/5 focus:border-red-500/30 text-white"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="flex justify-center py-2 min-h-[65px]">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LfQuNAsAAAAAOFCXyI_YV2eqLuM-UAhNhNjQKSD"}
                      onChange={(token) => {
                        setRecaptchaToken(token);
                        setError(null);
                      }}
                      onExpired={() => setRecaptchaToken(null)}
                      onErrored={() => {
                        setRecaptchaToken(null);
                        setError(t('errorSystem'));
                      }}
                      theme="dark"
                    />
                  </div>

                  <button type="submit" disabled={loading} className="glass-button-primary w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-red-600 hover:bg-red-500 shadow-red-600/20">
                    {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : t('signIn')}
                  </button>
                </form>
              )}

              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-400" size={18} />
                    <input 
                      type="email" 
                      placeholder={t('emailAddressTitle')}
                      className="glass-input w-full pl-12 h-14 bg-white/[0.02] border-white/5 focus:border-red-500/30 text-white"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="flex justify-center py-2 min-h-[65px]">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LfQuNAsAAAAAOFCXyI_YV2eqLuM-UAhNhNjQKSD"}
                      onChange={(token) => {
                        setRecaptchaToken(token);
                        setError(null);
                      }}
                      onExpired={() => setRecaptchaToken(null)}
                      onErrored={() => {
                        setRecaptchaToken(null);
                        setError(t('errorSystem'));
                      }}
                      theme="dark"
                    />
                  </div>

                  <button type="submit" disabled={loading} className="glass-button-primary w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-red-600 hover:bg-red-500 shadow-red-600/20">
                    {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : t('signUp')}
                  </button>
                </form>
              )}

              {mode === 'login' && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                    <div className="relative flex justify-center text-[8px] uppercase font-black tracking-widest"><span className="bg-[#080808] px-4 text-slate-600">{t('orOtherWay')}</span></div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={handleGoogleLogin}
                      className="glass h-12 rounded-2xl flex items-center justify-center hover:bg-white hover:text-black transition-all active:scale-95 border-white/5 gap-3"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      <span className="text-[10px] font-black uppercase tracking-widest">{t('continueWithGoogle')}</span>
                    </button>
                  </div>
                </>
              )}

              <div className="text-center pt-2">
                <button 
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
                >
                  {mode === 'login' ? t('noAccount') : t('hasAccount')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-[9px] font-black uppercase tracking-widest text-center mx-8 mb-8"
          >
            {error}
          </motion.div>
        )}
      </div>
    </motion.div>
  </div>
  );
};
