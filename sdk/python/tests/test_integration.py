"""
Comprehensive integration tests for the Prismer Python SDK.

Covers:
  - Context API  (load, save)
  - Parse API    (parse_pdf)
  - IM API       (account, direct, groups, conversations, contacts, credits, edge cases)

Usage:
    PRISMER_API_KEY_TEST="sk-prismer-..." python -m pytest tests/test_integration.py -v
"""

import time
import pytest

from prismer import PrismerClient

from .conftest import API_KEY, BASE_URL, RUN_ID


# ============================================================================
# Group 1: Context API
# ============================================================================

class TestContextAPI:
    """Context API — load and save."""

    def test_load_single_url(self, client: PrismerClient):
        """Load a single URL and verify success, mode, result."""
        result = client.load("https://example.com")
        assert result.success is True, f"load failed: {result.error}"
        assert result.mode == "single_url"
        assert result.result is not None
        assert result.result.url == "https://example.com"

    def test_load_batch_urls(self, client: PrismerClient):
        """Load multiple URLs and verify batch mode."""
        urls = [
            "https://example.com",
            "https://www.iana.org/domains/reserved",
        ]
        result = client.load(urls)
        assert result.success is True, f"batch load failed: {result.error}"
        assert result.mode == "batch_urls"
        assert result.results is not None
        assert len(result.results) == 2

    def test_save_content(self, client: PrismerClient):
        """Save content to the Prismer cache."""
        unique_url = f"https://test.example.com/integration-{RUN_ID}"
        hqcc = f"# Integration Test\n\nContent saved by run {RUN_ID}."
        result = client.save(url=unique_url, hqcc=hqcc)
        assert result.success is True, f"save failed: {result.error}"


# ============================================================================
# Group 2: Parse API
# ============================================================================

class TestParseAPI:
    """Parse API — PDF parsing."""

    def test_parse_pdf(self, client: PrismerClient):
        """Parse a public PDF and verify success and requestId."""
        result = client.parse_pdf("https://arxiv.org/pdf/2301.00234.pdf", mode="fast")
        assert result.success is True, f"parse_pdf failed: {result.error}"
        assert result.request_id is not None, "requestId should be present"
        if result.cost is not None:
            assert result.cost.credits >= 0


# ============================================================================
# Group 3: IM API — Full Lifecycle
# ============================================================================

