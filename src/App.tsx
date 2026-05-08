import * as React from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { auth, db, syncUserToFirestore, handleFirestoreError, OperationType } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot, getDocFromServer, increment } from 'firebase/firestore';
import { getRedirectResult } from 'firebase/auth';
import { Helmet } from 'react-helmet-async';
import Navbar from './components/Navbar';
import AnimePortal from './components/AnimePortal';
import AdminPanel from './components/AdminPanel';
import ContactForm from './components/ContactForm';
import { Loader2, ShieldAlert, AlertCircle, Send, Globe, X, Instagram, Youtube, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FallingLeaves } from './components/FallingLeaves';
import { AuthModal } from './components/AuthModal';
import NotificationSystem from './components/NotificationSystem';
import PushNotificationInitializer from './components/PushNotificationInitializer';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Chat from './components/Chat';
import { TelegramBanner } from './components/TelegramBanner';
import { Language, useTranslation } from './i18n';

export default function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'uz');
  const t = useTranslation(language);
  const [user, loading] = useAuthState(auth);
  const [initialLoading, setInitialLoading] = useState(true);
  const [firestoreAdmin, setFirestoreAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery');

  const [view, setView] = useState<'gallery' | 'admin'>('gallery');
  const [showContact, setShowContact] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (activeTab === 'gallery') setView('gallery');
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await syncUserToFirestore(result.user);
      }
    }).catch((error) => {
      console.error("Redirect login error:", error);
    });
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isAdmin = firestoreAdmin || (user?.email?.toLowerCase() === "mosinjonovjasurbek00@gmail.com");

  useEffect(() => {
    // Safety timeout: never show loading screen for more than 10 seconds
    const safetyTimer = setTimeout(() => {
      setInitialLoading(false);
    }, 10000);

    if (!loading && !dataLoading && !roleLoading) {
      const timer = setTimeout(() => setInitialLoading(false), 500);
      return () => {
        clearTimeout(timer);
        clearTimeout(safetyTimer);
      };
    }
    return () => clearTimeout(safetyTimer);
  }, [loading, dataLoading, roleLoading]);

  return (
    <HelmetProvider>
      <BrowserRouter>
        <AppContent 
          language={language}
          setLanguage={setLanguage}
          user={user}
          loading={loading}
          initialLoading={initialLoading}
          firestoreAdmin={firestoreAdmin}
          setFirestoreAdmin={setFirestoreAdmin}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          view={view}
          setView={setView}
          showContact={showContact}
          setShowContact={setShowContact}
          showAuthModal={showAuthModal}
          setShowAuthModal={setShowAuthModal}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          animeList={animeList}
          setAnimeList={setAnimeList}
          dataLoading={dataLoading}
          setDataLoading={setDataLoading}
          roleLoading={roleLoading}
          setRoleLoading={setRoleLoading}
          fetchError={fetchError}
          setFetchError={setFetchError}
          isAdmin={isAdmin}
        />
      </BrowserRouter>
    </HelmetProvider>
  );
}

