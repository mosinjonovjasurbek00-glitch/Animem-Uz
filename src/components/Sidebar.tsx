import React from 'react';
import { Home, Film, Sparkles, Heart, MessageSquare, LayoutDashboard, Film as Gallery } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, isAdmin }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'gallery', label: 'Bosh sahifa', icon: Home, path: '/' },
    { id: 'anime', label: 'Anime', icon: Gallery, path: '/' },
    { id: 'news', label: 'Yangiliklar', icon: Sparkles, path: '/news' },
    { id: 'premium', label: 'VIP (Bonus)', icon: Sparkles, path: 'https://www.profitablecpmratenetwork.com/gcz22c4q?key=04e604ab239b9477df0602f3d8618ee4', external: true },
    { id: 'saved', label: 'Saqlanganlar', icon: Heart, path: '/watchlist' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
  ];

  const handleNav = (item: any) => {
    if (item.external) {
      window.open(item.path, '_blank');
      return;
    }
    setActiveTab(item.id);
    navigate(item.path);
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-24 bg-[#0B0B14] border-r border-white/5 flex flex-col items-center py-8 z-[110] hidden lg:flex pt-28 will-change-transform">
      <div className="flex flex-col gap-8">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNav(item)}
            className={cn(
              "p-4 rounded-3xl transition-all duration-500 group relative",
              activeTab === item.id 
                ? "bg-red-600/10 text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.1)]" 
                : "text-slate-500 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon size={26} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            
            {/* Tooltip */}
            <div className="absolute left-20 px-4 py-2 bg-[#12121F] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 z-50">
              {item.label}
            </div>

            {/* Active Indicator */}
            {activeTab === item.id && (
              <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-red-600 rounded-r-full" />
            )}
          </button>
        ))}
      </div>
      
      <div className="mt-auto flex flex-col gap-6">
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className={cn(
              "p-4 rounded-3xl transition-all duration-500 group relative",
              location.pathname === '/admin'
                ? "bg-amber-600/10 text-amber-500" 
                : "text-slate-500 hover:text-white hover:bg-white/5"
            )}
          >
            <LayoutDashboard size={26} />
            <div className="absolute left-20 px-4 py-2 bg-[#12121F] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 z-50">
              Admin
            </div>
          </button>
        )}
      </div>
    </aside>
  );
}
