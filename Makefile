.PHONY: help dev-api dev-app build-apk install-api install-app gen-app clean-app typecheck-api

help:
	@echo "AuraLib monorepo — atajos"
	@echo ""
	@echo "  make install-api   Instala deps del backend"
	@echo "  make install-app   Instala deps del cliente Flutter"
	@echo "  make dev-api       Levanta el backend (http://localhost:3100)"
	@echo "  make dev-app       Levanta el cliente Flutter contra emulador (10.0.2.2)"
	@echo "  make gen-app       Corre build_runner (freezed/json/riverpod_generator)"
	@echo "  make build-apk     Compila APK release"
	@echo "  make typecheck-api Typecheck del backend"
	@echo "  make clean-app     flutter clean"

install-api:
	cd api && npm install

install-app:
	cd app && flutter pub get

dev-api:
	bash scripts/dev-api.sh

dev-app:
	bash scripts/dev-app.sh

build-apk:
	bash scripts/build-apk.sh

gen-app:
	cd app && dart run build_runner build --delete-conflicting-outputs

typecheck-api:
	cd api && npm run typecheck

clean-app:
	cd app && flutter clean
