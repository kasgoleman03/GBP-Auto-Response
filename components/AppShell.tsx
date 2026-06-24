"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";
import { useAppData } from "@/app/AppDataProvider";
import {
  InboxIcon,
  SlidersIcon,
  SparkleIcon,
  ListIcon,
} from "@/components/ui/icons";
import { config } from "@/lib/config";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

function useNavItems(): NavItem[] {
  const { needsReviewCount } = useAppData();
  return [
    {
      to: "/inbox",
      label: "Inbox",
      icon: <InboxIcon size={22} />,
      badge: needsReviewCount,
    },
    { to: "/rules", label: "Rules", icon: <SlidersIcon size={22} /> },
    { to: "/voice", label: "Voice", icon: <SparkleIcon size={22} /> },
    { to: "/activity", label: "Activity", icon: <ListIcon size={22} /> },
  ];
}

export function AppShell({ children }: { children: ReactNode }) {
  const items = useNavItems();
  const { connection } = useAppData();
  const pathname = usePathname();

  return (
    <div className="min-h-full lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200/70 bg-white px-4 py-6 lg:flex">
        <div className="flex items-center justify-between gap-2">
          <Brand />
          <ThemeToggle />
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} active={pathname === item.to} />
          ))}
        </nav>
        <div className="mt-auto">
          {connection?.status === "connected" && (
            <div className="rounded-xl bg-ink-50 p-3">
              <p className="text-xs font-medium text-ink-400">Connected</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-ink-800">
                {connection.businessName}
              </p>
              <p className="truncate text-xs text-ink-500">
                {connection.googleAccountEmail}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200/70 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Brand compact />
          <ThemeToggle />
        </header>

        <main key={pathname} className="flex-1 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink-200/70 bg-white/95 backdrop-blur lg:hidden">
        {items.map((item) => (
          <TabLink key={item.to} item={item} active={pathname === item.to} />
        ))}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
        <SparkleIcon size={20} />
      </span>
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-tight text-ink-900">
          {config.appName}
        </p>
        {!compact && (
          <p className="text-xs text-ink-400">Google review replies</p>
        )}
      </div>
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.to}
      className={cx(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
      )}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.to}
      className={cx(
        "relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors",
        active ? "text-brand-600" : "text-ink-400"
      )}
    >
      <span className="relative">
        {item.icon}
        {item.badge ? (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        ) : null}
      </span>
      {item.label}
    </Link>
  );
}
