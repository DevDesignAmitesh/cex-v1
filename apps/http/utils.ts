import type {
  Balance,
  BalanceKey,
  Fill,
  Order,
  OrderBook,
  OrderBookKey,
} from "./types";
import type { Response } from "express";
import fs from "fs";

export function compareStockOrCurrencyBalance(
  balance: { total: number; locked: number },
  // can be stock balance or currecy balance
  compareWith: number,
) {
  const userBalance = balance.total - balance.locked;
  if (userBalance > compareWith!) return true;
  return false;
}

export function checkAvailablePriceInOrderBook(
  orderbook: OrderBook,
  price: number,
  balanceKey: OrderBookKey,
  type: "asks" | "bids",
) {
  const data = orderbook[balanceKey][type];
  const stringifiedPrice = String(price);
  let key: number = 0;
  let keyPrice = 0;
  const keys = Object.keys(data);

  console.log("keys ", keys)
  

  if (Object.keys(data).find((key) => stringifiedPrice === key)) {
    console.log(
      "1 ",
      Object.keys(data).find((key) => stringifiedPrice === key),
    );
    key = Number(Object.keys(data).find((key) => stringifiedPrice === key));

    console.log("key ", key)
    console.log("keyPrice ", keyPrice)

    return { keyPrice: key, qty: data[key]!.totalQuantity };
  }

  if (type === "asks") {
    if (Object.keys(data).find((key) => key < stringifiedPrice)) {
      console.log(
        "2 ",
        Object.keys(data).find((key) => key < stringifiedPrice),
      );
      key = Number(Object.keys(data).find((key) => key < stringifiedPrice));
      console.log("key ", key)
      console.log("keyPrice ", keyPrice)

      return { keyPrice: key, qty: data[key]!.totalQuantity };
    }

  }

  if (type === "bids") {
    if (
      Object.keys(data)
        .sort((a, b) => Number(b) - Number(a))
        .find((key) => key > stringifiedPrice)
    ) {
      console.log(
        "3 ",
        Object.keys(data)
          .sort((a, b) => Number(b) - Number(a))
          .find((key) => key > stringifiedPrice),
      );
      key = Number(
        Object.keys(data)
          .sort((a, b) => Number(b) - Number(a))
          .find((key) => key > stringifiedPrice),
      );
      console.log("key ", key)
      console.log("keyPrice ", keyPrice)


      return { keyPrice: key, qty: data[key]!.totalQuantity };
    }
  }

  return null;
}

export function rejectOrder(res: Response) {
  res.status(400).json({ message: "order cant be full filled" });
  return;
}

export function addNewAsksOrBidsInOrderBook(
  type: "asks" | "bids",
  price: number,
  orderbook: OrderBook,
  balanceKey: OrderBookKey,
  leftQty: number,
) {
  const orderQty = orderbook[balanceKey][type][price]?.totalQuantity || 0;

  orderbook[balanceKey][type][price] = {
    totalQuantity: orderQty + leftQty,
  };
}

export function compareUserQtyWithPriceQty(userQty: number, priceQty: number) {
  return priceQty > userQty;
}

