const bids: Record<number, any> = {
  3980: {},
  3970: {},
  3960: {},
  3950: {},
};

const price = "3958";

if (Object.keys(bids).find((key) => price === key)) {
  console.log("same ", Object.keys(bids).find((key) => price === key))
} else if (Object.keys(bids).find((key) => key > price)) {
  console.log("this is it ", Object.keys(bids)
    .sort((a, b) => Number(b) - Number(a)) 
    .find((key) => key > price))
} else {
  // push in the orderbook
}

// for (let [key, val] of Object.entries(bids)) {
//   console.log(key)
// }

