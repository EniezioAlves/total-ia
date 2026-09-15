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
import { useSession } from "./auth/useSession";

type AppProps = {
  signedIn: boolean;
  bootError: string;
};

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
          element={session.admin ? <TeamsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/teams/:teamId"
          element={session.admin ? <TeamDetailPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/spend"
          element={session.admin ? <SpendPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/denylist"
          element={session.admin ? <DenylistPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/audit"
          element={session.admin ? <AuditPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/admin/health"
          element={session.admin ? <HealthPage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
