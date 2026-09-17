import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { Shell } from "./components/Shell";
import { AuditPage } from "./pages/admin/AuditPage";
import { DenylistPage } from "./pages/admin/DenylistPage";
import { HealthPage } from "./pages/admin/HealthPage";
import { SpendPage } from "./pages/admin/SpendPage";
import { TeamDetailPage } from "./pages/admin/TeamDetailPage";
import { TeamsPage } from "./pages/admin/TeamsPage";
import { ChatPage } from "./pages/chat/ChatPage";
import { LoginPage } from "./pages/LoginPage";
import { useSession, type Session } from "./auth/useSession";

type AppProps = {
  signedIn: boolean;
  bootError: string;
};

function AdminRoute({
  session,
  children,
}: {
  session: Session;
  children: ReactElement;
}) {
  if (!session.ready) {
    return null;
  }
  if (!session.admin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export function App({ signedIn, bootError }: AppProps) {
  const session = useSession(signedIn);

  if (!session.account) {
    return <LoginPage error={bootError || session.error} />;
  }

  return (
    <Shell session={session}>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route
          path="/admin/teams"
          element={
            <AdminRoute session={session}>
              <TeamsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/teams/:teamId"
          element={
            <AdminRoute session={session}>
              <TeamDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/spend"
          element={
            <AdminRoute session={session}>
              <SpendPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/denylist"
          element={
            <AdminRoute session={session}>
              <DenylistPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <AdminRoute session={session}>
              <AuditPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/health"
          element={
            <AdminRoute session={session}>
              <HealthPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
