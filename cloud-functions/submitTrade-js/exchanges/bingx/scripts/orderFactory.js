class Order {
    constructor(symbol, type, side, price, quantity, positionSide, stopPrice, clientOrderID) {
        this.symbol = symbol;
        this.type = type;
        this.side = side;
        this.price = price
        this.quantity = quantity;
        this.positionSide = positionSide;
        this.stopPrice = stopPrice;
        this.clientOrderID = clientOrderID;
    }
}

module.exports = Order;