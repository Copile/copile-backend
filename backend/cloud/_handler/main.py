import functions_framework

@functions_framework.http
def status(request):
    """
    Returns:
     A JSON Object containing the status (default "ok"),
        and the version of the application (default "copile-backend 1.0.0")
    """
    return {
        "status": "ok",
        "version": "copile-backend 1.0.0"
    }



""" Define Events, i.e. "buy", "sell", "stoploss", "cance" """

events = {
    "buy": "./events/buy.py",
    "profit": "./events/profit.py",
    "stoploss": "./events/stoploss.py",
    "cancel": "./events/cancel.py",
}

""" Loop all events and import them """


for event in events:
    eventFile = events[event]
    modEvent = __import__(eventFile, globals(), locals(), [event], 0)
    print(event);
