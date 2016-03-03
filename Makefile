install:
	npm install
	bower install

run:
	grunt serve

build:
	grunt build --force

deploy: build
	heroku docker:release -a rentswatch-api

prefetch:
	node server/commands/stats.js --output=./server/cache/all.json
