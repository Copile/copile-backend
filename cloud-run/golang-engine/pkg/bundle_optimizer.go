package pkg

import (
	"context"
	"fmt"
	"math/big"
	"sort"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
)

type BundleOptimizer struct {
	config         *EngineConfig
	marketMonitor  *MarketMonitor
	recentBundles  *CircularBuffer
	metrics        *BundleMetrics
	mu             sync.RWMutex
}

type Bundle struct {
	Transactions    []*Transaction
	TotalValue      *big.Int
	EstimatedProfit *big.Int
	GasUsed         uint64
	Priority        int
	Deadline        uint64
}

type BundleMetrics struct {
	OptimizationLatency  *prometheus.Histogram
	BundleSize          *prometheus.Histogram
	ProfitPerGas        *prometheus.Histogram
	RejectionRate       *prometheus.Counter
}

func NewBundleOptimizer(config *EngineConfig) *BundleOptimizer {
	return &BundleOptimizer{
		config:        config,
		recentBundles: NewCircularBuffer(1000),
		metrics:       newBundleMetrics(),
	}
}

func (bo *BundleOptimizer) OptimizeTransaction(ctx context.Context, tx *Transaction) (*Transaction, error) {
	start := time.Now()
	defer bo.metrics.OptimizationLatency.Observe(time.Since(start).Seconds())

	// Clone the transaction for optimization
	optimizedTx := tx.Clone()

	// Optimize gas settings
	if err := bo.optimizeGas(ctx, optimizedTx); err != nil {
		return nil, fmt.Errorf("failed to optimize gas: %v", err)
	}

	// Optimize transaction timing
	if err := bo.optimizeTiming(ctx, optimizedTx); err != nil {
		return nil, fmt.Errorf("failed to optimize timing: %v", err)
	}

	// Optimize transaction value (for MEV opportunities)
	if err := bo.optimizeValue(ctx, optimizedTx); err != nil {
		return nil, fmt.Errorf("failed to optimize value: %v", err)
	}

	return optimizedTx, nil
}

func (bo *BundleOptimizer) BuildBundle(tx *Transaction) *Bundle {
	bo.mu.Lock()
	defer bo.mu.Unlock()

	bundle := &Bundle{
		Transactions:    []*Transaction{tx},
		TotalValue:      new(big.Int).Set(tx.EstimatedProfit),
		EstimatedProfit: new(big.Int).Set(tx.EstimatedProfit),
		GasUsed:         tx.GasPrice,
		Priority:        tx.Priority,
		Deadline:        bo.calculateDeadline(tx),
	}

	// Try to add complementary transactions
	bo.addComplementaryTransactions(bundle)

	// Sort transactions by priority
	bo.sortBundleTransactions(bundle)

	// Record metrics
	bo.recordBundleMetrics(bundle)

	return bundle
}

func (bo *BundleOptimizer) optimizeGas(ctx context.Context, tx *Transaction) error {
	// Get current network conditions
	networkStats, err := bo.getNetworkStats(ctx)
	if err != nil {
		return fmt.Errorf("failed to get network stats: %v", err)
	}

	// Calculate optimal gas price based on:
	// 1. Network congestion
	// 2. Transaction priority
	// 3. MEV opportunity value
	// 4. Historical success rates
	optimalGas := bo.calculateOptimalGas(tx, networkStats)
	
	// Ensure gas price meets minimum requirements
	if optimalGas < networkStats.MinGasPrice {
		optimalGas = networkStats.MinGasPrice
	}

	tx.GasPrice = optimalGas
	return nil
}

func (bo *BundleOptimizer) optimizeTiming(ctx context.Context, tx *Transaction) error {
	// Get current block height and leader schedule
	currentBlock, err := bo.getCurrentBlockHeight(ctx)
	if err != nil {
		return err
	}

	// Calculate optimal submission timing based on:
	// 1. Leader schedule
	// 2. Network congestion
	// 3. MEV opportunity type
	// 4. Historical success patterns
	deadline := bo.calculateOptimalDeadline(tx, currentBlock)
	
	if deadline <= currentBlock {
		return fmt.Errorf("calculated deadline is in the past")
	}

	tx.Deadline = deadline
	return nil
}

func (bo *BundleOptimizer) optimizeValue(ctx context.Context, tx *Transaction) error {
	if tx.MEVType == MEVTypeNone {
		return nil
	}

	// Calculate optimal value based on MEV type
	switch tx.MEVType {
	case MEVTypeSandwich:
		return bo.optimizeSandwichValue(ctx, tx)
	case MEVTypeArbitrage:
		return bo.optimizeArbitrageValue(ctx, tx)
	case MEVTypeLiquidation:
		return bo.optimizeLiquidationValue(ctx, tx)
	default:
		return fmt.Errorf("unknown MEV type: %v", tx.MEVType)
	}
}

