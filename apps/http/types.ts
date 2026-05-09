// --- Types ---
export type User = {
  id: string;
  username: string;
  password: string;
};

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
  userId: string;
  qty: number;
  filledQty: number;
  orderId: string;
  createdAt: Date;
};

export type OrderBook = Record<
  BalanceKey,
  {
    bids: Record<
      number,
      {
        totalQuantity: number;
        orders: Order[];
      }
    >;
    asks: Record<
      number,
      {
        totalQuantity: number;
        orders: Order[];
      }
    >;
  }
>;

export type Fill = {
  orderId: string;
  orgQty: number;
  filledQty: number;
};
