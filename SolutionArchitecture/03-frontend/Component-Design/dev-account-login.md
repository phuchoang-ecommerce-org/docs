# Dev Account Login

Show `DevAccountLoginPanel` below `LoginForm` on `/login` for guests. It also appears there when a guest is sent from a protected page. This is a development aid, not a new sign-in method for users.

| Account shown | Role | Default page |
| --- | --- | --- |
| `customer@demo.local` | Customer | `/account/profile` |
| `staff@demo.local` | Staff | `/staff/catalog` |
| `warehouse@demo.local` | Warehouse operator | `/staff/inventory` |
| `support@demo.local` | Customer support | `/staff/orders` |
| `admin@demo.local` | Administrator | `/staff/catalog` |

The list matches the backend's dev seed accounts. Use a **Dev accounts** heading and show the email and role, with one **Sign in as ...** button per account. Each button works with the keyboard. Never show or send a password to the browser.

## Component and action rules

- `DevAccountLoginPanel` is a Server Component in `features/identity/components/`. It receives safe account labels and an optional `returnTo` path from `/login`. It passes a bound server action to each button. `DevAccountLoginButton` is a Client Component in the same folder; it receives only an account key, a label, and that action.
- Clicking a button sends the key and requested path to `features/identity/server/dev-login.ts`. That server action checks the dev gate, CSRF, the fixed account allowlist, and the path. It reads the demo password from private server config and calls the same identity login flow as `LoginForm`. It creates the same session and follows the same guest-cart merge rules. No role or session is faked.
- Show a pending state on the clicked button and block repeat clicks. On failure, keep the panel visible, show a short error, and let the developer try again. Respect a `429` wait time.
- After success, use the role returned by the backend. Open a same-origin `returnTo` path only if that role can use it. Otherwise use the default page above. The backend still checks every action.

## Dev gate

Render the panel and accept its action only when private server config has `ECP_FRONTEND_PROFILE=dev` and `ECP_DEMO_LOGIN_ENABLED=true`, and the backend URL is on the local/dev allowlist. Configure this only with the backend `dev` profile. `ECP_DEMO_PASSWORD` must match the backend seed password and stay server-only. In `prod`, omit the panel and reject direct calls to the action. Do not use a public environment variable or CSS hiding as the gate.
