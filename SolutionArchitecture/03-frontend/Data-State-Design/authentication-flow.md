# Authentication Flow

The browser has a `Secure`, `httpOnly`, `SameSite=Lax` session cookie (`Strict` for staff sessions). Access and refresh tokens stay in a server-side session store, never in browser JavaScript or local storage. The Next.js server adds the access token when it calls the backend. State-changing requests also pass a CSRF check.

1. **Guest:** Browsing and cart use a separate guest-cart cookie. No account session is needed.
2. **Register:** Create an account and ask the user to verify their email. Registration does not sign the user in.
3. **Sign in:** Send credentials to the backend from the Next.js server. On success, set the session cookie, merge the guest cart, and return to the safe page the user wanted. If cart merge fails, sign-in still succeeds and the guest cart is kept for another try.
4. **Use a session:** Read the short-lived access token on the server. Before or after expiry, refresh once and rotate the refresh token. Only one refresh for the same session may run at a time, including across open tabs.
5. **Refresh fails:** If the refresh token is invalid, expired, or reused, clear the cookie and private view state. Send the user to `/login` with a safe return path. Never keep retrying refresh.
6. **Sign out:** Invalidate the refresh token at the backend, clear the cookie, and return to `/`. If invalidation fails, local sign-out still ends and the failure is recorded for retry. **End all sessions** invalidates every refresh token for that account.

## Dev account sign-in

When the frontend and backend both use their dev profiles, `/login` may show the seeded accounts as one-click choices. A click sends an account key to a server-only action. The server checks its private dev gate and allowlist, adds the demo password from private config, and uses the normal identity login endpoint. The usual session, guest-cart merge, role checks, and safe return path still apply. A role that cannot open the requested page goes to its own default page.

The panel and action are off in `prod`. No demo password, access token, or refresh token is sent to browser code. See [dev-account-login.md](../Component-Design/dev-account-login.md).

A signed-in user with an unverified email may browse and use the cart, but cannot check out. The UI may hide actions by role, while the backend checks permission on every operation. Password reset ends all sessions; changing a password ends other sessions. Access tokens, refresh tokens, and passwords never appear in page URLs, client state, logs, or error messages.
