package pkg

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/prometheus/client_golang/prometheus"
)

type MEVDetector struct {
	config          *EngineConfig
	marketMonitor   *MarketMonitor
	recentMEV       *CircularBuffer
	metrics         *MEVMetrics
	mu              sync.RWMutex
}

type MEVMetrics struct {
	OpportunitiesDetected *prometheus.CounterVec
	ProfitDistribution    *prometheus.HistogramVec
	DetectionLatency      *prometheus.Histogram
	SuccessRate          *prometheus.GaugeVec
}

type MEVOpportunity struct {
	Type           MEVType
	SourceTx       *Transaction
	EstimatedProfit *big.Int
	Confidence     float64
	Requirements   MEVRequirements
	ExpiryTime     time.Time
}

type MEVRequirements struct {
	MinimumBalance uint64
	RequiredTokens []solana.PublicKey
	MaxLatency     time.Duration
}

func NewMEVDetector(config *EngineConfig) *MEVDetector {
	return &MEVDetector{
		config:     config,
		recentMEV:  NewCircularBuffer(1000),
		metrics:    newMEVMetrics(),
	}
}

func (md *MEVDetector) AnalyzeTransaction(ctx context.Context, tx *Transaction) (MEVType, *big.Int) {
	start := time.Now()
	defer md.metrics.DetectionLatency.Observe(time.Since(start).Seconds())

	// Check for different MEV types in parallel
	var wg sync.WaitGroup
	results := make(chan *MEVOpportunity, 3)

	wg.Add(3)
	go func() {
		defer wg.Done()
		if opp := md.analyzeSandwichOpportunity(ctx, tx); opp != nil {
			results <- opp
		}
	}()

	go func() {
		defer wg.Done()
		if opp := md.analyzeArbitrageOpportunity(ctx, tx); opp != nil {
			results <- opp
		}
	}()

	go func() {
		defer wg.Done()
		if opp := md.analyzeLiquidationOpportunity(ctx, tx); opp != nil {
			results <- opp
		}
	}()

	// Wait for all analyses to complete
	go func() {
		wg.Wait()
		close(results)
	}()

	// Find the most profitable opportunity
	var bestOpportunity *MEVOpportunity
	for opp := range results {
		if bestOpportunity == nil || 
		   opp.EstimatedProfit.Cmp(bestOpportunity.EstimatedProfit) > 0 {
			bestOpportunity = opp
		}
	}

	if bestOpportunity == nil {
		return MEVTypeNone, big.NewInt(0)
	}

	// Record metrics
	md.recordMEVOpportunity(bestOpportunity)

	return bestOpportunity.Type, bestOpportunity.EstimatedProfit
}

func (md *MEVDetector) analyzeSandwichOpportunity(ctx context.Context, tx *Transaction) *MEVOpportunity {
	// Extract swap information
	swapInfo, err := md.extractSwapInfo(tx)
	if err != nil {
		return nil
	}

	// Check if swap size is worth sandwiching
	if !md.isSwapWorthSandwiching(swapInfo) {
		return nil
	}

	// Calculate optimal sandwich parameters
	frontRun, backRun, err := md.calculateSandwichParameters(ctx, swapInfo)
	if err != nil {
		return nil
	}

	// Simulate sandwich execution
	profit, confidence := md.simulateSandwich(ctx, frontRun, tx, backRun)
	if profit.Sign() <= 0 || confidence < md.config.MonitoringConfig.SlippageThreshold {
		return nil
	}

	return &MEVOpportunity{
		Type:            MEVTypeSandwich,
		SourceTx:        tx,
		EstimatedProfit: profit,
		Confidence:      confidence,
		Requirements: MEVRequirements{
			MinimumBalance: frontRun.Amount,
			RequiredTokens: []solana.PublicKey{swapInfo.TokenIn, swapInfo.TokenOut},
			MaxLatency:     100 * time.Microsecond,
		},
		ExpiryTime: time.Now().Add(time.Second),
	}
}

