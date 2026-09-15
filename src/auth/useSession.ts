import { useEffect, useState } from "react";
import type { AccountInfo } from "@azure/msal-browser";

import { capabilitiesFromToken } from "./capabilities";
import { currentAccount, entraOid, getAccessToken } from "./msal";
import { friendlyAuthError } from "../api/errors";

export type Session = {
  account: AccountInfo | null;
  name: string;
  email: string;
  oid: string;
  admin: boolean;
  invoke: boolean;
  ready: boolean;
  error: string;
};

export function useSession(signedIn: boolean): Session {
  const account = signedIn ? currentAccount() : null;
  const [admin, setAdmin] = useState(false);
  const [invoke, setInvoke] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!account) {
      setAdmin(false);
      setInvoke(false);
      setReady(false);
      return;
    }
    setReady(false);
    void getAccessToken()
      .then((token) => {
        const caps = capabilitiesFromToken(token);
        setAdmin(caps.admin);
        setInvoke(caps.invoke);
      })
      .catch((err: unknown) => {
        setAdmin(false);
        setInvoke(false);
        setError(err instanceof Error ? friendlyAuthError(err.message) : "Não foi possível validar a sessão. Entre novamente.");
      })
      .finally(() => setReady(true));
  }, [account]);

  return {
    account,
    name: account?.name || account?.username || account?.localAccountId || "",
    email: account?.username || "",
    oid: entraOid(account) || "",
    admin,
    invoke,
    ready,
    error,
  };
}
