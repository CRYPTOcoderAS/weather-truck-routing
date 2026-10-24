from __future__ import annotations

from django.conf import settings
from django.core.cache import cache

from . import get_json


def search(query: str, limit: int = 6) -> list[dict]:
    query = query.strip()
    key = f"photon:{limit}:{query.lower()}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    data = get_json("Geocoding (Photon)", f"{settings.PHOTON_URL}/api/", {"q": query, "limit": limit, "lang": "en"})
    results = []
    for feature in data.get("features", []):
        p = feature["properties"]
        lon, lat = feature["geometry"]["coordinates"]
        name = p.get("name") or " ".join(filter(None, [p.get("housenumber"), p.get("street")]))
        parts = [name, p.get("city") if p.get("city") != name else None, p.get("state"), p.get("countrycode")]
        label = ", ".join(dict.fromkeys(x for x in parts if x))
        if label:
            results.append({"label": label, "lat": lat, "lon": lon})
    cache.set(key, results, 60 * 60 * 24)
    return results
