import { useState, type ReactNode } from "react";
import {
  CircleDollarSign,
  ClipboardList,
  HeartPulse,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  ShieldBan,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import type { Session } from "../auth/useSession";
import { logout } from "../auth/msal";
import { Logo } from "./Logo";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
    isActive ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
  }`;

function NavBody({ session, onNavigate }: { session: Session; onNavigate?: () => void }) {
  return (
    <>
      <div className="border-b border-white/10 px-4 py-4">
        <div className="rounded-xl bg-white px-2 py-2">
          <Logo />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <NavLink to="/" end className={linkClass} onClick={onNavigate}>
          <MessageSquare size={16} />
          Assistente
        </NavLink>
        {session.admin && (
          <>
            <div className="px-3 pb-1 pt-4 text-[11px] uppercase tracking-wider text-white/40">
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
      <div className="border-t border-white/10 p-4">
        <div className="text-[11px] uppercase tracking-wider text-white/40">Conta</div>
        <div className="mt-1 truncate text-sm font-medium">{session.name}</div>
        {session.email ? (
          <div className="truncate text-[11px] text-white/50" title={session.email}>
            {session.email}
          </div>
        ) : null}
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
          onClick={() => void logout()}
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </>
  );
}

export function Shell({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-ice">
      <aside className="hidden w-60 shrink-0 flex-col bg-navy text-white md:flex">
        <NavBody session={session} />
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy/50"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-60 flex-col bg-navy text-white shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1 text-white/80"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
            <NavBody session={session} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2 md:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-navy"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-navy">Assistente IA</span>
        </div>
        <main className="min-h-0 min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
