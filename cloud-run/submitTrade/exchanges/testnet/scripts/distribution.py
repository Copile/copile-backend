from utils.shuffle import rearrange_tps

def calculate_tp_amounts(take_profits, quantity, precision):
    # Extracting tp_percentage from each take-profit data
    tps_percentage = [tp_data['tp_percentage'] for tp_data in take_profits]

    # Calculating amounts for each take-profit
    tps_amount = [quantity * tp for tp in tps_percentage]

    # Rearrange the take-profit amounts based on precision
    tp_amounts = rearrange_tps(quantity, precision['quantity_precision'], tps_amount, precision['min_qty'])

    new_take_profits = []
    total_amount = sum(tp_amounts)

    # Creating new take-profit data structure
    for index, tp_data in enumerate(take_profits):
        if tp_amounts[index] > 0:
            tp_id = tp_data.get('document_id', tp_data.get('tp_id'))
            tp_number = tp_data['tp_number']
            tp_value = tp_data['tp_value']
            tp_percentage = round((tp_amounts[index] / total_amount) * 100, 2)

            new_take_profit = {
                'tp_id': tp_id,
                'tp_number': tp_number,
                'tp_value': tp_value,
                'tp_percentage': tp_percentage,
                'tp_amount': tp_amounts[index]
            }

            new_take_profits.append(new_take_profit)

    return new_take_profits