# Network Health Monitor

A real-time Solana network health monitoring service that provides comprehensive metrics, alerts, and analytics for network performance and validator behavior.

## Features

### Network Metrics

- Real-time block production monitoring
- Transaction throughput (TPS) tracking
- Network latency measurements
- Block time analysis
- Network congestion scoring

### Validator Analytics

- Active validator count tracking
- Validator performance analysis
- Stake distribution monitoring
- Delinquency detection
- Top performer identification

### Real-time Alerting

- High block time alerts
- Network congestion warnings
- Validator delinquency notifications
- RPC endpoint performance issues
- Custom alert thresholds

### Monitoring Interfaces

- REST API endpoints
- Prometheus metrics
- WebSocket real-time updates
- Historical data access
- Custom dashboard support

## API Endpoints

### Health Check

```
GET /health
```

Returns the current service status and connection states.

### Metrics

```
GET /metrics
```

Returns Prometheus-formatted metrics for network health.

### Validator Statistics

```
GET /stats/validators
```

Returns current validator performance statistics.

### Network Congestion

```
GET /stats/congestion
```

Returns current and historical network congestion data.

### Performance Metrics

```
GET /stats/performance
```

Returns detailed network performance metrics.

## WebSocket Events

### Slot Updates

```javascript
socket.on("slot_update", (data) => {
  // Real-time slot and block time information
});
```

### Validator Updates

```javascript
socket.on("validator_update", (data) => {
  // Validator performance and stake changes
});
```

### Network Alerts

```javascript
socket.on("network_alert", (data) => {
  // Real-time network health alerts
});
```

## Environment Variables

| Variable          | Description                 | Default      |
| ----------------- | --------------------------- | ------------ |
| `PORT`            | Service port                | 3002         |
| `SOLANA_RPC_URL`  | Primary Solana RPC endpoint | mainnet-beta |
| `JITO_RPC_URL`    | Jito RPC endpoint           | -            |
| `GENESYS_RPC_URL` | GenesysGo RPC endpoint      | -            |
| `REDIS_URL`       | Redis connection URL        | -            |
| `PUBSUB_TOPIC`    | Google Cloud Pub/Sub topic  | -            |

## Metrics

### Prometheus Metrics

- `solana_network_latency_ms`: Network latency histogram
- `solana_block_time_ms`: Block time histogram
- `solana_current_tps`: Current TPS gauge
- `solana_current_slot`: Current slot gauge
- `solana_active_validators`: Active validator count
- `solana_network_congestion`: Network congestion score

## Alert Types

### Network Alerts

- `high_block_time`: Block time exceeds threshold
- `high_congestion`: Network congestion above threshold
- `low_validator_count`: Active validator count below minimum
- `high_latency`: RPC endpoint latency issues
- `endpoint_error`: RPC endpoint connection failures

## Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the service:

```bash
npm start
```

## Docker Deployment

Build and run with Docker:

```bash
docker build -t network-health-monitor .
docker run -p 3002:3002 -p 8080:8080 network-health-monitor
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License - see LICENSE file for details
