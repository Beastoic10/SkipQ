import { redirect } from "next/navigation";
import { requireTerminalAccount } from "@/lib/auth/session";

export default async function TerminalRootPage() {
  const context = await requireTerminalAccount();
  redirect(`/terminal/${context.shopId}`);
}
