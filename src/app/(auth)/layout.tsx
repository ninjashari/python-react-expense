import { Wallet } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="gradient-primary absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(1_0_0/0.12),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Wallet className="size-5" />
          </div>
          Ledgerly
        </div>
        <div className="relative space-y-4">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Take control of
            <br />
            your money.
          </h1>
          <p className="max-w-md text-white/75">
            Track accounts, transactions, categories and reward points in one fast,
            private place. No spreadsheets, no clutter.
          </p>
        </div>
        <p className="relative text-sm text-white/50">
          © {new Date().getFullYear()} Ledgerly
        </p>
      </div>
      <div className="flex items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
