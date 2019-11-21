lint:
	npx eslint --color --quiet *.js

test:
	$(MAKE) lint
	node --throw-deprecation --trace-deprecation test.js

publish:
	git push -u --tags origin master
	npm publish

update:
	npx updates -u
	rm -rf node_modules
	npm i

patch:
	$(MAKE) test
	npx versions -C patch
	$(MAKE) publish

minor:
	$(MAKE) test
	npx versions -C minor
	$(MAKE) publish

major:
	$(MAKE) test
	npx versions -C major
	$(MAKE) publish

.PHONY: lint test publish update patch minor major