export function order({
  ioc,
  res,
  type,
  userQty,
  userPrice,
  userId,
  side,
  orderBook,
  balances,
  orders,
  fills,
}: {
  userId: string;
  userQty: number;
  userPrice: number;
  ioc: boolean;
  res: Response;
  type: "LIMIT" | "MARKET";
  side: "BUY" | "SELL";
  orderBook: OrderBook;
  balances: Balance;
  orders: Order[];
  fills: Fill[];
}) {
  console.log("runninggg");

  const availablePrice = checkAvailablePriceInOrderBook(
    orderBook,
    userPrice,
    "AXIS",
    side === "BUY" ? "asks" : "bids",
  );

  console.log("availablePrice ", availablePrice);

  if (!availablePrice && ioc) {
    return null;
  }

  if (!availablePrice && type === "MARKET") {
    return null;
  }

  if (!availablePrice && type === "LIMIT") {
    addNewAsksOrBidsInOrderBook(
      side === "SELL" ? "asks" : "bids",
      userPrice,
      orderBook,
      "AXIS",
      userQty,
    );
    console.log("orderbook ", orderBook.AXIS);
    return true;
  }

  const { keyPrice, qty } = availablePrice!;

  const orderId = crypto.randomUUID();

  const isPriceQtyHigh = compareUserQtyWithPriceQty(userQty, qty!);

  console.log("isPriceQtyHigh ", isPriceQtyHigh);

  if (!isPriceQtyHigh && ioc) {
    return null;
  }

  if (!isPriceQtyHigh && type === "MARKET") {
    const filledQty = userQty - qty!;
    const leftQty = userQty - filledQty;
    const priceOfLeftQty = leftQty * userPrice;

    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty,
      qty: userQty,
      userId,
      price: userPrice,
      market: "AXIS",
      side,
      status: "FILLED",
      type,
    });

    const fillId = crypto.randomUUID();

    fills.push({
      id: fillId,
      orderId,
      userId,
      price: userPrice,
      qty: userQty,
      side,
      asset: "AXIS",
      type: "MAKER",
      createdAt: new Date(),
    });

    delete orderBook["AXIS"][side === "BUY" ? "asks" : "bids"][keyPrice];

    const userBalance = balances.get(userId)!;

    balances.set(userId, {
      ...userBalance,
      AXIS: {
        locked: userBalance.AXIS.locked + priceOfLeftQty,
        total: userBalance.AXIS.total,
      },
    });

    return null;
  }

  if (!isPriceQtyHigh && type === "LIMIT") {
    const filledQty = userQty - qty!;
    const leftQty = userQty - filledQty;

    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty,
      qty: userQty,
      userId,
      price: userPrice,
      market: "AXIS",
      side,
      status: "FILLED",
      type,
    });

    const fillId = crypto.randomUUID();

    fills.push({
      id: fillId,
      orderId,
      userId,
      price: userPrice,
      qty: userQty,
      side,
      asset: "AXIS",
      type: "MAKER",
      createdAt: new Date(),
    });

    delete orderBook["AXIS"][side === "BUY" ? "asks" : "bids"][keyPrice];

    console.log("leftQty ", leftQty);
    console.log("filledQty ", filledQty);

    if (filledQty !== 0) {
      order({
        balances,
        fills,
        ioc,
        orderBook,
        orders,
        res,
        side,
        type,
        userId,
        userPrice,
        userQty: leftQty,
      });
    }

    orderBook["AXIS"].lastTradedPrice = userPrice;

    console.log("reached hereee");

    fs.writeFileSync("orderbook.txt", JSON.stringify(orderBook));

    return {
      orderId,
      filledQty: userQty,
      totalPrice: userQty * userPrice,
    };
  }

  if (isPriceQtyHigh) {
    const order =
      orderBook["AXIS"][side === "BUY" ? "asks" : "bids"][userPrice];

    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: userQty,
      qty: userQty,
      userId,
      price: userPrice,
      market: "AXIS",
      side,
      status: "FILLED",
      type,
    });

    const fillId = crypto.randomUUID();

    fills.push({
      id: fillId,
      orderId,
      userId,
      price: userPrice,
      qty: userQty,
      side,
      asset: "AXIS",
      type: "MAKER",
      createdAt: new Date(),
    });

    orderBook["AXIS"][side === "BUY" ? "asks" : "bids"][userPrice] = {
      totalQuantity: order?.totalQuantity! - userQty,
    };

    if (
      orderBook["AXIS"][side === "BUY" ? "asks" : "bids"][userPrice]
        ?.totalQuantity === 0
    ) {
      delete orderBook["AXIS"][side === "BUY" ? "asks" : "bids"][keyPrice];
    }

    orderBook["AXIS"].lastTradedPrice = userPrice;

    return {
      orderId,
      filledQty: userQty,
      totalPrice: userQty * userPrice,
    };
  }
}
