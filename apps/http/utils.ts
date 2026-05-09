import type { BalanceKey, OrderBook } from "./types";
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
    orders: [],
    totalQuantity: leftQty,
  };
}

export function compareUserQtyWithPriceQty(userQty: number, priceQty: number) {
  return priceQty > userQty;
}
