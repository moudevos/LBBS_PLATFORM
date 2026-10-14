# InstalaciÃ³n RouterOS v7

1. Actualiza RouterOS v7 y realiza un backup.
2. Identifica el puerto/VLAN del AP externo (el hEX no tiene radio WiFi) y la subnet de clientes.
3. Completa todos los placeholders de `install.rsc.template`; no modifiques WAN ni firewall global.
4. Reemplaza `{{LBBS_API_BASE_URL}}` y `{{LBBS_ROUTER_IDENTIFIER}}` tambiÃ©n dentro de `portal/login.html`; el token no va en el portal.
5. En WinBox > Files, sube `portal/` a `hotspot/lbbs-portal/` y cada archivo de `scripts/` a Files.
6. Guarda el template ya completado como `install.rsc` y usa Import.
7. Verifica HotSpot, DHCP, los schedulers `lbbs-sync` (5s) y `lbbs-heartbeat` (30s), y luego heartbeat en Dashboard.
8. Genera un cÃ³digo: el usuario debe existir inicialmente disabled.
9. Abre el portal, valida DNI+cÃ³digo y comprueba que se active, haga login CHAP y tenga Internet.
10. Desconecta menos de 3 min: debe reconectar con mac-cookie. Desconecta mÃ¡s de 3 min: debe expirar y exigir un cÃ³digo nuevo.

TLS requiere hora correcta, DNS funcional y CA confiable; `check-certificate=yes` es obligatorio. Los archivos a subir son `portal/*`, `scripts/lbbs-sync.rsc`, `scripts/lbbs-heartbeat.rsc`, `scripts/lbbs-session-login.rsc` y `scripts/lbbs-session-logout.rsc`.
