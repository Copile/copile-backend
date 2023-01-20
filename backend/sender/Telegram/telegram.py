import asyncio
from telethon import TelegramClient, events, sync
import dhooks
from dhooks import Webhook, Embed
import re
import csv
import _thread
from backend.sender.Sender.sender import start, send_cancel
from backend.monitor.add import add

api_id = 17992697
api_hash = 'b8b4bdbe6e3db8e269dc017aa612f530'
tel = TelegramClient('new_test', api_id, api_hash)

drvkich_alt_signals = 1279849171
drvkich_wolves_vip = 1298366223
drvkich_rose_vip = 1705195529

icon_url = 'https://cdn.discordapp.com/attachments/939543129806233720/941771625995583488/unknown.png'

emoji = ['⚠', '⛔', '✅', '❌']

hook = Webhook(
    "https://discord.com/api/webhooks/943509413384290335/BOeDNKwG3rhZYP3jXSBv4c_xsN9jHOQFmYFdy_5ggtYwv73D9F4wN0JzrHMLF0wQO9YM")


def call(text, coin, position, SL, TPS, entry, leverage, trader):
    arrow = '📉' if position == '#SHORT' else '📈'
    if trader == "drvkich_wolves_vip":
        all_leverage = ""
        number = -1
        for item in leverage:
            number = number + 1
            all_leverage = all_leverage + "-" + leverage[number]
    else:
        all_leverage = leverage
    embed = Embed(
        description='<@&933229693266702388>',
        color=16774932,
        timestamp='now'
    )
    embed.add_field(name='Drvkich Signals', value=f"```css\n{coin}/USDT {position} {arrow}```")
    embed.add_field(name='__**🚀 Entry**__', value=entry, inline=False)
    embed.add_field(name='__**💰 Leverage**__', value=all_leverage, inline=False)
    embed.add_field(name='__**🎯 TPs**__', value=''.join([str(item + '\n') for item in TPS]), inline=False)
    embed.add_field(name='__**🛑SL**__', value=SL, inline=False)
    embed.set_footer(text='House of Crypto', icon_url=icon_url)
    hook.send(embed=embed)


def stats(text, coin, type):
    field = "**TAKE PROFIT HIT**" if type == "profit" else "**STOP LOSS HIT**"
    embed = Embed(
        description='',
        color=16711680 if type == "loss" else 1376067,
        timestamp='now'
    )
    embed.add_field(name=field + " " + coin, value=f"```css\n{text}```")
    embed.set_footer(text='House of Crypto', icon_url=icon_url)
    hook.send(embed=embed)


def special(coin, profit, type):
    field = "**ALL TARGETS HIT!**" if type == "profit" else "**STOP LOSS HIT**"
    embed = Embed(
        description='',
        color=16711680 if type == "loss" else 1376067,
        timestamp='now'
    )
    field2 = "Profit: " + profit
    embed.add_field(name="Drvkich Signals", value=f"```css\n{coin}/USDT```")
    embed.add_field(name="__**🎯TPs HIT ✅**__", value=f"```css\n{field2}```", inline=False)
    embed.add_field(name="__**Notes**__", value="Congratulations to All Members ", inline=False)
    embed.set_footer(text='House of Crypto', icon_url=icon_url)
    hook.send(embed=embed)


def normal(text):
    embed = Embed(
        description='<@&933229693266702388>',
        color=16774932,
        timestamp='now'
    )
    embed.add_field(name='Drvkich Signals', value=text)
    hook.send(embed=embed)


def cancel(coin):
    embed = Embed(
        description='<@&933229693266702388>',
        color=16711680,
        timestamp='now'
    )
    embed.add_field(name="**CANCELLED TRADE** ❌", value=f"```css\n{coin}/USDT```")
    embed.set_footer(text='House of Crypto', icon_url=icon_url)
    hook.send(embed=embed)


def filter(new, filename):
    file1 = open(filename, 'w').close()
    file2 = open(filename, 'w')
    file2.write(new)


def mira(TPS, SL, position, leverage, coin, entry, trader):
    if trader == "drvkich_wolves_vip":
        stop_loss = SL.replace("$", "")
        print(position)
        side = 'Sell' if position == "#SHORT" else 'Buy'
        TAKE_cut = ''.join([str(item + '\n') for item in TPS])
        TP = re.findall(r"[0-9.]+[$&+,:;=?@#|'<>.^*()%!-]", TAKE_cut)
        EN = re.findall(r"[0-9.]+[$&+,:;=?@#|'<>.^*()%!-]", entry)
        price = EN[0].replace("$", "")
        leverage = leverage[0].replace("X", "")
        symbol = coin.replace("#", "") + "USDT"
        TPS = []
        for i in range(len(TP)):
            TPS.append(TP[i].replace("$", ""))
        add(coin, side)
        start(side, symbol, leverage, stop_loss, price, TPS)
    elif trader == "drvkich_alt_signals":
        print("Hello")
        stop_loss = SL.replace("$", "")
        side = 'Sell' if position == '#SHORT' else 'Buy'
        price = entry.replace("$", "")
        leverage = leverage.replace("Cross ", "").replace("x", "").replace("X", "")
        symbol = coin
        add(coin, side)
        start(side, symbol, leverage, stop_loss, price, TPS)


