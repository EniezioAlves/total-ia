import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { currentAccount, initAuth } from "./auth/msal";
import { friendlyAuthError } from "./api/errors";
import { useAppHeight } from "./hooks/useAppHeight";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function Root() {
  useAppHeight();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    void initAuth()
      .then(() => setReady(true))
      .catch((error: unknown) => {
        setBootError(
          error instanceof Error
            ? friendlyAuthError(error.message)
            : "Não foi possível iniciar o acesso. Confirme com o administrador se o aplicativo está cadastrado no Microsoft 365.",
        );
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-[var(--app-height)] place-items-center bg-ice text-muted">
        A iniciar Total IA…
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App signedIn={Boolean(currentAccount())} bootError={bootError} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root ausente");
}
createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
