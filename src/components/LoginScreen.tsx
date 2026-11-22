import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, LogOut, ShieldCheck, ArrowRight } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
  const { signInWithGoogle, authError, unauthorizedEmail, logout } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-zinc-100 flex flex-col lg:flex-row">
      {/* Left Executive Architectural Panel */}
      <div className="relative lg:w-[54%] min-h-[280px] lg:min-h-screen overflow-hidden border-b lg:border-b-0 lg:border-r border-white/8 bg-[#0D0F14] flex flex-col justify-between p-8 lg:p-14">
        {!imgFailed ? (
          <img
            src="/src/assets/images/login_corporate_backdrop_1795366652361.jpg"
            alt="X Guard Executive Boardroom"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,55,0.16),transparent_55%),linear-gradient(135deg,#08090B_0%,#14171F_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090B] via-[#08090B]/65 to-[#08090B]/40" />

        <div className="relative z-10">
          <BrandLogo size="lg" showCompany />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-xl mt-10 lg:mt-0"
        >
          <p className="text-xs font-medium tracking-wider text-[#FACC15] mb-3">
            Centralized Departmental Performance Governance
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-white leading-[1.15] tracking-tight mb-5">
            Precision visibility across every department at X Guard.
          </h1>
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-lg">
            Track monthly, quarterly, and annual targets against real achievements, generate executive PDF and Excel dossiers, and present consolidated company metrics in boardroom meetings.
          </p>

          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-3 gap-6 max-w-lg">
            <div>
              <div className="text-lg font-semibold text-[#FACC15] font-display">RBAC</div>
              <div className="text-xs text-zinc-400 mt-0.5">Email-verified department control</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-[#FACC15] font-display">Analytics</div>
              <div className="text-xs text-zinc-400 mt-0.5">10 live graphical views</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-[#FACC15] font-display">Boardroom</div>
              <div className="text-xs text-zinc-400 mt-0.5">Full-screen meeting slides</div>
            </div>
          </div>
        </motion.div>

        <div className="relative z-10 hidden lg:block text-xs text-zinc-500">
          © X Guard (Private) Limited. All Rights Reserved.
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 lg:px-14 bg-[#08090B]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-[#0F1115] border border-white/10 rounded-xl p-8"
        >
          {unauthorizedEmail ? (
            <div className="space-y-5">
              <div className="w-11 h-11 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white font-display">Access Not Authorized</h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  The Google account <span className="text-zinc-200 font-medium">{unauthorizedEmail}</span> is not currently approved or has been deactivated in the KPI Nexus Administrator Portal.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#161920] border border-white/8 text-xs text-zinc-300 space-y-1.5">
                <div className="font-semibold text-[#FACC15]">How to request access</div>
                <p className="text-zinc-400 leading-relaxed">
                  Contact an X Guard Super Administrator to register your Gmail address and assign your departmental role in User Management.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={logout}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-zinc-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Switch Google Account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[#D4AF37] mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  Authorized Corporate Sign-In
                </div>
                <h2 className="text-2xl font-bold text-white font-display">
                  Sign in to KPI Nexus
                </h2>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  Select your administrator-approved Google account to access your departmental workspace and performance dashboards.
                </p>
              </div>

              {authError && (
                <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
                  {authError}
                </div>
              )}

              <button
                type="button"
                disabled={signingIn}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#09090B"
                      d="M21.805 10.023h-9.765v3.954h5.617c-.242 1.281-.968 2.367-2.062 3.094v2.566h3.34c1.953-1.797 3.082-4.445 3.082-7.59 0-.695-.063-1.367-.212-2.024z"
                    />
                    <path
                      fill="#09090B"
                      d="M12.04 22c2.789 0 5.125-.922 6.832-2.504l-3.34-2.566c-.922.617-2.102.984-3.492.984-2.688 0-4.969-1.816-5.781-4.258H2.809v2.648C4.504 19.672 8 22 12.04 22z"
                    />
                    <path
                      fill="#09090B"
                      d="M6.259 13.656a5.98 5.98 0 0 1 0-3.812V7.196H2.809a9.97 9.97 0 0 0 0 9.108l3.45-2.648z"
                    />
                    <path
                      fill="#09090B"
                      d="M12.04 5.586c1.516 0 2.875.523 3.945 1.547l2.961-2.961C17.156 2.508 14.82 1.5 12.04 1.5 8 1.5 4.504 3.828 2.809 7.196l3.45 2.648c.812-2.442 3.093-4.258 5.781-4.258z"
                    />
                  </svg>
                  <span>{signingIn ? 'Opening Google Account Chooser...' : 'Sign in with Google'}</span>
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-4 border-t border-white/8 text-xs text-zinc-500 space-y-2">
                <p>No application password required. Google Identity Services handles account verification directly.</p>
                <p>Only Gmail accounts registered by an X Guard administrator are permitted entry.</p>
              </div>
            </div>
          )}
        </motion.div>

        <p className="mt-8 text-xs text-zinc-600 lg:hidden">
          © X Guard (Private) Limited. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
