function distributePercentages(orders) {
    // Check if the orders array is empty and return if it is
    if (orders.length === 0) {
        return [];
    }
    
    // Extract the tp_percentage for each order
    const tps = orders.map(order => order.tp_percentage);
    const n = tps.length;

    const total = tps.reduce((acc, curr) => acc + curr, 0);

    // Calculate the missing percentage that we need to distribute
    const missing = 1.0 - total;

    // If we're already at 100%, just return the orders as they are
    if (missing === 0) {
        return orders;
    }

    // Distribute the missing percentage equally
    const distributedValue = missing / n;
    tps.forEach((tp, index) => {
        tps[index] = tp + distributedValue;
    });

    // Convert to integers (i.e., percentage without decimals)
    const intTps = tps.map(tp => Math.floor(tp * 100));

    // Calculate how much we still need to add after rounding
    const sumIntTps = intTps.reduce((acc, curr) => acc + curr, 0);
    let remainder = 100 - sumIntTps;

    // Sort TPs by their distance to the next integer value
    // So that we add the remainder to the largest decimal parts
    const sortedIndices = tps
        .map((tp, index) => ({ index, value: (tp * 100) - intTps[index] }))
        .sort((a, b) => b.value - a.value)
        .map(item => item.index);

    // Add the remainder to the TPs with the largest decimal parts
    for (let i = 0; i < remainder; i++) {
        intTps[sortedIndices[i]] += 1;
    }

    // Update the original orders with the modified tp_percentages
    orders.forEach((order, index) => {
        order.tp_percentage = intTps[index];
    });

    return orders;
}

module.exports = distributePercentages;