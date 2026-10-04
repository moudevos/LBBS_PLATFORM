# Google Wallet — LBBS Rewards

La tarjeta de Google Wallet es una proyección de LBBS: Supabase sigue siendo la fuente de verdad de atenciones y Rewards.

1. En Google Cloud, activa **Google Wallet API** para el proyecto de LBBS.
2. En Google Pay & Wallet Console crea o registra la cuenta emisora y copia su **Issuer ID**.
3. Crea una Service Account en Google Cloud y genera una clave JSON. Invita el correo de esa cuenta como **Developer** dentro del issuer de Google Wallet.
4. Configura sólo en el entorno servidor de `lbbs-clientes`:

   ```env
   SUPABASE_SERVICE_ROLE_KEY=...
   GOOGLE_WALLET_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
   GOOGLE_WALLET_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_WALLET_PRIVATE_KEY_ID=...
   GOOGLE_WALLET_ISSUER_ID=...
   GOOGLE_WALLET_CLASS_SUFFIX=lbbs_loyalty_v1
   GOOGLE_WALLET_LOGO_URL=https://clientes.labajaditabarberstudio.com/icon.svg
   WALLET_SYNC_INTERNAL_SECRET=un-secreto-largo-aleatorio
   ```

   Ninguna de estas variables lleva el prefijo `NEXT_PUBLIC_`.
5. En modo de demostración, verifica que la cuenta emisora y la clase puedan crear tarjetas para los usuarios de prueba. Cuando la clase esté lista, Google debe aprobarla para uso publicado.
6. Abre el portal, entra a Rewards y pulsa **Agregar a Google Wallet**. El sistema crea o reutiliza una sola LoyaltyClass y un LoyaltyObject por cliente.
7. Para procesar pendientes manualmente durante desarrollo o desde un scheduler:

   ```bash
   curl -X POST https://clientes.labajaditabarberstudio.com/api/internal/wallet/sync \
     -H "x-wallet-sync-secret: $WALLET_SYNC_INTERNAL_SECRET"
   ```

   No pongas esa URL ni ese secreto en el navegador. Para producción puedes invocarlo desde Supabase Cron/pg_cron, un scheduler de infraestructura o el mecanismo interno que ya use LBBS.

La API requiere una Service Account autorizada en el issuer; la cuenta OAuth de Google que inicia sesión el cliente no se reutiliza para Wallet. La clase y los objetos usan IDs con formato `issuerId.identificador` y los objetos se actualizan mediante PATCH. Consulta la documentación oficial de [autenticación REST](https://developers.google.com/wallet/retail/loyalty-cards/getting-started/auth/rest), [LoyaltyClass](https://developers.google.com/wallet/reference/rest/v1/loyaltyclass) y [LoyaltyObject](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject).
