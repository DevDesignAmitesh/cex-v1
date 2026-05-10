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

export type Balance = Map<
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
  market: BalanceKey
  price: number;
  qty: number;
  type: "LIMIT" | "MARKET";
  side: "BUY" | "SELL";
  filledQty: number;
  status: "FILLED" | "CANCELLED" | "PARTIAL-FILLED"
  createdAt: Date;
};

export type OrderBookKey = "AXIS" | "HDFC" | "TATA";

export type OrderBook = Record<
  OrderBookKey,
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
    lastTradedPrice: number
  }
>;

export type Fill = {
  id: string;
  qty: number;
  type: "MAKER" | "TAKER";
  side: "BUY" | "SELL";
  userId: string;
  price: number;
  asset: BalanceKey;
  orderId: string;
  createdAt: Date
};