func (md *MEVDetector) analyzeArbitrageOpportunity(ctx context.Context, tx *Transaction) *MEVOpportunity {
	// Find potential arbitrage paths
	paths := md.findArbitragePaths(tx)
	if len(paths) == 0 {
		return nil
	}

	var bestPath *ArbitragePath
	var maxProfit *big.Int
	var confidence float64

	// Analyze each path
	for _, path := range paths {
		profit, pathConfidence := md.simulateArbitrage(ctx, path)
		if profit.Sign() > 0 && profit.Cmp(maxProfit) > 0 {
			maxProfit = profit
			bestPath = path
			confidence = pathConfidence
		}
	}

	if maxProfit == nil || maxProfit.Sign() <= 0 {
		return nil
	}

	return &MEVOpportunity{
		Type:            MEVTypeArbitrage,
		SourceTx:        tx,
		EstimatedProfit: maxProfit,
		Confidence:      confidence,
		Requirements: MEVRequirements{
			MinimumBalance: calculateRequiredBalance(bestPath),
			RequiredTokens: getRequiredTokens(bestPath),
			MaxLatency:     200 * time.Microsecond,
		},
		ExpiryTime: time.Now().Add(2 * time.Second),
	}
}

func (md *MEVDetector) analyzeLiquidationOpportunity(ctx context.Context, tx *Transaction) *MEVOpportunity {
	// Check if transaction affects any liquidatable positions
	positions := md.findLiquidatablePositions(tx)
	if len(positions) == 0 {
		return nil
	}

	var bestPosition *LiquidatablePosition
	var maxProfit *big.Int
	var confidence float64

	// Analyze each position
	for _, pos := range positions {
		profit, posConfidence := md.simulateLiquidation(ctx, pos)
		if profit.Sign() > 0 && profit.Cmp(maxProfit) > 0 {
			maxProfit = profit
			bestPosition = pos
			confidence = posConfidence
		}
	}

	if maxProfit == nil || maxProfit.Sign() <= 0 {
		return nil
	}

	return &MEVOpportunity{
		Type:            MEVTypeLiquidation,
		SourceTx:        tx,
		EstimatedProfit: maxProfit,
		Confidence:      confidence,
		Requirements: MEVRequirements{
			MinimumBalance: calculateLiquidationCollateral(bestPosition),
			RequiredTokens: getLiquidationTokens(bestPosition),
			MaxLatency:     150 * time.Microsecond,
		},
		ExpiryTime: time.Now().Add(500 * time.Millisecond),
	}
}

func (md *MEVDetector) recordMEVOpportunity(opp *MEVOpportunity) {
	md.metrics.OpportunitiesDetected.WithLabelValues(opp.Type.String()).Inc()
	md.metrics.ProfitDistribution.WithLabelValues(opp.Type.String()).Observe(float64(opp.EstimatedProfit.Uint64()))
	
	// Store in recent MEV buffer for analysis
	md.recentMEV.Add(opp)

	// Update success rate based on historical data
	successRate := md.calculateSuccessRate(opp.Type)
	md.metrics.SuccessRate.WithLabelValues(opp.Type.String()).Set(successRate)
}

func (md *MEVDetector) calculateSuccessRate(mevType MEVType) float64 {
	md.mu.RLock()
	defer md.mu.RUnlock()

	recent := md.recentMEV.GetRecent(100)
	if len(recent) == 0 {
		return 0
	}

	var successful int
	var total int

	for _, item := range recent {
		opp := item.(*MEVOpportunity)
		if opp.Type == mevType {
			total++
			if opp.EstimatedProfit.Sign() > 0 {
				successful++
			}
		}
	}

	if total == 0 {
		return 0
	}

	return float64(successful) / float64(total)
}

func newMEVMetrics() *MEVMetrics {
	return &MEVMetrics{
		OpportunitiesDetected: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "mev_opportunities_detected_total",
				Help: "Total number of MEV opportunities detected by type",
			},
			[]string{"type"},
		),
		ProfitDistribution: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "mev_profit_distribution_lamports",
				Help:    "Distribution of MEV profits in lamports",
				Buckets: prometheus.ExponentialBuckets(1000, 2, 15),
			},
			[]string{"type"},
		),
		DetectionLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "mev_detection_latency_seconds",
			Help:    "Time taken to detect MEV opportunities",
			Buckets: prometheus.ExponentialBuckets(0.0001, 2, 10),
		}),
		SuccessRate: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "mev_success_rate",
				Help: "Success rate of MEV opportunities by type",
			},
			[]string{"type"},
		),
	}
} 