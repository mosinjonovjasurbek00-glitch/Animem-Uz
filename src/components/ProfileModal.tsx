import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Check, Loader2, User, LogOut } from 'lucide-react';
import { db, auth, logout } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useTranslation, Language } from '../i18n';
import { Star, MessageSquare, Bookmark, Zap } from 'lucide-react';

interface ProfileModalProps {
  onClose: () => void;
  isOpen: boolean;
  language?: Language;
}

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Leo&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Mia&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Sam&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Nia&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Kai&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Zoe&backgroundColor=ffd5dc'
];

export default function ProfileModal({ onClose, isOpen, language = 'uz' }: ProfileModalProps) {
  const [user] = useAuthState(auth);
  const t = useTranslation(language);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [customPreview, setCustomPreview] = useState<string | null>(null);
  const [stats, setStats] = useState({ watchlist: 0, comments: 0, level: 1 });

  useEffect(() => {
    async function loadProfile() {
      try {
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUsername(data.username || user.displayName || '');
            setAvatarUrl(data.photoURL || '');
          }

          // Load Stats
          const watchlistSnap = await getDocs(query(collection(db, 'watchlist'), where('userId', '==', user.uid)));
          const commentsSnap = await getDocs(query(collection(db, 'comments'), where('userId', '==', user.uid)));
          
          const watchlistCount = watchlistSnap.size;
          const commentsCount = commentsSnap.size;
          const level = Math.floor((commentsCount * 5 + watchlistCount * 2) / 10) + 1;

          setStats({
            watchlist: watchlistCount,
            comments: commentsCount,
            level
          });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    }
    if (isOpen) {
      loadProfile();
      setCustomPreview(null);
    }
  }, [user, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250;
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
          }
          
          // Compress to base64 jpeg
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCustomPreview(dataUrl);
          setAvatarUrl(''); // Deselect pre-defined if custom is loaded
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      if (customPreview && !avatarUrl) finalAvatarUrl = customPreview;

      await updateDoc(doc(db, 'users', user.uid), {
        username: username.trim(),
        photoURL: finalAvatarUrl,
      });
      onClose();
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/95 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-[#080808] border border-white/5 rounded-[2.5rem] p-6 sm:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden"
      >
           <button 
             onClick={onClose}
             className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
           >
             <X size={20} />
           </button>

            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white mb-6">{t('editProfile')}</h2>

           {loading ? (
             <div className="flex justify-center py-10">
               <Loader2 className="animate-spin text-indigo-500" size={32} />
             </div>
           ) : (
             <div className="space-y-8">
               {/* Stats Overview */}
               <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:bg-red-500/5 transition-colors">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-red-400 transition-colors">Daraja</span>
                     <div className="flex items-center gap-1 text-red-500">
                        <Zap size={14} fill="currentColor" />
                        <span className="text-xl font-black">{stats.level}</span>
                     </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:bg-amber-500/5 transition-colors">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-400 transition-colors">Sizdagi</span>
                     <div className="flex items-center gap-1 text-amber-500">
                        <Bookmark size={14} fill="currentColor" />
                        <span className="text-xl font-black">{stats.watchlist}</span>
                     </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 group hover:bg-indigo-500/5 transition-colors">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 transition-colors">Izohlar</span>
                     <div className="flex items-center gap-1 text-indigo-500">
                        <MessageSquare size={14} fill="currentColor" />
                        <span className="text-xl font-black">{stats.comments}</span>
                     </div>
                  </div>
               </div>
               {/* Username input */}
               <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('emailAddressTitle')}</label>
                    <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-4 text-sm text-slate-400 font-medium">
                      {user?.email}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('username')}</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                      placeholder={t('username')}
                    />
                  </div>
               </div>

               {/* Avatar selection */}
               <div className="space-y-4 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('chooseAvatar')}</label>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                    {/* Custom Upload Button */}
                    <div className="relative aspect-square">
                       <label className="cursor-pointer w-full h-full rounded-2xl border-2 border-dashed border-white/10 hover:border-indigo-500 bg-white/[0.02] flex flex-col items-center justify-center gap-1 transition-all group">
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                          {customPreview ? (
                            <>
                              <img src={customPreview} className="w-full h-full object-cover rounded-[14px]" />
                              {(customPreview || (!avatarUrl && customPreview)) && (
                                <div className="absolute inset-0 ring-2 ring-red-500 rounded-2xl flex items-center justify-center bg-black/40">
                                   <Check size={16} className="text-white" />
                                </div>
                              )}
                            </>
                          ) : (
                            <Upload size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                          )}
                       </label>
                    </div>

                    {/* Pre-defined Avatars */}
                    {DEFAULT_AVATARS.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setAvatarUrl(url);
                          setCustomPreview(null);
                        }}
                        className={cn(
                          "relative aspect-square rounded-2xl overflow-hidden border-2 transition-all",
                          avatarUrl === url ? "border-indigo-500 scale-105 shadow-lg shadow-indigo-500/20" : "border-transparent hover:border-white/10"
                        )}
                      >
                         <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         {avatarUrl === url && (
                           <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                             <Check size={16} className="text-white" />
                           </div>
                         )}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="pt-4 flex flex-col gap-3">
                 <button
                   onClick={handleSave}
                   disabled={saving || !username.trim()}
                   className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-2xl py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-red-600/20"
                 >
                   {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                   {saving ? t('saving') : t('save')}
                 </button>

                 <button
                   onClick={() => {
                     logout();
                     onClose();
                   }}
                   className="w-full bg-white/5 hover:bg-red-600/10 border border-white/5 hover:border-red-500/20 text-slate-500 hover:text-red-500 rounded-2xl py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                   <LogOut size={16} />
                   {t('logout')}
                 </button>
               </div>
             </div>
           )}
        </motion.div>
      </div>
  );
}
