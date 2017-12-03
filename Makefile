lint:
	node_modules/.bin/eslint --color --quiet *.js

test:
	$(MAKE) lint
	node --throw-deprecation --trace-deprecation test.js

publish:
	git push -u --tags origin master
	npm publish

update:
	node_modules/.bin/updates
	rm -rf node_modules
	yarn

npm-patch:
	npm version patch

npm-minor:
	npm version minor

npm-major:
	npm version major

patch: lint test npm-patch publish
minor: lint test npm-minor publish
major: lint test npm-major publish

.PHONY: lint touch update patch minor major npm-patch npm-minor npm-major
