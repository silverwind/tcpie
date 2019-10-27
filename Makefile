lint:
	node_modules/.bin/eslint --color --quiet *.js

test:
	$(MAKE) lint
	node --throw-deprecation --trace-deprecation test.js

publish:
	git push -u --tags origin master
	npm publish

update:
	node_modules/.bin/updates -u
	rm -rf node_modules
	yarn

patch:
	$(MAKE) test
	npx ver -C patch
	$(MAKE) publish

minor:
	$(MAKE) test
	npx ver -C minor
	$(MAKE) publish

major:
	$(MAKE) test
	npx ver -C major
	$(MAKE) publish

.PHONY: lint test publish update patch minor major
