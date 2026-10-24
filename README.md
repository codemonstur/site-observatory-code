# Observatory Code

Periodically scans a random sample of Java projects on GitHub with
[codegrade](https://github.com/codemonstur/codegrade) and records the quality score.

## How it works

- `data/java-repositories.txt` — every Java project on GitHub known to
  [libraries.io](https://libraries.io) (snapshot from the open data dump,
  `repositories-1.6.0-2020-01-12`), one `owner/repo` per line
- `data/scanned.txt` — projects that have already been scanned (append-only)
- `docs/` — the static website (GitHub Pages serves this folder)
  - `docs/data/results.csv` — one row per scan: `repo,scanned_at,score,status`
  - `docs/data/reports/` — the full JSON report (and log) of every scan
- `.github/workflows/scan.yml` — daily at 03:17 UTC (and on manual dispatch)
  picks a random sample of not-yet-scanned projects and runs
  `java -jar codegrade-cli.jar owner/repo -o docs/data/reports/<owner>_<repo>.json`
  over each, then commits the results back to the repository

Failed scans (deleted or renamed repositories, network errors) are recorded with
`status=failed` and are not retried.

## The website

`docs/` holds a static dashboard — stat cards, score distribution and
timeline charts (uPlot, vendored), and a sortable/filterable leaderboard
with a per-repository report view. Everything is loaded client-side from
`docs/data/`, so the daily workflow keeps the site up to date just by
committing.

```sh
make serve   # http://localhost:8080
```

Deploy with GitHub Pages: "Deploy from a branch", branch `main`, folder `/docs`.

## Refreshing the repository list

The list comes from the libraries.io open data dump on
[Zenodo](https://zenodo.org/records/3626071). To regenerate it:

```sh
python3 scripts/filter-repositories.py repositories.csv data/java-repositories.txt
```