class TestIMLifecycle:
    """
    IM API full lifecycle using two agents.

    Because each sub-client method in the SDK returns a raw dict (not an
    IMResult Pydantic model), assertions are written against dict keys.

    After registration the returned JWT is used to create a *new*
    PrismerClient so that subsequent IM calls are authenticated with the
    agent's JWT rather than the platform API key.
    """

    # ------------------------------------------------------------------
    # Account: Register agent A
    # ------------------------------------------------------------------

    def test_01_register_agent_a(self, client: PrismerClient, run_id: str):
        """Register agent A and stash its imUserId + JWT."""
        res = client.im.account.register(
            type="agent",
            username=f"integ-agent-a-{run_id}",
            displayName=f"Agent A ({run_id})",
            agentType="assistant",
            capabilities=["chat"],
        )
        assert res.get("ok") is True, f"register agent A failed: {res}"
        data = res["data"]
        assert "imUserId" in data
        assert "token" in data

        # Store for later tests
        self.__class__._agent_a_id = data["imUserId"]
        self.__class__._agent_a_token = data["token"]
        self.__class__._agent_a_username = f"integ-agent-a-{run_id}"

    # ------------------------------------------------------------------
    # Account: me() and refresh_token() for agent A
    # ------------------------------------------------------------------

    def test_02_me(self, base_url: str):
        """Verify /me returns the agent's own profile."""
        token = self.__class__._agent_a_token
        agent_client = PrismerClient(api_key=token, base_url=base_url, timeout=60.0)
        try:
            res = agent_client.im.account.me()
            assert res.get("ok") is True, f"me() failed: {res}"
            assert "user" in res.get("data", {})
        finally:
            agent_client.close()

    def test_03_refresh_token(self, base_url: str):
        """Refresh JWT and update stored token."""
        token = self.__class__._agent_a_token
        agent_client = PrismerClient(api_key=token, base_url=base_url, timeout=60.0)
        try:
            res = agent_client.im.account.refresh_token()
            assert res.get("ok") is True, f"refresh_token failed: {res}"
            new_token = res["data"]["token"]
            assert new_token  # non-empty
            self.__class__._agent_a_token = new_token
        finally:
            agent_client.close()

    # ------------------------------------------------------------------
    # Account: Register agent B (target for DMs)
    # ------------------------------------------------------------------

    def test_04_register_agent_b(self, client: PrismerClient, run_id: str):
        """Register a second agent to serve as DM target."""
        res = client.im.account.register(
            type="agent",
            username=f"integ-agent-b-{run_id}",
            displayName=f"Agent B ({run_id})",
            agentType="assistant",
            capabilities=["chat"],
        )
        assert res.get("ok") is True, f"register agent B failed: {res}"
        data = res["data"]
        self.__class__._agent_b_id = data["imUserId"]
        self.__class__._agent_b_token = data["token"]

    # ------------------------------------------------------------------
    # Direct Messaging
    # ------------------------------------------------------------------

    def test_05_direct_send(self, base_url: str):
        """Agent A sends a DM to agent B."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            target_id = self.__class__._agent_b_id
            res = agent_client.im.direct.send(target_id, "Hello from integration test!")
            assert res.get("ok") is True, f"direct.send failed: {res}"
        finally:
            agent_client.close()

    def test_06_direct_get_messages(self, base_url: str):
        """Agent A retrieves DM history with agent B."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            target_id = self.__class__._agent_b_id
            res = agent_client.im.direct.get_messages(target_id)
            assert res.get("ok") is True, f"direct.get_messages failed: {res}"
            messages = res.get("data", [])
            assert isinstance(messages, list)
            assert len(messages) >= 1, "Expected at least 1 message"
        finally:
            agent_client.close()

    # ------------------------------------------------------------------
    # Credits
    # ------------------------------------------------------------------

    def test_07_credits_get(self, base_url: str):
        """Verify credits balance for a new agent (~100)."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            res = agent_client.im.credits.get()
            assert res.get("ok") is True, f"credits.get failed: {res}"
            data = res["data"]
            assert "balance" in data
            # New agents typically get ~100 credits
            assert data["balance"] >= 0
        finally:
            agent_client.close()

    def test_08_credits_transactions(self, base_url: str):
        """Verify transaction history is an array."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            res = agent_client.im.credits.transactions()
            assert res.get("ok") is True, f"credits.transactions failed: {res}"
            data = res.get("data", [])
            assert isinstance(data, list)
        finally:
            agent_client.close()

    # ------------------------------------------------------------------
    # Contacts & Discovery
    # ------------------------------------------------------------------

    def test_09_contacts_list(self, base_url: str):
        """Contacts list should return an array (may include agent B after DM)."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            res = agent_client.im.contacts.list()
            assert res.get("ok") is True, f"contacts.list failed: {res}"
            data = res.get("data", [])
            assert isinstance(data, list)
        finally:
            agent_client.close()

    def test_10_contacts_discover(self, base_url: str):
        """Discover agents — should return an array."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            res = agent_client.im.contacts.discover()
            assert res.get("ok") is True, f"contacts.discover failed: {res}"
            data = res.get("data", [])
            assert isinstance(data, list)
        finally:
            agent_client.close()

    # ------------------------------------------------------------------
    # Groups
    # ------------------------------------------------------------------

    def test_11_groups_create(self, base_url: str, run_id: str):
        """Create a group with both agents."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            res = agent_client.im.groups.create(
                title=f"Test Group {run_id}",
                members=[self.__class__._agent_b_id],
            )
            assert res.get("ok") is True, f"groups.create failed: {res}"
            data = res["data"]
            assert "groupId" in data
            self.__class__._group_id = data["groupId"]
        finally:
            agent_client.close()

    def test_12_groups_list(self, base_url: str):
        """List groups — should contain at least the one we created."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            res = agent_client.im.groups.list()
            assert res.get("ok") is True, f"groups.list failed: {res}"
            data = res.get("data", [])
            assert isinstance(data, list)
            assert len(data) >= 1
        finally:
            agent_client.close()

    def test_13_groups_get(self, base_url: str):
        """Get group details by ID."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            group_id = self.__class__._group_id
            res = agent_client.im.groups.get(group_id)
            assert res.get("ok") is True, f"groups.get failed: {res}"
            data = res.get("data", {})
            assert data.get("groupId") == group_id or data.get("title") is not None
        finally:
            agent_client.close()

    def test_14_groups_send(self, base_url: str):
        """Send a message to the group."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            group_id = self.__class__._group_id
            res = agent_client.im.groups.send(group_id, "Hello group from integration test!")
            assert res.get("ok") is True, f"groups.send failed: {res}"
        finally:
            agent_client.close()

    def test_15_groups_get_messages(self, base_url: str):
        """Get group message history."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            group_id = self.__class__._group_id
            res = agent_client.im.groups.get_messages(group_id)
            assert res.get("ok") is True, f"groups.get_messages failed: {res}"
            messages = res.get("data", [])
            assert isinstance(messages, list)
            assert len(messages) >= 1
        finally:
            agent_client.close()

    # ------------------------------------------------------------------
    # Conversations
    # ------------------------------------------------------------------

    def test_16_conversations_list(self, base_url: str):
        """List conversations for agent A — should include DM and group."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            res = agent_client.im.conversations.list()
            assert res.get("ok") is True, f"conversations.list failed: {res}"
            data = res.get("data", [])
            assert isinstance(data, list)
            assert len(data) >= 1
            # Stash first conversation id for next test
            self.__class__._conv_id = data[0]["id"]
        finally:
            agent_client.close()

    def test_17_conversations_get(self, base_url: str):
        """Get details of a specific conversation."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            conv_id = self.__class__._conv_id
            res = agent_client.im.conversations.get(conv_id)
            assert res.get("ok") is True, f"conversations.get failed: {res}"
            data = res.get("data", {})
            assert data.get("id") == conv_id
        finally:
            agent_client.close()

    # ------------------------------------------------------------------
    # Edge Cases
    # ------------------------------------------------------------------

    def test_18_duplicate_register(self, client: PrismerClient, run_id: str):
        """Registering the same username again should return 409 or an error."""
        res = client.im.account.register(
            type="agent",
            username=f"integ-agent-a-{run_id}",
            displayName=f"Agent A ({run_id})",
            agentType="assistant",
            capabilities=["chat"],
        )
        # The server may return the existing user (ok=True, isNew=False)
        # or a 409 conflict (ok=False). Both are acceptable.
        if res.get("ok") is True:
            # If the server returns success, isNew should be False
            data = res.get("data", {})
            assert data.get("isNew") is False, (
                "Duplicate register returned ok=True but isNew is not False"
            )
        else:
            # ok=False — expect a conflict-style error
            err = res.get("error", {})
            assert err.get("code") in (
                "CONFLICT",
                "USERNAME_TAKEN",
                "DUPLICATE",
                "HTTP_ERROR",
            ), f"Unexpected error code: {err}"

    def test_19_send_to_nonexistent_user(self, base_url: str):
        """Sending a DM to a non-existent user should fail (404 or error)."""
        agent_client = PrismerClient(
            api_key=self.__class__._agent_a_token,
            base_url=base_url,
            timeout=60.0,
        )
        try:
            fake_id = "nonexistent-user-00000000"
            res = agent_client.im.direct.send(fake_id, "Should fail")
            # Expect ok=False with some error
            assert res.get("ok") is False, (
                f"Sending to nonexistent user should fail, got: {res}"
            )
        finally:
            agent_client.close()
