# Copile Backend Git Flow Guide

This guide aims to provide a comprehensive understanding of Git Flow and how it is implemented in the Copile backend project. Git Flow is a branching model that provides a robust framework for managing larger projects.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Branches Explained](#branches-explained)
    - [Main Branch](#main-branch)
    - [Develop Branch](#develop-branch)
    - [Feature Branches](#feature-branches)
    - [Release Branches](#release-branches)
    - [Hotfix Branches](#hotfix-branches)
    - [Bugfix Branches](#bugfix-branches)
3. [Pull Requests](#pull-requests)
4. [Tips for Effective Collaboration](#tips-for-effective-collaboration)

## Initial Setup

1. Open your terminal.
2. Navigate to your project directory.
3. Run the following command to initialize Git Flow:

    ```bash
    git flow init
    ```

    You will be prompted to answer several questions. Here are the answers based on your provided config:

    - Branch name for production releases: `main`
    - Branch name for "next release" development: `develop`
    - Feature branches: `feature/`
    - Bugfix branches: `bugfix/`
    - Release branches: `release/`
    - Hotfix branches: `hotfix/`
    - Support branches: `support/`
    - Version tag prefix: (leave empty)
    - Hooks and filters directory: `D:/Copile/copile-backend/.git/hooks`

## Branches Explained

### Main Branch

The `main` branch contains the production-ready code.

### Develop Branch

The `develop` branch is the integration branch for features and the base for releasing new changes to `main`.

### Feature Branches

Feature branches are used for new features and are branched off of `develop`.

- To create and checkout a new feature branch:

    ```bash
    git flow feature start my-new-feature
    ```

- To finish a feature branch:

    ```bash
    git flow feature finish my-new-feature
    ```

### Release Branches

Release branches are used for code releases and are branched off of `develop`.

- To create a release branch:

    ```bash
    git flow release start 0.1.0
    ```

- To finish a release branch:

    ```bash
    git flow release finish 0.1.0
    ```

### Hotfix Branches

Hotfix branches are used for quick patches to production and are branched off of `main`.

- To create a hotfix branch:

    ```bash
    git flow hotfix start fix-broken-button
    ```

- To finish a hotfix branch:

    ```bash
    git flow hotfix finish fix-broken-button
    ```

### Bugfix Branches

Bugfix branches are used for fixing bugs and are branched off of `develop`.

- To create a bugfix branch:

    ```bash
    git flow bugfix start fix-nasty-bug
    ```

- To finish a bugfix branch:

    ```bash
    git flow bugfix finish fix-nasty-bug
    ```

## Pull Requests

- To push a feature branch:

    ```bash
    git flow feature publish my-new-feature
    ```

- After this, create a PR in GitHub against the `develop` branch.

## Tips for Effective Collaboration

- Always fetch the latest changes from the `develop` branch before creating a new feature or bugfix branch.
- Make sure to pull the latest changes in your current branch before pushing.
- Always add a meaningful PR description and review your changes before asking for reviews.
- Merge PRs only after they have been reviewed and all automatic checks pass.
