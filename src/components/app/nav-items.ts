import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tags,
  Store,
  PieChart,
  Award,
  Database,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/payees", label: "Payees", icon: Store },
  { href: "/reports", label: "Reports", icon: PieChart },
  { href: "/rewards", label: "Rewards", icon: Award },
  { href: "/data", label: "Data", icon: Database },
];
