import * as React from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { auth, db, syncUserToFirestore, handleFirestoreError, OperationType } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getRedirectResult } from 'firebase/auth';
import { Helmet } from 'react-helmet-async';
import Navbar from './components/Navbar';
import AnimePortal from './components/AnimePortal';
import AdminPanel from './components/AdminPanel';
import ContactForm from './components/ContactForm';
import { Loader2, ShieldAlert, AlertCircle, Send, Globe, X, Instagram, Youtube } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FallingLeaves } from './components/FallingLeaves';
import { AuthModal } from './components/AuthModal';
import NotificationSystem from './components/NotificationSystem';
import PushNotificationInitializer from './components/PushNotificationInitializer';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Chat from './components/Chat';
import { Language, useTranslation } from './i18n';

export default function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'uz');
  const t = useTranslation(language);
  const [user, loading] = useAuthState(auth);
  const [initialLoading, setInitialLoading] = useState(true);
  const [firestoreAdmin, setFirestoreAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery');

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setInitialLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  const [view, setView] = useState<'gallery' | 'admin'>('gallery');
  const [showContact, setShowContact] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (activeTab === 'gallery') setView('gallery');
    // We can add more logic here if other sidebar tabs map to different views
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // Check for redirect result on mount
  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await syncUserToFirestore(result.user);
      }
    }).catch((error) => {
      console.error("Redirect login error:", error);
    });
  }, []);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isAdmin = firestoreAdmin || (user?.email?.toLowerCase() === "mosinjonovjasurbek00@gmail.com");

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
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          animeList={animeList}
          setAnimeList={setAnimeList}
          dataLoading={dataLoading}
          setDataLoading={setDataLoading}
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
  showAuthModal, setShowAuthModal, selectedCategory, setSelectedCategory, 
  searchTerm, setSearchTerm, animeList, setAnimeList, dataLoading, 
  setDataLoading, fetchError, setFetchError, isAdmin 
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
    const qAnime = query(collection(db, 'movies'));
    const unsubscribe = onSnapshot(qAnime, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedDocs = docs.sort((a: any, b: any) => {
        const getTs = (d: any) => typeof d?.toMillis === 'function' ? d.toMillis() : (typeof d === 'number' ? d : 0);
        return getTs(b.createdAt) - getTs(a.createdAt);
      });
      setAnimeList(sortedDocs);
      setDataLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'movies');
      setDataLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function syncUserRole() {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setFirestoreAdmin(userDoc.data().role === 'admin');
          }
        } catch (error) {
          console.error("Role sync error:", error);
        }
      } else {
        setFirestoreAdmin(false);
        if (!loading) setView('gallery');
      }
    }
    syncUserRole();
  }, [user, loading]);

  // Filter anime by selected language
  const filteredAnimeListByLang = animeList.filter(a => (a.language || 'uz') === language);

  if (initialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-12 bg-[#000000] overflow-hidden">
        <div className="relative">
          {/* Subtle glow behind the logo */}
          <div className="absolute inset-x-0 -inset-y-4 bg-red-500/20 blur-[60px] rounded-full animate-pulse" />
          
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 20px rgba(220,38,38,0.2)",
                "0 0 40px rgba(220,38,38,0.4)",
                "0 0 20px rgba(220,38,38,0.2)"
              ]
            }} 
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 sm:w-32 sm:h-32 bg-red-600 rounded-[2.5rem] overflow-hidden border-2 border-white/5 relative z-10"
          >
            <img 
              src="https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg" 
              alt="Loading..."
              className="w-full h-full object-cover grayscale-[0.2]"
              referrerPolicy="no-referrer"
            />
            {/* Spinning ring only on edges */}
            <div className="absolute inset-0 border-[3px] border-transparent border-t-red-400 rounded-[2.5rem] animate-[spin_1.5s_linear_infinite]" />
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-4 relative z-10">
          <p className="text-white font-black uppercase tracking-[0.6em] text-[10px] sm:text-xs">
            {t('loadingString')}
          </p>
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-red-500 to-transparent"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] selection:bg-red-500/30 font-sans overflow-x-hidden">
      <Helmet>
        <title>Animem Uz - O'zbekistondagi eng yirik anime portali</title>
        <meta name="description" content="Animem Uz - O'zbekistondagi eng yirik anime portali. Barcha animelar o'zbek tilida, sifatli ovozda va HD formatda onlayn tomosha qiling." />
        <meta name="keywords" content="anime o'zbek tilida, animem, animem uz, animem.uz, anime online, anime uz, uzbek anime, vatan anime, anime ko'rish, o'zbekcha dublyaj, anime seriallar, yangi animelar" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://animem.uz/" />
        <meta property="og:title" content="Animem Uz - O'zbekistondagi eng yirik anime portali" />
        <meta property="og:description" content="Eng so'nggi animelar o'zbek va rus tillarida. HD formatda bepul tomosha qiling!" />
        <meta property="og:image" content="https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg" />
        <meta property="og:site_name" content="Animem Uz" />
        <link rel="canonical" href="https://animem.uz/" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Animem Uz",
            "alternateName": "AnimemUz",
            "url": "https://animem.uz/",
            "logo": "https://i.pinimg.com/736x/17/c6/88/17c688c6242fe4c3293be182924e73a3.jpg"
          })}
        </script>
      </Helmet>
      <Navbar 
        isAdmin={isAdmin} 
        view={view} 
        setView={setView} 
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
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
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
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
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
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
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
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
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
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
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
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
          <Route path="/category/:categoryName" element={
            <AnimePortal 
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
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

      <footer className="py-24 px-4 lg:px-8 border-t border-white/5 bg-[#050505] backdrop-blur-2xl relative z-10">
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
                href="https://t.me/animem_uz1" 
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
        <div className="max-w-7xl mx-auto mt-16 pt-12 border-t border-white/5 text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.4em]">
          {t('copyright')}
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
