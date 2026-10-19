import LoadingButton from "../components/LoadingButton";

export default function AuthPage({
  authMode,
  setAuthMode,
  selectedRole,
  setSelectedRole,
  displayName,
  setDisplayName,
  accountEmail,
  setAccountEmail,
  accountPassword,
  setAccountPassword,
  authError,
  activeAction,
  enterWorkspace,
  createAccount,
}) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          Project <span>RELAY</span>
        </div>
        <p className="login-kicker">
          {authMode === "login" ? "Sign in" : "Create account"}
        </p>
        {authMode === "register" && (
          <label>
            Account type
            <select
              value={selectedRole}
              onChange={(event) => {
                setSelectedRole(event.target.value);
              }}
            >
              <option value="dispatcher">Dispatcher</option>
              <option value="rider">Rider</option>
            </select>
          </label>
        )}
        <form
          className="form-grid"
          onSubmit={authMode === "login" ? enterWorkspace : createAccount}
        >
          {authMode === "register" && (
            <label>
              Full name
              <input
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Enter your name"
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={accountEmail}
              onChange={(event) => setAccountEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength="8"
              autoComplete={
                authMode === "login" ? "current-password" : "new-password"
              }
              value={accountPassword}
              onChange={(event) => setAccountPassword(event.target.value)}
              placeholder={
                authMode === "login"
                  ? "Enter your password"
                  : "At least 8 characters"
              }
            />
          </label>
          {authError && (
            <p className="form-message" role="alert">
              {authError}
            </p>
          )}
          <LoadingButton
            type="submit"
            activeAction={activeAction}
            action="auth"
            loadingLabel={
              authMode === "login" ? "Signing in..." : "Creating account..."
            }
            className="primary-btn login-submit"
            label={authMode === "login" ? "Sign in" : "Create account"}
          />
        </form>
        <button
          type="button"
          className="auth-mode-btn"
          onClick={() =>
            setAuthMode(authMode === "login" ? "register" : "login")
          }
        >
          {authMode === "login"
            ? "New here? Create an account"
            : "Already registered? Sign in"}
        </button>
      </section>
    </main>
  );
}
