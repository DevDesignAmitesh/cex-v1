// const bids: Record<number, any> = {
//   3980: {},
//   3970: {},
//   3960: {},
//   3950: {},
// };

// const price = "3958";

// if (Object.keys(bids).find((key) => price === key)) {
//   console.log("same ", Object.keys(bids).find((key) => price === key))
// } else if (Object.keys(bids).find((key) => key > price)) {
//   console.log("this is it ", Object.keys(bids)
//     .sort((a, b) => Number(b) - Number(a)) 
//     .find((key) => key > price))
// } else {
//   // push in the orderbook
// }

// for (let [key, val] of Object.entries(bids)) {
//   console.log(key)
// }


import type { Order } from "./types";

const ORDERS: Order[] = [
  {
    createdAt: new Date(),
    filledQty: 1,
    id: "1",
    qty: 1,
    userId: "1",
    price: 1
  },
  {
    createdAt: new Date(),
    filledQty: 1,
    id: "2",
    qty: 1,
    userId: "2",
    price: 1
  },
]

const orderId = "2";
const userId = "1";

const order = ORDERS.find((ord) => ord.id === orderId && ord.userId === userId);

console.log(order);