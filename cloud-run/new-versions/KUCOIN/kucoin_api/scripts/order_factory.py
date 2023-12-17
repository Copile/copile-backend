class Order:
    def __init__(self, symbol, order_type, side, price, quantity, leverage, stop, stop_price_type, stop_price,
                 reduce_only):
        self.symbol = symbol
        self.type = order_type
        self.side = side
        self.price = str(price) if price is not None else None
        self.size = int(quantity)
        self.leverage = str(leverage)
        self.stop = stop
        self.stopPriceType = stop_price_type
        self.stopPrice = str(stop_price) if stop_price is not None else None
        self.reduceOnly = reduce_only

    def remove_none_attributes(self):
        to_delete = [key for key, value in self.__dict__.items() if value is None]
        for key in to_delete:
            delattr(self, key)
