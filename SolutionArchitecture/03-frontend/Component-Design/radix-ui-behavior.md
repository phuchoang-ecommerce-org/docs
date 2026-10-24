# Radix UI Behavior

Radix UI Primitives provide interaction and accessibility behavior. Tailwind supplies the colors and spacing from [Design-System.md](../UI-UX/Design-System.md). Feature components supply data and call Server Actions. Radix does not fetch data or decide if an order action is allowed. Put shared wrappers in `components/ui/`; `AccountMenu` stays in `components/layout/`, and choice controls for checkout stay in their feature folders.

| Project component | Radix parts and state | Required behavior |
| --- | --- | --- |
| `Dialog` | `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Title`, `Description`, `Close`; `open` / `onOpenChange` | Use for an address form or other editable panel. Trap focus while open, close with Escape, and return focus to the trigger. Keep it open with the entered values if save fails. |
| `AlertDialog` | `Root`, `Trigger`, `Content`, `Title`, `Description`, `Cancel`, `Action`; `open` / `onOpenChange` | Use before canceling an order, removing an address, or approving a refund. Show clear Cancel and Confirm actions. Prevent the default close on Confirm; disable repeat submit, then close on success or show the error in place. |
| `AccountMenu` | `DropdownMenu.Root`, `Trigger`, `Content`, `Item` | Open from a button. Arrow keys move through items; Enter selects; Escape closes and returns focus. Render navigation items as links. |
| `SelectField` | `Select.Root`, `Trigger`, `Value`, `Content`, `Item`; `value` / `onValueChange` | Use for a long single-choice list, such as a warehouse. Connect its visible label, hint, and error to the trigger. |
| `AddressPicker`, `ShippingOptionPicker`, `PaymentMethodPicker` | `RadioGroup.Root`, `Item`; `value` / `onValueChange` | Show all choices when comparison matters. One choice is selected; arrow keys move between choices. Disable an option the backend marks unavailable. |
| Billing address choice | `Checkbox.Root`, `Indicator`; `checked` / `onCheckedChange` | Use for **Same as shipping address**. Space changes its state; a visible label names the choice. |
| `TextField` | `Label.Root` with native `input` | Keep native typing, autofill, and form behavior. Link the label with `htmlFor`; link hint and error with `aria-describedby`, and set `aria-invalid` on error. |

`Button`, `Card`, `Table`, `Pagination`, `StatusMessage`, and loading or empty states use native HTML and Tailwind. They do not need a Radix primitive. A message must include words; color or an icon alone is not enough.

`DevAccountLoginButton` also uses a native button. Its pending state and server action stay in the identity feature, as set out in [dev-account-login.md](./dev-account-login.md).

Use a controlled `open`, `value`, or `checked` when a server action must keep the component in sync. Keep pending dialogs open until the action ends. Style Radix state attributes such as `data-state` with the approved Tailwind tokens. When using `asChild` with a project Button or Link, keep a focusable native element and forward Radix props and ref; do not nest buttons. Test Tab, arrows, Enter, Space, Escape, focus return, and screen-reader names for each wrapper.

Behavior references: [Dialog](https://www.radix-ui.com/primitives/docs/components/dialog), [Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog), [Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu), [Select](https://www.radix-ui.com/primitives/docs/components/select), [Radio Group](https://www.radix-ui.com/primitives/docs/components/radio-group), [Checkbox](https://www.radix-ui.com/primitives/docs/components/checkbox), and [composition](https://www.radix-ui.com/primitives/docs/guides/composition).
