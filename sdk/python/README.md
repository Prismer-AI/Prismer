# prismer

Official Python SDK for Prismer Cloud Context API.

Prismer Cloud provides AI agents with fast, cached access to web content. Load URLs or search queries, get compressed high-quality content (HQCC) optimized for LLM consumption.

## Installation

```bash
pip install prismer
```

## Quick Start

```python
from prismer import PrismerClient

client = PrismerClient(api_key="sk-prismer-...")

# Load content from a URL
result = client.load("https://example.com")
if result.success and result.result:
    print(result.result.hqcc)  # Compressed content for LLM
```

### Async Support

```python
from prismer import AsyncPrismerClient

async with AsyncPrismerClient(api_key="sk-prismer-...") as client:
    result = await client.load("https://example.com")
    print(result.result.hqcc if result.result else None)
```

---

## API Reference

### Constructor

```python
client = PrismerClient(
    api_key="sk-prismer-...",           # Required
    base_url="https://prismer.cloud",  # Optional
    timeout=30.0,                        # Optional, seconds
)
```

---

## `load(input, **options)`

Load content from URL(s) or search query. The API auto-detects input type.

### Input Types

| Input | Mode | Description |
|-------|------|-------------|
| `"https://..."` | `single_url` | Fetch single URL, check cache first |
| `["url1", "url2"]` | `batch_urls` | Batch cache lookup |
| `"search query"` | `query` | Search → cache check → compress → rank |

### Examples

#### Single URL

```python
result = client.load("https://example.com")

# Result structure:
# LoadResult(
#   success=True,
#   request_id="load_abc123",
#   mode="single_url",
#   result=LoadResultItem(
#     url="https://example.com",
#     title="Example Domain",
#     hqcc="# Example Domain\n\nThis domain is for...",
#     cached=True,
#     cached_at="2024-01-15T10:30:00Z",
#   ),
#   cost={"credits": 0, "cached": True},
#   processing_time=45
# )
```

#### Batch URLs

```python
# Cache check only (default)
result = client.load(["url1", "url2", "url3"])

# With processing for uncached URLs
result = client.load(
    ["url1", "url2", "url3"],
    process_uncached=True,
    processing={
        "strategy": "fast",      # "auto" | "fast" | "quality"
        "maxConcurrent": 5       # Parallel compression limit
    }
)

# Result:
# result.results = [
#   LoadResultItem(url="url1", found=True, cached=True, hqcc="..."),
#   LoadResultItem(url="url2", found=True, cached=False, processed=True, hqcc="..."),
#   LoadResultItem(url="url3", found=False, cached=False, hqcc=None),
# ]
# result.summary = {"total": 3, "found": 2, "notFound": 1, "cached": 1, "processed": 1}
```

#### Search Query

```python
result = client.load(
    "latest developments in AI agents 2024",
    search={"topK": 15},              # Search results to fetch
    processing={
        "strategy": "quality",
        "maxConcurrent": 3
    },
    return_config={
        "topK": 5,                     # Results to return
        "format": "both"               # "hqcc" | "raw" | "both"
    },
    ranking={
        "preset": "cache_first"        # Prefer cached results
        # Or custom weights:
        # "custom": {"cacheHit": 0.3, "relevance": 0.4, "freshness": 0.2, "quality": 0.1}
    }
)

# Result:
# result.results = [
#   LoadResultItem(
#     rank=1,
#     url="https://...",
#     title="AI Agents in 2024",
#     hqcc="...",
#     raw="...",
#     cached=True,
#     ranking=RankingInfo(
#       score=0.85,
#       factors=RankingFactors(cache=0.3, relevance=0.35, freshness=0.15, quality=0.05)
#     )
#   ),
#   ...
# ]
# result.cost = {
#   "searchCredits": 1,
#   "compressionCredits": 3.5,
#   "totalCredits": 4.5,
#   "savedByCache": 4.0
# }
```

