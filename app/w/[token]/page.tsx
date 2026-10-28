import { publicWaLink } from "@/lib/office/wa-reply";
import WaChat from "./wa-chat";

export const dynamic = "force-dynamic";

export default async function WaLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await publicWaLink(token);
  if (!link) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#075E54] px-6 text-center text-white">
        <div>
          <p className="text-lg font-semibold">Tautan WhatsApp</p>
          <p className="mt-2 text-sm text-white/70">Link ini tidak berlaku. Minta tautan baru ke pemilik bisnis.</p>
        </div>
      </main>
    );
  }
  return <WaChat token={token.toLowerCase()} brand={link.brand} greeting={link.greeting} />;
}
