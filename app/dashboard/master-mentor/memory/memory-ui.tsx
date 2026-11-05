"use client";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-medium text-[#4B5563] ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#9CA3AF]",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-lg bg-[#111827] px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-lg border border-[#E5E7EB] px-3.5 py-2 text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB] disabled:opacity-40",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function DangerButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={[
        "rounded-lg border border-[#FECACA] px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-40",
        props.className || "",
      ].join(" ")}
    />
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
      {message}
    </div>
  );
}

export function MetaLine({ created, updated, source }: { created?: string; updated?: string; source?: string }) {
  return (
    <p className="mt-2 text-[11px] text-[#9CA3AF]">
      {source ? `Source: ${source}` : null}
      {source && (created || updated) ? " · " : null}
      {created ? `Created ${new Date(created).toLocaleString("id-ID")}` : null}
      {created && updated ? " · " : null}
      {updated ? `Updated ${new Date(updated).toLocaleString("id-ID")}` : null}
    </p>
  );
}

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}
