import type { Balance, Fill, Order, OrderBook, OrderBookKey } from "./types";
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
  const keys = Object.keys(data);

  if (keys.find((key) => stringifiedPrice === key)) {
    key = Number(keys.find((key) => stringifiedPrice === key));

    return { keyPrice: key, qty: data[key]!.totalQuantity };
  }

  if (type === "asks") {
    if (keys.find((key) => key < stringifiedPrice)) {
      key = Number(keys.find((key) => key < stringifiedPrice));

      return { keyPrice: key, qty: data[key]!.totalQuantity };
    }
  }

  if (type === "bids") {
    if (
      keys
        .sort((a, b) => Number(b) - Number(a))
        .find((key) => key > stringifiedPrice)
    ) {
      key = Number(
        keys
          .sort((a, b) => Number(b) - Number(a))
          .find((key) => key > stringifiedPrice),
      );

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
  
  /**
   * 1. adding user's order in orderBook
   * &&
   * 2. deducting the quantiy of that price
   */
  const orderQty = orderbook[balanceKey][type][price]?.totalQuantity || 0;
  orderbook[balanceKey][type][price] = {
    totalQuantity: orderQty + leftQty,
  };

  // 3. locking the users amount or stock
  // in index.ts, on line 212 
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
  total,
}: {
  userId: string;
  userQty: number;
  userPrice: number;
  total: number;
  ioc: boolean;
  res: Response;
  type: "LIMIT" | "MARKET";
  side: "BUY" | "SELL";
  orderBook: OrderBook;
  balances: Balance;
  orders: Order[];
  fills: Fill[];
}) {

  if (type === "LIMIT" && side === "BUY" && ioc) {
    /**
     * 1. check available price on the ASKS side
     * 2. compare the quantity of the available price with user's asks
     * 3. if quantity is less => cancel the order
     * 4. if quantity is more
     *  - compare stock price with the user price
     *    - if stock price is less than user price
     *      - calculate tbe different b/w them and multiply with total qty and refund to the usr
     *  - create users order with all the quantity
     *  - create fills for all the users involved
     *  - delete the filled qty from the price
     *  - if quantity becomes zero then delete the price from the orderbook
    */
  }
  if (type === "LIMIT" && side === "BUY" && !ioc) {
    /**
     * 1. check available price on the ASKS side
     * 2. compare the quantity of the available price with user's asks
     * 3. if quantity is less/more => same thing from line 123
     * 4. re-run the process with the left-qty
     */
  }
  
  if (type === "LIMIT" && side === "SELL" && ioc) {
    /**
     * 1. check available price on the BIDS side
     * 2. compare the quantity of the available price with user's asks
     * 3. if quantity is less => cancel the order
     * 4. if quantity is more
     *  - compare stock price with the user price
     *    - if stock price is more than user price
     *      - calculate the  different b/w them and multiply with total qty and add to the user profit
     *  - create users order with all the quantity
     *  - create fills for all the users involved
     *  - delete the filled qty from the price
     *  - if quantity becomes zero then delete the price from the orderbook
    */
  }
  if (type === "LIMIT" && side === "SELL" && !ioc) {
    /**
     * 1. check available price on the BIDS side
     * 2. compare the quantity of the available price with user's asks
     * 3. if quantity is less/more => same thing from line 147
     * 4. re-run the process with the left-qty
     */

  }
  
  
  if (type === "MARKET" && side === "BUY" && ioc) {}
  if (type === "MARKET" && side === "SELL" && ioc) {}
  
  
  
  
  let totalSpend = total;

  /**
   * checking for available price on the orderbook
   * like:
   * 
   * side: "BUY"
   * userPrice: 230 
   * we will check on the ASKS side for the same price or less
   * 
   * and if side: "SELL"
   * we will check on the BIDS side for the same price or more 
   */
  const availablePrice = checkAvailablePriceInOrderBook(
    orderBook,
    userPrice,
    "AXIS",
    side === "BUY" ? "asks" : "bids",
  );

  console.log("availablePrice ", availablePrice);

  const orderId = crypto.randomUUID();

  // if price not available and IOC (Immediate Or Cancel) is true then cancelling the order
  if (!availablePrice && ioc) {
    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userQty,
      userId,
      price: userPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });
    return null;
  }

  if (!availablePrice && type === "MARKET") {
    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userQty,
      userId,
      price: userPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });
    return null;
  }

  if (!availablePrice && type === "LIMIT") {
    /**
     * following things should happen
     * 
     * 1. adding user's order in orderBook
     * 2. deducting the quantiy of that price
     * 3. locking the users amount or stock
     */
    addNewAsksOrBidsInOrderBook(
      side === "SELL" ? "asks" : "bids",
      userPrice,
      orderBook,
      "AXIS",
      userQty,
    );
    return true;
  }

  const { keyPrice, qty } = availablePrice!;

  /**
   * TODO: it should be different for type: "BUY" | "SELL"
   * or 
   * TODO: go through rest of the code which are using this 
   */
  const isPriceQtyHigh = compareUserQtyWithPriceQty(userQty, qty!);

  console.log("isPriceQtyHigh ", isPriceQtyHigh);

  if (!isPriceQtyHigh && ioc) {
    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userQty,
      userId,
      price: userPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });
    
    return null;
  }

  if (!isPriceQtyHigh && side === "SELL" && !ioc) {
    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: 0,
      qty: userQty,
      userId,
      price: userPrice,
      market: "AXIS",
      side,
      status: "CANCELLED",
      type,
    });

    return null;
  }

  if (!isPriceQtyHigh && side === "BUY" && !ioc) {
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
    const leftQty = userQty - qty!;

    console.log("qty ", qty);
    console.log("leftQty ", leftQty);
    
    orders.push({
      id: orderId,
      createdAt: new Date(),
      filledQty: qty,
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

    totalSpend += userQty * keyPrice;

    if (leftQty !== 0) {
      order({
        balances,
        fills,
        ioc,
        orderBook,
        orders,
        res,
        side,
        type,
        total: totalSpend,
        userId,
        userPrice,
        userQty: leftQty,
      });
    }

    orderBook["AXIS"].lastTradedPrice = userPrice;

    fs.writeFileSync("orderbook.txt", JSON.stringify(orderBook));

    return {
      orderId,
      filledQty: userQty,
      totalPrice: totalSpend,
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

    totalSpend += userQty * keyPrice;

    return {
      orderId,
      filledQty: userQty,
      totalPrice: totalSpend,
    };
  }
}
