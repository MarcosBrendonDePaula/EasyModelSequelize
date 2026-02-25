import FluxStack from '@client/src/assets/fluxstack.svg'

export function HomePage({ apiStatus }: { apiStatus: 'checking' | 'online' | 'offline' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-72px)] px-4 sm:px-6 py-12 text-center relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-3xl">

        {/* Icon */}
        <div className="relative mb-5">
          <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-2xl animate-pulse-slow" />
          <img
            src={FluxStack}
            alt="FluxStack"
            className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 drop-shadow-[0_0_24px_rgba(168,85,247,0.35)] animate-float"
          />
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-3 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight leading-none">
          FluxStack
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base md:text-lg text-gray-400 mb-6 leading-relaxed">
          <span className="text-purple-400 font-semibold">Bun</span>
          {' + '}
          <span className="text-indigo-400 font-semibold">Elysia</span>
          {' + '}
          <span className="text-cyan-400 font-semibold">React</span>
          {' = '}
          <span className="text-white font-semibold">FluxStack</span>
        </p>

        {/* API Status */}
        <div className="mb-10 md:mb-12">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium tracking-wide uppercase transition-all ${
            apiStatus === 'online'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : apiStatus === 'offline'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              apiStatus === 'online' ? 'bg-emerald-400' : apiStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
            }`} />
            <span>{apiStatus === 'checking' ? 'Checking API...' : apiStatus === 'online' ? 'API Online' : 'API Offline'}</span>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full mb-12">
          <div className="group bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 sm:p-5 hover:bg-white/[0.06] hover:border-purple-500/20 transition-all duration-300">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-colors">
              <span className="text-sm">⚡</span>
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-white mb-1 text-left">Ultra Rápido</h3>
            <p className="text-gray-500 text-[11px] sm:text-xs text-left leading-relaxed">Bun runtime com performance 3x superior ao Node.js</p>
          </div>

          <div className="group bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 sm:p-5 hover:bg-white/[0.06] hover:border-indigo-500/20 transition-all duration-300">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:bg-indigo-500/20 transition-colors">
              <span className="text-sm">🔒</span>
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-white mb-1 text-left">Type Safe</h3>
            <p className="text-gray-500 text-[11px] sm:text-xs text-left leading-relaxed">Eden Treaty com inferência end-to-end automática</p>
          </div>

          <div className="group bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 sm:p-5 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all duration-300">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3 group-hover:bg-cyan-500/20 transition-colors">
              <span className="text-sm">🔥</span>
            </div>
            <h3 className="text-xs sm:text-sm font-semibold text-white mb-1 text-left">Live Components</h3>
            <p className="text-gray-500 text-[11px] sm:text-xs text-left leading-relaxed">Estado reativo no servidor inspirado no Livewire</p>
          </div>
        </div>

        <p className="text-gray-600 text-[11px] tracking-wide">
          Desenvolvido com ❤️ usando TypeScript
        </p>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}