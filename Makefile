SRC := tcpie.js
DST := dist/tcpie.js

node_modules: package-lock.json
	npm install --no-save
	@touch node_modules

.PHONY: deps
deps: node_modules

.PHONY: lint
lint: node_modules
	npx eslint --color --quiet .

.PHONY: lint-fix
lint-fix: node_modules
	npx eslint --color --quiet . --fix

.PHONY: test
test: lint build node_modules
	npx vitest

.PHONY: build
build: $(DST)

$(DST): $(SRC) node_modules
# workaround for https://github.com/evanw/esbuild/issues/1921
	npx esbuild --log-level=warning --platform=node --target=node16 --format=esm --bundle --minify --legal-comments=none --banner:js="import {createRequire} from 'module';const require = createRequire(import.meta.url);" --define:import.meta.VERSION=\"$(shell jq .version package.json)\" --outfile=$(DST) $(SRC)
	chmod +x $(DST)

.PHONY: publish
publish:
	git push -u --tags origin master
	npm publish

.PHONY: update
update: node_modules
	npx updates -cu
	rm -rf node_modules package-lock.json
	npm install
	@touch node_modules

.PHONY: patch
patch: node_modules test
	npx versions -c 'make --no-print-directory build' patch package.json package-lock.json
	@$(MAKE) --no-print-directory publish

.PHONY: minor
minor: node_modules test
	npx versions -c 'make --no-print-directory build' minor package.json package-lock.json
	@$(MAKE) --no-print-directory publish

.PHONY: major
major: node_modules test
	npx versions -c 'make --no-print-directory build' major package.json package-lock.json
	@$(MAKE) --no-print-directory publish
