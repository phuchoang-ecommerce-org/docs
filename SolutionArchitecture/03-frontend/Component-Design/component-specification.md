# Shared Component Specification

These components are shared by pages or features. Build each project-owned component from Radix primitives or native HTML, then style it with Tailwind. Each has one implementation and receives its data through props.

## `components/ui`

| Component | Shared job |
| --- | --- |
| `Button` | Primary, secondary, or quiet action; loading and disabled states. |
| `TextField`, `SelectField` | Label, hint, required mark, error text, and visible focus. |
| `Dialog`, `AlertDialog` | Radix focus and keyboard behavior; `AlertDialog` confirms a hard-to-undo action. |
| `StatusMessage` | Short success, info, or error text with an icon. |
| `EmptyState`, `ErrorState` | Reason and one useful next action. |
| `LoadingSkeleton` | Holds the shape of content while it loads. |
| `Card`, `Badge` | Simple surface and short status label. |
| `Table`, `Pagination` | Readable rows, a table caption, and clear page controls. |

## `components/layout`

| Component | Shared job |
| --- | --- |
| `PageShell` | Page title, main area, width, and spacing. |
| `Breadcrumbs` | Links back to parent pages. |
| `StoreHeader` | Store navigation, sign-in link, and server-provided cart count. |
| `AccountMenu` | Links to the signed-in customer's pages and sign-out action. |
| `StaffNav` | Links to the staff pages allowed for the signed-in role. |

Both folders use Tailwind tokens from [Design-System.md](../UI-UX/Design-System.md). They do not fetch data, read cookies, or decide business permission. A layout may receive a role or cart count for display; the backend still checks every action. Feature components stay in `features/<domain>/components`.

The dev-only sign-in panel and buttons stay in `features/identity/components/`, not in either shared folder. See [dev-account-login.md](./dev-account-login.md).
