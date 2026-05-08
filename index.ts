const asks: Record<number, any> = {
  3950: {},
  3960: {},
  3970: {},
  3980: {},
};

const price = "3955";

if (Object.keys(asks).find((key) => price === key)) {
  console.log("exact ", Object.keys(asks).find((key) => price === key));
} else if (Object.keys(asks).find((key) => key < price)) {
  console.log("less than ", Object.keys(asks).find((key) => key < price));
} else {
  // push in the orderbook
}

