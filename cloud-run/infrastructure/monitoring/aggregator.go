package monitoring

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc/ws"
	"golang.org/x/sync/errgroup"
)

type StreamSource int

const (
	SourceJito StreamSource = iota
	SourceYellowstone
	SourceGenesysGo
	SourceTriton
)

type StreamConfig struct {
	Sources           []StreamSource
	BufferSize        int
	DeduplicationTTL  time.Duration
	FilterConfig      *FilterConfig
	ValidationConfig  *ValidationConfig
}

type FilterConfig struct {
	Programs         []solana.PublicKey
	Accounts         []solana.PublicKey
	MinLamports     uint64
	ExcludePrograms []solana.PublicKey
	CustomFilters   []FilterFunc
}

type ValidationConfig struct {
	RequiredSources    int
	MaxLatency        time.Duration
	ConsensusRequired bool
}

type FilterFunc func(*Transaction) bool

type StreamAggregator struct {
	config      *StreamConfig
	sources     map[StreamSource]*SourceHandler
	dedupeCache *DeduplicationCache
	metrics     *AggregatorMetrics
	mu          sync.RWMutex
}

type SourceHandler struct {
	source    StreamSource
	client    interface{} // Can be JITO client, WebSocket client, etc.
	stream    chan *Transaction
	lastSeen  time.Time
	metrics   *SourceMetrics
}

type DeduplicationCache struct {
	cache  sync.Map
	ttl    time.Duration
	ticker *time.Ticker
}

type AggregatorMetrics struct {
	txProcessed        *prometheus.Counter
	txDeduplicated     *prometheus.Counter
	sourceLatency      *prometheus.HistogramVec
	consensusLatency   *prometheus.Histogram
	validationFailures *prometheus.CounterVec
}

type SourceMetrics struct {
	txReceived    *prometheus.Counter
	errors        *prometheus.Counter
	latency       *prometheus.Histogram
	lastSeenGauge *prometheus.Gauge
}

func NewStreamAggregator(config *StreamConfig) (*StreamAggregator, error) {
	if err := validateConfig(config); err != nil {
		return nil, fmt.Errorf("invalid config: %v", err)
	}

	agg := &StreamAggregator{
		config:      config,
		sources:     make(map[StreamSource]*SourceHandler),
		dedupeCache: newDeduplicationCache(config.DeduplicationTTL),
		metrics:     newAggregatorMetrics(),
	}

	// Initialize sources
	for _, source := range config.Sources {
		handler, err := agg.initializeSource(source)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize source %v: %v", source, err)
		}
		agg.sources[source] = handler
	}

	return agg, nil
}

func (agg *StreamAggregator) Start(ctx context.Context) (<-chan *Transaction, error) {
	outputStream := make(chan *Transaction, agg.config.BufferSize)
	g, ctx := errgroup.WithContext(ctx)

	// Start each source handler
	for _, handler := range agg.sources {
		h := handler // Create new variable for goroutine
		g.Go(func() error {
			return agg.processSource(ctx, h, outputStream)
		})
	}

	// Start deduplication cleanup
	g.Go(func() error {
		agg.dedupeCache.startCleanup(ctx)
		return nil
	})

	// Monitor source health
	g.Go(func() error {
		return agg.monitorSourceHealth(ctx)
	})

	return outputStream, nil
}

func (agg *StreamAggregator) processSource(ctx context.Context, handler *SourceHandler, output chan<- *Transaction) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case tx := <-handler.stream:
			start := time.Now()

			// Skip if already seen
			if agg.dedupeCache.exists(tx.Signature) {
				agg.metrics.txDeduplicated.Inc()
				continue
			}

			// Apply filters
			if !agg.applyFilters(tx) {
				continue
			}

			// Validate transaction
			if err := agg.validateTransaction(tx, handler.source); err != nil {
				agg.metrics.validationFailures.WithLabelValues(handler.source.String()).Inc()
				continue
			}

			// Store in deduplication cache
			agg.dedupeCache.add(tx.Signature)

			// Update metrics
			handler.metrics.txReceived.Inc()
			handler.metrics.latency.Observe(float64(time.Since(start).Microseconds()))
			handler.lastSeen = time.Now()
			handler.metrics.lastSeenGauge.Set(float64(handler.lastSeen.Unix()))

			// Send to output stream
			select {
			case output <- tx:
				agg.metrics.txProcessed.Inc()
			default:
				// Buffer full, skip transaction
			}
		}
	}
}

