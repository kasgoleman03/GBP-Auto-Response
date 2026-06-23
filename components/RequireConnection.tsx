"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/app/AppDataProvider";
import { Spinner } from "@/components/ui/Button";

/** Gate the app behind a connected Google Business Profile. */
export function RequireConnection({ children }: { children: React.ReactNode }) {
  const { connection, loading } = useAppData();
  const router = useRouter();

  const connected = connection?.status === "connected";

  useEffect(() => {
    if (!loading && !connected) {
      router.replace("/connect");
    }
  }, [loading, connected, router]);

  if (loading || !connected) {
    return (
      <div className="flex h-screen items-center justify-center text-brand-600">
        <Spinner size={28} />
      </div>
    );
  }

  return <>{children}</>;
}
