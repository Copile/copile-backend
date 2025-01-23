package rpc

import (
	"context"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/gagliardetto/solana-go/rpc"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/time/rate"
)

type EndpointStats struct {
	Endpoint     string
	Latency      time.Duration
	ErrorRate    float64
	SuccessCount uint64
	ErrorCount   uint64
	LastCheck    time.Time
	Priority     int
	QoSScore     float64
}

type LoadBalancer struct {
	endpoints     []*Endpoint
	statsMap      sync.Map
	healthChecker *HealthChecker
	limiter       *rate.Limiter
	mu            sync.RWMutex
}

type Endpoint struct {
	URL          string
	Client       *rpc.Client
	Weight       int
	IsJito       bool
	IsSwQoS      bool
	MaxQPS       int
	limiter      *rate.Limiter
	retryPolicy  *RetryPolicy
	failoverPool []string
}

type RetryPolicy struct {
	MaxAttempts      int
	BackoffBase      time.Duration
	BackoffMax       time.Duration
	FailoverThreshold float64
}

type HealthChecker struct {
	checkInterval time.Duration
	timeout       time.Duration
	metrics       *HealthMetrics
}

type HealthMetrics struct {
	latencyHistogram   *prometheus.Histogram
	errorRateGauge     *prometheus.Gauge
	endpointStatus     *prometheus.GaugeVec
	failoverCount      *prometheus.Counter
	qosScoreHistogram  *prometheus.Histogram
}

func NewLoadBalancer(config *Config) (*LoadBalancer, error) {
	lb := &LoadBalancer{
		endpoints: make([]*Endpoint, 0),
		limiter:   rate.NewLimiter(rate.Limit(config.GlobalQPS), config.GlobalBurst),
		healthChecker: &HealthChecker{
			checkInterval: 1 * time.Second,
			timeout:      500 * time.Millisecond,
			metrics:      newHealthMetrics(),
		},
	}

	// Initialize Jito endpoints
	jitoEndpoints := []string{
		"https://jito-primary.rpc.com",
		"https://jito-secondary.rpc.com",
	}
	for _, url := range jitoEndpoints {
		endpoint := &Endpoint{
			URL:     url,
			Client:  rpc.New(url),
			Weight:  10,
			IsJito:  true,
			MaxQPS:  5000,
			limiter: rate.NewLimiter(rate.Limit(5000), 100),
			retryPolicy: &RetryPolicy{
				MaxAttempts:       3,
				BackoffBase:       100 * time.Microsecond,
				BackoffMax:        1 * time.Second,
				FailoverThreshold: 0.1,
			},
			failoverPool: []string{
				"https://jito-backup1.rpc.com",
				"https://jito-backup2.rpc.com",
			},
		}
		lb.endpoints = append(lb.endpoints, endpoint)
	}

	// Initialize SwQoS endpoints
	swqosEndpoints := []string{
		"https://swqos-primary.rpc.com",
		"https://swqos-secondary.rpc.com",
	}
	for _, url := range swqosEndpoints {
		endpoint := &Endpoint{
			URL:      url,
			Client:   rpc.New(url),
			Weight:   8,
			IsSwQoS:  true,
			MaxQPS:   3000,
			limiter:  rate.NewLimiter(rate.Limit(3000), 50),
			retryPolicy: &RetryPolicy{
				MaxAttempts:       2,
				BackoffBase:       200 * time.Microsecond,
				BackoffMax:        500 * time.Millisecond,
				FailoverThreshold: 0.15,
			},
		}
		lb.endpoints = append(lb.endpoints, endpoint)
	}

	// Start health checking
	go lb.startHealthCheck()
	
	return lb, nil
}

