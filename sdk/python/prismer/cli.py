"""Prismer Cloud SDK CLI — manage config, register agents, check status."""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import click

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib

import tomli_w


# ============================================================================
# Config helpers
# ============================================================================

CONFIG_DIR = Path.home() / ".prismer"
CONFIG_FILE = CONFIG_DIR / "config.toml"


def _ensure_config_dir() -> None:
    """Create ~/.prismer/ if it doesn't exist."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def _load_config() -> Dict[str, Any]:
    """Read config.toml, returning an empty dict if it doesn't exist."""
    if not CONFIG_FILE.exists():
        return {}
    with open(CONFIG_FILE, "rb") as f:
        return tomllib.load(f)


def _save_config(cfg: Dict[str, Any]) -> None:
    """Write config dict to config.toml."""
    _ensure_config_dir()
    with open(CONFIG_FILE, "wb") as f:
        tomli_w.dump(cfg, f)


def _get_api_key(cfg: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Extract the API key from the config dict."""
    if cfg is None:
        cfg = _load_config()
    return cfg.get("default", {}).get("api_key")


def _set_nested(cfg: Dict[str, Any], dotted_key: str, value: str) -> None:
    """Set a value in a nested dict using a dotted key like 'default.api_key'."""
    parts = dotted_key.split(".")
    d = cfg
    for part in parts[:-1]:
        d = d.setdefault(part, {})
    d[parts[-1]] = value


# ============================================================================
# CLI group
# ============================================================================

@click.group()
def cli():
    """Prismer Cloud SDK CLI"""
    pass


# ============================================================================
# prismer init <api-key>
# ============================================================================

@cli.command()
@click.argument("api_key")
def init(api_key: str):
    """Store API key in ~/.prismer/config.toml"""
    cfg = _load_config()
    cfg.setdefault("default", {})
    cfg["default"]["api_key"] = api_key
    cfg["default"].setdefault("environment", "production")
    cfg["default"].setdefault("base_url", "")
    _save_config(cfg)
    click.echo(f"API key saved to {CONFIG_FILE}")


# ============================================================================
# prismer register <username>
# ============================================================================

@cli.command()
@click.argument("username")
@click.option("--type", "user_type", type=click.Choice(["agent", "human"]), default="agent",
              help="Identity type (default: agent)")
@click.option("--display-name", default=None, help="Display name (defaults to username)")
@click.option("--agent-type",
              type=click.Choice(["assistant", "specialist", "orchestrator", "tool", "bot"]),
              default=None, help="Agent type")
@click.option("--capabilities", default=None,
              help="Comma-separated capabilities (e.g. chat,search)")
def register(username: str, user_type: str, display_name: Optional[str],
             agent_type: Optional[str], capabilities: Optional[str]):
    """Register an IM agent and store the token."""
    cfg = _load_config()
    api_key = _get_api_key(cfg)
    if not api_key:
        click.echo("Error: No API key configured. Run 'prismer init <api-key>' first.", err=True)
        sys.exit(1)

    # Build registration kwargs
    kwargs: Dict[str, Any] = {
        "type": user_type,
        "username": username,
        "displayName": display_name or username,
    }
    if agent_type:
        kwargs["agentType"] = agent_type
    if capabilities:
        kwargs["capabilities"] = [c.strip() for c in capabilities.split(",")]

    # Create client and register
    from .client import PrismerClient

    env = cfg.get("default", {}).get("environment", "production")
    base_url = cfg.get("default", {}).get("base_url", "") or None

    client = PrismerClient(api_key, environment=env, base_url=base_url)
    try:
        result = client.im.account.register(**kwargs)
    finally:
        client.close()

    if not result.get("ok"):
        err = result.get("error", {})
        msg = err.get("message", "Unknown error") if isinstance(err, dict) else str(err)
        click.echo(f"Registration failed: {msg}", err=True)
        sys.exit(1)

    data = result.get("data", {})

    # Store auth info in config
    cfg.setdefault("auth", {})
    cfg["auth"]["im_token"] = data.get("token", "")
    cfg["auth"]["im_user_id"] = data.get("imUserId", "")
    cfg["auth"]["im_username"] = data.get("username", username)
    cfg["auth"]["im_token_expires"] = data.get("expiresIn", "")
    _save_config(cfg)

    is_new = data.get("isNew", False)
    label = "Registered new agent" if is_new else "Re-authenticated agent"
    click.echo(f"{label}: {data.get('username', username)}")
    click.echo(f"  User ID : {data.get('imUserId', 'N/A')}")
    click.echo(f"  Role    : {data.get('role', 'N/A')}")
    click.echo(f"  Expires : {data.get('expiresIn', 'N/A')}")
    click.echo(f"Token saved to {CONFIG_FILE}")


# ============================================================================
# prismer status
# ============================================================================

@cli.command()
def status():
    """Show current config and token status."""
    cfg = _load_config()

    if not cfg:
        click.echo("No config found. Run 'prismer init <api-key>' first.")
        return

    # Show [default] section
    default = cfg.get("default", {})
    click.echo("[default]")
    click.echo(f"  api_key     = {_mask_key(default.get('api_key', ''))}")
    click.echo(f"  environment = {default.get('environment', 'production')}")
    click.echo(f"  base_url    = {default.get('base_url', '') or '(default)'}")

    # Show [auth] section
    auth = cfg.get("auth", {})
    if auth:
        click.echo("")
        click.echo("[auth]")
        click.echo(f"  im_user_id  = {auth.get('im_user_id', '')}")
        click.echo(f"  im_username = {auth.get('im_username', '')}")

        token = auth.get("im_token", "")
        if token:
            click.echo(f"  im_token    = {token[:20]}...")
        else:
            click.echo("  im_token    = (not set)")

        expires_str = auth.get("im_token_expires", "")
        if expires_str:
            click.echo(f"  expires     = {expires_str}")
            try:
                # Parse ISO 8601 timestamp
                exp = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
                now = datetime.now(timezone.utc)
                if exp < now:
                    click.echo("  status      = EXPIRED")
                else:
                    delta = exp - now
                    hours = delta.total_seconds() / 3600
                    if hours < 1:
                        click.echo(f"  status      = valid ({int(delta.total_seconds() / 60)}m remaining)")
                    elif hours < 24:
                        click.echo(f"  status      = valid ({hours:.1f}h remaining)")
                    else:
                        click.echo(f"  status      = valid ({delta.days}d remaining)")

            except (ValueError, TypeError):
                click.echo("  status      = (could not parse expiry)")
    else:
        click.echo("")
        click.echo("[auth]")
        click.echo("  (not registered — run 'prismer register <username>')")

    # Optionally fetch live info
    api_key = _get_api_key(cfg)
    im_token = auth.get("im_token", "")
    if api_key and im_token:
        click.echo("")
        click.echo("Fetching live status...")
        try:
            from .client import PrismerClient

            env = default.get("environment", "production")
            base_url = default.get("base_url", "") or None

            client = PrismerClient(api_key, environment=env, base_url=base_url)
            try:
                me_result = client.im.account.me()
            finally:
                client.close()

            if me_result.get("ok"):
                me_data = me_result.get("data", {})
                user = me_data.get("user", {})
                credits_info = me_data.get("credits", {})
                stats = me_data.get("stats", {})
                click.echo(f"  Display   : {user.get('displayName', 'N/A')}")
                click.echo(f"  Role      : {user.get('role', 'N/A')}")
                click.echo(f"  Credits   : {credits_info.get('balance', 'N/A')}")
                click.echo(f"  Messages  : {stats.get('messagesSent', 'N/A')}")
                click.echo(f"  Contacts  : {stats.get('contactCount', 'N/A')}")
            else:
                err = me_result.get("error", {})
                msg = err.get("message", "Unknown error") if isinstance(err, dict) else str(err)
                click.echo(f"  Could not fetch live status: {msg}")
        except Exception as e:
            click.echo(f"  Could not fetch live status: {e}")


def _mask_key(key: str) -> str:
    """Mask an API key for display, showing only prefix and last 4 chars."""
    if not key:
        return "(not set)"
    if len(key) <= 16:
        return key[:4] + "..." + key[-4:]
    return key[:11] + "..." + key[-4:]


# ============================================================================
# prismer config (subgroup)
# ============================================================================

@cli.group()
def config():
    """Manage configuration."""
    pass


@config.command("show")
def config_show():
    """Print config file contents."""
    if not CONFIG_FILE.exists():
        click.echo(f"No config file found at {CONFIG_FILE}")
        return

    with open(CONFIG_FILE, "r") as f:
        click.echo(f.read())


@config.command("set")
@click.argument("key")
@click.argument("value")
def config_set(key: str, value: str):
    """Set a config value (e.g., prismer config set default.api_key sk-prismer-...)"""
    cfg = _load_config()
    _set_nested(cfg, key, value)
    _save_config(cfg)
    click.echo(f"Set {key} = {value}")


# ============================================================================
# Entry point
# ============================================================================

def main():
    cli()


if __name__ == "__main__":
    main()
