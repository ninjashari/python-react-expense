"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/components/app/nav-items";
import { ModeToggle } from "@/components/app/mode-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { Button } from "@/components/ui/button";

type Props = {
  user: { name: string; email: string };
  children: React.ReactNode;
};

export function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const NavLinks = (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
        <div className="sticky top-0">
          <div className="flex h-16 items-center gap-2 border-b px-5 font-semibold text-sidebar-foreground">
            <Wallet className="size-5 text-primary" />
            Ledgerly
          </div>
          {NavLinks}
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-5 font-semibold">
              <span className="flex items-center gap-2">
                <Wallet className="size-5 text-primary" />
                Ledgerly
              </span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            {NavLinks}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          <ModeToggle />
          <UserMenu name={user.name} email={user.email} />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
