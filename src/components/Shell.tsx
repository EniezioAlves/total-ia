import { useEffect, useState, type ReactNode } from "react";
import {
  CircleDollarSign,
  ClipboardList,
  HeartPulse,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  ShieldBan,
  X,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import type { Session } from "../auth/useSession";
import { logout } from "../auth/msal";
import { Logo } from "./Logo";

const NAV_KEY = "total-ia.nav-open";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
    isActive ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
  }`;

function NavBody({
  session,
  onNavigate,
  onHide,
}: {
  session: Session;
  onNavigate?: () => void;
  onHide?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/10 px-3 py-3">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1 rounded-xl bg-white px-2 py-1.5">
            <Logo />
          </div>
          {onHide ? (
            <button
              type="button"
              className="hidden shrink-0 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white md:inline-flex"
              aria-label="Esconder menu"
              title="Esconder menu"
              onClick={onHide}
            >
              <PanelLeftClose size={16} />
            </button>
          ) : null}
        </div>
      </div>
      <nav className="relative z-10 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2 md:overflow-hidden">
        <NavLink to="/" end className={linkClass} onClick={onNavigate}>
          <MessageSquare size={16} />
          Assistente
        </NavLink>
        {session.admin && (
          <>
            <div className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wider text-white/40">
              Gestão
            </div>
            <NavLink to="/admin/teams" className={linkClass} onClick={onNavigate}>
              <LayoutGrid size={16} />
              Equipes
            </NavLink>
            <NavLink to="/admin/spend" className={linkClass} onClick={onNavigate}>
              <CircleDollarSign size={16} />
              Custos
            </NavLink>
            <NavLink to="/admin/audit" className={linkClass} onClick={onNavigate}>
              <ClipboardList size={16} />
              Auditoria
            </NavLink>
            <NavLink to="/admin/denylist" className={linkClass} onClick={onNavigate}>
              <ShieldBan size={16} />
              Bloqueios
            </NavLink>
            <NavLink to="/admin/health" className={linkClass} onClick={onNavigate}>
              <HeartPulse size={16} />
              Saúde
            </NavLink>
          </>
        )}
      </nav>
      <div className="shrink-0 border-t border-white/10 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="text-[11px] uppercase tracking-wider text-white/40">Conta</div>
        <div className="mt-1 truncate text-sm font-medium">{session.name}</div>
        {session.email ? (
          <div className="truncate text-[11px] text-white/50" title={session.email}>
            {session.email}
          </div>
        ) : null}
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
          onClick={() => void logout()}
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </div>
  );
}

function readNavOpen(): boolean {
  try {
    return localStorage.getItem(NAV_KEY) !== "0";
  } catch {
    return true;
  }
}

export function Shell({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [navOpen, setNavOpen] = useState(readNavOpen);
  const chat = useLocation().pathname === "/";

  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, navOpen ? "1" : "0");
    } catch {
      /* ignore quota */
    }
  }, [navOpen]);

  return (
    <div className="flex h-[var(--app-height)] max-h-[var(--app-height)] min-h-0 w-full flex-1 overflow-hidden bg-ice">
      <aside className={`${navOpen ? "hidden md:flex" : "hidden"} relative z-20 h-full min-h-0 w-60 shrink-0 flex-col overflow-hidden bg-navy text-white`}>
        <NavBody session={session} onHide={() => setNavOpen(false)} />
      </aside>
      {drawer ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy/50"
            aria-label="Fechar menu"
            onClick={() => setDrawer(false)}
          />
          <aside className="relative flex h-full min-h-0 w-[min(16rem,85vw)] flex-col overflow-hidden bg-navy pt-[env(safe-area-inset-top)] text-white shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1 text-white/80"
              aria-label="Fechar"
              onClick={() => setDrawer(false)}
            >
              <X size={18} />
            </button>
            <NavBody session={session} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      ) : null}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className={`flex shrink-0 items-center gap-2 border-b border-line bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] ${
            navOpen ? "md:hidden" : ""
          }`}
        >
          <button
            type="button"
            className="rounded-lg p-2 text-navy"
            aria-label="Mostrar menu"
            title="Mostrar menu"
            onClick={() => {
              if (window.matchMedia("(min-width: 768px)").matches) {
                setNavOpen(true);
              } else {
                setDrawer(true);
              }
            }}
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-navy">Assistente IA</span>
        </div>
        <main
          className={`relative min-h-0 min-w-0 flex-1 ${
            chat ? "overflow-hidden" : "overflow-auto"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
