import discord
from backend.sender.Sender.sender import start, send_cancel
import _thread
import re
import csv

TOKEN = "OTA3NjMyNDczMDEyMzI2NDIw.YYqAnA.c6CUekwpdHg_3FxM9fA-lANXnsA"
sourceChannelid = "584759119487959046"
Stop_loss = 0.5

client = discord.Client()
guild = discord.guild


def kenny():
    print(f"Monitoring Channel: {sourceChannelid}")

    @client.event
    async def on_message(message):
        if message.channel.id == 584759119487959046:
            if message.author.bot:
                embeds = message.embeds
                for embed in embeds:
                    text = embed.to_dict()
                    call = text['description']
                    if "SHORT" in call:
                        print("Found!")
                        starts = call.find('🥇**Ticker** :  ') + 15
                        end = call.find(' SHORT')
                        start2 = call.find('**Entry** :  ') + 12
                        end2 = call.find('**Leverage**') - 2
                        symbol = (call[starts:end]).strip() + "USDT"
                        entry = (call[start2:end2]).strip()
                        price = float(entry.replace(",", ""))
                        try:
                            leverage = int(re.findall(r"[0-9.]+x", call)[1].replace("x", ""))
                        except Exception as error:
                            leverage = int(re.findall(r"[0-9.]+X", call)[0].replace("X", ""))
                        print(leverage)
                        side = "SELL"
                        print("SHORT", side, symbol, leverage, price)
                        _thread.start_new_thread(start, (side, symbol, leverage, price))
                    elif "LONG" in call:
                        print("Found!")
                        starts = call.find('🥇**Ticker** :  ') + 15
                        end = call.find(' LONG')
                        start2 = call.find('**Entry** :  ') + 12
                        end2 = call.find('**Leverage**') - 2
                        symbol = (call[starts:end]).strip() + "USDT"
                        entry = (call[start2:end2]).strip()
                        price = float(entry.replace(",", ""))
                        try:
                            leverage = re.findall(r"[0-9.]+x", call)[1].replace("x", "")
                        except Exception as error:
                            leverage = re.findall(r"[0-9.]+X", call)[0].replace("X", "")
                        side = "BUY"
                        print("LONG", side, symbol, leverage, price)
                        _thread.start_new_thread(start, (side, symbol, leverage, price))

    client.run(TOKEN)


kenny()
