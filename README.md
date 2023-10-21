# Copile Backend

Welcome to the Copile Backend repository! This repository contains the backend components of the Copile project, including Cloud Functions and Cloud Run services. This document provides an overview of the repository's structure, services, and deployment process.

## Repository Structure

The repository follows a structured organization to group different components:

- `cloud-functions`: Contains the source code and configurations for Cloud Functions.
- `cloud-run`: Contains the source code and configurations for Cloud Run services.
- `.gitignore`: Specifies files and directories to be ignored by Git.
- `cloudbuild.yaml`: Cloud Build configuration file for automating builds and deployments.

## Cloud Functions

The `cloud-functions` directory hosts various Cloud Functions that serve different purposes. Each function has its own subdirectory containing source files and configurations.

Here are some of the key Cloud Functions:

- `WhopWebhook`: Handles webhook requests for creating licenses.
- `admintrades`: Manages admin trades with special configurations.
- `bybit`: Handles trades related to the Bybit exchange.
- `checkMember`: Checks member information.
- ... and more.

## Cloud Run Services

The `cloud-run` directory contains Cloud Run services deployed in different regions. Similar to Cloud Functions, each service has its own subdirectory containing source files and configurations.

Here are some of the key Cloud Run services:

- `asia-handler`: Handles execution tasks for Asian region.
- `us-handler`: Handles execution tasks for US region.
- `preprocessing-layer`: Prepares data for execution services.

## Deployment Process

The deployment process is automated using Google Cloud Build, triggered by GitHub commits or other events. The `cloudbuild.yaml` file defines the deployment steps and configurations.

To deploy Cloud Functions:

1. Configure the `cloud-function-config.json` file with function settings.
2. Push your changes to the repository.
3. Google Cloud Build will automatically build and deploy the Cloud Functions.

To deploy Cloud Run services:

1. Modify the `cloudbuild.yaml` file to enable the relevant service deployment steps.
2. Push your changes to the repository.
3. Google Cloud Build will automatically build and deploy the Cloud Run services.

## Getting Started

To get started, follow these steps:

1. Clone this repository to your local machine.
2. Configure the necessary settings in the `cloud-function-config.json` file.
3. Push your changes to the repository to trigger the deployment process.

For detailed information about individual functions or services, refer to their respective subdirectories.
