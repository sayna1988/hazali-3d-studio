# React + TypeScript + Vite

## Supabase cloud sync en printerstatus

1. Voer `supabase/migrations/202606200001_create_prints.sql` uit in de Supabase SQL Editor.
2. Zet in Vercel `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`. De gebruikelijke Vercel/Supabase-aliasen worden ook ondersteund.
3. Vervang in Supabase bij **Authentication > Email Templates > Magic Link** de inhoud door het bestand `supabase/templates/magic_link.html`. De app gebruikt de getoonde OTP-code, omdat iOS de sessie van Safari niet deelt met een geïnstalleerde webapp.
4. Deploy opnieuw. Log op desktop en mobiel in met hetzelfde e-mailadres en vul de ontvangen code in de app in.

## Realtime printerstatus

1. Voer ook `supabase/migrations/202606200002_create_printer_realtime.sql` uit in de Supabase SQL Editor.
2. Voeg in Vercel `SUPABASE_SERVICE_ROLE_KEY` toe. Deze geheime sleutel mag nooit met `VITE_` beginnen.
3. Open **Mijn printer > Verbinding**, sla de instellingen op en kopieer de drie relayvariabelen.
4. Stel die variabelen in op een computer, NAS of Raspberry Pi in hetzelfde netwerk als de printerbridge.
5. Start daar `npm run printer:relay`. De relay leest standaard elke twee seconden `/api/printer/status` en stuurt de status beveiligd naar de cloud.

De statuspagina ontvangt wijzigingen direct via Supabase Realtime. Een update ouder dan 15 seconden wordt als offline getoond. De bridgepayload gebruikt dit formaat:

```json
{
  "state": "printing",
  "job": { "name": "model.3mf", "progress": 42, "elapsedSeconds": 900, "remainingSeconds": 1200 },
  "temperatures": { "nozzle": 220, "nozzleTarget": 220, "bed": 60, "bedTarget": 60 },
  "speed": { "percentage": 100, "profile": "Standard" },
  "filament": { "type": "PLA", "remainingPercent": 73 },
  "device": { "model": "Bambu Lab P2S", "serial": "...", "firmware": "...", "wifiSignal": -48, "ip": "192.168.1.50" }
}
```

Bestaande lokale prints worden bij de eerste login gemigreerd. Het originele 3MF-bestand blijft alleen lokaal; metadata en afbeeldingen worden gesynchroniseerd.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
