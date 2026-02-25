import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { FaBook, FaGithub, FaBars, FaTimes } from 'react-icons/fa'
import FluxStackLogo from '@client/src/assets/fluxstack.svg'
import faviconSvg from '@client/src/assets/fluxstack-static.svg?raw'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/counter', label: 'Counter' },
  { to: '/form', label: 'Form' },
  { to: '/upload', label: 'Upload' },
  { to: '/chat', label: 'Chat' },
  { to: '/room-chat', label: 'Room Chat' },
  { to: '/auth', label: 'Auth' },
  { to: '/api-test', label: 'API Test' }
]

const routeFlameHue: Record<string, string> = {
  '/': '0deg',              // roxo original
  '/counter': '180deg',     // ciano
  '/form': '300deg',        // rosa
  '/upload': '60deg',       // amarelo
  '/chat': '120deg',        // verde
  '/room-chat': '240deg',   // azul
  '/auth': '330deg',        // vermelho
  '/api-test': '90deg',     // lima
}

export function AppLayout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const current = navItems.find(item => item.to === location.pathname)
    document.title = current ? `${current.label} - FluxStack` : 'FluxStack'

    // Dynamic favicon with hue-rotate
    const hue = routeFlameHue[location.pathname] || '0deg'
    const colored = faviconSvg.replace(
      '<svg ',
      `<svg style="filter: hue-rotate(${hue})" `
    )
    const blob = new Blob([colored], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/svg+xml'
    link.href = url
    return () => URL.revokeObjectURL(url)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/60 border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-white font-semibold tracking-wide">
            <img
              src={FluxStackLogo}
              alt="FluxStack"
              className="w-9 h-9 transition-[filter] duration-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
              style={{ filter: `hue-rotate(${routeFlameHue[location.pathname] || '0deg'})` }}
            />
            FluxStack
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://live-docs.marcosbrendon.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-200 rounded-lg text-sm hover:bg-purple-500/30 transition-all"
            >
              <FaBook />
              Live Docs
            </a>
            <a
              href="/swagger"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
            >
              <FaBook />
              API Docs
            </a>
            <a
              href="https://github.com/MarcosBrendonDePaula/FluxStack"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
            >
              <FaGithub />
              GitHub
            </a>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-slate-900/90 backdrop-blur-md">
            <nav className="container mx-auto px-4 py-3 flex gap-4 relative">
              <div className="flex flex-col gap-1 flex-1">
              {navItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/10">
                <a
                  href="https://live-docs.marcosbrendon.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-200 rounded-lg text-sm hover:bg-purple-500/30 transition-all"
                >
                  <FaBook />
                  Live Docs
                </a>
                <a
                  href="/swagger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
                >
                  <FaBook />
                  API Docs
                </a>
                <a
                  href="https://github.com/MarcosBrendonDePaula/FluxStack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm hover:bg-white/20 transition-all"
                >
                  <FaGithub />
                  GitHub
                </a>
              </div>
              </div>

              {/* Logo floating right */}
              <img
                src={FluxStackLogo}
                alt=""
                className="absolute right-4 top-1/2 -translate-y-1/2 w-40 h-40 opacity-15 pointer-events-none transition-[filter] duration-500"
                style={{ filter: `hue-rotate(${routeFlameHue[location.pathname] || '0deg'})` }}
              />
            </nav>
          </div>
        )}
      </header>

      <Outlet />
    </div>
  )
}
