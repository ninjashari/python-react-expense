import { Wallet } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Wallet className="size-6" />
          Ledgerly
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Take control of your money.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Track accounts, transactions, categories and reward points in one fast,
            private place. No spreadsheets, no clutter.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} Ledgerly
        </p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