func (bo *BundleOptimizer) addComplementaryTransactions(bundle *Bundle) {
	// Find transactions that could increase bundle value
	// Examples:
	// - Backrun opportunities
	// - Arbitrage opportunities
	// - Liquidation opportunities
	candidates := bo.findComplementaryTransactions(bundle)

	// Add candidates that improve bundle value while respecting constraints
	for _, candidate := range candidates {
		if bo.shouldAddToBundle(bundle, candidate) {
			bundle.Transactions = append(bundle.Transactions, candidate)
			bundle.TotalValue.Add(bundle.TotalValue, candidate.EstimatedProfit)
			bundle.GasUsed += candidate.GasPrice
		}
	}
}

func (bo *BundleOptimizer) sortBundleTransactions(bundle *Bundle) {
	sort.Slice(bundle.Transactions, func(i, j int) bool {
		// Sort by:
		// 1. Priority (higher first)
		// 2. Profit per gas (higher first)
		// 3. Timestamp (earlier first)
		if bundle.Transactions[i].Priority != bundle.Transactions[j].Priority {
			return bundle.Transactions[i].Priority > bundle.Transactions[j].Priority
		}

		profitPerGasI := new(big.Float).Quo(
			new(big.Float).SetInt(bundle.Transactions[i].EstimatedProfit),
			new(big.Float).SetUint64(bundle.Transactions[i].GasPrice),
		)
		profitPerGasJ := new(big.Float).Quo(
			new(big.Float).SetInt(bundle.Transactions[j].EstimatedProfit),
			new(big.Float).SetUint64(bundle.Transactions[j].GasPrice),
		)

		if profitPerGasI.Cmp(profitPerGasJ) != 0 {
			return profitPerGasI.Cmp(profitPerGasJ) > 0
		}

		return bundle.Transactions[i].Timestamp.Before(bundle.Transactions[j].Timestamp)
	})
}

func (bo *BundleOptimizer) calculateDeadline(tx *Transaction) uint64 {
	// Base deadline from config
	deadline := bo.config.BlockDeadline

	// Adjust based on MEV type
	switch tx.MEVType {
	case MEVTypeSandwich:
		// Sandwich attacks need tighter deadlines
		deadline = deadline / 2
	case MEVTypeArbitrage:
		// Arbitrage opportunities might need quick execution
		deadline = deadline / 3
	case MEVTypeLiquidation:
		// Liquidations are often time-sensitive
		deadline = deadline / 4
	}

	return deadline
}

func (bo *BundleOptimizer) shouldAddToBundle(bundle *Bundle, tx *Transaction) bool {
	// Check bundle size limit
	if len(bundle.Transactions) >= bo.config.MaxBundleSize {
		return false
	}

	// Check gas limit
	if bundle.GasUsed+tx.GasPrice > bo.getMaxBundleGas() {
		return false
	}

	// Check for conflicts
	if bo.hasConflicts(bundle, tx) {
		return false
	}

	// Ensure profitability
	return bo.isProfileable(bundle, tx)
}

func (bo *BundleOptimizer) recordBundleMetrics(bundle *Bundle) {
	bo.metrics.BundleSize.Observe(float64(len(bundle.Transactions)))
	
	profitPerGas := new(big.Float).Quo(
		new(big.Float).SetInt(bundle.EstimatedProfit),
		new(big.Float).SetUint64(bundle.GasUsed),
	)
	
	if profit, _ := profitPerGas.Float64(); profit > 0 {
		bo.metrics.ProfitPerGas.Observe(profit)
	}
}

func newBundleMetrics() *BundleMetrics {
	return &BundleMetrics{
		OptimizationLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "bundle_optimization_latency_seconds",
			Help:    "Time taken to optimize transactions",
			Buckets: prometheus.ExponentialBuckets(0.001, 2, 10),
		}),
		BundleSize: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "bundle_size_transactions",
			Help:    "Number of transactions per bundle",
			Buckets: []float64{1, 2, 3, 4, 5, 10, 15, 20},
		}),
		ProfitPerGas: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "bundle_profit_per_gas",
			Help:    "Profit per gas unit for bundles",
			Buckets: prometheus.ExponentialBuckets(0.00001, 2, 15),
		}),
		RejectionRate: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "bundle_rejection_total",
			Help: "Total number of rejected bundles",
		}),
	}
} 