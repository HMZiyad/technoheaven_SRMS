.PHONY: up down down-v logs api-sh worker-sh migrate seed test lint build rebuild

up:
	docker compose up -d

down:
	docker compose down

down-v:
	docker compose down -v

logs:
	docker compose logs -f

api-sh:
	docker compose exec api sh

worker-sh:
	docker compose exec worker sh

migrate:
	docker compose run --rm migrate

seed:
	docker compose exec api npx tsx src/db/seed.ts

test:
	docker compose exec api npm test

lint:
	docker compose exec api npm run lint

build:
	docker compose build

rebuild:
	docker compose build --no-cache
