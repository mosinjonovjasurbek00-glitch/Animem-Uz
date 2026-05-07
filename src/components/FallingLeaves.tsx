import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Leaf {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  duration: number;
  delay: number;
  horizontalMovement: number;
}

export const FallingLeaves = () => {
  const leaves = useMemo(() => {
    return Array.from({ length: 140 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20,
      size: Math.random() * 10 + 6,
      rotation: Math.random() * 360,
      duration: Math.random() * 10 + 15,
      delay: -Math.random() * 30,
      horizontalMovement: Math.random() * 10 - 5, // Much less horizontal drift
      color: i % 3 === 0 ? 'text-pink-300/50' : (i % 3 === 1 ? 'text-rose-200/50' : 'text-red-200/40')
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {leaves.map((leaf) => (
        <motion.div
          key={leaf.id}
          initial={{ 
            opacity: 0, 
            y: '-10vh', 
            x: `${leaf.x}vw`,
            rotate: leaf.rotation 
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: '110vh',
            x: [`${leaf.x}vw`, `${leaf.x + leaf.horizontalMovement}vw`, `${leaf.x}vw`],
            rotate: leaf.rotation + 720
          }}
          transition={{
            duration: leaf.duration,
            repeat: Infinity,
            repeatDelay: 0,
            delay: leaf.delay,
            ease: "linear",
            opacity: { duration: leaf.duration, times: [0, 0.1, 0.9, 1] },
            x: {
              duration: leaf.duration,
              repeat: Infinity,
              ease: "easeInOut"
            }
          }}
          className="absolute will-change-transform"
          style={{ width: leaf.size, height: leaf.size }}
        >
          {/* Detailed Sakura Blade/Blossom SVG */}
          <svg viewBox="0 0 100 100" className={cn("w-full h-full filter drop-shadow-[0_2px_4px_rgba(255,182,193,0.3)]", leaf.color)}>
            <defs>
              <radialGradient id="grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                <stop offset="100%" stopColor="currentColor" />
              </radialGradient>
            </defs>
            {/* 5 Notched Petals */}
            {[0, 72, 144, 216, 288].map((angle) => (
              <path
                key={angle}
                fill="currentColor"
                d="M50 50 C50 30 40 10 50 5 C60 10 50 30 50 50 Z"
                transform={`rotate(${angle} 50 50)`}
                className="opacity-90"
              />
            ))}
            {/* Wider Petals for "Fullness" */}
            {[0, 72, 144, 216, 288].map((angle) => (
              <path
                key={`wide-${angle}`}
                fill="currentColor"
                d="M50 50 C65 40 75 25 70 15 C65 5 50 15 50 50 Z"
                transform={`rotate(${angle} 50 50)`}
                className="opacity-70"
              />
            ))}
            <circle cx="50" cy="50" r="6" fill="white" className="opacity-40" />
            <circle cx="50" cy="50" r="3" fill="yellow" className="opacity-20" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
};
