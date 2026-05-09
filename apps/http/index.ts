// video timestamps => 1 hour 33 minutes.

import express from "express";
import { hash, compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { orderInput } from "./validate";
import {
  addNewAsksOrBidsInOrderBook,
  checkAvailablePriceInOrderBook,
  compareStockOrCurrencyBalance,
  compareUserQtyWithPriceQty,
  rejectOrder,
} from "./utils";
import type { Balance, Fill, Order, OrderBook, Stock, User } from "./types";
export const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) throw Error("JWT_SECRET not found");

// --- In-memory state ---
const USERS: User[] = [];
let LAST_TRADED_PRICE = 0;
const STOCKS: Stock[] = [
  { id: "1", title: "AXIS BANK", symbol: "AXIS" },
  { id: "2", title: "HDFC BANK", symbol: "HDFC" },
  { id: "3", title: "TATA Steel", symbol: "TATA" },
];
const FILLS: Fill[] = [];
const ORDERS: Order[] = [];
const BALANCES: Balance = {}; // { userId: { INR: {total, locked}, AXIS: {total, locked}, ... } }
const ORDERBOOK: OrderBook = {
  INR: { bids: {}, asks: {}, lastTradedPrice: 0 },
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
  BALANCES[userId] = { 
    INR: { total: 0, locked: 0 },
    AXIS: { total: 0, locked: 0 },
    HDFC: { total: 0, locked: 0 },
    TATA: { total: 0, locked: 0 },
  };

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
  const { success, data, error } = orderInput.safeParse({
    ...req.body,
    userId: req.userId,
  });

  if (!success) {
    console.log("zod error ", error);
    res.status(403).json({ message: "Invalid inputs" });
    return;
  }

  const { ioc, side, symbol, type, userId, price, qty } = data;

  const userBalance = BALANCES[userId]![side === "BUY" ? "INR" : "AXIS"];
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
      userFinalQuantity = price / LAST_TRADED_PRICE;
    }

    if (typeof qty === "number") {
      userFinalQuantity = qty;
      priceOrPriceFromStock = qty * LAST_TRADED_PRICE;
    }

    const isBalanceAvailable = compareStockOrCurrencyBalance(
      userBalance, 
      priceOrPriceFromStock
    );

    if (!isBalanceAvailable) {
      res.status(400).json({ message: "Insuffecient balance." });
      return;
    }

    userFinalPrice = priceOrPriceFromStock;
    userBalance.locked += priceOrPriceFromStock;
  }

  const availablePrice = checkAvailablePriceInOrderBook(
    ORDERBOOK,
    userFinalPrice,
    side === "BUY" ? "INR" : "AXIS",
    side === "BUY" ? "asks" : "bids",
  );

  const orderId = crypto.randomUUID();

  if (!availablePrice && ioc) {
    ORDERS.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userFinalQuantity,
      userId,
      price: userFinalPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });
    rejectOrder(res);
    return;
  }

  if (!availablePrice && type === "MARKET") {
    ORDERS.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userFinalQuantity,
      userId,
      price: userFinalPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });

    rejectOrder(res);
    return;
  }

  if (!availablePrice && !ioc && type === "LIMIT") {
    addNewAsksOrBidsInOrderBook(
      side === "BUY" ? "asks" : "bids",
      userFinalPrice,
      ORDERBOOK,
      side === "BUY" ? "INR" : "AXIS",
      userFinalQuantity,
    );
    return;
  }

  const isPriceQtyHigh = compareUserQtyWithPriceQty(
    userFinalQuantity,
    availablePrice?.totalQuantity!,
  );

  if (!isPriceQtyHigh && ioc) {
    ORDERS.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userFinalQuantity,
      userId,
      price: userFinalPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });

    rejectOrder(res);
    return;
  }

  if (!isPriceQtyHigh && type === "MARKET") {
    ORDERS.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userFinalQuantity,
      userId,
      price: userFinalPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });

    rejectOrder(res);
    return;
  }

  const filledQty = userFinalQuantity - availablePrice?.totalQuantity!;
  const leftQty = userFinalQuantity - filledQty;

  const order =
    ORDERBOOK[side === "BUY" ? "INR" : "AXIS"][
      side === "BUY" ? "asks" : "bids"
    ][userFinalPrice];

  ORDERS.push({
    id: orderId,
    createdAt: new Date(),
    filledQty,
    qty: userFinalQuantity,
    userId,
    price: userFinalPrice,
    market: "AXIS",
    side,
    status: "FILLED",
    type,
  });

  FILLS.push({
    orderId,
    // filledQty,
    // orgQty: userFinalQuantity,
    asset: "AXIS",
    createdAt: new Date(),
    id: crypto.randomUUID(),
    price: userFinalPrice,
    qty: userFinalQuantity,
    side,
    type: "MAKER",
    userId
  });
  
  ORDERBOOK[side === "BUY" ? "INR" : "AXIS"][side === "BUY" ? "asks" : "bids"][
    userFinalPrice
  ] = {
    // orders: order?.orders ?? [],
    totalQuantity: order?.totalQuantity! - filledQty,
  };
  
  if (order?.totalQuantity === 0) {
    delete ORDERBOOK[side === "BUY" ? "INR" : "AXIS"][
      side === "BUY" ? "asks" : "bids"
    ][userFinalPrice];
  }
  
  if (!isPriceQtyHigh && type === "LIMIT") {
    const availablePrice = checkAvailablePriceInOrderBook(
      ORDERBOOK,
      userFinalPrice,
      side === "BUY" ? "INR" : "AXIS",
      side === "BUY" ? "asks" : "bids",
    );
    
    const isPriceQtyHigh = compareUserQtyWithPriceQty(
      leftQty,
      availablePrice?.totalQuantity!,
    );

    addNewAsksOrBidsInOrderBook(
      side === "BUY" ? "asks" : "bids",
      userFinalPrice,
      ORDERBOOK,
      side === "BUY" ? "INR" : "AXIS",
      leftQty,
    );    
  }

  LAST_TRADED_PRICE = userFinalPrice;
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
