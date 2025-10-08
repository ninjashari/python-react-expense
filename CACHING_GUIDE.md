# Caching Implementation for Performance Optimization

This document outlines the comprehensive caching strategy implemented to improve read operations performance in the Expense Manager application.

## Overview

The application was experiencing slow read operations due to a large number of transactions. We've implemented a multi-layered caching strategy:

1. **Backend Redis Caching** - Server-side caching for database queries
2. **Frontend Query Optimization** - Enhanced TanStack Query configuration with longer cache times
3. **Smart Cache Invalidation** - Automated cache invalidation patterns
4. **Prefetching Strategies** - Proactive data loading

## Backend Caching (Redis)

### Setup

1. **Install Redis dependencies:**
   ```bash
   cd backend
   pip install redis==5.0.1 aioredis==2.0.1
   ```

2. **Add Redis configuration to `.env`:**
   ```bash
   REDIS_URL=redis://localhost:6379
   CACHE_ENABLED=true
   CACHE_DEFAULT_TTL=900  # 15 minutes
   ```

3. **Start Redis server:**
   ```bash
   # Using Docker
   docker run -d --name redis -p 6379:6379 redis:latest
   
   # Or install locally (Ubuntu/Debian)
   sudo apt install redis-server
   sudo systemctl start redis-server
   ```

### Cache Service Features

- **Automatic serialization/deserialization** using pickle
- **Connection health monitoring** with automatic fallback
- **Pattern-based cache invalidation** for related data
- **User-scoped caching** for data isolation
- **Configurable TTL** for different data types

### Cache TTL Strategy

| Data Type | Cache Duration | Reason |
|-----------|----------------|---------|
| Transactions | 10 minutes | Changes frequently |
| Transaction Counts | 5 minutes | Changes very frequently |
| Accounts | 30 minutes | Changes less frequently |
| Payees/Categories | 20 minutes | Reference data, relatively stable |

### Cached Endpoints

- `GET /transactions/` - Transaction lists with filters
- `GET /accounts/` - Account lists
- `GET /payees/` - Payee lists with search
- `GET /categories/` - Category lists with search

## Frontend Optimization

### TanStack Query Configuration

```typescript
// Optimized query client with longer cache times
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      gcTime: 30 * 60 * 1000,      // 30 minutes
      retry: 3,
      refetchOnWindowFocus: true,
    },
  },
});
```

### Query Key Factories

Implemented consistent query key patterns for better cache management:

```typescript
export const queryKeys = {
  transactions: () => ['transactions'] as const,
  transactionList: (filters) => [...queryKeys.transactions(), 'list', filters] as const,
  accounts: () => ['accounts'] as const,
  // ... more query keys
};
```

### Optimized Hooks

Created optimized query hooks with automatic cache invalidation:

- `useTransactions()` - Cached transaction queries
- `useAccounts()` - Cached account queries  
- `usePayees()` - Cached payee queries
- `useCategories()` - Cached category queries
- `useCreateTransaction()` - Smart cache invalidation on create
- `useUpdateTransaction()` - Smart cache invalidation on update

## Cache Invalidation Strategy

### Automatic Invalidation

Write operations automatically invalidate related cache entries:

```typescript
// Creating a transaction invalidates:
- All transaction queries
- Account balance queries
- Transaction summary queries

// Creating a payee/category invalidates:
- Reference data queries
- Transaction queries (for dropdown updates)
```

### Manual Invalidation

Patterns for manual cache clearing:

```typescript
// Clear all user data
CacheInvalidator.invalidate_all_user_cache(user_id)

// Clear specific data types
CacheInvalidator.invalidate_user_transactions(user_id)
CacheInvalidator.invalidate_user_accounts(user_id)
CacheInvalidator.invalidate_user_references(user_id)
```

## Prefetching Strategies

### Initial Data Prefetching

When user logs in, automatically prefetch:
- Account list (always needed)
- Categories and payees (for forms)
- Current month transactions (most common view)

### Page Prefetching

- Prefetch next page of transactions when viewing current page
- Prefetch related data when navigating between pages

### Background Sync

- Periodic background refresh of critical data (every 5 minutes)
- Only when tab is active to avoid unnecessary requests

## Performance Benefits

### Expected Improvements

1. **Transaction List Loading**: 70-80% reduction in load time
2. **Account/Reference Data**: 80-90% reduction (cached for longer)
3. **Pagination**: Near-instant navigation between cached pages
4. **Form Interactions**: Instant dropdown population
5. **Dashboard Loading**: Faster summary calculations

### Monitoring

Backend cache performance can be monitored via:
- Redis CLI: `redis-cli info stats`
- Application logs for cache hit/miss rates
- Frontend Network tab for reduced API calls

## Configuration Options

### Backend Redis Settings

```bash
# .env file
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true           # Enable/disable caching
CACHE_DEFAULT_TTL=900        # Default cache time (15 minutes)
```

### Frontend Query Settings

```typescript
// Customize cache times per query type
const transactionOptions = {
  staleTime: 5 * 60 * 1000,   // 5 minutes
  gcTime: 15 * 60 * 1000,     // 15 minutes
};

const referenceDataOptions = {
  staleTime: 15 * 60 * 1000,  // 15 minutes
  gcTime: 45 * 60 * 1000,     // 45 minutes
};
```

## Development Mode

### Cache Debugging

1. **Enable Redis CLI monitoring:**
   ```bash
   redis-cli monitor
   ```

2. **Check cache hits in browser:**
   - Network tab shows reduced API calls
   - React Query Devtools show cache status

3. **Backend logging:**
   ```python
   logger.debug(f"Cache hit for key: {cache_key}")
   logger.debug(f"Cache set for key: {cache_key}")
   ```

### Testing Cache Invalidation

1. **Create a transaction** - Should clear transaction and account caches
2. **Update a transaction** - Should refresh affected queries
3. **Navigate between pages** - Should show instant loading for cached data

## Production Considerations

1. **Redis Memory Management:**
   - Monitor Redis memory usage
   - Configure maxmemory policy (recommend: allkeys-lru)
   - Set up Redis persistence if needed

2. **Cache Warming:**
   - Consider warming cache with common queries on deployment
   - Implement gradual cache warming to avoid thundering herd

3. **Monitoring:**
   - Set up Redis monitoring and alerting
   - Track cache hit rates and performance metrics
   - Monitor for cache stampede scenarios

4. **Scaling:**
   - Redis can be scaled with clustering if needed
   - Consider Redis Sentinel for high availability
   - Implement cache sharding for very large datasets

## Troubleshooting

### Common Issues

1. **Cache not working:**
   - Check Redis connection
   - Verify CACHE_ENABLED=true
   - Check Redis server status

2. **Stale data:**
   - Verify cache invalidation patterns
   - Check TTL settings
   - Manual cache clear if needed

3. **Memory issues:**
   - Monitor Redis memory usage
   - Adjust TTL values
   - Implement cache size limits

### Cache Reset Commands

```bash
# Clear all cache
redis-cli FLUSHDB

# Clear specific pattern
redis-cli --scan --pattern "user:123:*" | xargs redis-cli DEL

# Check cache size
redis-cli INFO memory
```

This caching implementation should significantly improve the application's read performance, especially for users with large transaction datasets.