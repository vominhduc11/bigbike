"""Shared boundary checks for the ephemeral performance stack; no Docker side effects."""
import os
from pathlib import Path
import re
from urllib.parse import urlsplit


def require_ci(environment=None):
    env = os.environ if environment is None else environment
    if env.get("GITHUB_ACTIONS") != "true" or env.get("RUNNER_ENVIRONMENT") != "github-hosted":
        raise ValueError("Refusing shared/local host: isolated GitHub-hosted runner required")


def loopback_url(value):
    parsed = urlsplit(value)
    if (parsed.scheme != "http" or parsed.hostname not in ("localhost", "127.0.0.1")
            or parsed.port is None or not 10000 <= parsed.port <= 65535
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ("", "/")):
        raise ValueError("Dedicated HTTP loopback origin on port >=10000 required")
    return value.rstrip("/")


def project_name(value):
    if not re.fullmatch(r"bbperf-[0-9]+-[0-9]+-(before|after)", value):
        raise ValueError("Refusing Docker project outside the job-owned bbperf namespace")
    return value


def safe_directory(path, parent):
    result, boundary = Path(path).resolve(), Path(parent).resolve()
    if result == boundary or not result.is_relative_to(boundary):
        raise ValueError("Directory must be a child of the job's temporary directory")
    return result
