export type TxType = "income" | "expense" | "transfer";

export type Tx = {
  id: string;
  amount: string;
  type: TxType;
  description: string | null;
  notes: string | null;
  date: string;
  rewardPoints: string | null;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  payeeId: string | null;
  accountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  payeeName: string | null;
  payeeColor: string | null;
};

export type TxPage = {
  items: Tx[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AccountOption = {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "cash" | "investment" | "ppf";
  currency: string;
};

export type Option = {
  id: string;
  name: string;
  color: string;
};
