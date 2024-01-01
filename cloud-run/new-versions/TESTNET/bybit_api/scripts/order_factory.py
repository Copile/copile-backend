class Order:
    def __init__(self, symbol, order_type, side, price, quantity, trigger_direction, trigger_price, trigger_by,
                 reduce_only, close_on_trigger):
        self.symbol = symbol
        self.orderType = order_type
        self.side = side
        self.price = str(price) if price is not None else None
        self.qty = str(quantity) if quantity is not None else None
        self.triggerDirection = trigger_direction
        self.triggerPrice = str(trigger_price) if trigger_price is not None else None
        self.triggerBy = trigger_by
        self.reduceOnly = reduce_only
        self.closeOnTrigger = close_on_trigger

    def remove_none_attributes(self):
        to_delete = [key for key, value in self.__dict__.items() if value is None]
        for key in to_delete:
            delattr(self, key)