func (agg *StreamAggregator) applyFilters(tx *Transaction) bool {
	// Apply program filters
	if len(agg.config.FilterConfig.Programs) > 0 {
		programMatch := false
		for _, inst := range tx.Instructions {
			for _, allowedProgram := range agg.config.FilterConfig.Programs {
				if inst.ProgramID.Equals(allowedProgram) {
					programMatch = true
					break
				}
			}
		}
		if !programMatch {
			return false
		}
	}

	// Apply account filters
	if len(agg.config.FilterConfig.Accounts) > 0 {
		accountMatch := false
		for _, acc := range tx.Accounts {
			for _, targetAccount := range agg.config.FilterConfig.Accounts {
				if acc.Equals(targetAccount) {
					accountMatch = true
					break
				}
			}
		}
		if !accountMatch {
			return false
		}
	}

	// Apply custom filters
	for _, filter := range agg.config.FilterConfig.CustomFilters {
		if !filter(tx) {
			return false
		}
	}

	return true
}

func (agg *StreamAggregator) validateTransaction(tx *Transaction, source StreamSource) error {
	if agg.config.ValidationConfig.ConsensusRequired {
		// Wait for transaction to be seen by required number of sources
		consensus := 1
		agg.mu.RLock()
		for s, handler := range agg.sources {
			if s != source && handler.hasSeenTransaction(tx.Signature) {
				consensus++
			}
		}
		agg.mu.RUnlock()

		if consensus < agg.config.ValidationConfig.RequiredSources {
			return fmt.Errorf("consensus not reached: %d/%d", consensus, agg.config.ValidationConfig.RequiredSources)
		}
	}

	// Check latency requirements
	if tx.DetectionLatency > agg.config.ValidationConfig.MaxLatency {
		return fmt.Errorf("latency too high: %v > %v", tx.DetectionLatency, agg.config.ValidationConfig.MaxLatency)
	}

	return nil
}

func (agg *StreamAggregator) monitorSourceHealth(ctx context.Context) error {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			agg.mu.RLock()
			for source, handler := range agg.sources {
				if time.Since(handler.lastSeen) > 5*time.Second {
					log.Printf("Warning: Source %v hasn't received transactions for %v", source, time.Since(handler.lastSeen))
				}
			}
			agg.mu.RUnlock()
		}
	}
}

func newDeduplicationCache(ttl time.Duration) *DeduplicationCache {
	return &DeduplicationCache{
		ttl:    ttl,
		ticker: time.NewTicker(ttl / 2),
	}
}

func (cache *DeduplicationCache) add(signature string) {
	cache.cache.Store(signature, time.Now())
}

func (cache *DeduplicationCache) exists(signature string) bool {
	_, exists := cache.cache.Load(signature)
	return exists
}

func (cache *DeduplicationCache) startCleanup(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-cache.ticker.C:
			now := time.Now()
			cache.cache.Range(func(key, value interface{}) bool {
				if timestamp, ok := value.(time.Time); ok {
					if now.Sub(timestamp) > cache.ttl {
						cache.cache.Delete(key)
					}
				}
				return true
			})
		}
	}
}

func newAggregatorMetrics() *AggregatorMetrics {
	return &AggregatorMetrics{
		txProcessed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "stream_aggregator_tx_processed_total",
			Help: "Total number of transactions processed",
		}),
		txDeduplicated: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "stream_aggregator_tx_deduplicated_total",
			Help: "Total number of duplicate transactions filtered",
		}),
		sourceLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "stream_aggregator_source_latency_microseconds",
				Help:    "Latency by source in microseconds",
				Buckets: []float64{50, 100, 200, 500, 1000, 2000},
			},
			[]string{"source"},
		),
		consensusLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "stream_aggregator_consensus_latency_microseconds",
			Help:    "Consensus validation latency in microseconds",
			Buckets: []float64{100, 200, 500, 1000, 2000, 5000},
		}),
		validationFailures: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "stream_aggregator_validation_failures_total",
				Help: "Total number of validation failures by source",
			},
			[]string{"source"},
		),
	}
} 