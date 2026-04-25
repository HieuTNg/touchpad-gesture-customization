NAME=touchpad-gesture-customization
DOMAIN=coooolapps.com
UUID=${NAME}@${DOMAIN}
BUILDIR=build
ZIPPATH=${BUILDIR}/${UUID}.zip

.PHONY: pack update clean install uninstall logs ci

ci:
	@echo "=== [1/6] Cleaning build artifacts ==="
	rm -rf ${BUILDIR}
	@echo ""
	@echo "=== [2/6] Installing dependencies ==="
	bun install
	@echo ""
	@echo "=== [3/6] Linting ==="
	bun run lint:extension
	@echo ""
	@echo "=== [4/6] Formatting ==="
	bun run format:extension
	@echo ""
	@echo "=== [5/6] Compiling TypeScript & Building ==="
	bun run build
	@echo ""
	@echo "=== [6/6] Packing & Installing extension ==="
	$(MAKE) pack
	$(MAKE) update
	@echo ""
	@echo "=== ✓ CI Complete — Extension installed ==="
	@echo "Log out and log back in to activate."

pack:
	mkdir -p ${BUILDIR}
	cp -r extension/assets extension/stylesheet.css extension/ui extension/schemas metadata.json $(BUILDIR)
	rm -f ${ZIPPATH}
	(cd ${BUILDIR} && zip -r ${UUID}.zip .)

update:
	gnome-extensions install -f ${ZIPPATH}

clean:
	rm -rf ${BUILDIR}

install: pack update
	@echo "Extension installed. Log out and log back in to activate."

uninstall:
	gnome-extensions uninstall ${UUID}
	@echo "Extension uninstalled."

logs:
	journalctl -f -o cat /usr/bin/gnome-shell