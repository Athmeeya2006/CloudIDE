"""Reverse proxy for the Live Preview.

A user's app runs on the machine where this backend runs (the same container or
host), listening on some port like 5173 or 5000. The browser, however, may be
on a completely different machine, so pointing an iframe at ``localhost:5173``
tries to reach the *viewer's* machine and fails with "connection refused".

This router proxies ``/api/preview/{port}/...`` to ``127.0.0.1:{port}`` on the
backend host, so the preview is always reached through the backend's own
(reachable) URL. HTML responses are lightly rewritten so apps that use
root-absolute URLs (``/assets/x.js``, ``fetch('/api/...')``) keep working under
the path prefix.

Limitation: WebSockets are not proxied, so dev-server hot reload (HMR) will not
push updates; a manual refresh still works. Apps that build absolute URLs in
ways the shim cannot intercept should use relative URLs or set their dev
server's base path to ``/api/preview/<port>/``.
"""
from __future__ import annotations

import asyncio
import contextlib
import re

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse

from app.config import settings

router = APIRouter(prefix="/api/preview", tags=["preview"])

# A single shared client, reused across requests. Creating one per request (and
# buffering whole responses) was a real source of memory pressure under a dev
# server that serves large bundles. Connection pool size is bounded.
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, read=60.0),
            follow_redirects=False,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=10),
        )
    return _client


async def aclose_client() -> None:
    """Close the shared client on shutdown (called from the app lifespan)."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None

# Separate prefix so it never collides with the proxy's catch-all route.
status_router = APIRouter(prefix="/api/preview-status", tags=["preview"])


# Ports a user's dev server might be listening on. The IDE's own port is
# excluded at request time. This is what lets the preview find the app no matter
# which port it actually chose (3000, 5000, 5173, ...).
_SCAN_PORTS = [
    3000, 3001, 4000, 4173, 4200, 5000, 5001, 5002, 5003, 5050,
    5173, 5174, 8080, 8081, 8888, 9000,
]


async def _port_open(port: int) -> bool:
    if port < 1 or port > 65535:
        return False
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection("127.0.0.1", port), timeout=0.7
        )
        writer.close()
        with contextlib.suppress(Exception):
            await writer.wait_closed()
        return True
    except (OSError, TimeoutError):
        return False


def _reserved() -> set[int]:
    """Ports that are the IDE itself, never a user app."""
    return {settings.port, *settings.reserved_ports_list}


@status_router.get("")
async def listening_ports():
    """Every candidate port that currently has something listening on it.

    The preview uses this to auto-detect the user's app instead of guessing a
    single port. The IDE's own backend port (and any configured reserved ports)
    are excluded so detection never points the preview back at the IDE.
    """
    reserved = _reserved()
    candidates = [p for p in _SCAN_PORTS if p not in reserved]
    results = await asyncio.gather(*(_port_open(p) for p in candidates))
    return {"ports": [p for p, ok in zip(candidates, results, strict=False) if ok]}


@status_router.get("/{port}")
async def is_listening(port: int):
    """Whether something is accepting connections on ``127.0.0.1:port``.

    The Live Preview polls this after Run Dev so it can show a "starting" state
    and load the app the moment the dev server is actually up, instead of
    flashing a connection error while npm install / the bundler boots.
    """
    return {"listening": await _port_open(port)}

_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]

# Headers we must not forward verbatim.
_DROP_REQ = frozenset({
    "host", "content-length", "connection", "keep-alive", "accept-encoding",
    "proxy-authorization", "proxy-authenticate", "te", "trailers",
    "transfer-encoding", "upgrade",
})
_DROP_RESP = frozenset({
    "content-encoding", "content-length", "transfer-encoding", "connection",
    "keep-alive", "trailer", "te", "upgrade",
})

# Rewrite root-absolute URLs in HTML attributes (src="/x", href="/x",
# action="/x") to carry the proxy prefix. Protocol-relative (//cdn) is skipped.
_ABS_ATTR_RE = re.compile(rb'(\b(?:src|href|action)\s*=\s*["\'])/(?!/)')


def _client_shim(prefix: str) -> bytes:
    """A tiny script that prefixes root-absolute fetch/XHR URLs at runtime.

    This is what lets ``fetch('/api/items')`` from the previewed app reach the
    app through the proxy instead of hitting the IDE backend.
    """
    return (
        b'<script>(function(){var P="' + prefix.encode() + b'";'
        b"function fix(u){try{if(typeof u==='string'&&u.charAt(0)==='/'"
        b"&&u.charAt(1)!=='/'&&u.lastIndexOf(P,0)!==0)return P+u;}catch(e){}return u;}"
        b"var of=window.fetch;if(of){window.fetch=function(i,init){"
        b"if(typeof i==='string'){i=fix(i);}"
        b"else if(i&&i.url){try{i=new Request(fix(i.url),i);}catch(e){}}"
        b"return of.call(this,i,init);};}"
        b"var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){"
        b"try{arguments[1]=fix(u);}catch(e){}return oo.apply(this,arguments);};"
        b"})();</script>"
    )


def _rewrite_html(body: bytes, prefix: str) -> bytes:
    pfx = prefix.encode()
    body = _ABS_ATTR_RE.sub(rb"\1" + pfx + b"/", body)
    inject = b'<base href="' + pfx + b'/">' + _client_shim(prefix)
    # Insert right after <head>, else after <html>, else at the very top.
    m = re.search(rb"<head[^>]*>", body, re.IGNORECASE)
    if m:
        return body[: m.end()] + inject + body[m.end():]
    m = re.search(rb"<html[^>]*>", body, re.IGNORECASE)
    if m:
        return body[: m.end()] + inject + body[m.end():]
    return inject + body


@router.api_route("/{port}", methods=_METHODS)
@router.api_route("/{port}/{path:path}", methods=_METHODS)
async def proxy(port: int, request: Request, path: str = ""):
    if port < 1 or port > 65535 or port in _reserved():
        return Response("That port is the IDE itself and cannot be previewed.", status_code=400)

    prefix = f"/api/preview/{port}"
    target = f"http://127.0.0.1:{port}/{path}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in _DROP_REQ}
    body = await request.body()

    client = _get_client()
    req = client.build_request(
        request.method, target, params=request.query_params, content=body, headers=headers,
    )
    try:
        upstream = await client.send(req, stream=True)
    except httpx.ConnectError:
        return Response(
            f"<html><body style='font-family:system-ui;padding:40px;color:#888'>"
            f"<h3>Nothing is running on port {port}</h3>"
            f"<p>Start your app (bound to 0.0.0.0:{port}) and reload.</p></body></html>",
            status_code=502, media_type="text/html",
        )
    except httpx.HTTPError as e:
        return Response(f"Preview proxy error: {e}", status_code=502)

    resp_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in _DROP_RESP}

    # Keep redirects inside the proxy.
    loc = upstream.headers.get("location")
    if loc and loc.startswith("/") and not loc.startswith("//"):
        resp_headers["location"] = f"{prefix}{loc}"

    ctype = upstream.headers.get("content-type", "")

    # HTML must be read fully so it can be rewritten (pages are small). Everything
    # else (JS bundles, images, JSON, ...) is streamed so we never hold a whole
    # response in memory.
    if "text/html" in ctype.lower():
        try:
            raw = await upstream.aread()
        finally:
            await upstream.aclose()
        return Response(
            content=_rewrite_html(raw, prefix), status_code=upstream.status_code,
            headers=resp_headers, media_type=ctype or None,
        )

    async def stream():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(
        stream(), status_code=upstream.status_code,
        headers=resp_headers, media_type=ctype or None,
    )
