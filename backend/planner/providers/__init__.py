import threading

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class UpstreamError(Exception):
    def __init__(self, service: str, message: str):
        super().__init__(f"{service}: {message}")
        self.service = service
        self.message = message


_local = threading.local()


def session() -> requests.Session:
    s = getattr(_local, "session", None)
    if s is None:
        s = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=0.8,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=False,
        )
        s.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=8))
        s.headers["User-Agent"] = settings.HTTP_USER_AGENT
        _local.session = s
    return s


def get_json(service: str, url: str, params: dict | None = None, timeout: float = 25) -> dict | list:
    try:
        resp = session().get(url, params=params, timeout=timeout)
    except requests.RequestException as exc:
        raise UpstreamError(service, f"request failed ({exc.__class__.__name__})") from exc
    if resp.status_code == 429:
        raise UpstreamError(service, "rate limit reached, please retry in a minute")
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("reason") or resp.json().get("message") or resp.text[:200]
        except ValueError:
            detail = resp.text[:200]
        raise UpstreamError(service, f"HTTP {resp.status_code}: {detail}")
    try:
        return resp.json()
    except ValueError as exc:
        raise UpstreamError(service, "invalid JSON response") from exc
