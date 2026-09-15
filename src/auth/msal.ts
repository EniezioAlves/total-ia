import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type RedirectRequest,
} from "@azure/msal-browser";

import { config, invokeScope } from "../config";

const redirectUri = window.location.origin;

const loginRequest: RedirectRequest = {
  scopes: [invokeScope],
  extraScopesToConsent: ["openid", "profile", "offline_access"],
  prompt: "select_account",
};

export const msal = new PublicClientApplication({
  auth: {
    clientId: config.clientId,
    authority: `https://login.microsoftonline.com/${config.tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
});

let ready: Promise<void> | null = null;

export function initAuth(): Promise<void> {
  if (!ready) {
    ready = msal
      .initialize()
      .then(() => msal.handleRedirectPromise())
      .then(() => undefined);
  }
  return ready;
}

export function currentAccount(): AccountInfo | null {
  const active = msal.getActiveAccount();
  if (active) {
    return active;
  }
  const accounts = msal.getAllAccounts();
  if (accounts[0]) {
    msal.setActiveAccount(accounts[0]);
    return accounts[0];
  }
  return null;
}

export function entraOid(account: AccountInfo | null = currentAccount()): string | null {
  const claims = account?.idTokenClaims;
  const oid = claims && typeof claims.oid === "string" ? claims.oid : null;
  if (oid) {
    return oid;
  }
  return account?.localAccountId ?? null;
}

export async function login(): Promise<void> {
  await initAuth();
  await msal.loginRedirect(loginRequest);
}

export async function logout(): Promise<void> {
  await initAuth();
  const account = currentAccount();
  await msal.logoutRedirect({ account: account ?? undefined });
}

export async function getAccessToken(options: { interactive?: boolean } = {}): Promise<string> {
  await initAuth();
  const account = currentAccount();
  if (!account) {
    throw new Error("Faça login no Entra antes de chamar o Gateway.");
  }
  const scopes = [invokeScope];
  const interactive = options.interactive !== false;
  try {
    const result = await msal.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch (error) {
    if (interactive && error instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ account, scopes });
    }
    throw error;
  }
}