def telegram():
    print("Telegram Monitor ready!")

    @tel.on(events.NewMessage(chats=1389618850))
    async def my_even_handler(event):
        text = event.raw_text
        filename = "spam1.txt"
        file1 = open(filename, "r")
        read = file1.read()
        check = text.splitlines()
        importante = check[1]
        for item in emoji:
            if item in importante:
                new = importante.replace(item, "")
        if "BUY IN PARTS & HOLD" in text:
            try:
                new = text
                if new != read:
                    TPS = re.findall(r"TARGET [0-9.] : [0-9.]+[$&+,:;=?@#|'<>.^*()%!-]", text)
                    SL = (re.search(r"STOP LOSS : [0-9.]+", text).group(0) + '$').replace("STOP LOSS : ", "")
                    entry = (re.search(r"BUY : [0-9.]+[$&+,:;=?@#|'<>.^*()%!-]- [0-9.]+[$&+,:;=?@#|'<>.^*()%!-]",
                                       text).group(0)).replace("BUY : ", "")
                    coin = re.findall(r"#[A-Z]+", text)[0]
                    position = re.findall(r"#[A-Z]+", text)[1]
                    leverage = re.findall(r"[0-9]+X", text)
                    trader = "drvkich_wolves_vip"
                    call(text, coin, position, SL, TPS, entry, leverage, trader)
                    filter(new, filename)
                    mira(TPS, SL, position, leverage, coin, entry, trader)
            except Exception as error:
                print("WRONG TEXT FORMAT - ", error)
                normal(text)
                filter(new, filename)

        elif "Closed at stoploss after reaching take profit" in text:
            if new != read:
                type = "loss"
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                stats(text, coin, type)
                filter(new, filename)
                send_cancel(coin)

        elif "Profit:" in text:
            if new != read:
                type = "profit"
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                stats(text, coin, type)
                filter(new, filename)

        elif "Loss:" in text:
            if new != read:
                type = "loss"
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                stats(text, coin, type)
                filter(new, filename)

        elif "We are Best" or "WE ARE BEST" in text:
            new = text
            if new != read:
                type = "profit"
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                profit = re.search(r"\d+%", text).group(0)
                special(coin, profit, type)
                filter(new, filename)
                send_cancel(coin)

        elif "Cancelled" in text:
            if new != read:
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                cancel(coin)
                filter(new, filename)
                send_cancel(coin)

    @tel.on(events.NewMessage(chats=1648684924))
    async def my_even_handler(event):
        text = event.raw_text
        filename = "spam2.txt"
        file1 = open(filename, "r")
        read = file1.read()
        check = text.splitlines()
        importante = check[1]
        for item in emoji:
            if item in importante:
                new = importante.replace(item, "")
        if "LONG" in text or "SHORT" in text:
            try:
                new = text
                if new != read:
                    if "Entry: " in text:
                        entry = (re.search(r"Entry: [0-9.]+", text).group(0)).replace("Entry: ", "")
                    elif "Entry Below: " in text:
                        entry = (re.search(r"Entry Below: [0-9.]+", text).group(0)).replace("Entry below: ", "")
                    coin = re.search(r"\w+USDT", text).group(0)
                    TPS_filter = re.findall(r"Targets: \d.+", text)
                    TPS = re.findall(r"[0-9.]+", TPS_filter[0])
                    position = "#SHORT" if "SHORT" in text else "#LONG"
                    leverage = (re.search(r"Leverage: \w+ \d+x", text).group(0)).replace("Leverage: ", "")
                    SL = (re.search(r"SL: [0-9.]+", text).group(0) + '$').replace("SL: ", "")
                    trader = "drvkich_alt_signals"
                    call(text, coin, position, SL, TPS, entry, leverage, trader)
                    mira(TPS, SL, position, leverage, coin, entry, trader)
                    filter(new, filename)
            except Exception as error:
                print("WRONG TEXT FORMAT - ", error)
                normal(text)
                filter(new, filename)
        elif "Closed at stoploss after reaching take profit" in text:
            if new != read:
                type = "loss"
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                stats(text, coin, type)
                filter(new, filename)
                send_cancel(coin)
        elif "Profit:" in text:
            if new != read:
                type = "profit"
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                stats(text, coin, type)
                filter(new, filename)
        elif "Loss:" in text:
            if new != read:
                type = "loss"
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                stats(text, coin, type)
                filter(new, filename)
        elif "Cancelled" in text:
            if new != read:
                coin = (re.search(r"#[A-Z]+", text)).group(0)
                cancel(coin)
                filter(new, filename)
                send_cancel(coin)

    tel.start()
    tel.run_until_disconnected()


telegram()
