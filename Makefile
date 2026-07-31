.PHONY: serve build test

serve:
	npm install
	npm run dev -- --host 127.0.0.1

build:
	npm run build

test:
	npm test
