# Deployment Guide

This guide covers deploying the Stellar Access Control Indexer to production using SubQuery's Managed Service or other hosting platforms.

## Prerequisites

- GitHub account
- SubQuery account (sign up at [project.subquery.network](https://project.subquery.network))
- Your project code in a public GitHub repository

## SubQuery Managed Service Deployment

### 1. Prepare Your Project

Ensure your project is ready for deployment:

```bash
# Build and test locally
yarn install
yarn codegen
yarn build

# Test with Docker
yarn start:docker
```

### 2. Push to GitHub

```bash
git add .
git commit -m "Ready for SubQuery deployment"
git push origin main
```

### 3. Deploy via SubQuery UI

1. **Login to SubQuery**
   - Visit [project.subquery.network](https://project.subquery.network)
   - Connect your GitHub account

2. **Create New Project**
   - Click "Create Project"
   - Select your GitHub repository
   - Choose the branch (usually `main`)

3. **Configure Deployment**
   - **Project Name**: `stellar-access-control-indexer`
   - **Network**: Stellar
   - **Version**: Latest SubQuery version
   - **Database**: Postgres (provided by SubQuery)

4. **Advanced Settings**
   - **Start Block**: `1600000` (or your preferred starting block)
   - **Workers**: `1-2` (adjust based on your needs)
   - **Batch Size**: `5-10` (adjust for performance)

5. **Deploy**
   - Click "Deploy"
   - Wait for indexing to begin (usually 2-5 minutes)

### 4. Get Your Endpoint

Once deployed, you'll receive:

```
GraphQL Endpoint: https://api.subquery.network/sq/{your-org}/stellar-access-control-indexer
```

## Alternative Hosting Options

### OnFinality Indexing Service

1. **Sign Up**
   - Visit [onfinality.io](https://onfinality.io)
   - Create an account

2. **Create Indexer**
   - Go to "Indexers" → "Create New"
   - Select "SubQuery"
   - Provide GitHub repository URL

3. **Configure**
   - Select network: Stellar
   - Set start block: `1600000`
   - Choose resources (based on plan)

4. **Deploy**
   - Click "Deploy"
   - Note your GraphQL endpoint

### Self-Hosted Deployment

For full control, deploy on your own infrastructure:

#### Docker Compose (Production)

```yaml
# docker-compose.prod.yml
services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: always

  subquery-node:
    image: subquerynetwork/subql-node-stellar:latest
    environment:
      DB_USER: postgres
      DB_PASS: ${DB_PASSWORD}
      DB_DATABASE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
    volumes:
      - ./:/app
    command:
      - -f=/app
      - --db-schema=app
      - --workers=2
      - --batch-size=10
      - --timeout=90000
    restart: always

  graphql-engine:
    image: subquerynetwork/subql-query:latest
    environment:
      DB_USER: postgres
      DB_PASS: ${DB_PASSWORD}
      DB_DATABASE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
    command:
      - --name=app
      - --playground
      - --indexer=http://subquery-node:3000
    restart: always
    ports:
      - "3000:3000"

volumes:
  postgres-data:
```

Deploy:

```bash
export DB_PASSWORD=your_secure_password
docker compose -f docker-compose.prod.yml up -d
```

#### Kubernetes

For Kubernetes deployment, use the provided Helm chart (see `helm/` directory).

## Configuration for Production

### 1. Use Private Horizon Endpoint

Replace the public endpoint with your private one:

```typescript
// project.ts
network: {
  chainId: "Public Global Stellar Network ; September 2015",
  endpoint: [
    "https://your-private-horizon.example.com",
    "https://horizon.stellar.org"  // fallback
  ],
  sorobanEndpoint: "https://your-private-soroban.example.com",
}
```

### 2. Optimize Performance

Adjust these settings based on your infrastructure:

```typescript
// In docker-compose or SubQuery UI
--workers=4              // More workers for parallel processing
--batch-size=20          // Larger batches for faster indexing
--timeout=60000          // Adjust based on endpoint speed
```

### 3. Monitor Your Deployment

SubQuery Managed Service provides:
- Real-time indexing metrics
- Query analytics
- Error tracking
- Health checks

For self-hosted deployments, consider:
- Prometheus + Grafana for metrics
- CloudWatch / DataDog for AWS deployments
- Custom health check endpoints

## Connecting Your Application

Once deployed, update your adapter configuration:

```typescript
// In contracts-ui-builder
const stellarNetwork: StellarNetworkConfig = {
  id: 'stellar-mainnet',
  name: 'Stellar Mainnet',
  chainId: 'Public Global Stellar Network ; September 2015',
  horizonUrl: 'https://horizon.stellar.org',
  sorobanUrl: 'https://soroban.stellar.org',
  indexerUri: 'https://api.subquery.network/sq/{your-org}/stellar-access-control-indexer',
  // Or for self-hosted:
  // indexerUri: 'https://your-domain.com/graphql',
};
```

## Deployment Checklist

- [ ] Project builds successfully (`yarn build`)
- [ ] Local Docker testing passes
- [ ] Code pushed to GitHub
- [ ] SubQuery project created
- [ ] Private Horizon endpoint configured (for production)
- [ ] Start block set appropriately
- [ ] Deployment successful
- [ ] GraphQL endpoint accessible
- [ ] Adapter configuration updated
- [ ] End-to-end testing complete
- [ ] Monitoring/alerting configured

## Troubleshooting

### Indexing Stuck

**Symptoms**: No new blocks being processed

**Solutions**:
1. Check Horizon endpoint availability
2. Verify database disk space
3. Increase timeout: `--timeout=120000`
4. Check logs for rate limiting errors

### High Memory Usage

**Symptoms**: Container OOM errors

**Solutions**:
1. Reduce batch size: `--batch-size=5`
2. Reduce workers: `--workers=1`
3. Increase container memory limits
4. Check for memory leaks in custom logic

### Query Performance Issues

**Symptoms**: Slow GraphQL queries

**Solutions**:
1. Verify database indexes are created (automatic in SubQuery)
2. Optimize query complexity
3. Use pagination (`first`, `offset`)
4. Consider read replicas for high-traffic apps

## Support

- **SubQuery Discord**: [discord.gg/subquery](https://discord.gg/subquery)
- **Documentation**: [academy.subquery.network](https://academy.subquery.network)
- **GitHub Issues**: [github.com/OpenZeppelin/stellar-access-control-indexer/issues](https://github.com/OpenZeppelin/stellar-access-control-indexer/issues)

## Security Considerations

1. **Never commit secrets** to version control
2. Use **environment variables** for sensitive data
3. Enable **query rate limiting** for public endpoints
4. Implement **authentication** for production APIs
5. Regular **security updates** for all dependencies
6. Monitor for **suspicious query patterns**

## Cost Optimization

### SubQuery Managed Service

- Start with the **Free Tier** for testing
- Upgrade to **Growth** for production apps
- Use **deployment slots** for staging/production separation

### Self-Hosted

- Use **spot instances** for non-critical environments
- Enable **auto-scaling** based on indexing progress
- Archive **old data** to cheaper storage
- Use **CDN** for GraphQL endpoints if public

## Next Steps

1. Deploy to staging environment first
2. Test with production-like data volume
3. Performance test your queries
4. Set up monitoring and alerts
5. Deploy to production
6. Document your endpoint for your team
7. Keep dependencies updated

