async def get_position_status(position_id, terminal_state):
    open_positions = terminal_state.positions

    position_status = False

    for position in open_positions:
        if position['id'] == position_id:
            position_status = True

    return position_status
