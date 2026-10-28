# Code Observatory - build & development tasks
#
# Run `make` (or `make help`) for a list of targets.

PORT ?= 8080

.DEFAULT_GOAL := help

.PHONY: help serve clean

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_.-]+:' $(MAKEFILE_LIST) | grep -vE '^[a-zA-Z0-9_.-]+:=' | \
		awk 'BEGIN {FS = ":"} /^\./ {next} {name = $$1; sub(/[[:blank:]]+$$/, "", name); doc = $$0; sub(/^[^#]*## /, "", doc); if (doc == $$0) sub(/^[^:]*:[[:blank:]]*/, "", doc); printf "  \033[36m%-20s\033[0m %s\n", name, doc}'

serve: ## Serve the site locally on PORT (default 8080)
	cd docs && python3 -m http.server $(PORT)

clean: ## Remove local scan logs
	rm -f docs/data/reports/*.log.tmp
