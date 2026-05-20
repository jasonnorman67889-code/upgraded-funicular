import re


def _parse_where(query: str) -> tuple[str, str] | None:
    match = re.search(r"where\s+([A-Za-z0-9_]+)\s*==\s*'([^']+)'", query, flags=re.IGNORECASE)
    if not match:
        return None
    return match.group(1), match.group(2)


def _parse_project(query: str) -> list[str]:
    match = re.search(r"project\s+([A-Za-z0-9_,\s]+)", query, flags=re.IGNORECASE)
    if not match:
        return []
    return [part.strip() for part in match.group(1).split(",") if part.strip()]


def run_kql_lite(query: str, rows: list[dict]) -> list[dict]:
    output = rows
    where_clause = _parse_where(query)
    if where_clause:
        field, value = where_clause
        output = [row for row in output if str(row.get(field)) == value]

    if re.search(r"summarize\s+count\(\)", query, flags=re.IGNORECASE):
        return [{"count_": len(output)}]

    project_fields = _parse_project(query)
    if project_fields:
        projected = []
        for row in output:
            projected.append({key: row.get(key) for key in project_fields})
        return projected

    return output
