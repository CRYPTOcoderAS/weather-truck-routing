import logging

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from . import heatmap, service
from .providers import UpstreamError, photon
from .serializers import HeatmapRequestSerializer, PlanRequestSerializer
from .weather import DemoStorm

log = logging.getLogger(__name__)


def exception_handler(exc, context):
    if isinstance(exc, UpstreamError):
        log.warning("upstream failure: %s", exc)
        return Response({"detail": f"{exc.service} is unavailable: {exc.message}"}, status=status.HTTP_502_BAD_GATEWAY)
    return drf_exception_handler(exc, context)


@api_view(["GET"])
def health(request):
    return Response({"ok": True})


@api_view(["GET"])
def geocode(request):
    query = request.query_params.get("q", "").strip()
    if len(query) < 2:
        return Response([])
    return Response(photon.search(query[:200]))


@api_view(["POST"])
def plan(request):
    s = PlanRequestSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    result = service.plan_trip(
        origin=(d["origin"]["lat"], d["origin"]["lon"]),
        destination=(d["destination"]["lat"], d["destination"]["lon"]),
        departure=d["departure"],
        load_lbs=d["load_lbs"],
        interval_mi=d["interval_mi"],
        demo_storm=d["demo_storm"],
    )
    return Response(result)


@api_view(["GET"])
def heatmap_grid(request):
    s = HeatmapRequestSerializer(data=request.query_params)
    s.is_valid(raise_exception=True)
    d = s.validated_data
    storm = DemoStorm(d["storm_lat"], d["storm_lon"], d["storm_t"]) if "storm_t" in d else None
    grid = heatmap.corridor_grid(d["south"], d["west"], d["north"], d["east"], d["start"], d["load_lbs"], storm)
    return Response(grid)
