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

type MarketMonitor struct {
	config         *EngineConfig
	markets        sync.Map // map[string]*MarketState
	priceFeeds     sync.Map // map[string]*PriceFeed
	volatility     sync.Map // map[string]*VolatilityTracker
	metrics        *MarketMetrics
	updateInterval time.Duration
	mu             sync.RWMutex
}

type MarketState struct {
	TokenA         solana.PublicKey
	TokenB         solana.PublicKey
	Price          *big.Float
	Volume24h      *big.Int
	TVL            *big.Int
	LastUpdate     time.Time
	UpdateCount    uint64
	IsHealthy      bool
}

type PriceFeed struct {
	Price         *big.Float
	Confidence    float64
	UpdateTime    time.Time
	Source        string
	IsAggregated  bool
}

type VolatilityTracker struct {
	Prices        []PricePoint
	WindowSize    int
	LastUpdate    time.Time
}

type PricePoint struct {
	Price     *big.Float
	Timestamp time.Time
	Volume    *big.Int
}

type MarketMetrics struct {
	PriceUpdates    *prometheus.CounterVec
	VolumeTracking  *prometheus.GaugeVec
	MarketHealth    *prometheus.GaugeVec
	UpdateLatency   *prometheus.HistogramVec
	Volatility      *prometheus.GaugeVec
}

func NewMarketMonitor(config *EngineConfig) *MarketMonitor {
	return &MarketMonitor{
		config:         config,
		updateInterval: time.Second,
		metrics:        newMarketMetrics(),
	}
}

func (mm *MarketMonitor) Start(ctx context.Context) error {
	// Start background market data updates
	go mm.runUpdateLoop(ctx)
	
	// Start health check monitoring
	go mm.runHealthChecks(ctx)
	
	// Start volatility tracking
	go mm.trackVolatility(ctx)

	return nil
}

func (mm *MarketMonitor) IsMarketConditionFavorable(marketID string) bool {
	// Get market state
	stateObj, ok := mm.markets.Load(marketID)
	if !ok {
		return false
	}
	state := stateObj.(*MarketState)

	// Check market health
	if !state.IsHealthy {
		return false
	}

	// Check update freshness
	if time.Since(state.LastUpdate) > mm.updateInterval*3 {
		return false
	}

	// Check volatility
	if !mm.isVolatilityAcceptable(marketID) {
		return false
	}

	// Check liquidity
	if !mm.hasAdequateLiquidity(state) {
		return false
	}

	return true
}

func (mm *MarketMonitor) GetMarketPrice(marketID string) (*big.Float, error) {
	// Get aggregated price from multiple sources
	prices := mm.getAggregatedPrices(marketID)
	if len(prices) == 0 {
		return nil, fmt.Errorf("no price data available for market %s", marketID)
	}

	// Calculate weighted average based on confidence
	weightedSum := new(big.Float)
	weightSum := 0.0

	for _, price := range prices {
		weight := price.Confidence
		weightedPrice := new(big.Float).Mul(price.Price, big.NewFloat(weight))
		weightedSum.Add(weightedSum, weightedPrice)
		weightSum += weight
	}

	if weightSum == 0 {
		return nil, fmt.Errorf("no confident price data available")
	}

	result := new(big.Float).Quo(weightedSum, big.NewFloat(weightSum))
	return result, nil
}

func (mm *MarketMonitor) UpdateMarketState(marketID string, state *MarketState) error {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	// Validate state
	if err := mm.validateMarketState(state); err != nil {
		return fmt.Errorf("invalid market state: %v", err)
	}

	// Update state
	mm.markets.Store(marketID, state)

	// Update metrics
	mm.updateMetrics(marketID, state)

	return nil
}

func (mm *MarketMonitor) runUpdateLoop(ctx context.Context) {
	ticker := time.NewTicker(mm.updateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			mm.updateAllMarkets(ctx)
		}
	}
}

func (mm *MarketMonitor) runHealthChecks(ctx context.Context) {
	ticker := time.NewTicker(mm.updateInterval * 2)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			mm.checkMarketHealth(ctx)
		}
	}
}

func (mm *MarketMonitor) trackVolatility(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			mm.updateVolatility(ctx)
		}
	}
}

