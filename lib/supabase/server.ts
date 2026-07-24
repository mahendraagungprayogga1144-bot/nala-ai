import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Components may ONLY read cookies.
 * Session refresh + Set-Cookie must happen in middleware (never here).
 * Calling cookies().set during RSC render → ERROR digest / blank page
 * (historically ERROR 1621801304 on this app).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Intentionally empty — do not call cookieStore.set from RSC.
        },
      },
    },
  );
}
