async function convertSymbol(symbol) {
    const index = symbol.indexOf("USDT");
    if (index !== -1) {
      const convertedSymbol = symbol.slice(0, index) + "-" + symbol.slice(index);
      return convertedSymbol;
    } else {
      return symbol;
    }
}

function roundToPrecision(number, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
}

module.exports = {
    convertSymbol,
    roundToPrecision
};