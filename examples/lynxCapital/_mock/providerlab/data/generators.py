"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Deterministic seeded data generators that build large, related, evolving entity sets for each provider without external dependencies.
"""
from __future__ import annotations

import hashlib
import random
from datetime import date, timedelta

_LEGAL = ("Holdings", "Industries", "Systems", "Logistics", "Components", "Partners",
          "Networks", "Capital", "Trading", "Labs", "Group", "Solutions", "Foods",
          "Materials", "Robotics", "Analytics", "Freight", "Ventures")
_ROOTS = ("Northwind", "Contoso", "Aerolux", "Meridian", "Vertex", "Apex", "Axiom",
          "Helios", "Cobalt", "Granite", "Sequoia", "Onyx", "Cinder", "Marigold",
          "Tamarind", "Borealis", "Solstice", "Kestrel", "Driftwood", "Lattice",
          "Quill", "Saffron", "Verde", "Indigo", "Crimson", "Harbor", "Cedar")
_FIRST = ("Dana", "Priya", "Marco", "Lena", "Hassan", "Yuki", "Sofia", "Diego",
          "Amara", "Noah", "Ingrid", "Tariq", "Mei", "Lucas", "Farah", "Oskar")
_LAST = ("Whitfield", "Okafor", "Bianchi", "Novak", "Haddad", "Tanaka", "Reyes",
         "Lindqvist", "Khan", "Bauer", "Costa", "Adeyemi", "Wu", "Sorensen")
_COUNTRIES = (("US", "USD"), ("GB", "GBP"), ("DE", "EUR"), ("FR", "EUR"),
              ("BR", "BRL"), ("SG", "SGD"), ("JP", "JPY"), ("CA", "CAD"))
_TERMS = ("NET15", "NET30", "NET45", "NET60")
_EPOCH = date(2026, 1, 1)


def _rng(*parts: object) -> random.Random:
    key = ":".join(str(p) for p in parts)
    digest = hashlib.sha256(key.encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def _company(rng: random.Random) -> str:
    return f"{rng.choice(_ROOTS)} {rng.choice(_LEGAL)}"


def _person(rng: random.Random) -> str:
    return f"{rng.choice(_FIRST)} {rng.choice(_LAST)}"


def _slug(name: str) -> str:
    return "".join(c for c in name.lower() if c.isalnum() or c == " ").replace(" ", "-")


def _day(rng: random.Random, lo: int, hi: int) -> str:
    return (_EPOCH + timedelta(days=rng.randint(lo, hi))).isoformat()


def vendors(seed: str, count: int) -> list[dict]:
    """Vendor / supplier master records with country, currency, terms, and tax id."""
    out = []
    for i in range(1, count + 1):
        rng = _rng(seed, "vendor", i)
        name = _company(rng)
        country, currency = rng.choice(_COUNTRIES)
        out.append({
            "id": f"VEND-{i:05d}",
            "name": name,
            "slug": _slug(name),
            "country": country,
            "currency": currency,
            "taxId": f"{country}{rng.randint(10**8, 10**9 - 1)}",
            "paymentTerms": rng.choice(_TERMS),
            "status": "active" if rng.random() > 0.08 else "on_hold",
            "riskTier": rng.choice(("low", "low", "medium", "high")),
            "createdAt": _day(rng, -540, -30),
        })
    return out


def contacts(seed: str, count: int) -> list[dict]:
    out = []
    stages = ("lead", "qualified", "customer", "vendor", "churned")
    for i in range(1, count + 1):
        rng = _rng(seed, "contact", i)
        name = _person(rng)
        company = _company(rng)
        out.append({
            "id": f"CONT-{i:05d}",
            "name": name,
            "email": f"{name.split()[0].lower()}@{_slug(company).split('-')[0]}.example",
            "company": company,
            "stage": rng.choice(stages),
            "ownerId": f"U-{rng.randint(1, 40)}",
            "createdAt": _day(rng, -400, -1),
        })
    return out


def accounts(seed: str, count: int) -> list[dict]:
    """Bank or ledger accounts with balances and currency."""
    out = []
    kinds = ("operating", "reserve", "payroll", "fx", "escrow")
    for i in range(1, count + 1):
        rng = _rng(seed, "account", i)
        country, currency = rng.choice(_COUNTRIES)
        out.append({
            "id": f"ACCT-{i:04d}",
            "name": f"{rng.choice(kinds).title()} {currency}",
            "kind": rng.choice(kinds),
            "currency": currency,
            "balance": round(rng.uniform(25_000, 4_500_000), 2),
            "available": 0.0,
            "status": "active",
        })
        out[-1]["available"] = round(out[-1]["balance"] * rng.uniform(0.6, 0.99), 2)
    return out


def transactions(seed: str, account_ids: list[str], count: int) -> list[dict]:
    out = []
    kinds = ("debit", "credit")
    rails = ("ACH", "WIRE", "RTP", "SEPA", "CARD")
    for i in range(1, count + 1):
        rng = _rng(seed, "txn", i)
        out.append({
            "id": f"TXN-{i:06d}",
            "accountId": rng.choice(account_ids),
            "type": rng.choice(kinds),
            "amount": round(rng.uniform(50, 250_000), 2),
            "currency": rng.choice(_COUNTRIES)[1],
            "rail": rng.choice(rails),
            "counterparty": _company(rng),
            "postedAt": _day(rng, -180, 0),
            "status": rng.choice(("posted", "posted", "posted", "pending")),
        })
    return out


def invoices(seed: str, vendor_ids: list[str], count: int) -> list[dict]:
    out = []
    for i in range(1, count + 1):
        rng = _rng(seed, "invoice", i)
        currency = rng.choice(_COUNTRIES)[1]
        amount = round(rng.uniform(250, 180_000), 2)
        issued = _EPOCH + timedelta(days=rng.randint(-150, -5))
        out.append({
            "id": f"INV-{i:06d}",
            "vendorId": rng.choice(vendor_ids),
            "number": f"{rng.choice(_ROOTS)[:3].upper()}-{rng.randint(1000, 9999)}",
            "amount": amount,
            "currency": currency,
            "tax": round(amount * rng.choice((0.0, 0.07, 0.19, 0.0825)), 2),
            "issuedAt": issued.isoformat(),
            "dueAt": (issued + timedelta(days=rng.choice((15, 30, 45)))).isoformat(),
            "status": rng.choice(("open", "open", "matched", "paid", "disputed")),
        })
    return out


def users(seed: str, count: int) -> list[dict]:
    out = []
    roles = ("analyst", "controller", "treasurer", "approver", "auditor", "admin")
    for i in range(1, count + 1):
        rng = _rng(seed, "user", i)
        name = _person(rng)
        out.append({
            "id": f"U-{i}",
            "name": name,
            "email": f"{name.split()[0].lower()}.{name.split()[1].lower()}@lynxcapital.example",
            "role": rng.choice(roles),
            "active": rng.random() > 0.06,
            "groups": sorted({f"grp-{rng.choice(('finance','treasury','compliance','ap','ar'))}"
                              for _ in range(rng.randint(1, 3))}),
        })
    return out


def instruments(seed: str) -> list[dict]:
    pairs = ("USD/EUR", "USD/GBP", "USD/JPY", "USD/BRL", "USD/SGD", "EUR/GBP",
             "EUR/JPY", "GBP/JPY", "USD/CAD", "EUR/CHF")
    out = []
    for sym in pairs:
        rng = _rng(seed, "instrument", sym)
        out.append({
            "symbol": sym,
            "mid": round(rng.uniform(0.6, 160.0), 4),
            "spreadBps": rng.randint(2, 18),
            "venue": rng.choice(("LDN", "NYC", "SGP", "TKY")),
        })
    return out


def recipients(seed: str, count: int) -> list[dict]:
    out = []
    methods = ("bank", "wallet", "card")
    for i in range(1, count + 1):
        rng = _rng(seed, "recipient", i)
        country, currency = rng.choice(_COUNTRIES)
        out.append({
            "id": f"RCPT-{i:05d}",
            "name": _company(rng) if rng.random() > 0.4 else _person(rng),
            "country": country,
            "currency": currency,
            "method": rng.choice(methods),
            "verified": rng.random() > 0.15,
        })
    return out


def index_by(records: list[dict], key: str = "id") -> dict[str, dict]:
    return {r[key]: r for r in records}