### Load Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `str \| list[str]` | URL, URLs, or search query |
| `input_type` | `str` | Force type: `"url"`, `"urls"`, `"query"` |
| `process_uncached` | `bool` | Process uncached URLs in batch mode |
| `search` | `dict` | `{"topK": 15}` - search results to fetch |
| `processing` | `dict` | `{"strategy": "auto", "maxConcurrent": 3}` |
| `return_config` | `dict` | `{"format": "hqcc", "topK": 5}` |
| `ranking` | `dict` | `{"preset": "cache_first"}` or `{"custom": {...}}` |

### Ranking Presets

| Preset | Description | Best For |
|--------|-------------|----------|
| `cache_first` | Strongly prefer cached results | Cost optimization |
| `relevance_first` | Prioritize search relevance | Accuracy-critical tasks |
| `balanced` | Equal weight to all factors | General use |

---

## `save()` / `save_batch()`

Save content to Prismer's global cache. Requires authentication.

### Single Save

```python
result = client.save(
    url="https://example.com/article",
    hqcc="Compressed content for LLM...",
    raw="Original HTML/text content...",  # Optional
    meta={                                 # Optional
        "source": "my-crawler",
        "crawledAt": "2024-01-15T10:30:00Z"
    }
)

# Result:
# SaveResult(success=True, status="created", url="...")
# Or if already exists:
# SaveResult(success=True, status="exists", url="...")
```

### Batch Save (max 50 items)

```python
result = client.save(items=[
    {"url": "url1", "hqcc": "content1"},
    {"url": "url2", "hqcc": "content2", "raw": "raw2"},
    {"url": "url3", "hqcc": "content3", "meta": {"source": "bot"}},
])

# Or use SaveOptions for type safety:
from prismer import SaveOptions

result = client.save_batch([
    SaveOptions(url="url1", hqcc="content1"),
    SaveOptions(url="url2", hqcc="content2"),
])

# Result:
# SaveResult(
#   success=True,
#   results=[
#     SaveResultItem(url="url1", status="created"),
#     SaveResultItem(url="url2", status="exists"),
#   ],
#   summary=SaveSummary(total=2, created=1, exists=1)
# )
```

---

## Error Handling

```python
result = client.load("https://example.com")

if not result.success:
    print(f"Error [{result.error.code}]: {result.error.message}")
    
    # Handle specific errors:
    if result.error.code == "UNAUTHORIZED":
        # Invalid or missing API key
        pass
    elif result.error.code == "INVALID_INPUT":
        # Bad request parameters
        pass
    elif result.error.code == "TIMEOUT":
        # Request timed out
        pass
    elif result.error.code == "NETWORK_ERROR":
        # Network connectivity issue
        pass
    return

# Safe to use result
print(result.result.hqcc if result.result else None)
```

---

## Type Hints

Full type hints with Pydantic models:

```python
from prismer import (
    PrismerClient,
    AsyncPrismerClient,
    LoadResult,
    LoadResultItem,
    SaveResult,
    SaveOptions,
    PrismerError,
)
```

---

## Best Practices

### 1. Use Context Manager for Async Client

```python
# ✅ Properly closes connection
async with AsyncPrismerClient(api_key="...") as client:
    result = await client.load("https://example.com")

# Or manually close:
client = AsyncPrismerClient(api_key="...")
try:
    result = await client.load("https://example.com")
finally:
    await client.close()
```

### 2. Batch URLs When Possible

```python
# ❌ Multiple individual requests
for url in urls:
    client.load(url)

# ✅ Single batch request
client.load(urls, process_uncached=True)
```

### 3. Use Cache-First Ranking for Cost Savings

```python
result = client.load("AI news", ranking={"preset": "cache_first"})
print(f"Saved {result.cost.get('savedByCache', 0)} credits from cache")
```

---

## Environment Variables

```bash
# Optional: Set default API key
export PRISMER_API_KEY=sk-prismer-...

# Optional: Custom API endpoint  
export PRISMER_BASE_URL=https://prismer.cloud
```

---

## License

MIT
