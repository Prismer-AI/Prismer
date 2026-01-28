"""Prismer Cloud API Client - Based on actual API implementation."""

from typing import Any, Dict, List, Optional, Union
import httpx

from .types import (
    LoadResult,
    SaveOptions,
    SaveResult,
    PrismerError,
)


class PrismerClient:
    """
    Prismer Cloud API Client.

    Example:
        >>> client = PrismerClient(api_key="sk-prismer-...")
        >>> result = client.load("https://example.com")
        >>> print(result.result.hqcc if result.result else None)

    Args:
        api_key: Your Prismer API key (starts with sk-prismer-)
        base_url: API base URL (default: https://prismer.cloud)
        timeout: Request timeout in seconds (default: 30)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://prismer.cloud",
        timeout: float = 30.0,
    ):
        if not api_key:
            raise ValueError("api_key is required")
        if not api_key.startswith("sk-prismer-"):
            import warnings
            warnings.warn('API key should start with "sk-prismer-"')

        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    def __enter__(self) -> "PrismerClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def load(
        self,
        input: Union[str, List[str]],
        *,
        input_type: Optional[str] = None,
        process_uncached: bool = False,
        search: Optional[Dict[str, Any]] = None,
        processing: Optional[Dict[str, Any]] = None,
        return_config: Optional[Dict[str, Any]] = None,
        ranking: Optional[Dict[str, Any]] = None,
    ) -> LoadResult:
        """
        Load content from URL(s) or search query.

        The API auto-detects input type:
        - Single URL: "https://..." → checks cache, fetches & compresses if miss
        - URL array: ["url1", "url2"] → batch cache check
        - Query string: "search terms" → searches, caches results, ranks

        Args:
            input: URL, list of URLs, or search query
            input_type: Force input type ('url', 'urls', 'query')
            process_uncached: Process uncached URLs in batch mode
            search: Search config (topK for query mode)
            processing: Processing config (strategy, maxConcurrent)
            return_config: Return config (format, topK)
            ranking: Ranking config (preset: cache_first|relevance_first|balanced, custom weights)

        Returns:
            LoadResult with content and metadata

        Example:
            >>> # Single URL
            >>> result = client.load("https://example.com")
            >>> print(result.result.hqcc)

            >>> # Batch URLs with processing
            >>> result = client.load(["url1", "url2"], process_uncached=True)

            >>> # Search query
            >>> result = client.load("latest AI news", 
            ...     search={"topK": 15},
            ...     return_config={"topK": 5, "format": "both"},
            ...     ranking={"preset": "cache_first"})
        """
        payload: Dict[str, Any] = {"input": input}
        
        if input_type:
            payload["inputType"] = input_type
        if process_uncached:
            payload["processUncached"] = process_uncached
        if search:
            payload["search"] = search
        if processing:
            payload["processing"] = processing
        if return_config:
            payload["return"] = return_config
        if ranking:
            payload["ranking"] = ranking

        try:
            response = self._client.post("/api/context/load", json=payload)
            data = response.json()

            if not response.is_success:
                return LoadResult(
                    success=False,
                    error=PrismerError(
                        code=data.get("error", {}).get("code", "HTTP_ERROR"),
                        message=data.get("error", {}).get("message", f"HTTP {response.status_code}"),
                    ),
                )

            return LoadResult(**data)

        except httpx.TimeoutException:
            return LoadResult(
                success=False,
                error=PrismerError(code="TIMEOUT", message="Request timed out"),
            )
        except Exception as e:
            return LoadResult(
                success=False,
                error=PrismerError(code="NETWORK_ERROR", message=str(e)),
            )

    def save(
        self,
        url: Optional[str] = None,
        hqcc: Optional[str] = None,
        raw: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        *,
        items: Optional[List[Dict[str, Any]]] = None,
    ) -> SaveResult:
        """
        Save content to Prismer cache.

        Requires authentication. Content is stored globally and can be
        retrieved by any authenticated user via load().

        Can be called in two ways:
        1. Single save: save(url="...", hqcc="...")
        2. Batch save: save(items=[{url, hqcc}, ...]) (max 50)

        Args:
            url: Source URL (single save)
            hqcc: Compressed content (single save)
            raw: Raw/intermediate content (optional)
            meta: Additional metadata (optional)
            items: List of items for batch save

        Returns:
            SaveResult with status

        Example:
            >>> # Single save
            >>> result = client.save(
            ...     url="https://example.com",
            ...     hqcc="compressed content...",
            ...     meta={"source": "my-agent"}
            ... )

            >>> # Batch save
            >>> result = client.save(items=[
            ...     {"url": "url1", "hqcc": "content1"},
            ...     {"url": "url2", "hqcc": "content2"},
            ... ])
        """
        if items is not None:
            # Batch save
            payload: Dict[str, Any] = {"items": items}
        else:
            # Single save
            if not url or not hqcc:
                return SaveResult(
                    success=False,
                    error=PrismerError(
                        code="INVALID_INPUT",
                        message="url and hqcc are required for single save",
                    ),
                )
            payload = {"url": url, "hqcc": hqcc}
            if raw:
                payload["raw"] = raw
            if meta:
                payload["meta"] = meta

        try:
            response = self._client.post("/api/context/save", json=payload)
            data = response.json()

            if not response.is_success:
                return SaveResult(
                    success=False,
                    error=PrismerError(
                        code=data.get("error", {}).get("code", "HTTP_ERROR"),
                        message=data.get("error", {}).get("message", f"HTTP {response.status_code}"),
                    ),
                )

            return SaveResult(**data)

        except httpx.TimeoutException:
            return SaveResult(
                success=False,
                error=PrismerError(code="TIMEOUT", message="Request timed out"),
            )
        except Exception as e:
            return SaveResult(
                success=False,
                error=PrismerError(code="NETWORK_ERROR", message=str(e)),
            )

    def save_batch(self, items: List[SaveOptions]) -> SaveResult:
        """
        Batch save multiple items (max 50).

        Convenience method for save(items=[...]).

        Args:
            items: List of SaveOptions

        Returns:
            SaveResult with batch status
        """
        return self.save(items=[item.model_dump() for item in items])


class AsyncPrismerClient:
    """
    Async Prismer Cloud API Client.

    Example:
        >>> async with AsyncPrismerClient(api_key="sk-prismer-...") as client:
        ...     result = await client.load("https://example.com")
        ...     print(result.result.hqcc if result.result else None)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://prismer.cloud",
        timeout: float = 30.0,
    ):
        if not api_key:
            raise ValueError("api_key is required")
        
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )

    async def __aenter__(self) -> "AsyncPrismerClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()

    async def load(
        self,
        input: Union[str, List[str]],
        *,
        input_type: Optional[str] = None,
        process_uncached: bool = False,
        search: Optional[Dict[str, Any]] = None,
        processing: Optional[Dict[str, Any]] = None,
        return_config: Optional[Dict[str, Any]] = None,
        ranking: Optional[Dict[str, Any]] = None,
    ) -> LoadResult:
        """Load content (async version). See PrismerClient.load() for details."""
        payload: Dict[str, Any] = {"input": input}
        
        if input_type:
            payload["inputType"] = input_type
        if process_uncached:
            payload["processUncached"] = process_uncached
        if search:
            payload["search"] = search
        if processing:
            payload["processing"] = processing
        if return_config:
            payload["return"] = return_config
        if ranking:
            payload["ranking"] = ranking

        try:
            response = await self._client.post("/api/context/load", json=payload)
            data = response.json()

            if not response.is_success:
                return LoadResult(
                    success=False,
                    error=PrismerError(
                        code=data.get("error", {}).get("code", "HTTP_ERROR"),
                        message=data.get("error", {}).get("message", f"HTTP {response.status_code}"),
                    ),
                )

            return LoadResult(**data)

        except httpx.TimeoutException:
            return LoadResult(
                success=False,
                error=PrismerError(code="TIMEOUT", message="Request timed out"),
            )
        except Exception as e:
            return LoadResult(
                success=False,
                error=PrismerError(code="NETWORK_ERROR", message=str(e)),
            )

    async def save(
        self,
        url: Optional[str] = None,
        hqcc: Optional[str] = None,
        raw: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        *,
        items: Optional[List[Dict[str, Any]]] = None,
    ) -> SaveResult:
        """Save content (async version). See PrismerClient.save() for details."""
        if items is not None:
            payload: Dict[str, Any] = {"items": items}
        else:
            if not url or not hqcc:
                return SaveResult(
                    success=False,
                    error=PrismerError(
                        code="INVALID_INPUT",
                        message="url and hqcc are required for single save",
                    ),
                )
            payload = {"url": url, "hqcc": hqcc}
            if raw:
                payload["raw"] = raw
            if meta:
                payload["meta"] = meta

        try:
            response = await self._client.post("/api/context/save", json=payload)
            data = response.json()

            if not response.is_success:
                return SaveResult(
                    success=False,
                    error=PrismerError(
                        code=data.get("error", {}).get("code", "HTTP_ERROR"),
                        message=data.get("error", {}).get("message", f"HTTP {response.status_code}"),
                    ),
                )

            return SaveResult(**data)

        except httpx.TimeoutException:
            return SaveResult(
                success=False,
                error=PrismerError(code="TIMEOUT", message="Request timed out"),
            )
        except Exception as e:
            return SaveResult(
                success=False,
                error=PrismerError(code="NETWORK_ERROR", message=str(e)),
            )
