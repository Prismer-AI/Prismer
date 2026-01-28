"""Type definitions for Prismer SDK - Based on actual API implementation."""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


# ============================================================================
# Load API Types
# ============================================================================

class SearchConfig(BaseModel):
    """Search configuration (query mode only)."""
    top_k: Optional[int] = Field(default=15, alias="topK")

    class Config:
        populate_by_name = True


class ProcessingConfig(BaseModel):
    """Processing configuration."""
    strategy: Optional[Literal["auto", "fast", "quality"]] = None
    max_concurrent: Optional[int] = Field(default=3, alias="maxConcurrent")

    class Config:
        populate_by_name = True


class ReturnConfig(BaseModel):
    """Return configuration."""
    format: Optional[Literal["hqcc", "raw", "both"]] = None
    top_k: Optional[int] = Field(default=5, alias="topK")

    class Config:
        populate_by_name = True


class RankingCustomConfig(BaseModel):
    """Custom ranking weights (0-1 each)."""
    cache_hit: Optional[float] = Field(default=None, alias="cacheHit")
    relevance: Optional[float] = None
    freshness: Optional[float] = None
    quality: Optional[float] = None

    class Config:
        populate_by_name = True


class RankingConfig(BaseModel):
    """Ranking configuration (query mode only)."""
    preset: Optional[Literal["cache_first", "relevance_first", "balanced"]] = None
    custom: Optional[RankingCustomConfig] = None


class LoadOptions(BaseModel):
    """Options for load() method."""
    input_type: Optional[Literal["url", "urls", "query"]] = Field(default=None, alias="inputType")
    process_uncached: Optional[bool] = Field(default=False, alias="processUncached")
    search: Optional[SearchConfig] = None
    processing: Optional[ProcessingConfig] = None
    return_config: Optional[ReturnConfig] = Field(default=None, alias="return")
    ranking: Optional[RankingConfig] = None

    class Config:
        populate_by_name = True


class RankingFactors(BaseModel):
    """Ranking factors breakdown."""
    cache: float = 0
    relevance: float = 0
    freshness: float = 0
    quality: float = 0


class RankingInfo(BaseModel):
    """Ranking details for a result item."""
    score: float
    factors: RankingFactors = Field(default_factory=RankingFactors)


class LoadResultItem(BaseModel):
    """A single result item from load()."""
    rank: Optional[int] = None  # 1-based, query mode
    url: str
    title: Optional[str] = None
    hqcc: Optional[str] = None
    raw: Optional[str] = None
    cached: bool = False
    cached_at: Optional[str] = Field(default=None, alias="cachedAt")
    processed: Optional[bool] = None  # batch mode
    found: Optional[bool] = None  # batch mode
    error: Optional[str] = None  # if processing failed
    ranking: Optional[RankingInfo] = None  # query mode
    meta: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True


# Cost structures differ by mode
class SingleUrlCost(BaseModel):
    """Cost for single URL mode."""
    credits: float
    cached: bool


class BatchUrlCost(BaseModel):
    """Cost for batch URL mode."""
    credits: float
    cached: int


class QueryCost(BaseModel):
    """Cost for query mode."""
    search_credits: float = Field(alias="searchCredits")
    compression_credits: float = Field(alias="compressionCredits")
    total_credits: float = Field(alias="totalCredits")
    saved_by_cache: float = Field(alias="savedByCache")

    class Config:
        populate_by_name = True


# Summary structures differ by mode
class BatchSummary(BaseModel):
    """Summary for batch URL mode."""
    total: int
    found: int
    not_found: int = Field(alias="notFound")
    cached: int
    processed: int

    class Config:
        populate_by_name = True


class QuerySummary(BaseModel):
    """Summary for query mode."""
    query: str
    searched: int
    cache_hits: int = Field(alias="cacheHits")
    compressed: int
    returned: int

    class Config:
        populate_by_name = True


class PrismerError(BaseModel):
    """Error information."""
    code: str
    message: str


class LoadResult(BaseModel):
    """Result from load() method."""
    success: bool
    request_id: Optional[str] = Field(default=None, alias="requestId")
    mode: Optional[Literal["single_url", "batch_urls", "query"]] = None
    result: Optional[LoadResultItem] = None  # single_url mode
    results: Optional[List[LoadResultItem]] = None  # batch_urls/query mode
    summary: Optional[Dict[str, Any]] = None  # BatchSummary or QuerySummary
    cost: Optional[Dict[str, Any]] = None  # SingleUrlCost, BatchUrlCost, or QueryCost
    processing_time: Optional[int] = Field(default=None, alias="processingTime")
    error: Optional[PrismerError] = None

    class Config:
        populate_by_name = True


# ============================================================================
# Save API Types
# ============================================================================

class SaveOptions(BaseModel):
    """Options for single save."""
    url: str
    hqcc: str
    raw: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class SaveBatchOptions(BaseModel):
    """Options for batch save (max 50 items)."""
    items: List[SaveOptions]


class SaveResultItem(BaseModel):
    """A single result from batch save."""
    url: str
    status: str


class SaveSummary(BaseModel):
    """Summary from batch save."""
    total: int
    created: int
    exists: int


class SaveResult(BaseModel):
    """Result from save() method."""
    success: bool
    status: Optional[str] = None  # 'created' | 'exists' (single save)
    url: Optional[str] = None  # single save
    results: Optional[List[SaveResultItem]] = None  # batch save
    summary: Optional[SaveSummary] = None  # batch save
    error: Optional[PrismerError] = None