func (lb *LoadBalancer) GetOptimalEndpoint(ctx context.Context, priority rpc.Priority) (*Endpoint, error) {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	// Filter endpoints based on health and QoS
	var candidates []*Endpoint
	for _, endpoint := range lb.endpoints {
		if stats, ok := lb.statsMap.Load(endpoint.URL); ok {
			endpointStats := stats.(*EndpointStats)
			if endpointStats.ErrorRate < endpoint.retryPolicy.FailoverThreshold &&
				endpointStats.QoSScore >= 0.8 {
				candidates = append(candidates, endpoint)
			}
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no healthy endpoints available")
	}

	// Sort by QoS score and priority
	sort.Slice(candidates, func(i, j int) bool {
		statsI, _ := lb.statsMap.Load(candidates[i].URL)
		statsJ, _ := lb.statsMap.Load(candidates[j].URL)
		scoreI := statsI.(*EndpointStats).QoSScore * float64(candidates[i].Weight)
		scoreJ := statsJ.(*EndpointStats).QoSScore * float64(candidates[j].Weight)
		return scoreI > scoreJ
	})

	// Select based on priority requirements
	switch priority {
	case rpc.PriorityHigh:
		// For high priority, only use Jito endpoints
		for _, endpoint := range candidates {
			if endpoint.IsJito {
				return endpoint, nil
			}
		}
	case rpc.PriorityMedium:
		// For medium priority, prefer Jito but allow SwQoS
		return candidates[0], nil
	case rpc.PriorityLow:
		// For low priority, use any available endpoint
		return candidates[len(candidates)-1], nil
	}

	return candidates[0], nil
}

func (lb *LoadBalancer) startHealthCheck() {
	ticker := time.NewTicker(lb.healthChecker.checkInterval)
	defer ticker.Stop()

	for range ticker.C {
		lb.checkEndpointHealth()
	}
}

func (lb *LoadBalancer) checkEndpointHealth() {
	var wg sync.WaitGroup
	for _, endpoint := range lb.endpoints {
		wg.Add(1)
		go func(ep *Endpoint) {
			defer wg.Done()
			
			ctx, cancel := context.WithTimeout(context.Background(), lb.healthChecker.timeout)
			defer cancel()

			start := time.Now()
			_, err := ep.Client.GetLatestBlockhash(ctx, rpc.CommitmentFinalized)
			latency := time.Since(start)

			stats := &EndpointStats{
				Endpoint:  ep.URL,
				LastCheck: time.Now(),
				Latency:   latency,
			}

			if err != nil {
				stats.ErrorCount++
				lb.healthChecker.metrics.errorRateGauge.Inc()
			} else {
				stats.SuccessCount++
			}

			// Calculate QoS score based on latency and error rate
			stats.QoSScore = calculateQoSScore(latency, stats.ErrorRate)
			
			lb.statsMap.Store(ep.URL, stats)
			lb.healthChecker.metrics.latencyHistogram.Observe(float64(latency.Microseconds()))
			lb.healthChecker.metrics.qosScoreHistogram.Observe(stats.QoSScore)
		}(endpoint)
	}
	wg.Wait()
}

func calculateQoSScore(latency time.Duration, errorRate float64) float64 {
	// Normalize latency (0-1 scale, lower is better)
	normalizedLatency := 1.0 - math.Min(float64(latency.Microseconds())/1000.0, 1.0)
	
	// Normalize error rate (0-1 scale, lower is better)
	normalizedErrorRate := 1.0 - errorRate

	// Weight factors
	const (
		latencyWeight = 0.7
		errorWeight   = 0.3
	)

	// Calculate final QoS score (0-1 scale, higher is better)
	return (normalizedLatency * latencyWeight) + (normalizedErrorRate * errorWeight)
}

func newHealthMetrics() *HealthMetrics {
	return &HealthMetrics{
		latencyHistogram: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "rpc_endpoint_latency_microseconds",
			Help:    "RPC endpoint latency in microseconds",
			Buckets: []float64{100, 200, 500, 1000, 2000, 5000},
		}),
		errorRateGauge: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "rpc_endpoint_error_rate",
			Help: "RPC endpoint error rate",
		}),
		endpointStatus: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "rpc_endpoint_status",
				Help: "RPC endpoint status (1 = healthy, 0 = unhealthy)",
			},
			[]string{"endpoint", "type"},
		),
		failoverCount: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "rpc_endpoint_failover_total",
			Help: "Total number of RPC endpoint failovers",
		}),
		qosScoreHistogram: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "rpc_endpoint_qos_score",
			Help:    "RPC endpoint QoS score",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9},
		}),
	}
} 