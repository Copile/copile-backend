const { Decimal } = require('decimal.js');

async function rearrangeTps(quantity, precision, tpAmounts, minQty) {
  
  Decimal.set({ precision: precision + 5 }); // Set precision to avoid rounding errors

  const roundedQuantity = new Decimal(quantity);
  const minQuantity = new Decimal(minQty);

  let tpsAmount = tpAmounts.map(tp => new Decimal(tp));
  const tpsSum = tpsAmount.reduce((sum, current) => sum.plus(current), new Decimal(0));

  let tpsRatio = tpsAmount.map(tp => tp.div(tpsSum));
  let tpsRounded = tpsRatio.map(ratio => (roundedQuantity.times(ratio)).toFixed(precision, Decimal.ROUND_DOWN));

  // Adjust values if any tpsRounded value is smaller than minQuantity
  tpsRounded = tpsRounded.map(tp => new Decimal(tp).lt(minQuantity) ? minQuantity : new Decimal(tp));

  let tpsSumRounded = tpsRounded.reduce((sum, current) => sum.plus(current), new Decimal(0));

  // Adjust total quantity if necessary
  if (tpsSumRounded.gt(roundedQuantity)) {
    let excess = tpsSumRounded.minus(roundedQuantity);

    for (let i = tpsRounded.length - 1; i >= 0; i--) {
      if (tpsRounded[i].gte(excess)) {
        tpsRounded[i] = tpsRounded[i].minus(excess);
        break;
      } else {
        excess = excess.minus(tpsRounded[i]);
        tpsRounded[i] = new Decimal(0);
      }
    }
  } else if (tpsSumRounded.lt(roundedQuantity)) {
    let deficit = roundedQuantity.minus(tpsSumRounded);

    for (let i = tpsRounded.length - 1; i >= 0; i--) {
      if (tpsRounded[i].gt(0)) {
        tpsRounded[i] = tpsRounded[i].plus(deficit);
        break;
      }
    }
  }

  return tpsRounded.map(val => Number(val.toString()));
}

module.exports = rearrangeTps;
