async def distribute_percentages(orders):
    # Extract the tp_percentage for each order
    tps = [order["tp_percentage"] for order in orders]
    n = len(tps)

    total = sum(tps)

    # Calculate the missing percentage that we need to distribute
    missing = 1.0 - total

    # If we're already at 100%, just return the orders as they are
    if missing == 0:
        return orders

    # Distribute the missing percentage equally
    distributed_value = missing / n
    tps = [tp + distributed_value for tp in tps]

    # Convert to integers (i.e., percentage without decimals)
    int_tps = [int(tp * 100) for tp in tps]

    # Calculate how much we still need to add after rounding
    remainder = 100 - sum(int_tps)

    # Sort TPs by their distance to the next integer value
    # So that we add the remainder to the largest decimal parts
    sorted_indices = sorted(range(n), key=lambda i: (tps[i] * 100) - int_tps[i], reverse=True)

    # Add the remainder to the TPs with the largest decimal parts
    for i in range(remainder):
        int_tps[sorted_indices[i]] += 1

    # Update the original orders with the modified tp_percentages
    for i, order in enumerate(orders):
        order["tp_percentage"] = int_tps[i]

    return orders