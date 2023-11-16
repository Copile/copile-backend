class Order:
    def __init__(self, symbol, type, side, price, quantity, positionSide, stopPrice, clientOrderID):
        self.symbol = symbol
        self.type = type
        self.side = side
        self.price = price
        self.quantity = quantity
        self.positionSide = positionSide
        self.stopPrice = stopPrice
        self.clientOrderID = clientOrderID