"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

treasury-ops gRPC mock server: deterministic responses backed by case files,
mirroring the latency/error/auth profile applied to REST providers.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import grpc

from _mock import cases
from _mock.faults import evaluate
from _mock.faults.engine import profile_for
from _mock.grpc.treasury_ops import treasury_pb2 as pb2
from _mock.grpc.treasury_ops import treasury_pb2_grpc as pb2_grpc
from _mock.webhooks import deliver


_STATUS_MAP = {
    401: grpc.StatusCode.UNAUTHENTICATED,
    403: grpc.StatusCode.PERMISSION_DENIED,
    404: grpc.StatusCode.NOT_FOUND,
    409: grpc.StatusCode.ABORTED,
    429: grpc.StatusCode.RESOURCE_EXHAUSTED,
    500: grpc.StatusCode.INTERNAL,
    502: grpc.StatusCode.UNAVAILABLE,
    503: grpc.StatusCode.UNAVAILABLE,
    504: grpc.StatusCode.DEADLINE_EXCEEDED,
}


async def _apply_faults(action: str, payload: dict, context: grpc.aio.ServicerContext) -> str:
    profile = profile_for("treasury-ops")
    header = profile["auth"]["header"].lower()
    metadata = dict(context.invocation_metadata() or [])
    token = metadata.get(header, "")
    if not token:
        await context.abort(grpc.StatusCode.UNAUTHENTICATED, "missing token")
    decision = evaluate("treasury-ops", action, payload, attempt=0, api_key=token)
    if decision.delay_s:
        await asyncio.sleep(decision.delay_s)
    if decision.rate_limited:
        await context.abort(grpc.StatusCode.RESOURCE_EXHAUSTED,
                            f"rate limited; retry in {decision.retry_after_s}s")
    if decision.error_status:
        code = _STATUS_MAP.get(decision.error_status, grpc.StatusCode.UNKNOWN)
        await context.abort(code, json.dumps(decision.error_body))
    return token


def _coerce(value: Any, default: Any) -> Any:
    return default if value is None else value


class TreasuryOps(pb2_grpc.TreasuryOpsServicer):
    async def GetCashPosition(self, request, context):
        payload = {"region": request.region}
        await _apply_faults("get_cash_position", payload, context)
        c = cases.resolve("treasury-ops", "get_cash_position", payload)
        return pb2.CashPositionResponse(
            region=_coerce(c.get("region"), ""),
            cash_usd=float(_coerce(c.get("cash_usd"), 0.0)),
            operating=float(_coerce(c.get("operating"), 0.0)),
            reserves=float(_coerce(c.get("reserves"), 0.0)),
            as_of=_coerce(c.get("as_of"), ""),
        )

    async def ForecastLiquidity(self, request, context):
        payload = {"region": request.region, "horizon_days": request.horizon_days}
        await _apply_faults("forecast_liquidity", payload, context)
        c = cases.resolve("treasury-ops", "forecast_liquidity", payload)
        return pb2.ForecastResponse(
            horizon_days=int(_coerce(c.get("horizon_days"), 0)),
            outflow_usd=float(_coerce(c.get("outflow_usd"), 0.0)),
            inflow_usd=float(_coerce(c.get("inflow_usd"), 0.0)),
            net=float(_coerce(c.get("net"), 0.0)),
            shortfall_risk=_coerce(c.get("shortfall_risk"), ""),
        )

    async def PlaceFxHedge(self, request, context):
        payload = {
            "from_currency": request.from_currency,
            "to_currency":   request.to_currency,
            "notional":      request.notional,
            "tenor_days":    request.tenor_days,
        }
        await _apply_faults("place_fx_hedge", payload, context)
        c = cases.resolve("treasury-ops", "place_fx_hedge", payload)
        result = pb2.FxHedgeResponse(
            hedge_id=_coerce(c.get("hedge_id"), ""),
            from_currency=_coerce(c.get("from_currency"), ""),
            to_currency=_coerce(c.get("to_currency"), ""),
            notional=float(_coerce(c.get("notional"), 0.0)),
            forward_rate=float(_coerce(c.get("forward_rate"), 0.0)),
            tenor_days=int(_coerce(c.get("tenor_days"), 0)),
            status=_coerce(c.get("status"), ""),
            error=_coerce(c.get("error"), ""),
        )
        deliver("treasury-ops", "treasury.hedge.executed", c, delay_s=0.6)
        return result

    async def TransferFunds(self, request, context):
        payload = {
            "from_region": request.from_region, "to_region": request.to_region,
            "amount_usd":  request.amount_usd,  "currency":  request.currency,
            "idempotency_key": request.idempotency_key,
        }
        await _apply_faults("transfer_funds", payload, context)
        c = cases.resolve("treasury-ops", "transfer_funds", payload)
        result = pb2.TransferResponse(
            transfer_id=_coerce(c.get("transfer_id"), ""),
            from_region=_coerce(c.get("from_region"), ""),
            to_region=_coerce(c.get("to_region"), ""),
            amount_usd=float(_coerce(c.get("amount_usd"), 0.0)),
            status=_coerce(c.get("status"), ""),
            value_date=_coerce(c.get("value_date"), ""),
        )
        deliver("treasury-ops", "treasury.transfer.completed", c, delay_s=0.4)
        return result


async def serve(addr: str = "0.0.0.0:50051") -> None:
    server = grpc.aio.server()
    pb2_grpc.add_TreasuryOpsServicer_to_server(TreasuryOps(), server)
    server.add_insecure_port(addr)
    await server.start()
    print(f"[mock] treasury-ops gRPC listening on {addr}", flush=True)
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve(os.getenv("LYNX_GRPC_TREASURY_ADDR", "0.0.0.0:50051")))