func (mm *MarketMonitor) updateAllMarkets(ctx context.Context) {
	mm.markets.Range(func(key, value interface{}) bool {
		marketID := key.(string)
		go func() {
			if err := mm.updateMarket(ctx, marketID); err != nil {
				mm.metrics.MarketHealth.WithLabelValues(marketID).Set(0)
			}
		}()
		return true
	})
}

func (mm *MarketMonitor) updateMarket(ctx context.Context, marketID string) error {
	start := time.Now()
	defer func() {
		mm.metrics.UpdateLatency.WithLabelValues(marketID).Observe(time.Since(start).Seconds())
	}()

	// Fetch new market data
	state, err := mm.fetchMarketData(ctx, marketID)
	if err != nil {
		return fmt.Errorf("failed to fetch market data: %v", err)
	}

	// Update price feeds
	if err := mm.updatePriceFeeds(ctx, marketID, state); err != nil {
		return fmt.Errorf("failed to update price feeds: %v", err)
	}

	// Update state
	return mm.UpdateMarketState(marketID, state)
}

func (mm *MarketMonitor) checkMarketHealth(ctx context.Context) {
	mm.markets.Range(func(key, value interface{}) bool {
		marketID := key.(string)
		state := value.(*MarketState)

		// Check various health indicators
		isHealthy := mm.checkHealthIndicators(state)
		
		// Update health status
		state.IsHealthy = isHealthy
		mm.markets.Store(marketID, state)

		// Update metrics
		if isHealthy {
			mm.metrics.MarketHealth.WithLabelValues(marketID).Set(1)
		} else {
			mm.metrics.MarketHealth.WithLabelValues(marketID).Set(0)
		}

		return true
	})
}

func (mm *MarketMonitor) updateVolatility(ctx context.Context) {
	mm.volatility.Range(func(key, value interface{}) bool {
		marketID := key.(string)
		tracker := value.(*VolatilityTracker)

		// Calculate volatility
		vol := mm.calculateVolatility(tracker)
		
		// Update metrics
		mm.metrics.Volatility.WithLabelValues(marketID).Set(vol)

		return true
	})
}

func (mm *MarketMonitor) calculateVolatility(tracker *VolatilityTracker) float64 {
	if len(tracker.Prices) < 2 {
		return 0
	}

	// Calculate price returns
	returns := make([]float64, len(tracker.Prices)-1)
	for i := 1; i < len(tracker.Prices); i++ {
		prev := tracker.Prices[i-1].Price
		curr := tracker.Prices[i].Price
		
		// Calculate log return
		ratio := new(big.Float).Quo(curr, prev)
		logReturn, _ := ratio.Float64()
		returns[i-1] = logReturn
	}

	// Calculate standard deviation of returns
	return calculateStandardDeviation(returns)
}

func (mm *MarketMonitor) isVolatilityAcceptable(marketID string) bool {
	trackerObj, ok := mm.volatility.Load(marketID)
	if !ok {
		return false
	}
	tracker := trackerObj.(*VolatilityTracker)

	vol := mm.calculateVolatility(tracker)
	return vol <= mm.config.MonitoringConfig.SlippageThreshold
}

func (mm *MarketMonitor) hasAdequateLiquidity(state *MarketState) bool {
	// Check TVL
	minTVL := big.NewInt(1000000000) // 1 SOL
	if state.TVL.Cmp(minTVL) < 0 {
		return false
	}

	// Check 24h volume
	minVolume := big.NewInt(100000000) // 0.1 SOL
	if state.Volume24h.Cmp(minVolume) < 0 {
		return false
	}

	return true
}

func newMarketMetrics() *MarketMetrics {
	return &MarketMetrics{
		PriceUpdates: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "market_price_updates_total",
				Help: "Total number of price updates by market",
			},
			[]string{"market"},
		),
		VolumeTracking: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "market_volume_lamports",
				Help: "24h trading volume in lamports by market",
			},
			[]string{"market"},
		),
		MarketHealth: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "market_health_status",
				Help: "Market health status (0 = unhealthy, 1 = healthy)",
			},
			[]string{"market"},
		),
		UpdateLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "market_update_latency_seconds",
				Help:    "Market data update latency in seconds",
				Buckets: prometheus.ExponentialBuckets(0.001, 2, 10),
			},
			[]string{"market"},
		),
		Volatility: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "market_volatility",
				Help: "Market price volatility",
			},
			[]string{"market"},
		),
	}
} 