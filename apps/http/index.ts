import express from "express";
import { hash, compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { orderInput } from "./validate";
import {
  addNewAsksOrBidsInOrderBook,
  checkAvailablePriceInOrderBook,
  compareStockOrCurrencyBalance,
  order,
  rejectOrder,
} from "./utils";
import type { Balance, Fill, Order, OrderBook, Stock, User } from "./types";

export const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) throw Error("JWT_SECRET not found");

// --- In-memory state ---
const USERS: User[] = [];
const STOCKS: Stock[] = [
  { id: "1", title: "AXIS BANK", symbol: "AXIS" },
  { id: "2", title: "HDFC BANK", symbol: "HDFC" },
  { id: "3", title: "TATA Steel", symbol: "TATA" },
];
const FILLS: Fill[] = [];
const ORDERS: Order[] = [];
const BALANCES: Balance = new Map(); // { userId: { INR: {total, locked}, AXIS: {total, locked}, ... } }
const ORDERBOOK: OrderBook = {
  AXIS: { bids: {}, asks: {}, lastTradedPrice: 0 },
  HDFC: { bids: {}, asks: {}, lastTradedPrice: 0 },
  TATA: { bids: {}, asks: {}, lastTradedPrice: 0 },
};

// --- Auth ---
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  // 1. check username not taken
  const existingUser = USERS.find((usr) => usr.username === username);
  if (existingUser) {
    res.status(411).json({ message: "username already taken" });
    return;
  }

  // 2. hash password (bcrypt/argon2)
  const hashedPassword = await hash(password, 4);

  // 3. push to USERS
  let userId = crypto.randomUUID();
  USERS.push({
    id: userId,
    username,
    password: hashedPassword,
  });

  // 4. init BALANCES[userId] with INR: { total: 0, locked: 0 }
  BALANCES.set(userId, { 
    INR: { total: 0, locked: 0 },
    AXIS: { total: 0, locked: 0 },
    HDFC: { total: 0, locked: 0 },
    TATA: { total: 0, locked: 0 },
  })

  res.status(201).json({ message: "signup successfull, please signin." });
  return;
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // 1. find user by username
  const existingUser = USERS.find((usr) => usr.username === username);
  if (!existingUser) {
    res.status(403).json({ message: "user not found, please signup" });
    return;
  }

  // 2. compare hashed password
  const isPasswordCorrect = await compare(password, existingUser.password);
  if (!isPasswordCorrect) {
    res.status(403).json({ message: "wrong password." });
    return;
  }

  // 3. return JWT / session token
  const token = sign({ userId: existingUser.id }, JWT_SECRET);

  res.status(200).json({ message: "login done", token });
  return;
});

// --- Orders ---
app.post("/order", (req, res) => {

  const { success, data, error } = orderInput.safeParse(req.body);

  if (!success) {
    console.log("zod error ", error);
    res.status(403).json({ message: "Invalid inputs" });
    return;
  }

  const { ioc, side, symbol, type, userId, price, qty } = data;

  const userBalance = BALANCES.get(userId)?.[side === "BUY" ? "INR" : "AXIS"] || {
    total: 10000,
    locked: 0
  };
  let userFinalPrice = 0;
  let userFinalQuantity = 0;

  if (type === "LIMIT") {
    if (price === undefined || qty === undefined) {
      res.status(403).json({ message: "Invalid inputs" });
      return;
    }

    const isBalanceAvailable = compareStockOrCurrencyBalance(
      userBalance,
      side === "BUY" ? price : qty,
    );

    console.log("isBalanceAvailable ", isBalanceAvailable)

    if (!isBalanceAvailable) {
      res.status(400).json({ message: "Insuffecient balance." });
      return;
    }

    userFinalPrice = price;
    userBalance.locked += price * qty;
    userFinalQuantity = qty;
  }
  
  if (type === "MARKET") {
    let priceOrPriceFromStock = 0;

    if (typeof price === "number") {
      priceOrPriceFromStock = price;
      userFinalQuantity = price / ORDERBOOK["AXIS"].lastTradedPrice;
    }

    if (typeof qty === "number") {
      userFinalQuantity = qty;
      priceOrPriceFromStock = qty * ORDERBOOK["AXIS"].lastTradedPrice;
    }

    const isBalanceAvailable = compareStockOrCurrencyBalance(
      userBalance, 
      priceOrPriceFromStock
    );

    console.log("isBalanceAvailable ", isBalanceAvailable)
    
    if (!isBalanceAvailable) {
      res.status(400).json({ message: "Insuffecient balance." });
      return;
    }

    userFinalPrice = priceOrPriceFromStock;
    userBalance.locked += priceOrPriceFromStock;
  }
  
  const orderRes = order({
    balances: BALANCES,
    fills: FILLS,
    ioc,
    orderBook: ORDERBOOK,
    orders: ORDERS,
    res,
    side,
    type,
    userId,
    userPrice: userFinalPrice,
    userQty: userFinalQuantity,
  });

  console.log("ORDERBOOK ", ORDERBOOK.AXIS);
  console.log("orderRes ", orderRes)
  
  if (orderRes === null) {
    rejectOrder(res);
    return;
  }

  if (orderRes === true) {
    res.status(201).json({
      message: "order added in orderbook"
    })
    return;
  }
  
  return res.status(201).json(orderRes);
});

app.delete("/order/:orderId", (req, res) => {
  const { orderId } = req.params;
  const userId = req.userId;
  // 1. find order, check ownership
  const order = ORDERS.find((ord) => ord.id === orderId || ord.userId === userId);
  if (!order) {
    res.status(403).json({ message: "Order not found or not belongs to you." })
    return;
  }
  
  // 2. remove from ORDERBOOK price level
  // ORDERBOOK.
  
  // 3. unlock remaining reserved balance
  // 4. mark status = CANCELLED
});

app.get("/orders", (req, res) => {
  // query: ?status=OPEN  (or all)
  // return current user's orders
});

// --- Market data ---
app.get("/orderbook/:symbol", (req, res) => {
  // return aggregated depth — totalQty per price level for bids and asks
  // (don't expose individual userIds to other users)
});

app.get("/fills/:symbol", (req, res) => {
  // recent trades for this stock — the "tape"
});

app.get("/stocks", (req, res) => {
  res.json(STOCKS);
});

// --- User data ---
app.get("/balance", (req, res) => {
  // return BALANCES[userId] for the authed user
});

app.listen(3000, () => console.log("CEX running on :3000"));
