from datetime import datetime, timedelta


def generate_attack_chain(tenant_id: str, entity_id: str) -> list[dict]:
    start = datetime.utcnow()
    timeline = [
        ("FailedLogon", 0),
        ("PasswordSpray", 2),
        ("MfaFatigue", 5),
        ("ImpossibleTravel", 9),
        ("TokenReplay", 14),
        ("OAuthPersistence", 18),
        ("SessionHijack", 24),
        ("PrivilegeEscalation", 31),
    ]
    events = []
    for idx, (event_type, minute) in enumerate(timeline, start=1):
        events.append(
            {
                "eventId": f"sim-{idx:03d}",
                "tenantId": tenant_id,
                "entityId": entity_id,
                "provider": "EntraID",
                "eventType": event_type,
                "ip": "203.0.113.10",
                "country": "US" if idx < 4 else "DE",
                "accountType": "Privileged" if event_type == "PrivilegeEscalation" else "Standard",
                "timeGenerated": (start + timedelta(minutes=minute)).isoformat() + "Z",
                "details": {"simulation": True},
            }
        )
    return events
