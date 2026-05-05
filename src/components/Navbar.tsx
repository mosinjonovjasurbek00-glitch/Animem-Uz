import { auth, logout } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, Film, Play, User, Globe, Bell, Search, ChevronDown, Menu, X, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES } from '../constants';
import { collection, doc, getDoc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import NotificationMenu from './NotificationMenu';
import ProfileModal from './ProfileModal';
import { Language, useTranslation } from '../i18n';

interface NavbarProps {
  isAdmin: boolean;
  view: 'gallery' | 'admin';
  setView: (view: 'gallery' | 'admin') => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  imageCount: number;
  onLoginClick: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({ isAdmin, view, setView, selectedCategory, setSelectedCategory, imageCount, onLoginClick, language, setLanguage, searchTerm, setSearchTerm, activeTab, setActiveTab }: NavbarProps) {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation(language);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [dynamicNews, setDynamicNews] = useState<string[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'news_items'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => doc.data())
        .filter(data => data.language === language)
        .map(data => data.text as string);
      
      if (items.length > 0) {
        setDynamicNews(items);
      } else {
        // Fallback
        setDynamicNews(language === 'uz' ? [
          "Yangi anime: 'Oshi no Ko' 2-fasl premyerasi!",
          "Solo Leveling o'zbek tilida sifatli ovozda chiqarildi!",
          "Haftaning eng mashhur animesi: Demon Slayer",
          "Saytimizga yangi chat tizimi qo'shildi!",
          "Animem.uz mobil ilovasi tez kunda kutilmoqda"
        ] : [
          "Новое аниме: Премьера 2 сезона 'Oshi no Ko'!",
          "Solo Leveling доступен с качественной озвучкой!",
          "Самое популярное аниме недели: Demon Slayer",
          "В чате нашего сайта появились новые функции!",
          "Мобильное приложение Animem.uz ожидается скоро"
        ]);
      }
    });
    return () => unsubscribe();
  }, [language]);

  useEffect(() => {
    let unsubscribe = () => {};
    if (user) {
      unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUsername(data.username);
          setAvatarUrl(data.avatarUrl || null);
        }
      });
    }
    return () => unsubscribe();
  }, [user]);

  const handleNavClick = (key: string) => {
    if (key === 'home') {
      navigate('/');
      setActiveTab('gallery');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (key === 'anime') {
      navigate('/');
      setActiveTab('anime');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (key === 'news') {
      navigate('/news');
      setActiveTab('news');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (key === 'saved') {
      navigate('/watchlist');
      setActiveTab('saved');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (key === 'chat') {
      navigate('/chat');
      setActiveTab('chat');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    setSearchTerm('');
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 lg:left-24 right-0 z-[120] h-16 sm:h-20 bg-[#0B0B14]/95 backdrop-blur-2xl px-4 lg:px-12 flex items-center justify-between font-sans border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5)] will-change-transform">
        {/* Left: Logo */}
        <div 
          className="flex items-center gap-3 sm:gap-5 cursor-pointer group shrink-0"
          onClick={() => {
            navigate('/');
            setActiveTab('gallery');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setSearchTerm('');
            setSelectedCategory('All');
          }}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-red-600 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
            <img src="https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg" alt="Logo" className="w-9 h-9 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-red-500/40 group-hover:border-red-500/80 transition-all duration-500 shadow-xl group-hover:scale-110 relative z-10" />
          </div>
          <span className="font-black text-xl sm:text-3xl tracking-tighter uppercase flex items-center text-white drop-shadow-[0_2px_10px_rgba(220,38,38,0.3)] group-hover:text-red-50 transition-colors">
            ANIMEM<span className="text-red-600 group-hover:text-red-500 transition-colors">.UZ</span>
          </span>
        </div>

        {/* Center: News Ticker / Menu */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-4 overflow-hidden mx-4">
          <div className="flex items-center gap-4 w-full max-w-xl bg-white/[0.03] border border-white/5 px-4 py-2 rounded-2xl relative overflow-hidden group/ticker">
            {/* News Badge */}
            <div className="shrink-0 flex items-center gap-2 px-2 py-0.5 bg-red-600/10 border border-red-500/20 rounded-md">
              <Sparkles size={10} className="text-red-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-red-500 whitespace-nowrap">
                Hot
              </span>
            </div>

            {/* Scrolling Ticker */}
            <div className="flex-1 overflow-hidden relative h-5">
              <motion.div 
                animate={{ x: [0, -1200] }}
                transition={{ 
                  duration: 40, 
                  repeat: Infinity, 
                  ease: "linear" 
                }}
                className="flex items-center gap-16 whitespace-nowrap will-change-transform"
              >
                {[...dynamicNews, ...dynamicNews, ...dynamicNews].map((item, idx) => (
                  <span key={idx} className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer uppercase tracking-[0.2em]">
                    {item}
                  </span>
                ))}
              </motion.div>
              
              {/* Fade masks */}
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10" />
              <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10" />
            </div>
            
            {/* Hover Indicator */}
            <div className="absolute inset-0 border border-red-500/0 group-hover/ticker:border-red-500/20 rounded-2xl transition-all pointer-events-none" />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0 lg:min-w-[300px] justify-end">
          {/* Desktop Search Bar */}
          <div className="hidden xl:flex items-center relative group max-w-[280px] w-full">
            <input 
              type="text" 
              placeholder={language === 'uz' ? 'Qidiruv...' : 'Поиск...'}
              className="w-full h-10 bg-white/[0.03] border border-white/5 rounded-full pl-6 pr-12 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-red-500/30 focus:bg-white/[0.06] transition-all text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute right-4 text-slate-500">
              <Search size={14} />
            </div>
            <div className="absolute right-10 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[8px] font-bold text-slate-500 pointer-events-none">
              Ctrl K
            </div>
          </div>

          {/* Mobile Search Toggle */}
          <button 
            className="xl:hidden w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center hover:bg-white/[0.06] transition-all"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search size={16} className={isSearchOpen ? "text-red-400" : "text-slate-400"} />
          </button>

          <NotificationMenu language={language} />

          {/* Auth/User */}
          <div className="flex items-center gap-3 sm:gap-4">
            {user ? (
              <div className="flex items-center gap-3 sm:gap-4">
                {isAdmin && (
                  <button
                    onClick={() => navigate(location.pathname === '/admin' ? '/' : '/admin')}
                    className="hidden sm:flex w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] items-center justify-center transition-all"
                    title={location.pathname === '/admin' ? t('gallery') : t('adminPanel')}
                  >
                    {location.pathname === '/admin' ? <Film size={18} className="text-red-400" /> : <LayoutDashboard size={18} className="text-red-400" />}
                  </button>
                )}
                
                <button 
                  onClick={() => setShowProfileModal(true)}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-white/5 bg-red-500/10 flex items-center justify-center shrink-0 overflow-hidden hover:border-red-500/50 transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={16} className="text-red-400" />
                  )}
                </button>
              </div>
            ) : (
              <button 
                onClick={onLoginClick}
                className="bg-red-600 hover:bg-red-500 text-white px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-600/20 flex items-center gap-2"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center">
                   <Play size={10} fill="white" className="ml-0.5" />
                </div>
                <span className="hidden sm:inline">{t('signIn' as any)}</span>
              </button>
            )}

            {/* Lang Switcher - Hide on very small screens, put in mobile menu */}
            <button 
              onClick={() => setLanguage(language === 'uz' ? 'ru' : 'uz')}
              className="hidden sm:flex w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 items-center justify-center group hover:bg-white/[0.06] transition-all"
            >
              <Globe size={18} className="text-slate-500 group-hover:text-white transition-colors" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center hover:bg-white/[0.06] transition-all"
            >
              {mobileMenuOpen ? <X size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Search Bar Dropdown */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-16 sm:top-20 left-0 right-0 z-[90] bg-[var(--bg-deep)] border-b border-white/5 xl:hidden overflow-hidden"
          >
            <div className="p-4 relative">
              <input 
                type="text" 
                placeholder={language === 'uz' ? 'Qidiruv...' : 'Поиск...'}
                className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl pl-6 pr-12 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-red-500/30 focus:bg-white/[0.06] transition-all text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-500">
                <Search size={18} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-[80] bg-[var(--bg-deep)]/95 backdrop-blur-xl lg:hidden pt-24 sm:pt-28 pb-6 px-6 overflow-y-auto flex flex-col"
          >
            <div className="flex flex-col gap-6">
              {['home', 'anime', 'news', 'saved', 'chat'].map((key) => (
                <button 
                  key={key}
                  onClick={() => handleNavClick(key)}
                  className={cn(
                    "text-2xl font-black uppercase text-left transition-colors",
                    (key === 'home' && activeTab === 'gallery') ||
                    (key === 'anime' && activeTab === 'anime') ||
                    (key === 'news' && activeTab === 'news') ||
                    (key === 'saved' && activeTab === 'saved') ||
                    (key === 'chat' && activeTab === 'chat')
                      ? "text-red-500" 
                      : "text-white"
                  )}
                >
                  {t(key as any)}
                </button>
              ))}
              
              <div className="h-px w-full bg-white/10 my-4" />

              <button 
                onClick={() => setLanguage(language === 'uz' ? 'ru' : 'uz')}
                className="flex items-center gap-4 text-xl font-black uppercase text-white"
              >
                <Globe size={24} className="text-slate-400" />
                {language === 'uz' ? 'Русский' : 'O\'zbek'}
              </button>

              {isAdmin && user && (
                <button
                  onClick={() => {
                    navigate(location.pathname === '/admin' ? '/' : '/admin');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-4 text-xl font-black uppercase text-red-400 mt-4"
                >
                  {location.pathname === '/admin' ? <Film size={24} /> : <LayoutDashboard size={24} />}
                  {location.pathname === '/admin' ? t('gallery') : t('adminPanel')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileModal && (
          <ProfileModal 
            isOpen={showProfileModal} 
            onClose={() => setShowProfileModal(false)}
            language={language}
          />
        )}
      </AnimatePresence>
    </>
  );
}

