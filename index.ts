const asks: Record<number, any> = {
  3950: {},
  3960: {},
  3970: {},
  3980: {},
};

const price = "3952";
console.log(Object.keys(asks).find((key) => price === key))

if (Object.keys(asks).find((key) => price === key)) {

} else if (Object.keys(asks).find((key) => key < price)) {

} else {
  // push in the orderbook
}

