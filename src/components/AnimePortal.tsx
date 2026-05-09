import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { slugify } from '../lib/slugs';
import { db, auth, loginWithGoogle } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, deleteDoc, writeBatch, serverTimestamp, where, increment, getDocs, addDoc, limit, updateDoc } from 'firebase/firestore';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Monitor, Settings, Star, Calendar, Clock, Search, Eye, X as CloseIcon, Loader2, Heart, Film, Sparkles, ChevronRight, ChevronLeft, Activity, TrendingUp, Check, ArrowLeft, MessageSquare, Send, User, Trash2, Filter, ChevronDown, RotateCcw, XCircle, Share2, Copy, Home, LayoutGrid, Bookmark, LogOut, Plus, Smile, SkipBack, SkipForward } from 'lucide-react';
import { ShareModal } from './ShareModal';
import AdBanner from './AdBanner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { CATEGORIES, categoryKeys } from '../constants';

interface AnimeDoc {
  id: string;
  title: string;
  posterUrl: string;
  description: string;
  category: string;
  genres?: string[];
  rating: number;
  ratingsCount?: number;
  year: number;
  type: 'movie' | 'series';
  views: number;
  isBanner?: boolean;
  slug?: string;
  createdAt: any;
  isRPlus?: boolean;
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

interface CommentDoc {
  id: string;
  userId: string;
  username: string;
  photoURL?: string;
  avatarUrl?: string; // Support legacy
  content: string;
  createdAt: any;
}

const UniversalVideoPlayer = ({ src, onNext, hasNext, videoLoading, setVideoLoading, openingStart, openingEnd }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [isHls, setIsHls] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsIframe(false);
    setResolvedSrc(null);
    setError(null);
    setIsHls(false);
    setVideoLoading(true);

    const resolveSrc = async () => {
      let finalSrc = src.trim();

      if (finalSrc.includes('<iframe')) {
        const srcMatch = finalSrc.match(/src=["']([^"']+)["']/);
        if (srcMatch) finalSrc = srcMatch[1];
      }

      if (finalSrc.startsWith('//')) {
        finalSrc = 'https:' + finalSrc;
      }

      const lowerSrc = finalSrc.toLowerCase();
      const isDirectExtension = lowerSrc.match(/\.(mp4|mkv|webm|mov|avi|m3u8)$/);
      const isApiStream = lowerSrc.includes('/api/') || lowerSrc.includes('stream') || lowerSrc.includes('/file/');

      if (lowerSrc.includes('.m3u8')) setIsHls(true);
      
      const proxyMap = {
        't.me/': '/api/telegram/stream',
        'telegram': '/api/telegram/stream',
        'vk.com/video': '/api/vk/stream',
        'vkvideo.ru': '/api/vk/stream',
        'd.tube/': '/api/dtube/stream',
        'dtube.video': '/api/dtube/stream',
        'discordapp.com': '/api/discord/stream',
        'discordapp.net': '/api/discord/stream',
        'ok.ru/': '/api/okru/stream'
      };

      const proxyEntry = Object.entries(proxyMap).find(([key]) => finalSrc.includes(key));

      if (proxyEntry && !isApiStream) {
        const proxyUrl = `${proxyEntry[1]}?url=${encodeURIComponent(finalSrc)}`;
        
        if (proxyUrl.includes('/api/vk') || proxyUrl.includes('/api/okru') || proxyUrl.includes('/api/rumble')) {
          try {
            const fetchUrl = `${proxyUrl}${proxyUrl.includes('?') ? '&' : '?'}format=json`;
            const response = await fetch(fetchUrl);
            if (response.ok) {
              const data = await response.json();
              if (isMounted && data.url) {
                setResolvedSrc(data.url);
                setIsIframe(false);
                if (data.url.includes('.m3u8')) setIsHls(true);
                return;
              }
            } else if (response.status === 404 || response.status === 403) {
              // Forced iframe fallback if proxy fails
              if (isMounted) {
                 let embedUrl = finalSrc;
                 if (finalSrc.includes('vk.com')) {
                    const vkMatch = finalSrc.match(/video(-?\d+)_(\d+)/);
                    if (vkMatch) embedUrl = `https://vk.com/video_ext.php?oid=${vkMatch[1]}&id=${vkMatch[2]}&hash=0`;
                 }
                 setResolvedSrc(embedUrl);
                 setIsIframe(true);
              }
              return;
            }
          } catch (e: any) {
            console.error("Proxy fetch error:", e?.message || e);
          }
        }
        
        if (isMounted) {
          setResolvedSrc(proxyUrl);
          setIsIframe(false);
        }
        return;
      }

      if (lowerSrc.includes('youtube.com') || lowerSrc.includes('youtu.be')) {
        const embedUrl = finalSrc.replace('watch?v=', 'embed/');
        if (isMounted) {
          setResolvedSrc(embedUrl);
          setIsIframe(true);
        }
        return;
      } else if (lowerSrc.includes('ok.ru/video/')) {
        const embedUrl = finalSrc.replace('ok.ru/video/', 'ok.ru/videoembed/');
        if (isMounted) {
          setResolvedSrc(embedUrl);
          setIsIframe(true);
        }
        return;
      }

      if (isDirectExtension || isApiStream) {
        if (isMounted) {
          setResolvedSrc(finalSrc);
          setIsIframe(false);
        }
      } else {
        if (isMounted) {
          setResolvedSrc(finalSrc);
          setIsIframe(true);
        }
      }
    };

    resolveSrc();
    return () => { isMounted = false; };
  }, [src, setVideoLoading]);

  useEffect(() => {
    let hls: Hls | null = null;
    const video = videoRef.current;
    if (!video || !resolvedSrc || isIframe) return;

    setError(null);

    const tryPlay = () => {
      video.play().catch(e => console.warn("Autoplay block:", e.message));
    };

    const handleTimeUpdate = () => {
      if (openingStart && openingEnd) {
        const current = video.currentTime;
        setShowSkipIntro(current >= openingStart && current <= openingEnd);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    if (isHls || resolvedSrc.includes('.m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = false; } });
        hls.loadSource(resolvedSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setVideoLoading(false);
          tryPlay();
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.warn("[HLS Fatal Error]", data.type);
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (data.response?.code === 403 || data.response?.code === 404) {
                  setIsIframe(true);
                } else {
                  hls!.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls!.recoverMediaError();
                break;
              default:
                setIsIframe(true);
                hls!.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = resolvedSrc;
        video.onloadeddata = tryPlay;
      }
    } else {
      video.src = resolvedSrc;
      video.onloadeddata = tryPlay;
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (hls) hls.destroy();
    };
  }, [resolvedSrc, isIframe, isHls, setVideoLoading, openingStart, openingEnd]);

  const skipIntro = () => {
    if (videoRef.current && openingEnd) {
      videoRef.current.currentTime = openingEnd;
      setShowSkipIntro(false);
    }
  };

  const handleManualSwitch = () => {
     setIsIframe(!isIframe);
     if (!isIframe) {
        // Switching TO iframe
        const lowerSrc = src.toLowerCase();
        let embed = src;
        if (lowerSrc.includes('vk.com')) {
           const match = src.match(/video(-?\d+)_(\d+)/);
           if (match) embed = `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}&hash=0`;
        }
        setResolvedSrc(embed);
     } else {
        // Switching TO native
        setResolvedSrc(null); // trigger re-resolve
     }
  };

  if (isIframe && resolvedSrc) {
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <iframe 
          src={resolvedSrc}
          referrerPolicy="no-referrer"
          className="w-full h-full border-none z-10 bg-black"
          allowFullScreen
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          onLoad={() => setVideoLoading(false)}
        />
        <button 
          onClick={handleManualSwitch}
          className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-black/90 text-white px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/20 transition-all flex items-center gap-2"
        >
          <Monitor size={12} />
          SWITCH TO NATIVE
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {error && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 text-white p-6 rounded-xl">
            <h3 className="text-red-500 text-xl font-bold mb-2">Xatolik</h3>
            <p className="text-sm opacity-80 text-center mb-4">{error}</p>
         </div>
      )}
      
      <video
        ref={videoRef}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        controls
        playsInline
        className="w-full h-full object-contain bg-black outline-none z-10"
        onCanPlay={() => setVideoLoading(false)}
        onLoadStart={() => setVideoLoading(true)}
        onWaiting={() => setVideoLoading(true)}
        onPlaying={() => setVideoLoading(false)}
        onError={() => {
           console.log("[Video Error] Fallback to iframe mode");
           setIsIframe(true);
           setVideoLoading(false);
        }}
        onEnded={() => {
          if (hasNext && onNext) onNext();
        }}
      />

      <div className="absolute top-4 right-4 z-50 flex gap-2">
         <button 
            onClick={handleManualSwitch}
            className="bg-black/60 hover:bg-black/90 text-white px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/20 transition-all flex items-center gap-2"
          >
            <Settings size={12} />
            IFRAME MODE
          </button>
      </div>

      <AnimatePresence>
        {showSkipIntro && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={skipIntro}
            className="absolute bottom-20 right-6 z-50 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-black uppercase tracking-tighter shadow-2xl flex items-center gap-2 group transition-all"
          >
            <Sparkles size={18} className="animate-pulse" />
            SKIP INTRO
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};




import { Language, useTranslation } from '../i18n';

interface AnimePortalProps {
  animeList: AnimeDoc[];
  loading: boolean;
  language: Language;
  showWatchlistOnly: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onAuthRequired: () => void;
}

const EMOJIS = [
  "😀", "😂", "🥰", "😎", "🤔", "😅", "🔥", "✨", "🙌", "👍", 
  "❤️", "💔", "💀", "🎉", "👀", "👋", "😭", "😤", "😡", "😱",
  "😋", "🤩", "🥳", "🤡", "🤖", "👻", "👾", "👽", "💩", "😈",
  "🤝", "💯", "✅", "❌", "⚠️", "🆘", "🎵", "🎮", "🍿", "🍔",
  "🦄", "🐱", "🐶", "🦊", "🦁", "🐯", "🐼", "🐨", "🐸", "🦒"
];

export default function AnimePortal({ 
  animeList, 
  loading, 
  language,
  showWatchlistOnly,
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  onAuthRequired
}: AnimePortalProps) {
  const navigate = useNavigate();
  const { animeSlug: urlAnimeSlug, episodeNumber: urlEpisodeNumber } = useParams();
  const location = useLocation();

  const t = useTranslation(language);
  const [user] = useAuthState(auth);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [selectedAnime, setSelectedAnime] = useState<AnimeDoc | null>(null);
  const [modalMode, setModalMode] = useState<'details' | 'player'>('details');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [episodes, setEpisodes] = useState<EpisodeDoc[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<EpisodeDoc | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [forceLegacy, setForceLegacy] = useState(false);
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isAgeVerified, setIsAgeVerified] = useState(() => {
    return sessionStorage.getItem('is_age_verified_18') === 'true';
  });
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [pendingAnimeAction, setPendingAnimeAction] = useState<any>(null);

  const [episodePage, setEpisodePage] = useState(0);
  const EPISODES_PER_PAGE = 30;

  const [relatedAnimes, setRelatedAnimes] = useState<AnimeDoc[]>([]);

  // Update related animes when selection changes
  useEffect(() => {
    if (selectedAnime) {
      setEpisodePage(0);
      const related = animeList
        .filter(a => a.id !== selectedAnime.id && (a.category === selectedAnime.category || a.genres?.some(g => selectedAnime.genres?.includes(g))))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6);
      setRelatedAnimes(related);
    }
  }, [selectedAnime, animeList]);

  const handleRateAnime = async (rating: number) => {
    if (!user) {
      onAuthRequired();
      return;
    }
    if (!selectedAnime) return;
    
    try {
      const animeRef = doc(db, 'anime', selectedAnime.id);
      const currentRating = selectedAnime.rating || 0;
      const currentCount = selectedAnime.ratingsCount || 0;
      
      const newCount = currentCount + 1;
      const newAverage = ((currentRating * currentCount) + rating) / newCount;
      
      await updateDoc(animeRef, {
        rating: Number(newAverage.toFixed(1)),
        ratingsCount: newCount
      });
      setUserRating(rating);
    } catch (error) {
      console.error("Rating error:", error);
    }
  };
  const [history, setHistory] = useState<any[]>([]);
  const trendingRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const topRatingRef = useRef<HTMLDivElement>(null);

  const scrollHandler = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -ref.current.offsetWidth * 0.8 : ref.current.offsetWidth * 0.8;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Function to save watching progress
  useEffect(() => {
    if (!user || !selectedAnime || !currentEpisode) return;

    // Save every 10 seconds or when significantly changed
    const interval = setInterval(async () => {
      const currentProgress = videoRef.current?.currentTime || 0;
      if (currentProgress < 10) return; // avoid saving 0s
      try {
        const historyId = `${user.uid}_${selectedAnime.id}`;
        await setDoc(doc(db, 'history', historyId), {
          userId: user.uid,
          animeId: selectedAnime.id,
          episodeId: currentEpisode.id,
          episodeNumber: currentEpisode.episodeNumber,
          progress: currentProgress,
          animeTitle: selectedAnime.title,
          posterUrl: selectedAnime.posterUrl,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error("Save history error:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user, selectedAnime, currentEpisode]);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const itemsPerPage = 12;

  // Global fallback timeout for stuck loading states
  useEffect(() => {
    let timeout: any;
    if (videoLoading) {
      timeout = setTimeout(() => {
        setVideoLoading(false);
        console.warn("[Player] Global loading timeout reached. Force clearing loading state.");
      }, 15000); // 15 seconds max global load time before giving up
    }
    return () => clearTimeout(timeout);
  }, [videoLoading]);

  const bannerAnime = animeList.filter(a => a.isBanner);
  const featuredAnime = bannerAnime.length > 0 ? bannerAnime[bannerIndex] : (animeList.find(a => a.rating >= 9) || animeList[0]);

  useEffect(() => {
    if (bannerAnime.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex(prev => (prev + 1) % bannerAnime.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [bannerAnime.length]);

  useEffect(() => {
    if (!auth.currentUser) {
      setWatchlist(new Set());
      return;
    }
    const q = query(collection(db, 'watchlist'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWatchlist(new Set(snapshot.docs.map(doc => doc.data().animeId)));
    });
    
    const qHistory = query(
      collection(db, 'history'), 
      where('userId', '==', auth.currentUser.uid), 
      orderBy('updatedAt', 'desc'), 
      limit(10)
    );
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => { unsubscribe(); unsubHistory(); };
  }, [auth.currentUser]);

  useEffect(() => {
    if (!selectedAnime) return;
    setLoadingEpisodes(true);
    const q = query(collection(db, 'anime', selectedAnime.id, 'episodes'), orderBy('episodeNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EpisodeDoc[];
      setEpisodes(docs);
      if (docs.length > 0 && !currentEpisode) {
        setVideoLoading(true);
        setCurrentEpisode(docs[0]);
      }
      setLoadingEpisodes(false);
    });
    return () => unsubscribe();
  }, [selectedAnime]);

  useEffect(() => {
    setForceLegacy(false);
  }, [selectedAnime?.id, currentEpisode?.id]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [episodeProgress, setEpisodeProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || history.length === 0) return;
    const progress: Record<string, number> = {};
    history.forEach(h => {
      if (h.animeId && h.episodeId) {
        progress[`${h.animeId}_${h.episodeId}`] = h.progress || 0;
      }
    });
    setEpisodeProgress(progress);
  }, [user, history]);

  let filteredAnime = animeList.filter(anime => {
    const matchesSearch = anime.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          anime.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesWatchlist = !showWatchlistOnly || watchlist.has(anime.id);
    
    // Support sidebar filtering
    let matchesTab = true;
    switch (activeTab) {
        case 'movies': matchesTab = anime.type === 'movie'; break;
        case 'series': matchesTab = anime.type === 'series'; break;
        case 'watchlist': matchesTab = watchlist.has(anime.id); break;
        case 'saved': matchesTab = watchlist.has(anime.id); break; 
        default: matchesTab = true; 
    }

    return matchesSearch && matchesWatchlist && matchesTab;
  });

  // Apply sorting
  filteredAnime = [...filteredAnime].sort((a, b) => {
    const getTs = (d: any) => typeof d === 'number' ? d : (d?.toMillis ? d.toMillis() : (d?.toDate ? d.toDate().getTime() : 0));
    return getTs(b.createdAt) - getTs(a.createdAt);
  });

  if (activeTab === 'news') {
    filteredAnime = filteredAnime.sort((a, b) => {
      const getTs = (d: any) => typeof d === 'number' ? d : (d?.toMillis ? d.toMillis() : (d?.toDate ? d.toDate().getTime() : 0));
      const aTime = getTs(a.createdAt);
      const bTime = getTs(b.createdAt);
      return bTime - aTime;
    });
  }

  // Deep linking logic with react-router-dom
  useEffect(() => {
    if (loading || animeList.length === 0) return;
    
    if (urlAnimeSlug) {
      const anime = animeList.find(a => slugify(a.title) === urlAnimeSlug || a.id === urlAnimeSlug);
      if (anime) {
        if (anime.isRPlus && !isAgeVerified) {
          setShowAgeVerification(true);
          setPendingAnimeAction(() => () => {
            setSelectedAnime(anime);
            setModalMode(location.pathname.includes('/watch/') ? 'player' : 'details');
          });
        } else {
          setSelectedAnime(anime);
          setModalMode(location.pathname.includes('/watch/') ? 'player' : 'details');
        }
      }
    } else {
        // If no animeId in URL, close modal if it was open
        if (selectedAnime) {
            setSelectedAnime(null);
            setCurrentEpisode(null);
        }
    }
  }, [loading, animeList, urlAnimeSlug, location.pathname]);

  // Handle specific episode from URL once loaded
  useEffect(() => {
    if (!selectedAnime || episodes.length === 0 || !urlEpisodeNumber) return;
    
    const ep = episodes.find(e => e.episodeNumber.toString() === urlEpisodeNumber);
    if (ep) {
      setCurrentEpisode(ep);
    }
  }, [selectedAnime, episodes, urlEpisodeNumber]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredAnime.length / itemsPerPage);
  const paginatedAnime = filteredAnime.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showWatchlistOnly]);

  useEffect(() => {
    if (!selectedAnime || modalMode !== 'details') {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'anime', selectedAnime.id, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CommentDoc[]);
    });
    return () => unsubscribe();
  }, [selectedAnime, modalMode]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedAnime || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await addDoc(collection(db, 'anime', selectedAnime.id, 'comments'), {
        userId: user.uid,
        username: user.displayName || user.email?.split('@')[0] || user.phoneNumber || 'Foydalanuvchi',
        photoURL: user.photoURL || '',
        content: newComment.trim(),
        createdAt: serverTimestamp()
      });
      
      setNewComment('');
    } catch (err: any) {
      console.error("Comment error:", err);
      alert("Xatolik: " + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedAnime) return;
    try {
      await deleteDoc(doc(db, 'anime', selectedAnime.id, 'comments', commentId));
    } catch (err) {
      console.error("Delete comment error:", err);
    }
  };

  const handleWatchlist = async (e: React.MouseEvent, animeId: string) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      onAuthRequired();
      return;
    }
    const isSaved = watchlist.has(animeId);
    const id = `${auth.currentUser.uid}_${animeId}`;
    if (isSaved) {
      await deleteDoc(doc(db, 'watchlist', id));
    } else {
      await setDoc(doc(db, 'watchlist', id), {
        userId: auth.currentUser.uid,
        animeId: animeId,
        createdAt: serverTimestamp()
      });
    }
  };

  const handleNextEpisode = () => {
    if (!currentEpisode) return;
    const currentIndex = episodes.findIndex(ep => ep.id === currentEpisode.id);
    if (currentIndex < episodes.length - 1) {
      handleEpisodeSelect(episodes[currentIndex + 1]);
    }
  };

  const handlePrevEpisode = () => {
    if (!currentEpisode) return;
    const currentIndex = episodes.findIndex(ep => ep.id === currentEpisode.id);
    if (currentIndex > 0) {
      handleEpisodeSelect(episodes[currentIndex - 1]);
    }
  };

  const handleEpisodeSelect = async (ep: EpisodeDoc) => {
    if (currentEpisode?.id === ep.id) return;
    
    if (selectedAnime) {
      navigate(`/watch/${slugify(selectedAnime.title)}/${ep.episodeNumber}`);
    }
    
    setVideoLoading(true);
    setCurrentEpisode(ep);
    
    if (auth.currentUser && selectedAnime) {
      const historyId = `${auth.currentUser.uid}_${selectedAnime.id}`;
      setDoc(doc(db, 'history', historyId), {
        userId: auth.currentUser.uid,
        animeId: selectedAnime.id,
        episodeId: ep.id,
        episodeNumber: ep.episodeNumber,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  };

  const handleCloseAnime = () => {
    setSelectedAnime(null);
    setCurrentEpisode(null);
    navigate('/');
  };

  // Add escape key listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedAnime) {
        handleCloseAnime();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedAnime]);

  const handleOpenAnime = (anime: AnimeDoc, mode: 'details' | 'player' = 'details') => {
    const action = () => {
      const slug = slugify(anime.title);
      if (mode === 'details') {
        navigate(`/anime/${slug}`);
      } else {
        // For player, we navigate to the last watched episode if history exists
        const histItem = history.find(h => h.animeId === anime.id);
        const epNum = histItem?.episodeNumber || 1;
        navigate(`/watch/${slug}/${epNum}`);
      }

      if (mode === 'player') {
        setDoc(doc(db, 'anime', anime.id), { views: increment(1) }, { merge: true });
      }
    };

    if (anime.isRPlus && !isAgeVerified) {
      setPendingAnimeAction(() => action);
      setShowAgeVerification(true);
    } else {
      action();
    }
  };

  const getTitle = () => {
    if (selectedAnime) {
      if (modalMode === 'player' && currentEpisode) {
        return `${selectedAnime.title} - ${currentEpisode.episodeNumber}-${language === 'uz' ? 'qism' : 'серия'} - O'zbek tilida onlayn tomosha qiling - Animem.uz`;
      }
      return `${selectedAnime.title} - O'zbek tilida sifatli anime - Animem.uz`;
    }
    if (activeTab === 'news') return `${language === 'uz' ? 'So\'nggi Anime Yangiliklar' : 'Последние новости аниме'} - Animem.uz`;
    if (activeTab === 'watchlist' || activeTab === 'saved') return `${language === 'uz' ? 'Saqlanganlar' : 'Сохраненное'} - Mening ro'yxatim - Animem.uz`;
    return 'Animem.uz - O\'zbek tilidagi eng so\'nggi animelar markazi';
  };

  const getDescription = () => {
    if (selectedAnime) {
      if (modalMode === 'player' && currentEpisode) {
        return `${selectedAnime.title} ${currentEpisode.episodeNumber}-qismini o'zbek tilida HD sifatda onlayn tomosha qiling. ${selectedAnime.description?.slice(0, 100)}...`;
      }
      return `${selectedAnime.title} - barcha qismlari o'zbek tilida bepul va yuqori sifatda. Animem.uz - o'zbekcha animelar markazi.`;
    }
    return 'Animem.uz - O\'zbekistondagi eng yirik anime portali. Barcha animelar o\'zbek tilida, sifatli ovozda va HD formatda. Eng so\'nggi seriallar va filmlar.';
  };

  const getKeywords = () => {
    if (selectedAnime) {
      return `${selectedAnime.title}, ${selectedAnime.title} o\'zbek tilida, ${selectedAnime.title} online ko\'rish, ${selectedAnime.category}, anime o\'zbekcha, animem, animem uz`;
    }
    return 'anime o\'zbek tilida, animem, animem uz, anime online, uzbek anime, vatan anime, anime ko\'rish, o\'zbekcha dublyaj, anime seriallar';
  };

  const getCanonical = () => {
    const baseUrl = 'https://animem.uz';
    if (selectedAnime) return `${baseUrl}/anime/${selectedAnime.slug || selectedAnime.id}`;
    if (activeTab === 'news') return `${baseUrl}/news`;
    if (activeTab === 'watchlist') return `${baseUrl}/watchlist`;
    return baseUrl;
  };

  return (
    <div className="flex flex-col min-w-0">
      <Helmet key={selectedAnime?.id || activeTab}>
        <title>{getTitle()}</title>
        <meta name="description" content={getDescription()} />
        <meta name="keywords" content={getKeywords()} />
        <meta property="og:title" content={getTitle()} />
        <meta property="og:description" content={getDescription()} />
        <meta property="og:image" content={selectedAnime ? selectedAnime.posterUrl : 'https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg'} />
        <meta property="og:url" content={getCanonical()} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={getTitle()} />
        <meta name="twitter:description" content={getDescription()} />
        <meta name="twitter:image" content={selectedAnime ? selectedAnime.posterUrl : 'https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg'} />
        <link rel="canonical" href={getCanonical()} />
        <link rel="alternate" hrefLang="uz" href={getCanonical()} />
        <link rel="alternate" hrefLang="ru" href={getCanonical()} />
        <link rel="alternate" hrefLang="x-default" href={getCanonical()} />
        {selectedAnime && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": modalMode === 'player' ? "VideoObject" : "Movie",
              "name": modalMode === 'player' ? `${selectedAnime.title} - Ep ${currentEpisode?.episodeNumber}` : selectedAnime.title,
              "description": selectedAnime.description,
              "thumbnailUrl": selectedAnime.posterUrl,
              "uploadDate": selectedAnime.createdAt?.toDate ? selectedAnime.createdAt.toDate().toISOString() : new Date().toISOString(),
              "genre": selectedAnime.category,
              "author": {
                "@type": "Organization",
                "name": "Animem Uz"
              },
              "interactionStatistic": {
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/WatchAction",
                "userInteractionCount": selectedAnime.views || 0
              }
            })}
          </script>
        )}
      </Helmet>
      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {/* Middle Content */}
        <div className="flex-1 min-w-0 py-2 sm:py-6 pb-32">
          
          {/* Trending Hero Section */}
          {!loading && featuredAnime && activeTab === 'gallery' && !searchTerm && !showWatchlistOnly && (
            <div className="mb-8 md:mb-12">
              <div className="relative aspect-[4/5] sm:aspect-[21/9] sm:rounded-[2.5rem] overflow-hidden group shadow-2xl bg-black -mx-4 sm:mx-0">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={featuredAnime.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                  >
                    <img 
                      src={featuredAnime.posterUrl} 
                      className="w-full h-full object-cover object-top sm:object-center" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-[#0B0B14] via-[#0B0B14]/80 sm:from-black sm:via-black/80 to-transparent" />
                    
                    <div className="absolute inset-0 flex flex-col md:flex-row md:items-center justify-end md:justify-between p-4 sm:p-12 md:p-16">
                         <div className="flex-1 max-w-2xl w-full flex flex-col justify-end md:justify-center h-full md:h-auto">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter uppercase mb-4 sm:mb-6 leading-none line-clamp-2 sm:line-clamp-none flex-shrink-0">
                                {featuredAnime.title}
                                </h1>
                                
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4 sm:mb-6">
                                   <div className="flex items-center gap-1 sm:gap-2">
                                     <Star size={16} fill="#f59e0b" className="text-amber-500 w-4 h-4 sm:w-5 sm:h-5" />
                                     <span className="text-sm sm:text-base font-black">{featuredAnime.rating}</span>
                                   </div>
                                   <span className="text-sm sm:text-base font-bold text-slate-500">{featuredAnime.year}</span>
                                   <span className="text-sm sm:text-base font-bold text-red-500 uppercase">{featuredAnime.type || 'TV'}</span>
                                </div>
                                
                                <p className="text-slate-300 text-xs sm:text-sm md:text-base line-clamp-3 sm:line-clamp-4 font-medium opacity-80 leading-relaxed max-w-xl mb-6 sm:mb-8">
                                {featuredAnime.description}
                                </p>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                    <button 
                                    onClick={() => handleOpenAnime(featuredAnime, 'player')}
                                    className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl flex justify-center items-center gap-3 shadow-xl shadow-[var(--accent)]/20 transition-all font-black"
                                    >
                                    <Play size={18} fill="white" className="sm:w-[18px] sm:h-[18px]" /> {t('watchBtn' as any)}
                                    </button>
                                    <button 
                                    onClick={(e) => handleWatchlist(e, featuredAnime.id)}
                                    className={cn(
                                        "px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border border-white/10 text-white hover:bg-white/5 transition-all text-xs font-black flex items-center justify-center",
                                        watchlist.has(featuredAnime.id) && "bg-[var(--accent)]/20 border-[var(--accent)] text-red-500"
                                    )}
                                    >
                                    <Heart size={20} className={cn(watchlist.has(featuredAnime.id) && "fill-current text-red-500")} />
                                    <span className="ml-2">{t('save')}</span>
                                    </button>
                                </div>
                            </motion.div>
                         </div>
                         
                         {/* Poster Image on the Right with Animation */}
                         <motion.div 
                           initial={{ opacity: 0, scale: 0.8, rotate: 5, x: 50 }}
                           animate={{ opacity: 1, scale: 1, rotate: 3, x: 0 }}
                           transition={{ 
                             duration: 1,
                             delay: 0.4,
                             type: "spring",
                             bounce: 0.3
                           }}
                           whileHover={{ 
                             rotate: 0, 
                             scale: 1.05,
                             transition: { duration: 0.4, ease: "easeOut" }
                           }}
                           className="hidden md:block w-72 h-[420px] rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-20 shrink-0"
                         >
                            <motion.div
                              animate={{ 
                                y: [0, -10, 0],
                              }}
                              transition={{ 
                                duration: 5, 
                                repeat: Infinity, 
                                ease: "easeInOut" 
                              }}
                              className="w-full h-full"
                            >
                                <img 
                                    src={featuredAnime.posterUrl} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                    alt={featuredAnime.title}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                            </motion.div>
                         </motion.div>
                     </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}


          {(searchTerm || showWatchlistOnly || activeTab === 'anime' || activeTab === 'news') && (
            <div className="px-4">
               <div className="flex items-center justify-between mb-10 pb-6 border-b border-white/5">
                  <div className="flex flex-col gap-2">
                     <h2 className="text-3xl font-black tracking-tighter uppercase italic flex items-center gap-4">
                        <Search className="text-red-500" size={32} />
                        {showWatchlistOnly ? t('saved') : 
                         searchTerm ? `"${searchTerm}"` : 
                         activeTab === 'news' ? t('news' as any) :
                         t('anime' as any)}
                      </h2>
                      <div className="flex items-center gap-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Showing {filteredAnime.length} results</p>
                      </div>
                  </div>
                  
                  {/* Action Buttons for Filter View */}
                  {searchTerm && (
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={() => {
                          if (searchTerm) setSearchTerm('');
                         }}
                         className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2 group"
                       >
                          <XCircle size={16} className="group-hover:rotate-90 transition-transform" />
                          Tozalash
                       </button>
                    </div>
                  )}
               </div>

               {loading ? (
                 <div className="py-40 flex flex-col items-center justify-center text-center space-y-8">
                     <Loader2 className="animate-spin text-red-500 w-12 h-12" />
                     <h3 className="text-xl font-black uppercase tracking-tighter text-white">{t('loadingString')}</h3>
                 </div>
               ) : filteredAnime.length > 0 ? (
                 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-6 gap-y-10">
                    {filteredAnime.map(anime => (
                      <div 
                        key={anime.id}
                        onClick={() => handleOpenAnime(anime)}
                        className="group flex flex-col cursor-pointer"
                      >
                          <div className="relative aspect-[2/3] rounded-3xl overflow-hidden border border-white/5 group-hover:border-red-500/50 transition-all shadow-2xl bg-[#080808] will-change-transform">
                            <img 
                              src={anime.posterUrl} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                              referrerPolicy="no-referrer" 
                              loading="lazy"
                              decoding="async"
                              alt={anime.title}
                            />
                            
                            {/* Rating Overlay */}
                            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                               <Star size={10} fill="#f59e0b" className="text-amber-500" />
                               <span className="text-[11px] font-black tabular-nums">{anime.rating}</span>
                            </div>

                            {anime.isRPlus && (
                              <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-red-500/30">
                                 <span className="text-[10px] font-black text-red-500 uppercase">R+</span>
                              </div>
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-red-600/60 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-6 duration-500">
                               <div className="flex gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); handleOpenAnime(anime); }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/40 translate-y-4 group-hover:translate-y-0 transition-transform">
                                     {t('watch')}
                                  </button>
                                  <button 
                                    onClick={(e) => handleWatchlist(e, anime.id)}
                                    className={cn(
                                       "p-4 rounded-2xl border transition-all translate-y-4 group-hover:translate-y-0 duration-300",
                                       watchlist.has(anime.id) 
                                         ? "bg-red-600 border-red-500 text-white shadow-xl shadow-red-600/40" 
                                         : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                                    )}
                                  >
                                     <Heart size={18} className={cn(watchlist.has(anime.id) && "fill-current")} />
                                  </button>
                               </div>
                            </div>
                         </div>
                         <div className="mt-5 space-y-1 px-2">
                            <h3 className="text-sm font-black uppercase tracking-tight text-white group-hover:text-red-400 transition-colors line-clamp-1">{anime.title}</h3>
                            <div className="flex items-center gap-3">
                               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">{anime.year}</span>
                               <div className="w-1 h-1 bg-slate-700 rounded-full" />
                               <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{anime.type || 'TV'}</span>
                               <div className="w-1 h-1 bg-slate-700 rounded-full" />
                               <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                  <Eye size={10} />
                                  <span>{(anime.views || 0).toLocaleString()}</span>
                               </div>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="py-40 flex flex-col items-center justify-center text-center space-y-8">
                    <div className="w-24 h-24 bg-white/[0.02] border-2 border-dashed border-white/5 rounded-full flex items-center justify-center text-slate-700">
                       <Search size={40} />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-xl font-black uppercase tracking-tighter">No anime found</h3>
                       <p className="text-slate-500 font-medium max-w-xs">{t('noAnimeFound')}</p>
                    </div>
                 </div>
               )}
            </div>
          )}

          {/* Rail: Continue Watching (Personalized) */}
          {activeTab === 'gallery' && !searchTerm && !showWatchlistOnly && user && history.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                  Ko'rishda davom etish
                </h2>
                <div className="flex items-center gap-4">
                  <button onClick={() => setHistory([])} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2 group">
                    Tozalash
                    <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 scroll-smooth">
                {history.slice(0, 8).map((h) => {
                  const anime = animeList.find(a => a.id === h.animeId);
                  if (!anime) return null;
                  return (
                    <div 
                      key={`history-${h.id}`}
                      onClick={() => {
                        const ep = episodes.find(e => e.id === h.episodeId) || { id: h.episodeId, episodeNumber: h.episodeNumber };
                        handleOpenAnime(anime, 'player');
                        // Substantial logic for episode selection will trigger on open
                      }}
                      className="flex-shrink-0 w-64 group cursor-pointer h-32 flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-3xl p-3 transition-all relative overflow-hidden"
                    >
                      <div className="w-20 h-full rounded-2xl overflow-hidden border border-white/5 shrink-0 bg-slate-900 relative">
                        <img 
                          src={anime.posterUrl} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          referrerPolicy="no-referrer" 
                          alt={anime.title}
                        />
                      </div>
                      <div className="min-w-0 pr-2">
                        <h3 className="font-bold text-xs uppercase tracking-tight text-white group-hover:text-red-400 transition-colors line-clamp-1">{anime.title}</h3>
                        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-1">{h.episodeNumber}-qism</p>
                        <div className="mt-2 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full bg-red-600" style={{ width: '45%' }} /> {/* Placeholder progress since we don't have total duration here easily */}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rail: Trending Now */}
          {(activeTab === 'gallery' && !searchTerm && !showWatchlistOnly) && (
            <div className="mb-12">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
                <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                {t('trendingNow' as any)}
              </h2>
              <div className="flex items-center gap-4">
                <button onClick={() => { setActiveTab('anime'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2 group">
                  {t('seeAll' as any)}
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mb-6 pr-2">
                <button 
                  onClick={() => scrollHandler(trendingRef, 'left')}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all active:scale-90 border border-white/5"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={() => scrollHandler(trendingRef, 'right')}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all active:scale-90 border border-white/5"
                >
                  <ChevronRight size={18} />
                </button>
            </div>
            <div ref={trendingRef} className="flex gap-6 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 scroll-smooth">
              {animeList.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10).map((anime) => (
                <div 
                  key={`trending-${anime.id}`}
                  onClick={() => handleOpenAnime(anime)}
                  className="flex-shrink-0 w-44 sm:w-52 group cursor-pointer"
                >
                  <div className="aspect-[2/3] rounded-3xl overflow-hidden border border-white/5 group-hover:border-red-500/50 transition-all relative shadow-xl bg-slate-900 will-change-transform">
                    <img 
                      src={anime.posterUrl} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      referrerPolicy="no-referrer" 
                      loading="lazy"
                      decoding="async"
                      alt={anime.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    {anime.isRPlus && (
                      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-red-500/30">
                        <span className="text-[10px] font-black text-red-500 uppercase">R+</span>
                      </div>
                    )}
                    {anime.rating >= 8.5 && (
                      <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-lg text-[8px] font-black uppercase text-white shadow-lg">
                        POPULAR
                      </div>
                    )}
                  </div>
                  <h3 className="mt-4 font-bold text-sm uppercase tracking-tight text-white group-hover:text-red-400 transition-colors line-clamp-1">{anime.title}</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{anime.year} • {anime.type}</p>
                </div>
              ))}
            </div>
          </div>
          )}

          <AdBanner />

          {/* Rail: Popular This Week */}
          {(activeTab === 'gallery' && !searchTerm && !showWatchlistOnly) && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
                <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                {t('popularThisWeek' as any)}
              </h2>
              <div className="flex items-center gap-4">
                <button onClick={() => { setActiveTab('anime'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2 group">
                  {t('seeAll' as any)}
                  <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mb-6 pr-2">
                <button 
                  onClick={() => scrollHandler(popularRef, 'left')}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all active:scale-90 border border-white/5"
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={() => scrollHandler(popularRef, 'right')}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all active:scale-90 border border-white/5"
                >
                  <ChevronRight size={18} />
                </button>
            </div>
            <div ref={popularRef} className="flex gap-6 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 scroll-smooth">
              {animeList.filter(a => a.rating >= 8.5).slice(0, 10).map((anime, i) => (
                <div 
                  key={`popular-${anime.id}`}
                  onClick={() => handleOpenAnime(anime)}
                  className="flex-shrink-0 w-64 sm:w-72 group cursor-pointer h-32 flex items-center gap-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-3xl p-3 transition-all"
                >
                  <div className="text-3xl font-black text-white/10 group-hover:text-red-500/20 italic tabular-nums w-10 shrink-0 text-center">
                    0{i+1}
                  </div>
                  <div className="w-20 h-full rounded-2xl overflow-hidden border border-white/5 shrink-0 bg-slate-900 will-change-transform relative">
                    <img 
                      src={anime.posterUrl} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 text-[0]" 
                      referrerPolicy="no-referrer" 
                      loading="lazy"
                      decoding="async"
                      alt={anime.title}
                    />
                    {anime.isRPlus && (
                      <div className="absolute top-1 left-1 z-10 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-red-500/30">
                        <span className="text-[8px] font-black text-red-500 uppercase">R+</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-xs uppercase tracking-tight text-white group-hover:text-red-400 transition-colors line-clamp-2">{anime.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Star size={10} fill="#f59e0b" className="text-amber-500" />
                      <span className="text-[10px] font-black text-slate-500 uppercase">{anime.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Rail: Top Rating (moved to bottom) */}
          {activeTab === 'gallery' && !searchTerm && !showWatchlistOnly && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                  {t('topRating' as any)}
                </h2>
                <div className="flex items-center gap-4">
                  <button onClick={() => { setActiveTab('anime'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-[10px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2 group">
                    {t('seeAll' as any)}
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mb-6 pr-2">
                  <button 
                    onClick={() => scrollHandler(topRatingRef, 'left')}
                    className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all active:scale-90 border border-white/5"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button 
                    onClick={() => scrollHandler(topRatingRef, 'right')}
                    className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all active:scale-90 border border-white/5"
                  >
                    <ChevronRight size={18} />
                  </button>
              </div>
              
              <div ref={topRatingRef} className="flex gap-6 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 scroll-smooth">
                {animeList.sort((a,b) => b.rating - a.rating).slice(0, 5).map((anime, i) => (
                  <div 
                    key={`top-${anime.id}`}
                    onClick={() => handleOpenAnime(anime)}
                    className="flex flex-col group cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-3xl p-4 transition-all relative overflow-hidden"
                  >
                    <div className="absolute right-0 -bottom-6 text-8xl font-black text-white/5 group-hover:text-red-500/10 italic transition-colors pointer-events-none z-0">
                      {i+1}
                    </div>
                    <div className="flex items-center gap-4 relative z-10 w-full">
                      <div className="w-16 h-20 rounded-xl overflow-hidden shrink-0 border border-white/5 group-hover:border-red-500/50 transition-colors bg-slate-900 will-change-transform relative">
                        <img 
                          src={anime.posterUrl} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 text-[0]" 
                          referrerPolicy="no-referrer" 
                          loading="lazy"
                          decoding="async"
                          alt={anime.title}
                        />
                        {anime.isRPlus && (
                          <div className="absolute top-0 left-0 z-10 bg-black/60 backdrop-blur-md px-1 py-0.5 rounded-br-lg border-b border-r border-red-500/30">
                            <span className="text-[7px] font-black text-red-500 uppercase">R+</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 pr-2">
                        <h4 className="font-black text-xs uppercase tracking-tight text-white line-clamp-2 group-hover:text-red-400 transition-colors">{anime.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold">
                            <Star size={10} fill="currentColor" /> {anime.rating}
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">{anime.year}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AdBanner />

        </div>
      </div>

      <AnimatePresence>
        {selectedAnime && (
           <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#0B0B14]/90 backdrop-blur-md"
          >
            <div 
              className="absolute inset-0 z-0" 
              onClick={handleCloseAnime} 
            />
            
            <div
              className="relative z-10 w-full h-full bg-[#12121F] overflow-hidden border border-white/10 shadow-2xl flex flex-col"
            >
              <button 
                onClick={handleCloseAnime} 
                className="absolute top-4 right-4 z-[999] p-2 bg-[#12121F]/60 hover:bg-[#12121F]/90 text-white rounded-full transition-all border border-white/20 active:scale-90"
              >
                <XCircle size={24} className="sm:w-7 sm:h-7" />
              </button>

              <AnimatePresence mode="wait">
                {modalMode === 'details' ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10"
                  >
                    {/* Modal Content Structure */}
                    <div className="flex flex-col md:flex-row gap-8">
                      {/* Poster */}
                      <div className="shrink-0 w-full md:w-72 aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                        <img src={selectedAnime.posterUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" style={{ backgroundColor: '#1f2937' }} alt={selectedAnime.title} onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x600?text=Error'; }} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 space-y-6">
                        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">{selectedAnime.title}</h2>
                        
                        <div className="flex flex-wrap gap-3">
                            <span className="px-3 py-1 bg-red-600 rounded-lg text-xs font-bold uppercase">{selectedAnime.type || 'TV'}</span>
                            <span className="px-3 py-1 bg-white/10 rounded-lg text-xs font-bold uppercase">{selectedAnime.year}</span>
                        </div>

                        <div>
                            <p className={cn(
                                "text-slate-400 text-sm leading-relaxed",
                                !expandedDesc && "line-clamp-3"
                            )}>
                                {selectedAnime.description}
                            </p>
                            {selectedAnime.description && selectedAnime.description.length > 150 && (
                                <button 
                                    onClick={() => setExpandedDesc(!expandedDesc)}
                                    className="text-red-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest mt-2"
                                >
                                    {expandedDesc ? "Kamroq o'qish" : "Ko'proq o'qish"}
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShareModalOpen(true)}
                                className="flex items-center justify-center gap-3 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors text-sm"
                            >
                                <Share2 size={18} />
                                Ulashish
                            </button>
                            <button
                                onClick={(e) => handleWatchlist(e, selectedAnime.id)}
                                className={cn(
                                    "flex items-center justify-center gap-3 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors text-sm",
                                    watchlist.has(selectedAnime.id) && "text-red-500 bg-red-600/10 border-red-500/30"
                                )}
                            >
                                <Heart size={18} className={cn(watchlist.has(selectedAnime.id) && "fill-current text-red-500")} />
                                {watchlist.has(selectedAnime.id) ? "Saqlangan" : "Saqlash"}
                            </button>
                        </div>

                        {/* Rating Component */}
                        <div className="flex flex-col gap-4 py-4 border-y border-white/5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Anime reytingi</span>
                                <div className="flex items-center gap-1.5">
                                    <Star size={14} fill="#f59e0b" className="text-amber-500" />
                                    <span className="text-lg font-black">{selectedAnime.rating || '0.0'}</span>
                                    <span className="text-[10px] text-slate-500 font-bold ml-1">({selectedAnime.ratingsCount || 0})</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-center gap-2 bg-white/5 p-4 rounded-xl">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => handleRateAnime(star)}
                                        className="transition-all hover:scale-125 focus:scale-110"
                                    >
                                        <Star 
                                            size={18} 
                                            className={cn(
                                                "transition-colors",
                                                (userRating && star <= userRating) ? "text-amber-500 fill-amber-500" : "text-slate-600 hover:text-amber-400"
                                            )} 
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Episodes selection in details view */}
                        <div className="pt-8 border-t border-white/5">
                            <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center justify-between">
                               Qismlarni tanlang
                               <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-slate-500 font-bold">{episodes.length} TA QISM</span>
                            </h3>
                            <div className="flex flex-col gap-4">
                              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                                  {loadingEpisodes ? (
                                      [1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-square bg-white/5 animate-pulse rounded-lg" />)
                                  ) : episodes.length > 0 ? (
                                      episodes.slice(episodePage * EPISODES_PER_PAGE, (episodePage + 1) * EPISODES_PER_PAGE).map((ep) => (
                                          <button
                                              key={ep.id}
                                              onClick={() => {
                                                  handleEpisodeSelect(ep);
                                                  setModalMode('player');
                                              }}
                                              className={cn(
                                                  "aspect-square flex flex-col items-center justify-center bg-white/5 hover:bg-red-600 transition-all group rounded-lg border border-white/5 hover:border-red-500 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] relative overflow-hidden",
                                                  currentEpisode?.id === ep.id && "bg-red-600 border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                                              )}
                                          >
                                              <span className={cn(
                                                  "text-xs font-black transition-colors",
                                                  currentEpisode?.id === ep.id ? "text-white" : "text-slate-400 group-hover:text-white"
                                              )}>
                                                  {ep.episodeNumber}
                                              </span>

                                              {/* Progress indicator */}
                                              {episodeProgress[`${selectedAnime.id}_${ep.id}`] > 0 && (
                                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                                                  <div 
                                                    className="h-full bg-red-400" 
                                                    style={{ width: `${Math.min(100, (episodeProgress[`${selectedAnime.id}_${ep.id}`] / 1440) * 100)}%` }}
                                                  />
                                                </div>
                                              )}
                                          </button>
                                      ))
                                  ) : (
                                      <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
                                          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                                              <Film size={24} />
                                          </div>
                                          <h4 className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Hozircha qismlar yuklanmagan</h4>
                                      </div>
                                  )}
                              </div>

                              {episodes.length > EPISODES_PER_PAGE && (
                                <div className="flex items-center justify-center gap-4 mt-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                                  <button
                                    disabled={episodePage === 0}
                                    onClick={() => setEpisodePage(prev => Math.max(0, prev - 1))}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                  >
                                    <ArrowLeft size={14} />
                                    Ortga qaytarish
                                  </button>
                                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Sahifa {episodePage + 1} / {Math.ceil(episodes.length / EPISODES_PER_PAGE)}
                                  </div>
                                  <button
                                    disabled={(episodePage + 1) * EPISODES_PER_PAGE >= episodes.length}
                                    onClick={() => setEpisodePage(prev => prev + 1)}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 text-white shadow-lg shadow-red-600/20"
                                  >
                                    Keyingi qisimlar
                                    <ChevronRight size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Comments Section */}
                    <section className="mt-12">
                         <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
                            {t('comments')} ({comments.length})
                         </h3>
                         
                         {user ? (
                            <form onSubmit={handlePostComment} className="flex flex-col gap-3 mb-12">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                      className={cn(
                                        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all border",
                                        showEmojiPicker 
                                          ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]" 
                                          : "bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20"
                                      )}
                                    >
                                      <Smile size={24} className={cn("transition-transform duration-300", showEmojiPicker && "rotate-12 scale-110")} />
                                    </button>

                                    <AnimatePresence>
                                      {showEmojiPicker && (
                                        <motion.div 
                                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                          animate={{ opacity: 1, y: 0, scale: 1 }}
                                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                          className="absolute bottom-full left-0 mb-4 p-4 bg-[#12121F]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-2xl z-50 w-72 sm:w-80"
                                        >
                                          <div className="flex items-center justify-between mb-4 px-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Emoji tanlang</span>
                                            <button 
                                              type="button" 
                                              onClick={() => setShowEmojiPicker(false)}
                                              className="text-slate-500 hover:text-white transition-colors"
                                            >
                                              <XCircle size={16} />
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-6 sm:grid-cols-7 gap-1 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                                            {EMOJIS.map(emoji => (
                                              <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => {
                                                  setNewComment(prev => prev + emoji);
                                                  // Optional: keep picker open or close it
                                                }}
                                                className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl text-xl transition-all active:scale-90"
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar pointer-events-none opacity-40">
                                    {EMOJIS.slice(0, 8).map(e => <span key={e} className="text-sm grayscale">{e}</span>)}
                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter ml-2">Tezkor emoji</span>
                                  </div>
                                </div>

                               <div className="relative group">
                                 <textarea 
                                   placeholder={t('leaveComment')} 
                                   className="w-full min-h-[140px] bg-white/[0.02] border border-white/5 rounded-3xl p-6 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white/[0.05] transition-all resize-none shadow-inner"
                                   value={newComment}
                                   onChange={e => setNewComment(e.target.value)}
                                   required
                                 />
                                 <button 
                                   disabled={submittingComment || !newComment.trim()}
                                   className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white p-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-red-600/30 flex items-center justify-center group/send"
                                 >
                                   {submittingComment ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} className="group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5 transition-transform" />}
                                 </button>
                               </div>
                            </form>
                          ) : (
                            <div className="bg-red-500/5 border-2 border-dashed border-red-500/20 p-8 rounded-3xl flex items-center justify-between gap-6 mb-12">
                               <div className="flex items-center gap-4 text-red-400">
                                  <MessageSquare size={24} />
                                  <p className="text-sm font-black uppercase tracking-widest leading-none">{t('loginToComment')}</p>
                               </div>
                               <button 
                                 onClick={loginWithGoogle}
                                 className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95"
                               >
                                 Sign In with Google
                               </button>
                            </div>
                          )}
                          <div className="space-y-6">
                             {comments.length === 0 ? (
                                 <div className="text-center py-12 text-slate-500 uppercase tracking-widest font-black text-sm">
                                     Izohlar mavjud emas
                                 </div>
                             ) : (
                                 comments.map(comment => (
                                     <div key={comment.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex gap-4 transition-colors hover:bg-white/[0.04]">
                                         <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
                                             {comment.photoURL ? (
                                                 <img src={comment.photoURL} alt={comment.username} className="w-full h-full object-cover" />
                                             ) : (
                                                 <User size={20} className="text-white/50" />
                                             )}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <div className="flex items-center justify-between mb-1">
                                                 <h4 className="font-bold text-white truncate text-sm">{comment.username}</h4>
                                                 {user && user.uid === comment.userId && (
                                                     <button 
                                                         onClick={() => handleDeleteComment(comment.id)}
                                                         className="text-slate-500 hover:text-red-500 transition-colors p-1"
                                                     >
                                                         <Trash2 size={16} />
                                                     </button>
                                                 )}
                                             </div>
                                             <p className="text-slate-400 text-sm break-words whitespace-pre-wrap">{comment.content}</p>
                                             <span className="text-[10px] text-slate-500 mt-3 block font-medium">
                                                 {comment.createdAt ? new Date(typeof comment.createdAt === 'number' ? comment.createdAt : comment.createdAt.toMillis ? comment.createdAt.toMillis() : comment.createdAt.toDate().getTime()).toLocaleDateString() : ''}
                                             </span>
                                         </div>
                                     </div>
                                 ))
                             )}
                          </div>
                    </section>

                    {/* Related Anime Section */}
                    {relatedAnimes.length > 0 && (
                      <section className="mt-16 pt-12 border-t border-white/5 pb-12">
                        <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
                            O'xshash animelar
                          </div>
                          <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Sizga yoqishi mumkin</span>
                        </h3>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {relatedAnimes.map((anime) => (
                            <motion.div
                              key={anime.id}
                              whileHover={{ y: -5 }}
                              onClick={() => {
                                setSelectedAnime(anime);
                                setModalMode('details');
                              }}
                              className="group cursor-pointer"
                            >
                              <div className="relative aspect-[4/5] rounded-xl overflow-hidden border border-white/5 mb-2 shadow-2xl">
                                <img src={anime.posterUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                  <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white">
                                    <Star size={8} fill="currentColor" /> {anime.rating}
                                  </div>
                                </div>
                              </div>
                              <h4 className="text-[10px] font-black uppercase tracking-tight text-slate-300 group-hover:text-white transition-colors truncate">
                                {anime.title}
                              </h4>
                            </motion.div>
                          ))}
                        </div>
                      </section>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="player"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex-1 flex flex-col overflow-hidden relative bg-[#0B0B14] min-h-0"
                  >
                    {/* Player UI Overlay */}
                    <div className="absolute top-0 left-0 right-0 z-[300] p-3 sm:p-8 flex flex-col items-start bg-gradient-to-b from-black/95 via-black/80 to-transparent pointer-events-none">
                       <div className="w-full flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 sm:gap-6 pointer-events-auto">
                             <button 
                               onClick={() => setModalMode('details')}
                               className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"
                             >
                               <ArrowLeft size={14} className="sm:w-6 sm:h-6" />
                             </button>
                             <div className="space-y-0.5 sm:space-y-1">
                                <h3 className="text-white font-black text-xs sm:text-2xl tracking-tighter uppercase leading-none truncate max-w-[100px] sm:max-w-md">
                                  {selectedAnime.title}
                                </h3>
                                <p className="text-red-400 font-bold text-[7px] sm:text-xs uppercase tracking-widest flex items-center gap-1">
                                   <span className="w-0.5 h-0.5 bg-red-600 rounded-full animate-pulse" />
                                   {t('episode')} {currentEpisode?.episodeNumber || 1}
                                </p>
                             </div>
                          </div>
 
                          <div className="flex items-center gap-1 sm:gap-3 pointer-events-auto mr-12 sm:mr-24">
                             <button 
                               disabled={episodes.findIndex(ep => ep.id === currentEpisode?.id) === 0}
                               onClick={handlePrevEpisode}
                               className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-2 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-red-600 transition-all active:scale-95 disabled:opacity-20 disabled:pointer-events-none group/nav shadow-2xl"
                             >
                               <SkipBack size={10} className="sm:w-3.5 sm:h-3.5 text-white transition-transform group-hover/nav:-translate-x-0.5" />
                               <span className="hidden xs:inline text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Prev</span>
                             </button>
                             <button 
                               disabled={episodes.findIndex(ep => ep.id === currentEpisode?.id) === episodes.length - 1}
                               onClick={handleNextEpisode}
                               className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-2 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10 hover:bg-red-600 transition-all active:scale-95 disabled:opacity-20 disabled:pointer-events-none group/nav shadow-2xl"
                             >
                               <span className="hidden xs:inline text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Next</span>
                               <SkipForward size={10} className="sm:w-3.5 sm:h-3.5 text-white transition-transform group-hover/nav:translate-x-0.5" />
                             </button>
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative min-h-0 bg-[#12121F]">
                       {/* Video Area - Now Full Width */}
                       <div className="w-full relative group bg-black shrink-0 aspect-video max-h-[75vh]">
                          {/* Video Loading State */}
                          {currentEpisode && videoLoading && (
                            <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#0B0B14] transition-opacity">
                               <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin mb-4" />
                               <div className="flex flex-col items-center gap-1">
                                  <h4 className="text-sm font-black uppercase tracking-tighter">Yuklanmoqda...</h4>
                               </div>
                            </div>
                          )}

                          <div className="w-full h-full shadow-2xl relative">
                            {currentEpisode ? (
                              <UniversalVideoPlayer 
                                src={currentEpisode.videoUrl}
                                videoLoading={videoLoading}
                                setVideoLoading={setVideoLoading}
                                onNext={handleNextEpisode}
                                hasNext={episodes.findIndex((ep: any) => ep.id === currentEpisode?.id) < episodes.length - 1}
                                openingStart={currentEpisode.openingStart}
                                openingEnd={currentEpisode.openingEnd}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-black">
                                <div className="w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center animate-pulse border border-red-500/20">
                                  <Play size={48} className="text-red-500 ml-2" />
                                </div>
                                <h4 className="text-sm font-black uppercase tracking-[0.4em] text-slate-500">Pick an Episode to start</h4>
                              </div>
                            )}

                            {/* Skip Intro logic moved to UniversalVideoPlayer */}
                          </div>
                       </div>
                       
                       <AdBanner />

                       {/* Episode Selector - Now Below Player and Compact */}
                        <div className="w-full p-6 sm:p-10 space-y-8">
                           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                              <div className="space-y-1">
                                <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                                  <div className="w-1.5 h-6 bg-red-600 rounded-full" />
                                  {t('episodes')}
                                </h4>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">Jami: {episodes.length} ta qism yuklangan</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setShareModalOpen(true)}
                                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase transition-colors"
                                >
                                  <Share2 size={14} />
                                  Ulashish
                                </button>
                                <button
                                  onClick={(e) => handleWatchlist(e, selectedAnime.id)}
                                  className={cn(
                                    "flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase transition-colors",
                                    watchlist.has(selectedAnime.id) && "text-red-500"
                                  )}
                                >
                                  <Heart size={14} className={watchlist.has(selectedAnime.id) ? "fill-current" : ""} />
                                  Saqlash
                                </button>
                              </div>
                           </div>
                           
                           <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
                             {loadingEpisodes ? (
                               Array.from({ length: 12 }).map((_, i) => (
                                 <div key={i} className="aspect-square bg-white/[0.02] border border-white/5 rounded-xl animate-pulse" />
                               ))
                             ) : (
                               episodes.slice(episodePage * EPISODES_PER_PAGE, (episodePage + 1) * EPISODES_PER_PAGE).map((ep) => (
                                 <button
                                   key={ep.id}
                                   onClick={() => handleEpisodeSelect(ep)}
                                   className={cn(
                                     "aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all relative group overflow-hidden",
                                     currentEpisode?.id === ep.id 
                                       ? "bg-red-600 border-red-500 shadow-lg shadow-red-600/20" 
                                       : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-red-500/50"
                                   )}
                                 >
                                    <span className={cn(
                                      "text-sm font-black transition-colors relative z-10",
                                      currentEpisode?.id === ep.id ? "text-white" : "text-slate-400 group-hover:text-white"
                                    )}>
                                      {ep.episodeNumber}
                                    </span>
                                    {currentEpisode?.id === ep.id && (
                                      <motion.div 
                                        layoutId="activeEp"
                                        className="absolute inset-0 bg-gradient-to-tr from-red-600 to-red-500 z-0" 
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                 </button>
                               ))
                             )}
                           </div>

                            {episodes.length > EPISODES_PER_PAGE && (
                              <div className="flex items-center justify-center gap-4 mt-6 mb-10 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                                <button
                                  disabled={episodePage === 0}
                                  onClick={() => setEpisodePage(prev => Math.max(0, prev - 1))}
                                  className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                >
                                  <ArrowLeft size={14} />
                                  Ortga qaytarish
                                </button>
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  Sahifa {episodePage + 1} / {Math.ceil(episodes.length / EPISODES_PER_PAGE)}
                                </div>
                                <button
                                  disabled={(episodePage + 1) * EPISODES_PER_PAGE >= episodes.length}
                                  onClick={() => setEpisodePage(prev => prev + 1)}
                                  className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 text-white shadow-lg shadow-red-600/20"
                                >
                                  Keyingi qisimlar
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                            )}

                           {/* Description & Info below episodes for player mode */}
                           <div className="mt-12 pt-12 border-t border-white/5">
                              <div className="flex flex-col lg:flex-row gap-10">
                                 <div className="shrink-0 w-32 aspect-[2/3] rounded-xl overflow-hidden border border-white/10 hidden sm:block will-change-transform">
                                    <img 
                                      src={selectedAnime.posterUrl} 
                                      className="w-full h-full object-cover" 
                                      referrerPolicy="no-referrer" 
                                      alt={selectedAnime.title} 
                                      loading="lazy"
                                      decoding="async"
                                    />
                                 </div>
                                 <div className="flex-1 space-y-4">
                                    <h4 className="text-xl font-black uppercase text-white tracking-tight">{selectedAnime.title} haqida</h4>
                                    <p className="text-sm text-slate-400 leading-relaxed max-w-4xl">
                                      {selectedAnime.description}
                                    </p>
                                    <div className="flex flex-wrap gap-4 pt-2">
                                       <div className="flex flex-col gap-1">
                                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Reyting</span>
                                          <span className="text-xs font-black text-amber-500 flex items-center gap-1">
                                             <Star size={12} fill="currentColor" />
                                             {selectedAnime.rating}
                                          </span>
                                       </div>
                                       <div className="flex flex-col gap-1">
                                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Yil</span>
                                          <span className="text-xs font-black text-white">{selectedAnime.year}</span>
                                       </div>
                                       <div className="flex flex-col gap-1">
                                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Janr</span>
                                          <span className="text-xs font-black text-white uppercase">{selectedAnime.category}</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Age Verification Modal */}
      <AnimatePresence>
        {showAgeVerification && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass max-w-sm w-full p-8 rounded-[2.5rem] border border-white/10 text-center shadow-[0_30px_100px_rgba(220,38,38,0.2)]"
            >
              <div className="w-20 h-20 bg-red-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                <span className="text-3xl font-black text-red-500">18+</span>
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">DIQQAT: R+ KONTENT</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed mb-8">
                Siz ko'rmoqchi bo'lgan animeda kattalarga mos sahnalar bo'lishi mumkin. Davom etish uchun 18 yoshdan katta ekanligingizni tasdiqlang.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setIsAgeVerified(true);
                    sessionStorage.setItem('is_age_verified_18', 'true');
                    setShowAgeVerification(false);
                    if (pendingAnimeAction) pendingAnimeAction();
                    setPendingAnimeAction(null);
                  }}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/40"
                >
                  Ha, tan olaman va davom etaman
                </button>
                <button 
                  onClick={() => {
                    setShowAgeVerification(false);
                    setPendingAnimeAction(null);
                    navigate('/');
                  }}
                  className="w-full py-4 glass text-slate-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Yo'q, ortga qaytish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShareModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShareModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
              >
                <XCircle size={22} />
              </button>
              
              <h3 className="text-xl font-bold text-white mb-6">Ulashish</h3>
              
              <div className="bg-[#12121F] border border-white/5 rounded-xl p-4 mb-4 text-sm text-slate-300 font-mono break-all leading-relaxed">
                {window.location.origin}{currentEpisode ? `/watch/${slugify(selectedAnime?.title || '')}/${currentEpisode.episodeNumber}` : `/anime/${slugify(selectedAnime?.title || '')}`}
              </div>
              
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    const shareUrl = `${window.location.origin}${currentEpisode ? `/watch/${slugify(selectedAnime?.title || '')}/${currentEpisode.episodeNumber}` : `/anime/${slugify(selectedAnime?.title || '')}`}`;
                    navigator.clipboard.writeText(shareUrl);
                  }}
                  className="w-full flex items-center gap-3 bg-[#2A2A2A] hover:bg-[#333333] text-white py-3.5 px-4 rounded-xl transition-colors text-sm font-medium"
                >
                  <Copy size={20} />
                  Havolani nusxalash
                </button>
                
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(window.location.origin + (currentEpisode ? `/watch/${slugify(selectedAnime?.title || '')}/${currentEpisode.episodeNumber}` : `/anime/${slugify(selectedAnime?.title || '')}`))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 bg-[#1D4ED8] hover:bg-[#1e40af] text-white py-3.5 px-4 rounded-xl transition-colors text-sm font-medium"
                >
                  <Send size={20} />
                  Telegram orqali ulashish
                </a>
                
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(window.location.origin + (currentEpisode ? `/watch/${slugify(selectedAnime?.title || '')}/${currentEpisode.episodeNumber}` : `/anime/${slugify(selectedAnime?.title || '')}`))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 bg-[#059669] hover:bg-[#047857] text-white py-3.5 px-4 rounded-xl transition-colors text-sm font-medium"
                >
                  <MessageSquare size={20} />
                  WhatsApp orqali ulashish
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 50 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 sm:bottom-10 right-6 sm:right-10 z-[150] w-12 h-12 sm:w-14 sm:h-14 bg-red-600 hover:bg-red-500 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.3)] active:scale-95 transition-all border border-red-400 group"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ChevronRight size={28} className="-rotate-90 group-hover:scale-110 transition-transform" />
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
