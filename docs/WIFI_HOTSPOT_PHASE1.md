# Red Hotspot — Fase 1

El dashboard genera vouchers de seis dígitos y sólo guarda SHA-256 y los últimos cuatro dígitos. El portal `lbbs-captive` valida server-side y consume el voucher de forma atómica: primer uso 30 minutos, misma MAC/dispositivo 3 horas, máximo un dispositivo.

MikroTik queda desacoplado: no hay conexión simulada. Para hardware real faltan host/puerto, usuario, contraseña, perfil HotSpot, VLAN/interfaz, dominio HTTPS, certificado, walled garden y los parámetros `mac`, `ip`, `link-login`, `link-orig` entregados por RouterOS. Nunca exponer `MIKROTIK_*` al navegador.
