class Order:
    def __init__(self, symbol, order_type, side, price, quantity, stop_price,
                 reduce_only):
        self.symbol = symbol
        self.type = order_type
        self.side = side
        self.price = float(price) if price is not None else None
        self.quantity = float(quantity) if quantity is not None else None
        self.stopPrice = float(stop_price) if stop_price is not None else None
        self.reduceOnly = reduce_only

    def remove_none_attributes(self):
        to_delete = [key for key, value in self.__dict__.items() if value is None]
        for key in to_delete:
            delattr(self, key)
