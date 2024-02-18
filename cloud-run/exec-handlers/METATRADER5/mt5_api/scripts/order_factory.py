class Order:
    def __init__(self, action, symbol, lot, order_type, price, stoplimit, sl, tp, deviation, magic, expiration, type_time, type_filling, position_ticket, position_by):
        self.action = action
        self.symbol = symbol
        self.volume = float(lot) if lot != None else None
        self.type = order_type
        self.price = float(price) if price != None else None
        self.stoplimit = float(stoplimit) if stoplimit != None else None
        self.sl = float(sl) if sl != None else None
        self.tp = float(tp) if tp != None else None
        self.deviation = deviation
        self.magic = int(magic) if magic != None else None
        self.expiration = expiration
        self.comment = "Copile Execution"
        self.type_time = type_time
        self.type_filling = type_filling
        self.position = position_ticket if position_ticket != None else None
        self.position_by = position_by if position_by != None else None

    def remove_none_attributes(self):
        to_delete = [key for key, value in self.__dict__.items() if value is None]
        for key in to_delete:
            delattr(self, key)
