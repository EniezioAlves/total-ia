import { login } from "../auth/msal";
import { Logo } from "../components/Logo";
import { friendlyAuthError } from "../api/errors";

export function LoginPage({ error }: { error: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-navy px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <Logo variant="hero" />
        </div>
        <h1 className="text-center text-xl font-semibold text-ink">Assistente IA</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Entre com a conta da empresa para usar o assistente. O acesso segue a política da sua
          equipe.
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-accent-hover"
          onClick={() => void login()}
        >
          Entrar com a Microsoft
        </button>
        {error ? <p className="mt-4 text-sm text-danger">{friendlyAuthError(error)}</p> : null}
      </section>
    </div>
  );
}
