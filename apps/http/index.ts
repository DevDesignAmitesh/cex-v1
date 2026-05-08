import express from "express";
import { hash, compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { orderInput } from "./validate";
const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

// --- Types ---
type User = {
  id: string;
  username: string;
  password: string;
}

type BalanceKey = "INR" | "AXIS" | "HDFC" |"TATA"

type Balance = Record<string, Record<BalanceKey, {
  total: number,
  locked: number
}>>

type Order = {
  userId: string;
  qty: number;
  filledQty: number;
  orderId: string;
  createdAt: Date
}

type orderBook = Record<BalanceKey, {
  bids: Record<number, {
    totalQuantity: number,
    orders: Order[]
  }>,
  asks: Record<number, {
    totalQuantity: number,
    orders: Order[]
  }>,
}>

type Fill = {
  orderId: string;
  qty: number;
}

// --- In-memory state ---
const USERS: User[] = [];
const STOCKS = [
  { id: 1, title: "AXIS BANK", symbol: "AXIS" },
  { id: 2, title: "HDFC BANK", symbol: "HDFC" },
  { id: 3, title: "TATA Steel", symbol: "TATA" },
];
const ORDERS = [];
const FILLS: Fill[] = [];
const BALANCES: Balance = {}; // { userId: { INR: {total, locked}, AXIS: {total, locked}, ... } }
const ORDERBOOK: orderBook = {
  INR: { bids: {}, asks: {} },
  AXIS: { bids: {}, asks: {} },
  HDFC: { bids: {}, asks: {} },
  TATA: { bids: {}, asks: {} },
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
  const userId = crypto.randomUUID();
  USERS.push({
    id: userId,
    username,
    password: hashedPassword,
  });

  // 4. init BALANCES[userId] with INR: { total: 0, locked: 0 }
  BALANCES[userId] = { INR: { total: 0, locked: 0 } };

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
  // symbol = INR/AXIS
  // { userId, side: "BUY"|"SELL", type: "LIMIT"|"MARKET", symbol, price?, qty } from body and user

  // 1. validate input + stock exists
  const { data, success, error } = orderInput.safeParse(req.body);

  if (!success) {
    console.log("zod error ", error);
    res.status(403).json({ message: "invalid inputs" });
    return;
  }

  const { 
    qty, 
    side, 
    symbol, 
    // type, 
    userId, 
    price 
  } = data;

  const stock = symbol.split("/")[1] as BalanceKey;

  
  // 2. check + lock balance (INR for BUY, stock for SELL)
  if (side === "BUY") {
    // is the user have enough INR
    const userBalance = BALANCES[userId]?.INR.total - BALANCES[userId]?.INR.locked

    if (userBalance < price * qty) {
      res.status(403).json({ message: "insuffecient balance" });
      return;
    }
    
    BALANCES[userId]?.INR.locked += price * qty;
  }
  
  if (side === "SELL") {
    const userBalance = BALANCES[userId][stock].total - BALANCES[userId][stock].locked
    
    if (userBalance < qty) {
      res.status(403).json({ message: "insuffecient balance" });
      return;
    }
    
    BALANCES[userId][stock].locked += qty;
  }

  // 3. run matching engine against opposite side of ORDERBOOK
  if (side === "BUY") {
    let value: number = 0; // value in asks
    const asks = ORDERBOOK[stock].asks;
    const condition1 = Object.keys(asks).find((key) => price === Number(key));
    const condition2 = Object.keys(asks)
      .sort((a, b) => Number(a) - Number(b))
      .find((key) => Number(key) < price);
      
    if (condition1 || condition2) {
      if (condition1) {
        value = Number(condition1)
      } else if (condition2) {
        value = Number(condition2)
      }

      const asks = ORDERBOOK[stock].asks[value];
      const orderId = crypto.randomUUID();

      if (asks?.totalQuantity >= qty) {
        asks?.totalQuantity -= qty;

        if (asks?.totalQuantity === 0) {
          delete asks
        } else {
          asks?.orders.push({
            createdAt: new Date(),
            filledQty: qty,
            orderId,
            qty,
            userId
          })
        }


      } else if (asks?.totalQuantity <= qty) {
        // jitna hai utna do
        const filledQty = qty - asks?.totalQuantity;
        const leftQty = qty - filledQty;
        asks?.totalQuantity = 0
        
        asks?.orders.push({
          createdAt: new Date(),
          filledQty,
          orderId,
          qty,
          userId
        })
        
        // bids mein push kro
        ORDERBOOK[stock].bids[value] = { orders: [], totalQuantity: leftQty };
      }
    } else {
      // push in the orderbook
      ORDERBOOK[stock].bids[price] = {
        orders: [],
        totalQuantity: qty
      }
    }
  }

  if (side === "SELL") {
    const userStockBln = BALANCES[userId][stock].total - BALANCES[userId][stock].locked;
    
    if (userStockBln < qty) {
      res.status(403).json({ message: "insuffescient balance" })
      return;
    }

    const bids = ORDERBOOK[stock].bids;
    const condition1 = Object.keys(bids).find((key) => price === Number(key));
    const condition2 = Object.keys(bids)
      .sort((a, b) => Number(b) - Number(a))
      .find((key) => Number(key) > price);

    let value: number = 0
      
    if (condition1) {
      value = Number(condition1)
    } else if (condition2) {
      value = Number(condition2)
    }

    const finalBids = ORDERBOOK[stock].bids[value];
    const orderId = crypto.randomUUID();

    if (finalBids?.totalQuantity >= qty) {
      finalBids?.totalQuantity -= qty

      if (finalBids?.totalQuantity === 0) {
        delete finalBids
      } else {
        finalBids?.orders.push({
          createdAt: new Date(),
          filledQty: qty,
          orderId,
          qty,
          userId,
        })
      }
    } else if (finalBids?.totalQuantity <= qty) {
        // jitna hai utna do
        
        const filledQty = qty - finalBids?.totalQuantity;
        const leftQty = qty - filledQty;
        finalBids?.totalQuantity = 0
        
        finalBids?.orders.push({
          createdAt: new Date(),
          filledQty,
          orderId,
          qty,
          userId
        })
        // bids mein push kro
        ORDERBOOK[stock].asks[value] = { orders: [], totalQuantity: leftQty };
      }
  }

  // 4. write fills to FILLS, update filledQty + status on ORDERS
  // 5. if leftover qty and LIMIT, rest on book; if MARKET, cancel remainder
  // 6. settle balances on each fill (move locked -> other asset's available)
});

app.delete("/order/:orderId", (req, res) => {
  // 1. find order, check ownership
  // 2. remove from ORDERBOOK price level
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
