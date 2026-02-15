.PHONY: test test-backend test-frontend

## Run all tests
test: test-backend test-frontend

## Run backend tests with pytest
test-backend:
	cd backend && uv run --group dev pytest -v

## Run frontend tests (placeholder – no test runner configured yet)
test-frontend:
	@echo "⚠️  No frontend tests configured yet (no test runner in package.json)"
