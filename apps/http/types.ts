// --- Types ---
export type User = {
  id: string;
  username: string;
  password: string;
};

export type Stock = {
  id: string;
  title: string;
  symbol: string;
}

export type BalanceKey = "INR" | "AXIS" | "HDFC" | "TATA";

export type Balance = Record<
  string,
  Record<
    BalanceKey,
    {
      total: number;
      locked: number;
    }
  >
>;

export type Order = {
  id: string;
  userId: string;
  stockId: string
  side: "BUY" | "LIMIT";
  type: "LIMIT" | "MARKET";
  qty: number;
  filledQty: number;
  createdAt: Date;
  price: number
  status: "FILLED" | "CANCELLED" | "PARTIAL-FILLED"
};

export type OrderBook = Record<
  BalanceKey,
  {
    bids: Record<
      number,
      {
        totalQuantity: number;
        // orders: Order[];
      }
    >;
    asks: Record<
      number,
      {
        totalQuantity: number;
        // orders: Order[];
      }
    >;
  }
>;

export type Fill = {
  id: string;
  stockId: string;
  orderId: string;
  price: number;
  qty: number;
};
