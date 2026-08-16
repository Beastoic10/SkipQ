import { logout } from "./actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-orange-300 hover:text-orange-700">
        Log out
      </button>
    </form>
  );
}
