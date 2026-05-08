import React, { useEffect, useRef } from 'react';

const AdBanner: React.FC = () => {
  const bannerRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLDivElement>(null);
  const banner728Ref = useRef<HTMLDivElement>(null);
  const banner320Ref = useRef<HTMLDivElement>(null);
  const banner160Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if the script has already been added to avoid duplicates
    if (bannerRef.current && !bannerRef.current.querySelector('script[src*="fa73987abd20fc269e203c742c5c0a1a"]')) {
      // Clear contents just in case (e.g. strict mode double invocations)
      bannerRef.current.innerHTML = '';
      
      const conf = document.createElement('script');
      const script = document.createElement('script');
      
      script.type = 'text/javascript';
      script.src = '//www.highperformanceformat.com/fa73987abd20fc269e203c742c5c0a1a/invoke.js';
      
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {
        'key' : 'fa73987abd20fc269e203c742c5c0a1a',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };`;
      
      bannerRef.current.appendChild(conf);
      bannerRef.current.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // Native banner
    if (nativeRef.current && !document.querySelector('script[src*="pl29370526"]')) {
       // Append the Native Banner script to the document body so it doesn't duplicate
       const script = document.createElement('script');
       script.async = true;
       script.setAttribute('data-cfasync', 'false');
       script.src = 'https://pl29370526.profitablecpmratenetwork.com/5e5bdedbb0917caa7cf44e3709da7781/invoke.js';
       document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // 728x90 Banner
    if (banner728Ref.current && !banner728Ref.current.querySelector('script[src*="79e885f0be5cd0839533ca3755585c29"]')) {
      banner728Ref.current.innerHTML = '';
      const conf = document.createElement('script');
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = '//www.highperformanceformat.com/79e885f0be5cd0839533ca3755585c29/invoke.js';
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {
        'key' : '79e885f0be5cd0839533ca3755585c29',
        'format' : 'iframe',
        'height' : 90,
        'width' : 728,
        'params' : {}
      };`;
      banner728Ref.current.appendChild(conf);
      banner728Ref.current.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // 320x50 Banner
    if (banner320Ref.current && !banner320Ref.current.querySelector('script[src*="fbc401a879c9f673dc068b5cd470750d"]')) {
      banner320Ref.current.innerHTML = '';
      const conf = document.createElement('script');
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = '//www.highperformanceformat.com/fbc401a879c9f673dc068b5cd470750d/invoke.js';
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {
        'key' : 'fbc401a879c9f673dc068b5cd470750d',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };`;
      banner320Ref.current.appendChild(conf);
      banner320Ref.current.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // 160x600 Banner
    if (banner160Ref.current && !banner160Ref.current.querySelector('script[src*="3546819bac7b6b44a437333032f96f41"]')) {
      banner160Ref.current.innerHTML = '';
      const conf = document.createElement('script');
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = '//www.highperformanceformat.com/3546819bac7b6b44a437333032f96f41/invoke.js';
      conf.type = 'text/javascript';
      conf.innerHTML = `atOptions = {
        'key' : '3546819bac7b6b44a437333032f96f41',
        'format' : 'iframe',
        'height' : 600,
        'width' : 160,
        'params' : {}
      };`;
      banner160Ref.current.appendChild(conf);
      banner160Ref.current.appendChild(script);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center my-6 gap-6 w-full overflow-hidden">
      <div className="flex flex-wrap flex-row items-center justify-center gap-6 w-full">
        {/* Native Banner */}
        <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold select-none">Reklama</div>
            <div 
              id="container-5e5bdedbb0917caa7cf44e3709da7781"
              ref={nativeRef}
              className="bg-slate-900/40 rounded-xl overflow-hidden flex items-center justify-center border border-white/5 relative z-10 w-full min-w-[300px]"
            >
            </div>
        </div>

        {/* 300x250 Banner */}
        <div className="flex flex-col items-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold select-none">Reklama</div>
            <div 
              ref={bannerRef} 
              className="min-w-[300px] min-h-[250px] bg-slate-900/40 rounded-xl overflow-hidden flex items-center justify-center border border-white/5 relative z-10"
            >
            </div>
        </div>

        {/* 728x90 Banner */}
        <div className="hidden md:flex flex-col items-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold select-none">Reklama</div>
            <div 
              ref={banner728Ref} 
              className="min-w-[728px] min-h-[90px] bg-slate-900/40 rounded-xl overflow-hidden flex items-center justify-center border border-white/5 relative z-10"
            >
            </div>
        </div>

        {/* 320x50 Banner - Mobile version */}
        <div className="flex md:hidden flex-col items-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold select-none">Reklama</div>
            <div 
              ref={banner320Ref} 
              className="min-w-[320px] min-h-[50px] bg-slate-900/40 rounded-xl overflow-hidden flex items-center justify-center border border-white/5 relative z-10"
            >
            </div>
        </div>
        
        {/* 160x600 Banner - Only on very specific large layouts context where it might fit, or we just display it in flex wrap */}
        <div className="hidden xl:flex flex-col items-center">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold select-none">Reklama</div>
            <div 
              ref={banner160Ref} 
              className="min-w-[160px] min-h-[600px] bg-slate-900/40 rounded-xl overflow-hidden flex items-center justify-center border border-white/5 relative z-10"
            >
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdBanner;
