from decimal import Decimal, getcontext

async def rearrange_tps(quantity, precision, tps_amount, min_qty):
    
    getcontext().prec = precision + 5  # set precision to avoid rounding errors

    rounded_quantity = Decimal(str(quantity))
    min_qty = Decimal(str(min_qty))

    tps_amount = [Decimal(str(tp)) for tp in tps_amount]
    tps_sum = sum(tps_amount)

    tps_ratio = [tp / tps_sum for tp in tps_amount]
    tps_rounded = [(rounded_quantity * ratio).quantize(Decimal('1e-{0}'.format(precision))) for ratio in tps_ratio]

    # Adjust values if any tps_rounded value is smaller than min_qty
    for i in range(len(tps_rounded)):
        if tps_rounded[i] < min_qty:
            tps_rounded[i] = min_qty

    tps_sum_rounded = sum(tps_rounded)

    # Adjust total quantity if necessary
    if tps_sum_rounded > rounded_quantity:
        excess = tps_sum_rounded - rounded_quantity

        # Find the indices of the last values in tps_rounded
        last_indices = [i for i in range(len(tps_rounded) - 1, -1, -1)]

        # Iterate over the last indices in reverse order
        for index in last_indices:
            if tps_rounded[index] >= excess:
                tps_rounded[index] -= excess
                break
            else:
                excess -= tps_rounded[index]
                tps_rounded[index] = Decimal('0')

    elif tps_sum_rounded < rounded_quantity:
        deficit = rounded_quantity - tps_sum_rounded

        # Find the indices of the last values in tps_rounded
        last_indices = [i for i in range(len(tps_rounded) - 1, -1, -1)]

        # Iterate over the last indices in reverse order
        for index in last_indices:
            if tps_rounded[index] > 0:
                tps_rounded[index] += deficit
                break

    return [float(val) for val in tps_rounded]