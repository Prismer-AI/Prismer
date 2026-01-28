"""
Prismer Cloud SDK for Python

Official Python SDK for Prismer Cloud API.

Example:
    >>> from prismer import PrismerClient
    >>> client = PrismerClient(api_key="sk-prismer-...")
    >>> result = client.load("https://example.com")
    >>> print(result.result.hqcc)
"""

from .client import PrismerClient, AsyncPrismerClient
from .types import (
    LoadOptions,
    LoadResult,
    LoadResultItem,
    SaveOptions,
    SaveBatchOptions,
    SaveResult,
    PrismerError,
)

__version__ = "0.1.0"
__all__ = [
    "PrismerClient",
    "AsyncPrismerClient",
    "LoadOptions",
    "LoadResult",
    "LoadResultItem",
    "SaveOptions",
    "SaveBatchOptions",
    "SaveResult",
    "PrismerError",
]
