import React from 'react';
import { motion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Synchronizing departmental intelligence...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0D11] via-[#131823] to-[#1C2331] flex flex-col items-center justify-center px-6 text-zinc-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-6 max-w-sm w-full bg-[#151A24] border border-slate-800 rounded-2xl p-8 shadow-2xl"
      >
        <motion.div
          animate={{ opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BrandLogo size="lg" showCompany variant="dark" />
        </motion.div>

        <div className="w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500 via-[#FACC15] to-amber-600 rounded-full"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <p className="text-xs text-zinc-400 text-center tracking-wide font-medium">{message}</p>
      </motion.div>

      <footer className="fixed bottom-6 text-[11px] text-zinc-500">
        © X Guard (Private) Limited. All Rights Reserved.
      </footer>
    </div>
  );
}
