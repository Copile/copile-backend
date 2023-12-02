class Order:
    def __init__(self, symbol, order_type, side, price, quantity, leverage, stop, stop_price_type, stop_price,
                 reduce_only, close_on_trigger):
        self.symbol = symbol
        self.type = order_type
        self.side = side
        self.price = str(price)
        self.size = int(quantity)
        self.leverage = str(leverage)
        self.stop = stop
        self.stopPriceType = stop_price_type
        self.stopPrice = str(stop_price)
        self.reduceOnly = reduce_only
        self.closeOnTrigger = close_on_trigger

    def remove_none_attributes(self):
        to_delete = [key for key, value in self.__dict__.items() if value is None]
        for key in to_delete:
            delattr(self, key)
