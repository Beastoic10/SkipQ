import { logout } from "./actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-1"
      >
        Sign Out
      </button>
    </form>
  );
}
