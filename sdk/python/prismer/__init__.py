"""
Prismer Cloud SDK for Python

Official Python SDK for Prismer Cloud API — Context, Parse, and IM.

Example:
    >>> from prismer import PrismerClient
    >>> client = PrismerClient(api_key="sk-prismer-...")
    >>> result = client.load("https://example.com")
    >>> pdf = client.parse_pdf("https://arxiv.org/pdf/2401.00001.pdf")
    >>> client.im.direct.send("user-123", "Hello!")
    >>> client.im.groups.list()
"""

from .client import PrismerClient, AsyncPrismerClient, IMClient, AsyncIMClient
from .realtime import (
    RealtimeConfig,
    RealtimeWSClient,
    RealtimeSSEClient,
    AsyncRealtimeWSClient,
    AsyncRealtimeSSEClient,
    # Event payloads
    AuthenticatedPayload,
    MessageNewPayload,
    TypingIndicatorPayload,
    PresenceChangedPayload,
    PongPayload,
    ErrorPayload,
    DisconnectedPayload,
    ReconnectingPayload,
)
from .types import (
    ENVIRONMENTS,
    PrismerError,
    # Context API
    LoadResult,
    LoadResultItem,
    SaveOptions,
    SaveBatchOptions,
    SaveResult,
    # Parse API
    ParseOptions,
    ParseResult,
    ParseDocument,
    ParseUsage,
    ParseCost,
    # IM API
    IMResult,
    IMRegisterOptions,
    IMRegisterData,
    IMMeData,
    IMUser,
    IMMessage,
    IMMessageData,
    IMGroupData,
    IMContact,
    IMDiscoverAgent,
    IMBindingData,
    IMBinding,
    IMCreditsData,
    IMTransaction,
    IMTokenData,
    IMConversation,
    IMWorkspaceData,
    IMAutocompleteResult,
)

__version__ = "1.3.2"
__all__ = [
    # Clients
    "PrismerClient",
    "AsyncPrismerClient",
    "IMClient",
    "AsyncIMClient",
    # Real-Time Clients
    "RealtimeConfig",
    "RealtimeWSClient",
    "RealtimeSSEClient",
    "AsyncRealtimeWSClient",
    "AsyncRealtimeSSEClient",
    # Real-Time Event Payloads
    "AuthenticatedPayload",
    "MessageNewPayload",
    "TypingIndicatorPayload",
    "PresenceChangedPayload",
    "PongPayload",
    "ErrorPayload",
    "DisconnectedPayload",
    "ReconnectingPayload",
    # Environment
    "ENVIRONMENTS",
    # Shared
    "PrismerError",
    # Context API
    "LoadResult",
    "LoadResultItem",
    "SaveOptions",
    "SaveBatchOptions",
    "SaveResult",
    # Parse API
    "ParseOptions",
    "ParseResult",
    "ParseDocument",
    "ParseUsage",
    "ParseCost",
    # IM API
    "IMResult",
    "IMRegisterOptions",
    "IMRegisterData",
    "IMMeData",
    "IMUser",
    "IMMessage",
    "IMMessageData",
    "IMGroupData",
    "IMContact",
    "IMDiscoverAgent",
    "IMBindingData",
    "IMBinding",
    "IMCreditsData",
    "IMTransaction",
    "IMTokenData",
    "IMConversation",
    "IMWorkspaceData",
    "IMAutocompleteResult",
]
