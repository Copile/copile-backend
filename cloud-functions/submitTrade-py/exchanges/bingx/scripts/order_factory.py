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

    def remove_none_attributes(self):
        to_delete = [key for key, value in self.__dict__.items() if value is None]
        for key in to_delete:
            delattr(self, key)