function AppContent({ 
  language, setLanguage, user, loading, initialLoading, firestoreAdmin, setFirestoreAdmin, 
  activeTab, setActiveTab, view, setView, showContact, setShowContact, 
  showAuthModal, setShowAuthModal,
  searchTerm, setSearchTerm, animeList, setAnimeList, dataLoading, 
  setDataLoading, roleLoading, setRoleLoading, fetchError, setFetchError, isAdmin 
}: any) {
  const t = useTranslation(language);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      // Potentially handle role sync here if needed, but it's already in the parent App
    }
  }, [loading]);

  useEffect(() => {
    // Sync activeTab with URL if necessary, or just rely on state
    if (location.pathname === '/') setActiveTab('gallery');
    else if (location.pathname === '/news') setActiveTab('news');
    else if (location.pathname === '/watchlist') setActiveTab('watchlist');
    else if (location.pathname.startsWith('/anime/')) setActiveTab('gallery');
    else if (location.pathname.startsWith('/watch/')) setActiveTab('gallery');
  }, [location.pathname]);

  useEffect(() => {
    // Visitor tracking
    const trackVisitor = async () => {
      const hasVisited = sessionStorage.getItem('visted_this_session');
      if (!hasVisited) {
        try {
          const statsRef = doc(db, 'stats', 'visitors');
          await setDoc(statsRef, { count: increment(1) }, { merge: true });
          sessionStorage.setItem('visted_this_session', 'true');
        } catch (err) {
          console.debug("Visitor tracking failed:", err);
        }
      }
    };
    trackVisitor();
  }, []);

  useEffect(() => {
    const qAnime = query(collection(db, 'anime'));
    const unsubscribe = onSnapshot(qAnime, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedDocs = docs.sort((a: any, b: any) => {
        const getTs = (d: any) => {
          if (!d) return Date.now() + 100000; // Local items to the top
          if (typeof d?.toMillis === 'function') return d.toMillis();
          if (typeof d === 'number') return d;
          return 0;
        };
        return getTs(b.createdAt) - getTs(a.createdAt);
      });
      setAnimeList(sortedDocs);
      setDataLoading(false);
    }, (error) => {
      console.error("Anime snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'anime');
      setDataLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function syncUserRole() {
      if (user) {
        // Fallback for hardcoded admin email
        if (user.email === "mosinjonovjasurbek00@gmail.com") {
          setFirestoreAdmin(true);
          setRoleLoading(false);
          return;
        }

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setFirestoreAdmin(userDoc.data().role === 'admin');
          }
        } catch (error) {
          console.debug("Role sync debug:", error);
        } finally {
          setRoleLoading(false);
        }
      } else {
        setFirestoreAdmin(false);
        setRoleLoading(false);
        if (!loading) setView('gallery');
      }
    }
    syncUserRole();
  }, [user, loading]);

  // User has requested that all content be visible to everyone regardless of language settings
  const filteredAnimeListByLang = animeList;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] selection:bg-red-500/30 font-sans overflow-x-hidden">
      <FallingLeaves />
      <Helmet>
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Animem Uz" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#0B0B14" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
      </Helmet>
      <TelegramBanner />
      <Navbar 
        isAdmin={isAdmin} 
        view={view} 
        setView={setView} 
        imageCount={filteredAnimeListByLang.length}
        onLoginClick={() => setShowAuthModal(true)}
        language={language}
        setLanguage={setLanguage}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <AnimatePresence>
        {fetchError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-24 right-6 z-[80] bg-red-500/20 backdrop-blur-md border border-red-500/30 p-4 rounded-2xl flex items-center justify-between gap-4 max-w-2xl mx-auto"
          >
            <div className="flex items-center gap-3 text-red-400">
               <AlertCircle size={20} />
               <p className="text-xs font-black uppercase tracking-widest leading-none">{t('errorFetchAnime')}</p>
            </div>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">{t('retry')}</button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="relative px-4 lg:px-8 pt-20 sm:pt-28 pb-24 lg:pb-8 min-h-screen lg:ml-24">
        <Routes>
          <Route path="/" element={
            <AnimePortal 
              animeList={filteredAnimeListByLang}
              loading={dataLoading}
              language={language}
              showWatchlistOnly={activeTab === 'watchlist' || activeTab === 'saved'}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAuthRequired={() => setShowAuthModal(true)}
            />
          } />
          <Route path="/news" element={
            <AnimePortal 
              animeList={filteredAnimeListByLang}
              loading={dataLoading}
              language={language}
              showWatchlistOnly={false}
              activeTab="news"
              setActiveTab={setActiveTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAuthRequired={() => setShowAuthModal(true)}
            />
          } />
          <Route path="/watchlist" element={
            <AnimePortal 
              animeList={filteredAnimeListByLang}
              loading={dataLoading}
              language={language}
              showWatchlistOnly={true}
              activeTab="saved"
              setActiveTab={setActiveTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAuthRequired={() => setShowAuthModal(true)}
            />
          } />
          <Route path="/chat" element={
            <div className="pt-4 sm:pt-10">
              <Chat />
            </div>
          } />
          <Route path="/anime/:animeSlug" element={
            <AnimePortal 
              animeList={filteredAnimeListByLang}
              loading={dataLoading}
              language={language}
              showWatchlistOnly={false}
              activeTab="gallery"
              setActiveTab={setActiveTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAuthRequired={() => setShowAuthModal(true)}
            />
          } />
          <Route path="/watch/:animeSlug/:episodeNumber" element={
            <AnimePortal 
              animeList={filteredAnimeListByLang}
              loading={dataLoading}
              language={language}
              showWatchlistOnly={false}
              activeTab="gallery"
              setActiveTab={setActiveTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onAuthRequired={() => setShowAuthModal(true)}
            />
          } />
          <Route path="/admin" element={
            isAdmin ? (
              <AdminPanel language={language} setLanguage={setLanguage} />
            ) : (
              <div className="pt-40 flex flex-col items-center justify-center px-6">
                <div className="glass p-16 rounded-[2rem] text-center max-w-lg">
                  <ShieldAlert className="text-red-500 w-20 h-20 mx-auto mb-8 animate-bounce" />
                  <h2 className="text-4xl font-black tracking-tighter mb-4 uppercase">{t('noAccess')}</h2>
                  <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed uppercase tracking-widest">{t('noAccessDesc')}</p>
                  <button onClick={() => navigate('/')} className="glass-button-primary w-full py-5 text-xs">{t('backToHome')}</button>
                </div>
              </div>
            )
          } />
        </Routes>
      </main>

      <footer className="py-24 px-4 lg:px-8 border-t border-white/5 bg-[#0B0B14] backdrop-blur-2xl relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col gap-6 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                <img 
                  src="https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg" 
                  alt="Footer Logo" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-3xl font-black tracking-tighter italic uppercase">Animem<span className="text-red-500"> Uz</span></span>
            </div>
            <p className="text-slate-500 text-sm max-w-sm font-medium leading-relaxed">{t('footerDesc')}</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-6">
            <div className="flex items-center gap-4">
              <a 
                href="https://t.me/animemuz1" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 transition-all border border-white/5 group"
                title="Telegram"
              >
                <Send size={20} className="text-white group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://www.instagram.com/animem_uz/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 transition-all border border-white/5 group"
                title="Instagram"
              >
                <Instagram size={20} className="text-white group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://www.youtube.com/@animemuz1" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 transition-all border border-white/5 group"
                title="YouTube"
              >
                <Youtube size={20} className="text-white group-hover:scale-110 transition-transform" />
              </a>
            </div>
            <button 
              onClick={() => setShowContact(true)} 
              className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-colors"
            >
              {t('contact')}
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-12 border-t border-white/5 text-center flex flex-col items-center gap-8">
          <div className="text-slate-800 text-[10px] font-black uppercase tracking-[0.4em]">
            {t('copyright')}
          </div>
          
          <a 
            href="https://t.me/animemuzdownloadsapp/4" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-red-600 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(220,38,38,0.3)] hover:shadow-[0_0_60px_rgba(220,38,38,0.5)] transition-all duration-500"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <Smartphone size={18} className="text-white relative z-10" />
            <span className="text-white font-black uppercase tracking-[0.2em] text-[10px] sm:text-xs relative z-10">
              ILOVANI YUKLASH
            </span>
          </a>
          
          <div className="mt-8 flex justify-center w-full max-w-full overflow-hidden">
            <a href="https://beta.publishers.adsterra.com/referral/zUXZZSY82Y" rel="nofollow" target="_blank" className="max-w-full">
              <img alt="banner" src="https://landings-cdn.adsterratech.com/referralBanners/png/728%20x%2090%20px.png" className="max-w-full h-auto object-contain" />
            </a>
          </div>
        </div>
      </footer>

      <ContactForm isOpen={showContact} onClose={() => setShowContact(false)} language={language} />
      
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal 
            onSuccess={() => setShowAuthModal(false)} 
            onClose={() => setShowAuthModal(false)} 
            language={language}
          />
        )}
      </AnimatePresence>

      <NotificationSystem language={language} />
      <PushNotificationInitializer />
    </div>
  );
}
