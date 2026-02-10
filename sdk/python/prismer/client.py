"""Prismer Cloud API Client — covers Context, Parse, and IM APIs."""

from typing import Any, Dict, List, Optional, Union
import httpx

from .types import (
    ENVIRONMENTS,
    LoadResult,
    SaveResult,
    ParseResult,
    IMResult,
    PrismerError,
)


# ============================================================================
# IM Sub-Client Building Blocks (sync)
# ============================================================================

class AccountClient:
    """Account management: register, identity, token refresh."""

    def __init__(self, request_fn):
        self._request = request_fn

    def register(self, **kwargs) -> IMResult:
        """Register an agent or human identity."""
        return self._request("POST", "/api/im/register", json=kwargs)

    def me(self) -> IMResult:
        """Get own identity, stats, bindings, credits."""
        return self._request("GET", "/api/im/me")

    def refresh_token(self) -> IMResult:
        """Refresh JWT token."""
        return self._request("POST", "/api/im/token/refresh")


class DirectClient:
    """Direct messaging between two users."""

    def __init__(self, request_fn):
        self._request = request_fn

    def send(
        self, user_id: str, content: str, *, type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
        parent_id: Optional[str] = None,
    ) -> IMResult:
        """Send a direct message to a user."""
        payload: Dict[str, Any] = {"content": content, "type": type}
        if metadata:
            payload["metadata"] = metadata
        if parent_id:
            payload["parentId"] = parent_id
        return self._request("POST", f"/api/im/direct/{user_id}/messages", json=payload)

    def get_messages(
        self, user_id: str, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        """Get direct message history with a user."""
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return self._request("GET", f"/api/im/direct/{user_id}/messages", params=params)


class GroupsClient:
    """Group chat management and messaging."""

    def __init__(self, request_fn):
        self._request = request_fn

    def create(
        self, title: str, members: List[str], *, description: Optional[str] = None,
    ) -> IMResult:
        """Create a group chat."""
        payload: Dict[str, Any] = {"title": title, "members": members}
        if description:
            payload["description"] = description
        return self._request("POST", "/api/im/groups", json=payload)

    def list(self) -> IMResult:
        """List groups you belong to."""
        return self._request("GET", "/api/im/groups")

    def get(self, group_id: str) -> IMResult:
        """Get group details."""
        return self._request("GET", f"/api/im/groups/{group_id}")

    def send(
        self, group_id: str, content: str, *, type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> IMResult:
        """Send a message to a group."""
        payload: Dict[str, Any] = {"content": content, "type": type}
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/im/groups/{group_id}/messages", json=payload)

    def get_messages(
        self, group_id: str, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        """Get group message history."""
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return self._request("GET", f"/api/im/groups/{group_id}/messages", params=params)

    def add_member(self, group_id: str, user_id: str) -> IMResult:
        """Add a member to a group (owner/admin only)."""
        return self._request("POST", f"/api/im/groups/{group_id}/members", json={"userId": user_id})

    def remove_member(self, group_id: str, user_id: str) -> IMResult:
        """Remove a member from a group (owner/admin only)."""
        return self._request("DELETE", f"/api/im/groups/{group_id}/members/{user_id}")


class ConversationsClient:
    """Conversation management."""

    def __init__(self, request_fn):
        self._request = request_fn

    def list(self, *, with_unread: bool = False, unread_only: bool = False) -> IMResult:
        """List conversations."""
        params: Dict[str, Any] = {}
        if with_unread:
            params["withUnread"] = "true"
        if unread_only:
            params["unreadOnly"] = "true"
        return self._request("GET", "/api/im/conversations", params=params)

    def get(self, conversation_id: str) -> IMResult:
        """Get conversation details."""
        return self._request("GET", f"/api/im/conversations/{conversation_id}")

    def create_direct(self, user_id: str) -> IMResult:
        """Create a direct conversation."""
        return self._request("POST", "/api/im/conversations/direct", json={"userId": user_id})

    def mark_as_read(self, conversation_id: str) -> IMResult:
        """Mark a conversation as read."""
        return self._request("POST", f"/api/im/conversations/{conversation_id}/read")


class MessagesClient:
    """Low-level message operations (by conversation ID)."""

    def __init__(self, request_fn):
        self._request = request_fn

    def send(
        self, conversation_id: str, content: str, *, type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> IMResult:
        """Send a message to a conversation."""
        payload: Dict[str, Any] = {"content": content, "type": type}
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", f"/api/im/messages/{conversation_id}", json=payload)

    def get_history(
        self, conversation_id: str, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        """Get message history for a conversation."""
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return self._request("GET", f"/api/im/messages/{conversation_id}", params=params)

    def edit(self, conversation_id: str, message_id: str, content: str) -> IMResult:
        """Edit a message."""
        return self._request(
            "PATCH", f"/api/im/messages/{conversation_id}/{message_id}", json={"content": content}
        )

    def delete(self, conversation_id: str, message_id: str) -> IMResult:
        """Delete a message."""
        return self._request("DELETE", f"/api/im/messages/{conversation_id}/{message_id}")


class ContactsClient:
    """Contacts and agent discovery."""

    def __init__(self, request_fn):
        self._request = request_fn

    def list(self) -> IMResult:
        """List contacts (users you've communicated with)."""
        return self._request("GET", "/api/im/contacts")

    def discover(self, *, type: Optional[str] = None, capability: Optional[str] = None) -> IMResult:
        """Discover agents by capability or type."""
        params: Dict[str, Any] = {}
        if type:
            params["type"] = type
        if capability:
            params["capability"] = capability
        return self._request("GET", "/api/im/discover", params=params)


class BindingsClient:
    """Social bindings (Telegram, Discord, Slack, etc.)."""

    def __init__(self, request_fn):
        self._request = request_fn

    def create(self, **kwargs) -> IMResult:
        """Create a social binding."""
        return self._request("POST", "/api/im/bindings", json=kwargs)

    def verify(self, binding_id: str, code: str) -> IMResult:
        """Verify a binding with 6-digit code."""
        return self._request("POST", f"/api/im/bindings/{binding_id}/verify", json={"code": code})

    def list(self) -> IMResult:
        """List bindings."""
        return self._request("GET", "/api/im/bindings")

    def delete(self, binding_id: str) -> IMResult:
        """Delete a binding."""
        return self._request("DELETE", f"/api/im/bindings/{binding_id}")


class CreditsClient:
    """Credits balance and transaction history."""

    def __init__(self, request_fn):
        self._request = request_fn

    def get(self) -> IMResult:
        """Get credits balance."""
        return self._request("GET", "/api/im/credits")

    def transactions(
        self, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        """Get credit transaction history."""
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return self._request("GET", "/api/im/credits/transactions", params=params)


class WorkspaceClient:
    """Workspace management (advanced collaborative environments)."""

    def __init__(self, request_fn):
        self._request = request_fn

    def init(self) -> IMResult:
        """Initialize a 1:1 workspace (1 user + 1 agent)."""
        return self._request("POST", "/api/im/workspace/init")

    def init_group(self) -> IMResult:
        """Initialize a group workspace (multi-user + multi-agent)."""
        return self._request("POST", "/api/im/workspace/init-group")

    def add_agent(self, workspace_id: str, agent_id: str) -> IMResult:
        """Add an agent to a workspace."""
        return self._request(
            "POST", f"/api/im/workspace/{workspace_id}/agents", json={"agentId": agent_id}
        )

    def list_agents(self, workspace_id: str) -> IMResult:
        """List agents in a workspace."""
        return self._request("GET", f"/api/im/workspace/{workspace_id}/agents")

    def mention_autocomplete(self, query: Optional[str] = None) -> IMResult:
        """@mention autocomplete."""
        params: Dict[str, Any] = {}
        if query:
            params["q"] = query
        return self._request("GET", "/api/im/workspace/mentions/autocomplete", params=params)


class IMRealtimeClient:
    """Real-time connection factory (WebSocket & SSE)."""

    def __init__(self, base_url: str):
        self._base_url = base_url

    def ws_url(self, token: Optional[str] = None) -> str:
        """Get the WebSocket URL."""
        base = self._base_url.replace("https://", "wss://").replace("http://", "ws://")
        return f"{base}/ws?token={token}" if token else f"{base}/ws"

    def sse_url(self, token: Optional[str] = None) -> str:
        """Get the SSE URL."""
        return f"{self._base_url}/sse?token={token}" if token else f"{self._base_url}/sse"

    def connect_ws(self, config) -> "RealtimeWSClient":
        """Create a sync WebSocket client. Call .connect() to start."""
        from .realtime import RealtimeWSClient
        return RealtimeWSClient(self._base_url, config)

    def connect_sse(self, config) -> "RealtimeSSEClient":
        """Create a sync SSE client. Call .connect() to start."""
        from .realtime import RealtimeSSEClient
        return RealtimeSSEClient(self._base_url, config)


# ============================================================================
# IM Client (sync) — orchestrates sub-modules
# ============================================================================

class IMClient:
    """IM API sub-client with sub-module access pattern. Access via ``client.im``."""

    def __init__(self, request_fn, base_url: str):
        self._request = request_fn
        self.account = AccountClient(request_fn)
        self.direct = DirectClient(request_fn)
        self.groups = GroupsClient(request_fn)
        self.conversations = ConversationsClient(request_fn)
        self.messages = MessagesClient(request_fn)
        self.contacts = ContactsClient(request_fn)
        self.bindings = BindingsClient(request_fn)
        self.credits = CreditsClient(request_fn)
        self.workspace = WorkspaceClient(request_fn)
        self.realtime = IMRealtimeClient(base_url)

    def health(self) -> IMResult:
        """IM health check."""
        return self._request("GET", "/api/im/health")


# ============================================================================
# IM Sub-Client Building Blocks (async)
# ============================================================================

class AsyncAccountClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def register(self, **kwargs) -> IMResult:
        return await self._request("POST", "/api/im/register", json=kwargs)

    async def me(self) -> IMResult:
        return await self._request("GET", "/api/im/me")

    async def refresh_token(self) -> IMResult:
        return await self._request("POST", "/api/im/token/refresh")


class AsyncDirectClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def send(
        self, user_id: str, content: str, *, type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
        parent_id: Optional[str] = None,
    ) -> IMResult:
        payload: Dict[str, Any] = {"content": content, "type": type}
        if metadata:
            payload["metadata"] = metadata
        if parent_id:
            payload["parentId"] = parent_id
        return await self._request("POST", f"/api/im/direct/{user_id}/messages", json=payload)

    async def get_messages(
        self, user_id: str, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return await self._request("GET", f"/api/im/direct/{user_id}/messages", params=params)


class AsyncGroupsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def create(
        self, title: str, members: List[str], *, description: Optional[str] = None,
    ) -> IMResult:
        payload: Dict[str, Any] = {"title": title, "members": members}
        if description:
            payload["description"] = description
        return await self._request("POST", "/api/im/groups", json=payload)

    async def list(self) -> IMResult:
        return await self._request("GET", "/api/im/groups")

    async def get(self, group_id: str) -> IMResult:
        return await self._request("GET", f"/api/im/groups/{group_id}")

    async def send(
        self, group_id: str, content: str, *, type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> IMResult:
        payload: Dict[str, Any] = {"content": content, "type": type}
        if metadata:
            payload["metadata"] = metadata
        return await self._request("POST", f"/api/im/groups/{group_id}/messages", json=payload)

    async def get_messages(
        self, group_id: str, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return await self._request("GET", f"/api/im/groups/{group_id}/messages", params=params)

    async def add_member(self, group_id: str, user_id: str) -> IMResult:
        return await self._request(
            "POST", f"/api/im/groups/{group_id}/members", json={"userId": user_id}
        )

    async def remove_member(self, group_id: str, user_id: str) -> IMResult:
        return await self._request("DELETE", f"/api/im/groups/{group_id}/members/{user_id}")


class AsyncConversationsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def list(self, *, with_unread: bool = False, unread_only: bool = False) -> IMResult:
        params: Dict[str, Any] = {}
        if with_unread:
            params["withUnread"] = "true"
        if unread_only:
            params["unreadOnly"] = "true"
        return await self._request("GET", "/api/im/conversations", params=params)

    async def get(self, conversation_id: str) -> IMResult:
        return await self._request("GET", f"/api/im/conversations/{conversation_id}")

    async def create_direct(self, user_id: str) -> IMResult:
        return await self._request(
            "POST", "/api/im/conversations/direct", json={"userId": user_id}
        )

    async def mark_as_read(self, conversation_id: str) -> IMResult:
        return await self._request("POST", f"/api/im/conversations/{conversation_id}/read")


class AsyncMessagesClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def send(
        self, conversation_id: str, content: str, *, type: str = "text",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> IMResult:
        payload: Dict[str, Any] = {"content": content, "type": type}
        if metadata:
            payload["metadata"] = metadata
        return await self._request("POST", f"/api/im/messages/{conversation_id}", json=payload)

    async def get_history(
        self, conversation_id: str, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return await self._request("GET", f"/api/im/messages/{conversation_id}", params=params)

    async def edit(self, conversation_id: str, message_id: str, content: str) -> IMResult:
        return await self._request(
            "PATCH", f"/api/im/messages/{conversation_id}/{message_id}", json={"content": content}
        )

    async def delete(self, conversation_id: str, message_id: str) -> IMResult:
        return await self._request("DELETE", f"/api/im/messages/{conversation_id}/{message_id}")


class AsyncContactsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def list(self) -> IMResult:
        return await self._request("GET", "/api/im/contacts")

    async def discover(
        self, *, type: Optional[str] = None, capability: Optional[str] = None,
    ) -> IMResult:
        params: Dict[str, Any] = {}
        if type:
            params["type"] = type
        if capability:
            params["capability"] = capability
        return await self._request("GET", "/api/im/discover", params=params)


class AsyncBindingsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def create(self, **kwargs) -> IMResult:
        return await self._request("POST", "/api/im/bindings", json=kwargs)

    async def verify(self, binding_id: str, code: str) -> IMResult:
        return await self._request(
            "POST", f"/api/im/bindings/{binding_id}/verify", json={"code": code}
        )

    async def list(self) -> IMResult:
        return await self._request("GET", "/api/im/bindings")

    async def delete(self, binding_id: str) -> IMResult:
        return await self._request("DELETE", f"/api/im/bindings/{binding_id}")


class AsyncCreditsClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def get(self) -> IMResult:
        return await self._request("GET", "/api/im/credits")

    async def transactions(
        self, *, limit: Optional[int] = None, offset: Optional[int] = None,
    ) -> IMResult:
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
        return await self._request("GET", "/api/im/credits/transactions", params=params)


class AsyncWorkspaceClient:
    def __init__(self, request_fn):
        self._request = request_fn

    async def init(self) -> IMResult:
        return await self._request("POST", "/api/im/workspace/init")

    async def init_group(self) -> IMResult:
        return await self._request("POST", "/api/im/workspace/init-group")

    async def add_agent(self, workspace_id: str, agent_id: str) -> IMResult:
        return await self._request(
            "POST", f"/api/im/workspace/{workspace_id}/agents", json={"agentId": agent_id}
        )

    async def list_agents(self, workspace_id: str) -> IMResult:
        return await self._request("GET", f"/api/im/workspace/{workspace_id}/agents")

    async def mention_autocomplete(self, query: Optional[str] = None) -> IMResult:
        params: Dict[str, Any] = {}
        if query:
            params["q"] = query
        return await self._request("GET", "/api/im/workspace/mentions/autocomplete", params=params)


class AsyncIMRealtimeClient:
    """Async real-time connection factory (WebSocket & SSE)."""

    def __init__(self, base_url: str):
        self._base_url = base_url

    def ws_url(self, token: Optional[str] = None) -> str:
        base = self._base_url.replace("https://", "wss://").replace("http://", "ws://")
        return f"{base}/ws?token={token}" if token else f"{base}/ws"

    def sse_url(self, token: Optional[str] = None) -> str:
        return f"{self._base_url}/sse?token={token}" if token else f"{self._base_url}/sse"

    def connect_ws(self, config) -> "AsyncRealtimeWSClient":
        from .realtime import AsyncRealtimeWSClient
        return AsyncRealtimeWSClient(self._base_url, config)

    def connect_sse(self, config) -> "AsyncRealtimeSSEClient":
        from .realtime import AsyncRealtimeSSEClient
        return AsyncRealtimeSSEClient(self._base_url, config)


# ============================================================================
# IM Client (async) — orchestrates sub-modules
# ============================================================================

class AsyncIMClient:
    """Async IM API sub-client with sub-module access pattern. Access via ``client.im``."""

    def __init__(self, request_fn, base_url: str):
        self._request = request_fn
        self.account = AsyncAccountClient(request_fn)
        self.direct = AsyncDirectClient(request_fn)
        self.groups = AsyncGroupsClient(request_fn)
        self.conversations = AsyncConversationsClient(request_fn)
        self.messages = AsyncMessagesClient(request_fn)
        self.contacts = AsyncContactsClient(request_fn)
        self.bindings = AsyncBindingsClient(request_fn)
        self.credits = AsyncCreditsClient(request_fn)
        self.workspace = AsyncWorkspaceClient(request_fn)
        self.realtime = AsyncIMRealtimeClient(base_url)

    async def health(self) -> IMResult:
        return await self._request("GET", "/api/im/health")


# ============================================================================
# Prismer Client (sync)
# ============================================================================

class PrismerClient:
    """
    Prismer Cloud API Client.

    Example::

        client = PrismerClient(api_key="sk-prismer-...")

        # Context API
        result = client.load("https://example.com")

        # Parse API
        pdf = client.parse_pdf("https://arxiv.org/pdf/2401.00001.pdf")

        # IM API (sub-module pattern)
        reg = client.im.account.register(type="agent", username="my-agent", displayName="My Agent")
        client.im.direct.send("user-123", "Hello!")
        groups = client.im.groups.list()
        conversations = client.im.conversations.list()
    """

    def __init__(
        self,
        api_key: str,
        *,
        environment: str = "production",
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        im_agent: Optional[str] = None,
    ):
        if not api_key:
            raise ValueError("api_key is required")
        if not api_key.startswith("sk-prismer-") and not api_key.startswith("eyJ"):
            import warnings
            warnings.warn('API key should start with "sk-prismer-" (or "eyJ" for IM JWT)')

        env_url = ENVIRONMENTS.get(environment, ENVIRONMENTS["production"])
        self._base_url = (base_url or env_url).rstrip("/")

        headers: Dict[str, str] = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if im_agent:
            headers["X-IM-Agent"] = im_agent

        self._client = httpx.Client(
            base_url=self._base_url,
            timeout=timeout,
            headers=headers,
        )

        self.im = IMClient(self._request, self._base_url)

    def __enter__(self) -> "PrismerClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[Any] = None,
        params: Optional[Dict[str, Any]] = None,
    ):
        try:
            response = self._client.request(method, path, json=json, params=params)
            data = response.json()
            if not response.is_success:
                err = data.get("error", {"code": "HTTP_ERROR", "message": f"HTTP {response.status_code}"})
                data.setdefault("success", False)
                data.setdefault("ok", False)
                data["error"] = err
            return data
        except httpx.TimeoutException:
            return {"success": False, "ok": False, "error": {"code": "TIMEOUT", "message": "Request timed out"}}
        except Exception as e:
            return {"success": False, "ok": False, "error": {"code": "NETWORK_ERROR", "message": str(e)}}

    # --------------------------------------------------------------------------
    # Context API
    # --------------------------------------------------------------------------

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
        """Load content from URL(s) or search query."""
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
        data = self._request("POST", "/api/context/load", json=payload)
        return LoadResult(**data)

    def save(
        self,
        url: Optional[str] = None,
        hqcc: Optional[str] = None,
        raw: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        *,
        items: Optional[List[Dict[str, Any]]] = None,
    ) -> SaveResult:
        """Save content to Prismer cache."""
        if items is not None:
            payload: Dict[str, Any] = {"items": items}
        else:
            if not url or not hqcc:
                return SaveResult(
                    success=False,
                    error=PrismerError(code="INVALID_INPUT", message="url and hqcc are required for single save"),
                )
            payload = {"url": url, "hqcc": hqcc}
            if raw:
                payload["raw"] = raw
            if meta:
                payload["meta"] = meta
        data = self._request("POST", "/api/context/save", json=payload)
        return SaveResult(**data)

    def save_batch(self, items: List[Dict[str, Any]]) -> SaveResult:
        """Batch save multiple items (max 50)."""
        return self.save(items=items)

    # --------------------------------------------------------------------------
    # Parse API
    # --------------------------------------------------------------------------

    def parse(
        self,
        *,
        url: Optional[str] = None,
        base64: Optional[str] = None,
        filename: Optional[str] = None,
        mode: str = "fast",
        output: str = "markdown",
        image_mode: Optional[str] = None,
        wait: Optional[bool] = None,
    ) -> ParseResult:
        """Parse a document (PDF, image) into structured content."""
        payload: Dict[str, Any] = {"mode": mode, "output": output}
        if url:
            payload["url"] = url
        if base64:
            payload["base64"] = base64
        if filename:
            payload["filename"] = filename
        if image_mode:
            payload["image_mode"] = image_mode
        if wait is not None:
            payload["wait"] = wait
        data = self._request("POST", "/api/parse", json=payload)
        return ParseResult(**data)

    def parse_pdf(self, url: str, mode: str = "fast") -> ParseResult:
        """Convenience: parse a PDF by URL."""
        return self.parse(url=url, mode=mode)

    def parse_status(self, task_id: str) -> ParseResult:
        """Check status of an async parse task."""
        data = self._request("GET", f"/api/parse/status/{task_id}")
        return ParseResult(**data)

    def parse_result(self, task_id: str) -> ParseResult:
        """Get result of a completed async parse task."""
        data = self._request("GET", f"/api/parse/result/{task_id}")
        return ParseResult(**data)

    # --------------------------------------------------------------------------
    # Convenience
    # --------------------------------------------------------------------------

    def search(
        self,
        query: str,
        *,
        top_k: Optional[int] = None,
        return_top_k: Optional[int] = None,
        format: Optional[str] = None,
        ranking: Optional[str] = None,
    ) -> LoadResult:
        """Search for content (convenience wrapper around load with query mode)."""
        return self.load(
            query,
            input_type="query",
            search={"topK": top_k} if top_k else None,
            return_config={"topK": return_top_k, "format": format}
            if (return_top_k or format)
            else None,
            ranking={"preset": ranking} if ranking else None,
        )


# ============================================================================
# Async Prismer Client
# ============================================================================

class AsyncPrismerClient:
    """
    Async Prismer Cloud API Client.

    Example::

        async with AsyncPrismerClient(api_key="sk-prismer-...") as client:
            result = await client.load("https://example.com")
            await client.im.direct.send("user-123", "Hello!")
    """

    def __init__(
        self,
        api_key: str,
        *,
        environment: str = "production",
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        im_agent: Optional[str] = None,
    ):
        if not api_key:
            raise ValueError("api_key is required")

        env_url = ENVIRONMENTS.get(environment, ENVIRONMENTS["production"])
        self._base_url = (base_url or env_url).rstrip("/")

        headers: Dict[str, str] = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if im_agent:
            headers["X-IM-Agent"] = im_agent

        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=timeout,
            headers=headers,
        )

        self.im = AsyncIMClient(self._request, self._base_url)

    async def __aenter__(self) -> "AsyncPrismerClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[Any] = None,
        params: Optional[Dict[str, Any]] = None,
    ):
        try:
            response = await self._client.request(method, path, json=json, params=params)
            data = response.json()
            if not response.is_success:
                err = data.get("error", {"code": "HTTP_ERROR", "message": f"HTTP {response.status_code}"})
                data.setdefault("success", False)
                data.setdefault("ok", False)
                data["error"] = err
            return data
        except httpx.TimeoutException:
            return {"success": False, "ok": False, "error": {"code": "TIMEOUT", "message": "Request timed out"}}
        except Exception as e:
            return {"success": False, "ok": False, "error": {"code": "NETWORK_ERROR", "message": str(e)}}

    # --- Context API ---

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
        data = await self._request("POST", "/api/context/load", json=payload)
        return LoadResult(**data)

    async def save(
        self,
        url: Optional[str] = None,
        hqcc: Optional[str] = None,
        raw: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        *,
        items: Optional[List[Dict[str, Any]]] = None,
    ) -> SaveResult:
        if items is not None:
            payload: Dict[str, Any] = {"items": items}
        else:
            if not url or not hqcc:
                return SaveResult(
                    success=False,
                    error=PrismerError(code="INVALID_INPUT", message="url and hqcc are required"),
                )
            payload = {"url": url, "hqcc": hqcc}
            if raw:
                payload["raw"] = raw
            if meta:
                payload["meta"] = meta
        data = await self._request("POST", "/api/context/save", json=payload)
        return SaveResult(**data)

    async def save_batch(self, items: List[Dict[str, Any]]) -> SaveResult:
        return await self.save(items=items)

    # --- Parse API ---

    async def parse(
        self,
        *,
        url: Optional[str] = None,
        base64: Optional[str] = None,
        filename: Optional[str] = None,
        mode: str = "fast",
        output: str = "markdown",
        image_mode: Optional[str] = None,
        wait: Optional[bool] = None,
    ) -> ParseResult:
        payload: Dict[str, Any] = {"mode": mode, "output": output}
        if url:
            payload["url"] = url
        if base64:
            payload["base64"] = base64
        if filename:
            payload["filename"] = filename
        if image_mode:
            payload["image_mode"] = image_mode
        if wait is not None:
            payload["wait"] = wait
        data = await self._request("POST", "/api/parse", json=payload)
        return ParseResult(**data)

    async def parse_pdf(self, url: str, mode: str = "fast") -> ParseResult:
        return await self.parse(url=url, mode=mode)

    async def parse_status(self, task_id: str) -> ParseResult:
        data = await self._request("GET", f"/api/parse/status/{task_id}")
        return ParseResult(**data)

    async def parse_result(self, task_id: str) -> ParseResult:
        data = await self._request("GET", f"/api/parse/result/{task_id}")
        return ParseResult(**data)

    # --- Convenience ---

    async def search(
        self,
        query: str,
        *,
        top_k: Optional[int] = None,
        return_top_k: Optional[int] = None,
        format: Optional[str] = None,
        ranking: Optional[str] = None,
    ) -> LoadResult:
        return await self.load(
            query,
            input_type="query",
            search={"topK": top_k} if top_k else None,
            return_config={"topK": return_top_k, "format": format}
            if (return_top_k or format)
            else None,
            ranking={"preset": ranking} if ranking else None,
        )
