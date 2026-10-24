#!/usr/bin/env python3
"""Filter a libraries.io repositories.csv down to a list of GitHub Java projects.

Usage: python3 scripts/filter-repositories.py <repositories.csv> [output.txt]

Keeps rows where language is Java and the host is GitHub, drops deleted rows,
and writes one owner/repo per line, sorted and deduplicated.
"""
import csv
import sys


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    source = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else "data/java-repositories.txt"

    repos = set()
    with open(source, newline="", encoding="utf-8", errors="replace") as handle:
        for row in csv.DictReader(handle):
            if row.get("language") != "Java":
                continue
            if row.get("host_type") != "GitHub":
                continue
            if str(row.get("deleted", "")).lower() in ("true", "1"):
                continue
            full_name = (row.get("full_name") or "").strip()
            if full_name.count("/") != 1 or full_name.startswith("/") or full_name.endswith("/"):
                continue
            repos.add(full_name)

    with open(output, "w", encoding="utf-8") as handle:
        for repo in sorted(repos):
            handle.write(repo + "\n")
    print(f"wrote {len(repos)} repositories to {output}")


if __name__ == "__main__":
    main()
