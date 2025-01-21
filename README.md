# Copile Backend - Solana Copy Trading Infrastructure

Welcome to the Copile Backend repository! This repository contains the backend components of the Copile Solana copy trading infrastructure, including Cloud Functions for analytics and monitoring, and Cloud Run services for execution and indexing.

## Repository Structure

The repository follows a structured organization to group different components:

- `cloud-functions/`: Contains utility services and analytics tools

  - `wallet-analytics/`: Analyzes Solana wallets for trading patterns
  - `profitability-tracker/`: Tracks wallet profitability and performance
  - `jito-mempool-monitor/`: Monitors Jito mempool for MEV opportunities
  - `liquidity-analyzer/`: Analyzes DEX liquidity pools
  - `market-maker-detector/`: Identifies market maker behavior
  - `position-tracker/`: Tracks positions across Solana DEXes
  - `transaction-analyzer/`: Analyzes transaction patterns and impact

- `cloud-run/`: Contains core copy trading services
  - `solana-indexer/`: Indexes Solana blockchain data for copy trading
  - `solana-executor/`: Executes copy trades across Solana DEXes
  - `exec-handlers/`: Handles trade execution logic

## Cloud Functions

Our Cloud Functions provide essential utilities and analytics for the copy trading platform:

### Analytics Services

- `wallet-analytics`: Analyzes wallet behavior and trading patterns
- `profitability-tracker`: Tracks trading performance and profitability
- `transaction-analyzer`: Deep analysis of transaction patterns

### Market Intelligence

- `jito-mempool-monitor`: Real-time MEV opportunity detection
- `market-maker-detector`: Identifies market making patterns
- `liquidity-analyzer`: DEX liquidity analysis

### Position Management

- `position-tracker`: Tracks positions across multiple DEXes

## Cloud Run Services

The `cloud-run` directory contains our core copy trading infrastructure:

- `solana-indexer`: High-performance blockchain indexing service
- `solana-executor`: Executes copy trades with MEV protection
- `exec-handlers`: Trade execution and routing logic

## Deployment Process

The deployment process is automated using Google Cloud Build:

1. Cloud Functions are deployed based on `cloud-function-config.json`
2. Cloud Run services are built and deployed to europe-west2 region
3. All services are configured for optimal performance with Solana and Jito

## Getting Started

To get started with development:

1. Clone this repository
2. Install dependencies for each service
3. Configure environment variables
4. Run services locally for testing

## Technology Stack

- Solana Web3.js for blockchain interaction
- Jito Labs SDK for MEV protection
- Node.js 18 runtime
- Firebase Admin SDK
- Google Cloud Platform

## Contributing

Please follow our branching strategy:

- Use `feat/` for new features
- Use `fix/` for bug fixes
- Use `chore/` for maintenance tasks
