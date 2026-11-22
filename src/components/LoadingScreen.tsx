import React from 'react';
import { motion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Synchronizing departmental intelligence...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-[#08090B] flex flex-col items-center justify-center px-6 text-zinc-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6 max-w-sm w-full"
      >
        <motion.div
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandLogo size="lg" showCompany />
        </motion.div>

        <div className="w-56 h-1 bg-zinc-800/80 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#D4AF37] via-[#FACC15] to-[#D4AF37] rounded-full"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <p className="text-xs text-zinc-400 text-center tracking-wide">{message}</p>
      </motion.div>

      <footer className="fixed bottom-6 text-[11px] text-zinc-500">
        © X Guard (Private) Limited. All Rights Reserved.
      </footer>
    </div>
  );
}
