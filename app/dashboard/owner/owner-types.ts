export type TopProduct = {
  id: string;
  name: string;
  sold: number;
  revenue: number;
  emoji: string;
};

export type RecentTransaction = {
  id: string;
  customer: string;
  status: "Selesai" | "Diproses" | "Pending";
  amount: number;
  time: string;
};
