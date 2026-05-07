import React, { useEffect, useRef } from 'react';

const AdBanner: React.FC = () => {
  const bannerRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if the script has already been added to avoid duplicates
    if (bannerRef.current && !bannerRef.current.querySelector('script[src*="highperformanceformat.com"]')) {
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

  return (
    <div className="flex flex-col items-center justify-center my-6 gap-6">
      <div className="flex flex-wrap items-center justify-center gap-6">
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
      </div>
    </div>
  );
};

export default AdBanner;
