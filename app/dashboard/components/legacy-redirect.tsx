import { redirect } from "next/navigation";

/** Redirect route lama ke route modul mandiri */
export default function LegacyRedirect({ to }: { to: string }): never {
  redirect(to);
}
