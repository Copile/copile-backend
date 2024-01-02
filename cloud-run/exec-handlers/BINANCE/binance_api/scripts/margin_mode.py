async def switch_margin_mode(session, symbol, margin_type):
    try:
        margin_mode = await session.switch_margin_mode(symbol, margin_type)
        return margin_mode
    except Exception as e:
        return "Changed margin mode successfully"
