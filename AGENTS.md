# Hazali Repository Richtlijnen

Deze richtlijnen gelden voor werk in deze repository. De app is een mobile-first
PWA met React, TypeScript, Vite, Supabase, Dexie en Vercel API-routes.

## Algemeen

- Gebruik TypeScript strict.
- Gebruik geen `any` tenzij dit gemotiveerd wordt in de code of het plan.
- Volg bestaande naamgeving, mapstructuur en componentpatronen.
- Hergebruik bestaande Hazali-componenten en CSS-variabelen.
- Houd de interface mobile-first.
- Verander bestaande functionaliteit alleen wanneer noodzakelijk.
- Voeg geen dependencies toe zonder expliciete reden en controle.

## Security

- Zet nooit secrets in frontendcode, commits of logs.
- Service-role keys en cron secrets blijven uitsluitend server-side.
- Voer geen destructieve databasewijzigingen uit zonder toestemming.
- Omzeil geen captcha's, logins, rate limits of anti-botbeveiliging.
- Respecteer gebruiksvoorwaarden, robots.txt en technische blokkades.

## Filament Dealtracker

- Retailer-specifieke code moet gescheiden blijven van algemene logica.
- Een mislukte retailer mag andere retailers niet laten mislukken.
- Verzendkosten moeten worden meegenomen in de werkelijke prijs per kilogram.
- Gewichten en geldbedragen moeten gevalideerd worden.
- Gebruik eurobedragen intern zonder floating-point-afrondingsfouten.
- Houd algemene prijs-, gewicht-, normalisatie- en deduplicatielogica los van
  retailer-adapters.
- Markeer een retailer als ongeschikt wanneer een bron niet betrouwbaar,
  toegestaan of onderhoudbaar gekoppeld kan worden.

## Tests En Checks

- Voeg tests toe voor alle prijs- en gewichtsberekeningen.
- Gebruik geen live webverzoeken in unit-tests.
- Gebruik fixtures of mocks voor retailerdata.
- Voer lint, typecheck, tests en build uit voordat een fase gereed is.
- Huidige beschikbare commands:
  - `npm run lint`
  - `npm run build` voert `tsc -b` en `vite build` uit.
- Er is momenteel geen apart testscript in `package.json`; voeg of documenteer
  een testcommand wanneer een fase tests introduceert.

## Bestaande Structuur

- Applicatieroutes staan in `src/App.tsx`.
- Globale app-start, auth-shell en PWA-registratie staan in `src/main.tsx`.
- Supabase clientconfiguratie staat in `src/lib/supabase.ts`.
- Lokale Dexie-opslag staat in `src/database/db.ts`.
- Supabase migraties staan in `supabase/migrations`.
- Vercel API-routes staan in `api`.
- Pagina's staan in `src/pages`, services in `src/services`, types in
  `src/types`, utilities in `src/utils` en gedeelde UI in `src/components`.
