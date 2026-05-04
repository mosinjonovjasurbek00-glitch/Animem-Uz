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
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -20,
      size: Math.random() * 6 + 4,
      rotation: Math.random() * 360,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 15,
      horizontalMovement: Math.random() * 40 - 20,
      color: i % 3 === 0 ? 'bg-indigo-500/10' : (i % 3 === 1 ? 'bg-violet-400/10' : 'bg-fuchsia-400/10')
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
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
            opacity: [0, 0.8, 0.8, 0],
            y: '110vh',
            x: `${leaf.x + (leaf.horizontalMovement / 5)}vw`,
            rotate: leaf.rotation + 720
          }}
          transition={{
            duration: leaf.duration,
            repeat: Infinity,
            delay: leaf.delay,
            ease: "linear"
          }}
          className="absolute will-change-transform"
          style={{ width: leaf.size, height: leaf.size }}
        >
          <div className={cn("w-full h-full rounded-full blur-[1px]", leaf.color)}>
             <div className="w-1/2 h-full bg-white/10 rounded-full rotate-45" />
          </div>
        </motion.div>
      ))}
    </div>
  );
};
