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

import re

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.config import settings

router = APIRouter(prefix="/api/preview", tags=["preview"])

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
    if port < 1 or port > 65535 or port == settings.port:
        return Response("Invalid preview port", status_code=400)

    prefix = f"/api/preview/{port}"
    target = f"http://127.0.0.1:{port}/{path}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in _DROP_REQ}
    body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            upstream = await client.request(
                request.method, target,
                params=request.query_params, content=body, headers=headers,
            )
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

    content = upstream.content
    ctype = upstream.headers.get("content-type", "")
    if "text/html" in ctype.lower():
        content = _rewrite_html(content, prefix)

    return Response(content=content, status_code=upstream.status_code,
                    headers=resp_headers, media_type=ctype or None)
