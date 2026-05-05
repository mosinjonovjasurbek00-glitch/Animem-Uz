import React from 'react';
import { Home, Sparkles, Heart, MessageSquare, Flame } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'gallery', label: 'Home', icon: Home, path: '/' },
    { id: 'anime', label: 'Anime', icon: Flame, path: '/' },
    { id: 'news', label: 'Ticker', icon: Sparkles, path: '/news' },
    { id: 'saved', label: 'Saved', icon: Heart, path: '/watchlist' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
  ];

  const handleNav = (item: any) => {
    setActiveTab(item.id);
    navigate(item.path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] lg:hidden pb-[safe-area-inset-bottom]">
      {/* Background with blur */}
      <div className="absolute inset-0 bg-[#0B0B14]/95 backdrop-blur-3xl border-t border-white/[0.08]" />
      
      {/* Glow Effect */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      
      <div className="relative px-6 py-3 flex items-center justify-between pointer-events-auto">
        {menuItems.map((item) => (
          <button 
            key={item.id}
            onClick={() => handleNav(item)}
            className="flex flex-col items-center gap-1 relative px-2"
          >
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
              activeTab === item.id 
                ? "bg-red-600/20 text-red-500 scale-110 shadow-[0_0_20px_rgba(220,38,38,0.2)]" 
                : "text-slate-500"
            )}>
              <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            </div>
            <span className={cn(
              "text-[8px] font-black uppercase tracking-widest transition-all duration-300",
              activeTab === item.id ? "text-red-500 opacity-100" : "text-slate-600 opacity-60"
            )}>
              {item.label}
            </span>

            {activeTab === item.id && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-1 bg-red-600 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
