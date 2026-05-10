import type { Balance, BalanceKey, Fill, Order, OrderBook } from "./types";
import type { Response } from "express";

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
  balanceKey: BalanceKey,
  type: "asks" | "bids",
) {
  const data = orderbook[balanceKey][type];
  const stringifiedPrice = String(price);
  let key: number = 0;

  if (Object.keys(data).find((key) => stringifiedPrice === key)) {
    key = Number(Object.keys(data).find((key) => stringifiedPrice === key));
    return data[key];
  }

  if (type === "asks") {
    if (Object.keys(data).find((key) => key < stringifiedPrice)) {
      key = Number(Object.keys(data).find((key) => key < stringifiedPrice));
      return data[key];
    }
  }

  if (type === "bids") {
    if (
      Object.keys(data)
        .sort((a, b) => Number(b) - Number(a))
        .find((key) => key > stringifiedPrice)
    ) {
      key = Number(
        Object.keys(data)
          .sort((a, b) => Number(b) - Number(a))
          .find((key) => key > stringifiedPrice),
      );

      return data[key];
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
  balanceKey: BalanceKey,
  leftQty: number,
) {
  orderbook[balanceKey][type][price] = {
    totalQuantity: leftQty,
  };
}

export function compareUserQtyWithPriceQty(userQty: number, priceQty: number) {
  return priceQty > userQty;
}

export function order({
  ioc,
  priceQty,
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
  priceQty: number;
  ioc: boolean;
  res: Response;
  type: "LIMIT" | "MARKET";
  side: "BUY" | "SELL";
  orderBook: OrderBook;
  balances: Balance;
  orders: Order[];
  fills: Fill[];
}) {
  const orderId = crypto.randomUUID();

  const isPriceQtyHigh = compareUserQtyWithPriceQty(userQty, priceQty);

  if (!isPriceQtyHigh && ioc) {
    rejectOrder(res);
    return;
  }

  if (!isPriceQtyHigh && type === "MARKET") {
    const filledQty = userQty - priceQty;
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

    delete orderBook[side === "BUY" ? "INR" : "AXIS"][
      side === "BUY" ? "asks" : "bids"
    ][userPrice];

    const userBalance = balances.get(userId)!;

    balances.set(userId, {
      ...userBalance,
      AXIS: {
        locked: userBalance.AXIS.locked + priceOfLeftQty,
        total: userBalance.AXIS.total,
      },
    });
    rejectOrder(res);
    return;
  }

  if (!isPriceQtyHigh && type === "LIMIT") {
    const filledQty = userQty - priceQty;
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

    delete orderBook[side === "BUY" ? "INR" : "AXIS"][
      side === "BUY" ? "asks" : "bids"
    ][userPrice];

    order({
      balances,
      fills,
      ioc,
      orderBook,
      orders,
      priceQty: leftQty,
      res,
      side,
      type,
      userId,
      userPrice,
      userQty,
    });
  }

  if (isPriceQtyHigh) {
    const order =
      orderBook[side === "BUY" ? "INR" : "AXIS"][
        side === "BUY" ? "asks" : "bids"
      ][userPrice];

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

    orderBook[side === "BUY" ? "INR" : "AXIS"][
      side === "BUY" ? "asks" : "bids"
    ][userPrice] = {
      totalQuantity: order?.totalQuantity! - userQty,
    };

    if (
      orderBook[side === "BUY" ? "INR" : "AXIS"][
        side === "BUY" ? "asks" : "bids"
      ][userPrice]?.totalQuantity === 0
    ) {
      delete orderBook[side === "BUY" ? "INR" : "AXIS"][
        side === "BUY" ? "asks" : "bids"
      ][userPrice];
    }
  }

  orderBook["AXIS"].lastTradedPrice = userPrice;
}
