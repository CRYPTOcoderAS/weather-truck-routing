from datetime import timedelta, timezone

from django.utils import timezone as dj_timezone
from rest_framework import serializers

from .providers.open_meteo import forecast_window


class PlaceSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-85, max_value=85)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    label = serializers.CharField(required=False, allow_blank=True, max_length=300)


def _validate_departure(value):
    if dj_timezone.is_naive(value):
        value = value.replace(tzinfo=timezone.utc)
    lo, hi = forecast_window()
    if value < lo + timedelta(days=1):
        raise serializers.ValidationError("Departure is too far in the past for forecast data.")
    if value > hi - timedelta(days=2):
        raise serializers.ValidationError("Departure must be within the next 13 days (forecast horizon).")
    return value.astimezone(timezone.utc)


class PlanRequestSerializer(serializers.Serializer):
    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure = serializers.DateTimeField()
    load_lbs = serializers.FloatField(min_value=0, max_value=200_000)
    interval_mi = serializers.ChoiceField(choices=[10, 25, 50], default=25)
    demo_storm = serializers.BooleanField(default=False)

    def validate_departure(self, value):
        return _validate_departure(value)

    def validate(self, attrs):
        o, d = attrs["origin"], attrs["destination"]
        if abs(o["lat"] - d["lat"]) < 1e-4 and abs(o["lon"] - d["lon"]) < 1e-4:
            raise serializers.ValidationError("Origin and destination are the same place.")
        return attrs


class HeatmapRequestSerializer(serializers.Serializer):
    south = serializers.FloatField(min_value=-85, max_value=85)
    west = serializers.FloatField(min_value=-180, max_value=180)
    north = serializers.FloatField(min_value=-85, max_value=85)
    east = serializers.FloatField(min_value=-180, max_value=180)
    start = serializers.DateTimeField()
    load_lbs = serializers.FloatField(min_value=0, max_value=200_000)
    storm_lat = serializers.FloatField(required=False, min_value=-85, max_value=85)
    storm_lon = serializers.FloatField(required=False, min_value=-180, max_value=180)
    storm_t = serializers.FloatField(required=False)

    def validate_start(self, value):
        return _validate_departure(value)

    def validate(self, attrs):
        storm_fields = {"storm_lat", "storm_lon", "storm_t"} & attrs.keys()
        if storm_fields and len(storm_fields) != 3:
            raise serializers.ValidationError("storm_lat, storm_lon and storm_t go together.")
        if attrs["south"] >= attrs["north"] or attrs["west"] >= attrs["east"]:
            raise serializers.ValidationError("Invalid bounds.")
        if attrs["north"] - attrs["south"] > 40 or attrs["east"] - attrs["west"] > 70:
            raise serializers.ValidationError("Area too large.")
        return attrs
