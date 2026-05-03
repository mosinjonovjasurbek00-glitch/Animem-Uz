import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { getLocalData, saveLocalData } from '../lib/localData';
import { collection, addDoc, deleteDoc, doc, query, onSnapshot, serverTimestamp, where, updateDoc, getDocs, orderBy, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, Film, Check, X, AlertCircle, Loader2, Upload, Link as LinkIcon, MessageSquare, Star, Clock, Play, List, ChevronRight, ArrowLeft, Send, User, Globe, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { CATEGORIES, categoryKeys } from '../constants';
import axios from 'axios';
import { Language, useTranslation } from '../i18n';

interface AnimeDoc {
  id: string;
  title: string;
  posterUrl: string;
  description: string;
  category: string;
  rating: number;
  year: number;
  type: 'movie' | 'series';
  views: number;
  slug?: string;
  createdAt: any;
  language?: Language;
}

interface EpisodeDoc {
  id: string;
  animeId: string;
  episodeNumber: number;
  title?: string;
  videoUrl: string;
  openingStart?: number;
  openingEnd?: number;
  createdAt: any;
}

interface MessageDoc {
  id: string;
  name: string;
  email: string;
  contact: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  createdAt: any;
}

interface UserDoc {
  id: string;
  uid: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
}

interface NewsItemDoc {
  id: string;
  text: string;
  language: Language;
  createdAt: any;
}

interface AdminPanelProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export default function AdminPanel({ language, setLanguage }: AdminPanelProps) {
  const t = useTranslation(language);
  const [animeList, setAnimeList] = useState<AnimeDoc[]>([]);
  const [activeTab, setActiveTab] = useState<'anime' | 'episodes' | 'messages' | 'admins' | 'news'>('anime');
  const [selectedAnimeForEpisodes, setSelectedAnimeForEpisodes] = useState<AnimeDoc | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeDoc[]>([]);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [userSearch, setUserSearch] = useState('');
  
  const [newsItems, setNewsItems] = useState<NewsItemDoc[]>([]);
  const [newNewsText, setNewNewsText] = useState('');
  const [newNewsLang, setNewNewsLang] = useState<Language>('uz');
  
  const [editingAnime, setEditingAnime] = useState<AnimeDoc | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<EpisodeDoc | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Confirmation state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Anime Form State
  const [title, setTitle] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Action');
  const [rating, setRating] = useState(8.5);
  const [year, setYear] = useState(new Date().getFullYear());
  const [contentType, setContentType] = useState<'movie' | 'series'>('series');
  const [isBanner, setIsBanner] = useState(false);
  const [animeLanguage, setAnimeLanguage] = useState<Language>('uz');

  // Episode Form State
  const [epNumber, setEpNumber] = useState(1);
  const [epTitle, setEpTitle] = useState('');
  const [epVideoUrl, setEpVideoUrl] = useState('');
  const [epVideoFile, setEpVideoFile] = useState<File | null>(null);
  const [epOpeningStart, setEpOpeningStart] = useState(''); // Formatted as MM:SS
  const [epOpeningEnd, setEpOpeningEnd] = useState('');     // Formatted as MM:SS

  const sendPush = async (title: string, body: string, imageUrl: string, animeId: string) => {
    try {
      await axios.post('/api/admin/broadcast-notification', { title, body, imageUrl, animeId });
      // Trigger Telegram bridge immediately
      await axios.post('/api/admin/trigger-telegram');
    } catch (err) {
      console.error("Failed to send push/telegram notification:", err);
    }
  };

  const [telegramStatus, setTelegramStatus] = useState<{connected: boolean, botName: string} | null>(null);

  useEffect(() => {
    const checkTelegram = async () => {
      try {
        const res = await axios.get('/api/debug/telegram-test');
        if (res.data.botInfo?.ok) {
          setTelegramStatus({
            connected: true,
            botName: res.data.botInfo.result.username
          });
        }
      } catch (e) {
        setTelegramStatus(null);
      }
    };
    checkTelegram();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'anime'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AnimeDoc[];
      setAnimeList(docs.sort((a, b) => {
        const getTs = (d: any) => typeof d?.toMillis === 'function' ? d.toMillis() : 0;
        return getTs(b.createdAt) - getTs(a.createdAt);
      }));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'anime'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'messages') {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MessageDoc[]);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));
      return () => unsubscribe();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'admins') {
      const q = query(collection(db, 'users'), where('role', '==', 'admin'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserDoc[]);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
      return () => unsubscribe();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'news') {
      const q = query(collection(db, 'news_items'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNewsItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsItemDoc[]);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'news_items'));
      return () => unsubscribe();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedAnimeForEpisodes) {
      setEpisodes([]);
      return;
    }
    const q = query(
      collection(db, 'movies', selectedAnimeForEpisodes.id, 'episodes'),
      orderBy('episodeNumber', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEpisodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EpisodeDoc[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'movies/episodes'));
    return () => unsubscribe();
  }, [selectedAnimeForEpisodes]);

  useEffect(() => {
    if (editingAnime) {
      setTitle(editingAnime.title);
      setPosterUrl(editingAnime.posterUrl);
      setDescription(editingAnime.description || '');
      setCategory(editingAnime.category);
      setRating(editingAnime.rating);
      setYear(editingAnime.year);
      setContentType(editingAnime.type || 'series');
      // @ts-ignore
      setIsBanner(editingAnime.isBanner || false);
      setAnimeLanguage(editingAnime.language || 'uz');
    } else {
      setTitle(''); setPosterUrl(''); setPosterFile(null); setDescription('');
      setCategory('Action'); setRating(8.5); setYear(new Date().getFullYear());
      setIsBanner(false);
      setAnimeLanguage('uz');
    }
  }, [editingAnime]);

  const formatSecondsToMMSS = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseMMSSToSeconds = (timeStr: string): number | undefined => {
    if (!timeStr) return undefined;
    if (timeStr.includes(':')) {
      const [mins, secs] = timeStr.split(':').map(Number);
      if (isNaN(mins) || isNaN(secs)) return undefined;
      return mins * 60 + secs;
    }
    const secs = Number(timeStr);
    return isNaN(secs) ? undefined : secs;
  };

  useEffect(() => {
    if (editingEpisode) {
      setEpNumber(editingEpisode.episodeNumber);
      setEpTitle(editingEpisode.title || '');
      setEpVideoUrl(editingEpisode.videoUrl);
      setEpOpeningStart(formatSecondsToMMSS(editingEpisode.openingStart));
      setEpOpeningEnd(formatSecondsToMMSS(editingEpisode.openingEnd));
    } else {
      setEpNumber(episodes.length + 1);
      setEpTitle('');
      setEpVideoUrl('');
      setEpOpeningStart('');
      setEpOpeningEnd('');
    }
  }, [editingEpisode, episodes.length]);

  const handlePosterUpload = async (file: File): Promise<string> => {
    const storageRef = ref(storage, `posters/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        reject,
        () => getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject)
      );
    });
  };

  const handleAnimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let finalPosterUrl = posterUrl;
      // Poster logic... (keep existing)
      if (posterFile) {
        try {
          finalPosterUrl = await handlePosterUpload(posterFile);
        } catch (uploadError) {
          console.error("Poster upload failed:", uploadError);
          if (!finalPosterUrl) {
             finalPosterUrl = 'https://via.placeholder.com/400x600?text=Upload+Error';
             alert("Rasm yuklashda xatolik.");
          }
        }
      }
      if (!finalPosterUrl) {
         finalPosterUrl = 'https://via.placeholder.com/400x600?text=No+Poster';
      }

      const animeData = {
        title, posterUrl: finalPosterUrl, description, category, rating, year,
        type: contentType, 
        authorUid: auth.currentUser?.uid,
        isBanner,
        language: animeLanguage,
        updatedAt: serverTimestamp()
      };

      if (editingAnime) {
        await updateDoc(doc(db, 'anime', editingAnime.id), animeData);
        setEditingAnime(null);
      } else {
        const newAnimeDoc = await addDoc(collection(db, 'anime'), {
          ...animeData,
          views: 0,
          createdAt: serverTimestamp()
        });

        // Add public notification for new anime
        const isRu = animeLanguage === 'ru';
        const msg = isRu ? `${title} загружено на сайт! Смотрите прямо сейчас.` : `${title} saytga yuklandi! Hoziroq tomosha qiling.`;
        await addDoc(collection(db, 'public_notifications'), {
          type: 'anime',
          title: title,
          message: msg,
          posterUrl: finalPosterUrl,
          animeId: newAnimeDoc.id,
          createdAt: serverTimestamp()
        });

        // Send actual Push Notification
        await sendPush(title, msg, finalPosterUrl, newAnimeDoc.id);
      }

      setTitle(''); setPosterUrl(''); setPosterFile(null); setDescription('');
      setCategory('Action'); setRating(8.5); setYear(new Date().getFullYear());
      setIsBanner(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('errorAddAnime'));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleEpisodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimeForEpisodes) return;
    setSubmitting(true);
    try {
      let finalVideoUrl = epVideoUrl;
      // Upload file to Firebase Storage if selected
      if (epVideoFile) {
        setUploadProgress(0);
        try {
          const storageRef = ref(storage, `episodes/${selectedAnimeForEpisodes.id}/${Date.now()}_${epVideoFile.name}`);
          const uploadTask = uploadBytesResumable(storageRef, epVideoFile);
          
          finalVideoUrl = await new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
              reject,
              () => getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject)
            );
          });
        } catch (uploadError) {
          console.error("Episode upload failed:", uploadError);
          if (!finalVideoUrl) {
            finalVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
            alert("Videoni yuklashda xatolik yuz berdi. Qo'shish to'xtab qolmasligi uchun vaqtinchalik video ulandi, keyin URL orqali o'zgartirishingiz mumkin.");
          }
        }
        setUploadProgress(null);
      }

      if (!finalVideoUrl) {
        finalVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
      }

      const epData: any = {
        animeId: selectedAnimeForEpisodes.id,
        episodeNumber: epNumber,
        title: epTitle,
        videoUrl: finalVideoUrl,
        updatedAt: serverTimestamp()
      };

      const openingStartSec = parseMMSSToSeconds(epOpeningStart);
      const openingEndSec = parseMMSSToSeconds(epOpeningEnd);
      
      if (openingStartSec !== undefined) epData.openingStart = openingStartSec;
      if (openingEndSec !== undefined) epData.openingEnd = openingEndSec;

      if (editingEpisode) {
        await updateDoc(doc(db, 'anime', selectedAnimeForEpisodes.id, 'episodes', editingEpisode.id), epData);
        setEditingEpisode(null);
      } else {
        await addDoc(collection(db, 'anime', selectedAnimeForEpisodes.id, 'episodes'), {
          ...epData,
          createdAt: serverTimestamp()
        });

        // Add public notification for new episode
        const isRu = selectedAnimeForEpisodes.language === 'ru';
        const titleMsg = isRu ? `${selectedAnimeForEpisodes.title}: ${epNumber}-серия` : `${selectedAnimeForEpisodes.title}: ${epNumber}-qism`;
        const bodyMsg = isRu ? `Новая ${epNumber}-я серия ${selectedAnimeForEpisodes.title} добавлена на сайт!` : `${selectedAnimeForEpisodes.title} ning yangi ${epNumber}-qismi saytga qo'shildi!`;

        await addDoc(collection(db, 'public_notifications'), {
          type: 'episode',
          title: titleMsg,
          message: bodyMsg,
          posterUrl: selectedAnimeForEpisodes.posterUrl,
          animeId: selectedAnimeForEpisodes.id,
          createdAt: serverTimestamp()
        });

        // Send actual Push Notification
        await sendPush(
          titleMsg, 
          bodyMsg,
          selectedAnimeForEpisodes.posterUrl,
          selectedAnimeForEpisodes.id
        );
      }
      
      setEpNumber(prev => prev + 1);
      setEpTitle('');
      setEpVideoUrl('');
      setEpOpeningStart('');
      setEpOpeningEnd('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(t('errorAddEpisode'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnime = (id: string) => {
    setConfirmModal({
      show: true,
      title: t('deleteAnimeTitle'),
      message: t('deleteAnimeConfirm'),
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setConfirmModal(prev => ({ ...prev, show: false }));
          
          // Delete episodes subcollection first
          const episodesRef = collection(db, 'anime', id, 'episodes');
          const episodesSnap = await getDocs(episodesRef);
          
          const batch = writeBatch(db);
          episodesSnap.forEach((episodeDoc) => {
            batch.delete(episodeDoc.ref);
          });
          
          // Delete the main anime doc
          batch.delete(doc(db, 'anime', id));
          
          await batch.commit();
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
          console.error("Delete error:", err);
          setError(t('errorDeleteAnime') + ": " + (err.message || 'Unknown error'));
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleDeleteEpisode = (id: string) => {
    if (!selectedAnimeForEpisodes) return;
    setConfirmModal({
      show: true,
      title: t('deleteEpisodeTitle'),
      message: t('deleteEpisodeConfirm'),
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setConfirmModal(prev => ({ ...prev, show: false }));
          await deleteDoc(doc(db, 'anime', selectedAnimeForEpisodes.id, 'episodes', id));
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
          console.error("Episode delete error:", err);
          setError(t('errorDeleteEpisode') + ": " + (err.message || 'Unknown error'));
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleDeleteMessage = (id: string) => {
    setConfirmModal({
      show: true,
      title: t('deleteMessageTitle'),
      message: t('deleteMessageConfirm'),
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setConfirmModal(prev => ({ ...prev, show: false }));
          await deleteDoc(doc(db, 'messages', id));
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
          setError(t('errorDeleteMessage'));
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSearch) return;
    setSubmitting(true);
    setError(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', userSearch.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error(t('userNotFound'));
      }
      
      const userToPromote = snap.docs[0];
      await updateDoc(userToPromote.ref, { role: 'admin' });
      
      setUserSearch('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('errorAddAdmin'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAdmin = (userId: string, email: string) => {
    if (email === "mosinjonovjasurbek00@gmail.com") {
      setError(t('mainAdminError'));
      return;
    }
    setConfirmModal({
      show: true,
      title: t('removeAdminTitle'),
      message: t('removeAdminConfirm'),
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setConfirmModal(prev => ({ ...prev, show: false }));
          await updateDoc(doc(db, 'users', userId), { role: 'user' });
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
          setError(t('errorRemoveAdmin'));
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleAddNewsItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNewsText) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'news_items'), {
        text: newNewsText,
        language: newNewsLang,
        createdAt: serverTimestamp()
      });
      setNewNewsText('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("News add error:", err);
      setError(err.message || "Failed to add news");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNewsItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'news_items', id));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("News delete error:", err);
      setError(err.message || "Failed to delete news");
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto font-sans relative z-10">
      <Helmet>
        <title>Admin Panel - Animem.uz</title>
      </Helmet>
      {/* Feedback Messages */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 shadow-[0_10px_40px_rgba(220,38,38,0.4)] text-white px-6 py-4 rounded-2xl flex items-center gap-3 border border-red-500/20"
          >
            <AlertCircle size={20} />
            <span className="text-xs font-black uppercase tracking-widest">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:bg-white/10 p-1 rounded-full"><X size={16} /></button>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 shadow-[0_10px_40px_rgba(220,38,38,0.4)] text-white px-6 py-4 rounded-2xl flex items-center gap-3 border border-red-500/20"
          >
            <Check size={20} />
            <span className="text-xs font-black uppercase tracking-widest">{t('successMessage')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-black/95"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative glass rounded-[2.5rem] p-8 max-w-sm w-full border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-center mb-2">{confirmModal.title}</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center mb-8 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="glass-button py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="bg-red-600 hover:bg-red-500 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20"
                >
                  {t('delete')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {telegramStatus && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="glass rounded-2xl p-4 flex items-center justify-between border border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                <Send className="text-red-400" size={20} />
              </div>
              <div className="flex flex-col">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('telegramConnection')}</h4>
                <p className="text-xs font-bold text-white uppercase tracking-tight">@{telegramStatus.botName} ({t('connected')})</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {t('onlineMonitoring')}
            </div>
          </div>
        </div>
      )}

      <div className="flex glass p-1 rounded-2xl mb-10 w-fit mx-auto gap-1">
        <button
          onClick={() => { setActiveTab('anime'); setSelectedAnimeForEpisodes(null); }}
          className={cn(
            "px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all",
            activeTab === 'anime' ? "bg-red-600 text-white shadow-xl shadow-red-500/20" : "text-slate-400 hover:text-white"
          )}
        >
          <Film size={16} /> {t('animeTab')}
        </button>
        <button
          onClick={() => setActiveTab('episodes')}
          className={cn(
            "px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all",
            activeTab === 'episodes' ? "bg-red-600 text-white shadow-xl shadow-red-500/20" : "text-slate-400 hover:text-white"
          )}
        >
          <List size={16} /> {t('episodes')}
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={cn(
            "px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all",
            activeTab === 'messages' ? "bg-red-600 text-white shadow-xl shadow-red-500/20" : "text-slate-400 hover:text-white"
          )}
        >
          <MessageSquare size={16} /> {t('messages')}
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={cn(
            "px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all",
            activeTab === 'admins' ? "bg-red-600 text-white shadow-xl shadow-red-500/20" : "text-slate-400 hover:text-white"
          )}
        >
          <User size={16} /> {t('adminsTab')}
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={cn(
            "px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all",
            activeTab === 'news' ? "bg-red-600 text-white shadow-xl shadow-red-500/20" : "text-slate-400 hover:text-white"
          )}
        >
          <Sparkles size={16} /> {language === 'uz' ? 'HOT Ticker' : 'ГОРЯЧЕЕ'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'anime' && (
          <motion.div 
            key="anime-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-10"
          >
            <div className="lg:col-span-1">
              <div className="glass rounded-3xl p-8 sticky top-32">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{editingAnime ? t('edit') : t('newAnime')}</h2>
                  {editingAnime && (
                     <button onClick={() => setEditingAnime(null)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400">{t('cancel')}</button>
                  )}
                </div>
                <form onSubmit={handleAnimeSubmit} className="space-y-4">
                  <input type="text" placeholder={t('title')} className="glass-input w-full" value={title} onChange={e => setTitle(e.target.value)} required />
                  <textarea placeholder={t('description')} className="glass-input w-full h-24" value={description} onChange={e => setDescription(e.target.value)} />
                  
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{t('posterOrUrl')}</label>
                    <div className="flex gap-2">
                       <input type="file" onChange={e => setPosterFile(e.target.files?.[0] || null)} className="text-[10px] flex-1 text-slate-400 file:bg-white/5 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-[10px] file:text-white file:font-black file:uppercase file:cursor-pointer hover:file:bg-white/10" />
                    </div>
                    <input type="text" placeholder={t('posterOrUrl')} className="glass-input w-full" value={posterUrl} onChange={e => setPosterUrl(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <select className="glass-input" value={category} onChange={e => setCategory(e.target.value)}>
                      {CATEGORIES.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c} className="bg-slate-900">{t(categoryKeys[c] as any)}</option>
                      ))}
                    </select>
                    <select className="glass-input" value={contentType} onChange={e => setContentType(e.target.value as any)}>
                      <option value="series" className="bg-slate-900">{t('series')}</option>
                      <option value="movie" className="bg-slate-900">{t('movies')}</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" step="0.1" placeholder={t('rating')} className="glass-input" value={rating} onChange={e => setRating(Number(e.target.value))} />
                    <input type="number" placeholder={t('year')} className="glass-input" value={year} onChange={e => setYear(Number(e.target.value))} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-2"><Globe size={12}/>{t('language')}</label>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setAnimeLanguage('uz')}
                        className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", animeLanguage === 'uz' ? "bg-red-600 border-red-500 text-white shadow-lg" : "bg-white/5 border border-white/10 text-slate-400")}
                      >
                         O'zbek (UZ)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAnimeLanguage('ru')}
                        className={cn("flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", animeLanguage === 'ru' ? "bg-red-600 border-red-500 text-white shadow-lg" : "bg-white/5 border border-white/10 text-slate-400")}
                      >
                         Русский (RU)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 glass rounded-2xl cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsBanner(!isBanner)}>
                     <div className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", isBanner ? "bg-red-600 border-red-500 shadow-lg shadow-red-500/30" : "border-white/10")}>
                        {isBanner && <Check size={14} className="text-white" />}
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('addToBanner')}</span>
                  </div>

                  {uploadProgress !== null && (
                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} className="bg-red-500 h-full" />
                    </div>
                  )}

                  <button type="submit" disabled={submitting} className="glass-button-primary w-full py-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 shadow-red-600/20">
                    {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
                    {t('save')}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="glass rounded-3xl p-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-6">{t('animeList')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {animeList.map(anime => (
                    <div key={anime.id} className="glass rounded-2xl p-3 flex gap-4 items-center group relative overflow-hidden bg-white/[0.02]">
                      <img src={anime.posterUrl} alt={anime.title} referrerPolicy="no-referrer" className="w-16 h-24 object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x96?text=Error'; }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", anime.language === 'ru' ? "bg-red-500/20 text-red-400" : "bg-red-500/10 text-red-300")}>{anime.language === 'ru' ? 'RU' : 'UZ'}</span>
                          <h3 className="font-black text-sm uppercase truncate text-white">{anime.title}</h3>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase font-black">{anime.category} • {anime.year} • {anime.views || 0} {t('views')}</p>
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => { setSelectedAnimeForEpisodes(anime); setActiveTab('episodes'); }}
                            className="bg-red-600/20 text-red-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-red-600 hover:text-white transition-all"
                          >
                            {t('episodes')}
                          </button>
                          <button 
                            onClick={() => setEditingAnime(anime)}
                            className="bg-white/5 text-white/50 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-white/10 hover:text-white transition-all"
                          >
                            {t('edit')}
                          </button>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteAnime(anime.id)} 
                        disabled={submitting}
                        className="p-2 text-white/30 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'episodes' && (
          <motion.div 
            key="episodes-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {selectedAnimeForEpisodes ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1">
                  <div className="glass rounded-3xl p-8 sticky top-32">
                    <button 
                      onClick={() => setSelectedAnimeForEpisodes(null)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white mb-6"
                    >
                      <ArrowLeft size={14} /> {t('back')}
                    </button>
                    <h2 className="text-xl font-black uppercase tracking-tighter mb-2">{selectedAnimeForEpisodes.title}</h2>
                    <div className="flex justify-between items-center mb-6">
                      <p className="text-[10px] text-red-400 font-black uppercase">{editingEpisode ? t('editEpisode') : t('addEpisode')}</p>
                      {editingEpisode && (
                        <button onClick={() => setEditingEpisode(null)} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400">{t('cancel')}</button>
                      )}
                    </div>
                    
                    <form onSubmit={handleEpisodeSubmit} className="space-y-4">
                      <input type="number" placeholder={t('episodeNumber')} className="glass-input w-full" value={epNumber} onChange={e => setEpNumber(Number(e.target.value))} required />
                      <input type="text" placeholder={t('episodeTitle')} className="glass-input w-full" value={epTitle} onChange={e => setEpTitle(e.target.value)} />
                      <div className="space-y-1">
                         <input type="text" placeholder={t('videoUrl')} className="glass-input w-full" value={epVideoUrl} onChange={e => setEpVideoUrl(e.target.value)} />
                         <input type="file" accept="video/*" onChange={e => { const file = e.target.files?.[0]; if (file) setEpVideoFile(file); }} className="text-[10px] w-full text-slate-400 file:bg-white/5 file:border-0 file:rounded-lg file:px-3 file:py-1 file:text-[10px] file:text-white file:font-black file:uppercase file:cursor-pointer hover:file:bg-white/10" />
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">{t('telegramHint')}</p>
                      </div>

                      {uploadProgress !== null && (
                        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mb-4">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} className="bg-red-500 h-full" />
                        </div>
                      )}

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Opening Start (MM:SS)</label>
                            <input type="text" placeholder="2:14" className="glass-input w-full" value={epOpeningStart} onChange={e => setEpOpeningStart(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Opening End (MM:SS)</label>
                            <input type="text" placeholder="5:14" className="glass-input w-full" value={epOpeningEnd} onChange={e => setEpOpeningEnd(e.target.value)} />
                          </div>
                        </div>
                        <p className="text-[9px] text-amber-500 font-bold uppercase tracking-wider ml-1">Eslatma: Openingdan o'tish faqat Direct Link va Telegram orqali yuklangan videolar uchun ishlaydi. Iframe (YouTube, OK.ru) videolarida ishlamaydi.</p>
                      
                      <button type="submit" disabled={submitting} className="glass-button-primary w-full py-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 shadow-red-600/20">
                        {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
                        {editingEpisode ? t('edit') : t('add')}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="glass rounded-3xl p-8">
                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-6">{t('episodes')}</h2>
                    <div className="space-y-3">
                      {episodes.map(ep => (
                        <div key={ep.id} className="glass rounded-2xl p-4 flex items-center justify-between group bg-white/[0.02] border border-white/5 hover:border-red-500/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center font-black text-red-400 border border-red-500/20">
                              {ep.episodeNumber}
                            </div>
                            <div>
                              <h4 className="font-black text-xs uppercase text-white">{ep.title || `${t('episodeFallback')}${ep.episodeNumber}`}</h4>
                              <p className="text-[8px] text-slate-500 uppercase tracking-widest truncate max-w-xs">{ep.videoUrl}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setEditingEpisode(ep)}
                              className="p-2 text-white/20 hover:text-red-400 transition-colors"
                            >
                              <LinkIcon size={16} className="rotate-45" />
                            </button>
                            <button 
                              onClick={() => handleDeleteEpisode(ep.id)} 
                              disabled={submitting}
                              className="p-2 text-white/20 hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            </button>
                          </div>
                        </div>
                      ))}
                      {episodes.length === 0 && (
                        <div className="text-center py-10 text-slate-600 font-black uppercase tracking-widest text-xs italic">
                          {t('noEpisodes')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass rounded-3xl p-12 text-center">
                <h3 className="text-xl font-black tracking-tighter text-slate-500 uppercase mb-4">{t('selectAnimeFirst')}</h3>
                <button 
                   onClick={() => setActiveTab('anime')}
                   className="glass-button-primary px-10 py-3"
                >
                  {t('goToAnimeList')}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'messages' && (
          <motion.div 
            key="messages-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-3xl p-8 sm:p-12"
          >
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white">{t('userMessages')}</h2>
              <div className="bg-red-600/20 px-4 py-2 rounded-xl border border-red-500/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400">{messages.length} {t('msgCount')}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {messages.map(msg => (
                <div key={msg.id} className="glass rounded-[2rem] p-8 relative group border border-white/5 hover:border-red-500/30 transition-all bg-white/[0.01]">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center font-black text-red-500 border border-white/10">
                        {msg.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-sm uppercase tracking-tight text-white">{msg.name}</h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{msg.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  
                  <div className="bg-black/20 p-6 rounded-2xl border border-white/5 mb-6">
                    <p className="text-slate-300 text-xs font-medium leading-relaxed">{msg.message}</p>
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                    <div className="flex items-center gap-2 text-red-400">
                      <Send size={12} />
                      <span>{msg.contact}</span>
                    </div>
                    <span className="text-slate-600">{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleDateString() : t('recently')}</span>
                  </div>
                </div>
              ))}
              
              {messages.length === 0 && (
                <div className="col-span-full py-20 text-center glass rounded-3xl border-dashed border-2 border-white/5">
                  <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">{t('noMessages')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'admins' && (
          <motion.div 
            key="admins-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-10"
          >
            <div className="lg:col-span-1">
              <div className="glass rounded-[2.5rem] p-8 sm:p-10 sticky top-32 border border-white/10">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">{t('addAdmin')}</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-8">{t('searchUserByEmail')}</p>
                
                <form onSubmit={handleAddAdmin} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-1">{t('emailAddress')}</label>
                    <input 
                      type="email" 
                      placeholder="foydalanuvchi@gmail.com" 
                      className="glass-input w-full h-14" 
                      value={userSearch} 
                      onChange={e => setUserSearch(e.target.value)} 
                      required 
                    />
                  </div>
                  
                  <button type="submit" disabled={submitting} className="glass-button-primary w-full py-5 flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 shadow-red-600/20">
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{t('assignAdmin')}</span>
                  </button>
                </form>

                <div className="mt-10 p-6 bg-red-600/10 rounded-2xl border border-red-500/20">
                  <div className="flex items-center gap-3 text-red-400 mb-3">
                    <AlertCircle size={16} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{t('note')}</span>
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed normal-case">
                    {t('adminNote')}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="glass rounded-[2.5rem] p-8 sm:p-12 border border-white/5 bg-white/[0.01]">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-10 text-white">{t('adminList')}</h2>
                
                <div className="space-y-4">
                  {users.map(u => (
                    <div key={u.id} className="glass rounded-2xl p-4 sm:p-6 flex items-center justify-between group border border-white/5 hover:border-red-500/20 transition-all bg-white/[0.02]">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-500/20">
                          <User size={24} className="text-red-500" />
                        </div>
                        <div>
                          <h4 className="font-black text-sm uppercase tracking-tight text-white">@{u.username}</h4>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{u.email}</p>
                        </div>
                      </div>
                      
                      {u.email !== "mosinjonovjasurbek00@gmail.com" && (
                        <button 
                          onClick={() => handleRemoveAdmin(u.id, u.email)}
                          className="p-3 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          title={t('removeAdmin')}
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'news' && (
          <motion.div 
            key="news-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-10"
          >
            <div className="lg:col-span-1">
              <div className="glass rounded-[2.5rem] p-8 sm:p-10 sticky top-32 border border-white/10">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Yangi Xabar</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-8">Hot ticker uchun matn qo'shing</p>
                
                <form onSubmit={handleAddNewsItem} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-1">Xabar matni</label>
                    <textarea 
                      placeholder="Xabar matni..." 
                      className="glass-input w-full h-32 py-4" 
                      value={newNewsText} 
                      onChange={e => setNewNewsText(e.target.value)} 
                      required 
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setNewNewsLang('uz')}
                      className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", newNewsLang === 'uz' ? "bg-red-600 text-white shadow-lg" : "bg-white/5 text-slate-400")}
                    >
                      O'zbek
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewNewsLang('ru')}
                      className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", newNewsLang === 'ru' ? "bg-red-600 text-white shadow-lg" : "bg-white/5 text-slate-400")}
                    >
                      Русский
                    </button>
                  </div>

                  <button type="submit" disabled={submitting} className="glass-button-primary w-full py-5 flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 shadow-red-600/20">
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">Qo'shish</span>
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="glass rounded-[2.5rem] p-8 sm:p-12 border border-white/5 bg-white/[0.01]">
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-10 text-white">Xabarlar Ro'yxati</h2>
                
                <div className="space-y-4">
                  {newsItems.map(item => (
                    <div key={item.id} className="glass rounded-2xl p-6 flex justify-between items-center group border border-white/5 hover:border-red-500/20 transition-all bg-white/[0.02]">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                           <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", item.language === 'ru' ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/10 text-emerald-300")}>{item.language === 'ru' ? 'RU' : 'UZ'}</span>
                           <span className="text-[10px] font-black uppercase tracking-tight text-slate-600">
                             {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : 'Just now'}
                           </span>
                        </div>
                        <p className="text-sm font-bold text-white uppercase tracking-tight leading-relaxed max-w-xl">{item.text}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteNewsItem(item.id)}
                        className="p-3 text-slate-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  {newsItems.length === 0 && (
                    <div className="text-center py-20">
                      <Sparkles size={48} className="text-slate-800 mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Hozircha xabarlar yo'q</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
