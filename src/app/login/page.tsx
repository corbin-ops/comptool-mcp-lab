import type { Metadata } from "next";
import Link from "next/link";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid: "That password did not match the shared comp-tool password.",
  config: "Set APP_PASSWORD and AUTH_SECRET before using the comp tool.",
};

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Login | Dew Claw Comp Tool",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const errorKey = getSingleParam(params.error);
  const redirectTo = getSingleParam(params.redirectTo) ?? "/";
  const errorMessage = errorKey ? LOGIN_ERROR_MESSAGES[errorKey] ?? null : null;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Dew Claw Comp Tool</p>
        <h1>Unlock the comp workspace</h1>
        <p className="auth-copy">
          This standalone app is for DewClaw comping only, separate from the EOD dashboard.
        </p>

        <form className="auth-form" action="/api/auth/login" method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <label>
            <span>Shared password</span>
            <input type="password" name="password" placeholder="Enter password" required />
          </label>

          <button type="submit">Open comp tool</button>
        </form>

        {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

        <p className="auth-note">
          Retrieval source: local DewClaw corpus built from the PDF handbook set.
        </p>

        <Link className="auth-link" href="https://nextjs.org/docs/app/getting-started/installation">
          Next.js setup guide
        </Link>
      </section>
    </main>
  );
}
