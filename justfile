# pullim-admissions-coach — standard verbs. `just` to list.
set shell := ["bash", "-cu"]

default:
    @just --list

lint:
    pnpm lint

typecheck:
    pnpm typecheck

check:
    pnpm lint
    pnpm typecheck
    pnpm test

setup:
    mise install
    pnpm install

test:
    pnpm test

ship msg:
    just check
    git add -A
    git commit -m "{{msg}}"
    git push
