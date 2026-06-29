# Filament Dealtracker Plan

## Doel En Scope

De filament-dealtracker wordt een uitbreidbare module binnen Hazali die
filamentaanbiedingen verzamelt, normaliseert en vergelijkt op werkelijke prijs
per kilogram. De MVP richt zich op PLA en PLA+, webwinkels die naar Nederland
leveren, rollen van minimaal 750 gram, voorraadstatus, prijshistorie,
prijsalerts en een Dealtracker-pagina in de bestaande mobile-first PWA.

De MVP begint met maximaal drie retailers. Per retailer wordt eerst beoordeeld
of er een toegestane en onderhoudbare bron bestaat, in deze volgorde:
officiële API, officiële productfeed, officiële affiliate-feed, toegestane
HTML-uitlezing. Captcha's, logins, rate limits, anti-botbeveiliging en andere
technische blokkades worden niet omzeild.

## Architectuuroverzicht

De bestaande applicatie gebruikt React, TypeScript en Vite voor de frontend,
Supabase voor auth en clouddata, Dexie voor lokale offline opslag en Vercel
API-routes voor server-side integraties. De dealtracker voegt een centrale
deal-datalaag toe aan Supabase en houdt persoonlijke alerts gescheiden per
gebruiker.

Aanbevolen hoofdonderdelen:

- Frontendpagina: `src/pages/Dealtracker.tsx` met CSS in
  `src/pages/Dealtracker.css`.
- Service-laag: `src/services/DealtrackerService.ts` voor reads, filters en
  alertacties.
- Types: `src/types/Dealtracker.ts`.
- Algemene rekenlogica: `src/utils/dealPricing.ts`.
- Algemene normalisatie: `src/utils/dealNormalize.ts`.
- Retailer-adapters: server-side, gescheiden van algemene logica.
- Background collector: bij voorkeur Supabase Edge Function met Supabase Cron,
  of Vercel Cron wanneer het deployment-plan zesuurlijkse jobs ondersteunt.

De bestaande route-inrichting staat in `src/App.tsx`, desktopnavigatie in
`src/components/Sidebar/Sidebar.tsx` en mobiele navigatie in
`src/components/BottomNavigation/BottomNavigation.tsx`.

## Datastroom

1. Een geplande achtergrondtaak start iedere zes uur.
2. De collector leest de actieve retailers uit de configuratie.
3. Iedere retailer-adapter draait geïsoleerd met eigen timeout, rate-limit en
   foutafhandeling.
4. Ruwe producten worden genormaliseerd naar materiaal, merk, kleur, diameter,
   variant, gewicht, voorraadstatus en levering naar Nederland.
5. De prijsberekening bepaalt de werkelijke prijs per kilogram:
   `totale_prijs = productprijs + verzendkosten - directe_korting`.
6. Het totale gewicht wordt bepaald uit losse rollen, multipacks,
   rolgewicht en minimale bestelhoeveelheid:
   `totaal_gewicht_kg = totaal_gewicht_gram / 1000`.
7. De collector slaat observaties op in de prijshistorie en werkt de actuele
   aanbieding bij.
8. Alertregels worden geëvalueerd en gededupliceerde alert-events worden
   aangemaakt.
9. De frontend leest actuele aanbiedingen, prijshistorie en persoonlijke
   alerts via Supabase.

## Databaseontwerp

De dealtracker heeft querybare relationele tabellen nodig in plaats van alleen
`jsonb`, omdat prijs, materiaal, voorraad en tijdreeksen efficiënt gefilterd
moeten worden.

Voorgestelde tabellen:

- `deal_stores`: retailerconfiguratie, adapter-key, bronsoort, status,
  leverbaarheid naar Nederland, robots/terms-checkdatum en rate-limit.
- `deal_products`: genormaliseerde productvariant per retailer met merk,
  naam, materiaal, materiaalvariant, kleur, diameter, EAN/GTIN, canonical URL
  en `variant_key`.
- `deal_offer_observations`: prijshistorie per controle met productprijs,
  verzendkosten, directe korting, totaalprijs, totaalgewicht, prijs per kg,
  minimale bestelhoeveelheid, aantal rollen, gewicht per rol, voorraadstatus,
  valuta, raw hash en `checked_at`.
- `deal_current_offers`: actuele beste/laatste observatie per productvariant
  voor snelle frontendqueries.
- `deal_alerts`: persoonlijke alertregels per gebruiker.
- `deal_alert_events`: gededupliceerde getriggerde alerts.
- `deal_runs`: collector-runs met start/einde, status en aantallen.
- `deal_run_logs`: adapterlogs, waarschuwingen en fouten zonder secrets.

RLS:

- Gedeelde dealdata is leesbaar voor ingelogde gebruikers.
- Schrijven naar dealdata gebeurt alleen server-side met service role.
- Gebruikers mogen alleen eigen `deal_alerts` en `deal_alert_events` lezen en
  beheren.
- Runlogs zijn standaard alleen server-side/admin zichtbaar.

Indexen:

- `deal_current_offers(material, price_per_kg, stock_status, checked_at desc)`.
- Unique index op `deal_products(store_id, external_id, variant_key)`.
- `deal_offer_observations(product_id, checked_at desc)`.
- `deal_alerts(user_id, active)`.
- Unique index op `deal_alert_events(alert_id, dedupe_key)`.

## Adapterontwerp

Retailer-specifieke code blijft server-side en gescheiden van algemene logica.
Een adapter levert alleen ruwe of half-genormaliseerde data aan; centrale
helpers doen validatie, normalisatie, prijsberekening en deduplicatie.

Conceptueel contract:

- `key`: stabiele retailer-id.
- `sourceType`: `api`, `product_feed`, `affiliate_feed` of `html`.
- `supportsNlShipping`: of levering naar Nederland ondersteund wordt.
- `fetchRaw()`: haalt data op met timeout en respect voor rate limits.
- `normalize()`: vertaalt retailerdata naar algemene product- en offerrecords.
- `health`: status, laatste fout en geschiktheid.

Een mislukte adapter mag de run van andere adapters niet stoppen. De collector
gebruikt per adapter `try/catch`, timeouts en logging. Live requests horen niet
in unit-tests; adapters krijgen fixtures voor testdekking.

## Achtergrondtaken

Voorkeur: Supabase Edge Function met Supabase Cron, omdat Supabase al de
centrale database en service-role context heeft. Dit houdt collector writes,
alert-evaluatie en logs dicht bij de data.

Alternatief: Vercel Cron op een API-route in `api`, mits het Vercel-plan
zesuurlijkse uitvoering ondersteunt. In dat geval is een `CRON_SECRET` nodig,
plus idempotentie en locking om dubbele runs veilig af te handelen.

Benodigde achtergrondtaken:

- `dealtracker-check`: verzamelt aanbiedingen en slaat observaties op.
- `dealtracker-alerts`: kan onderdeel zijn van dezelfde run of apart draaien.
- `dealtracker-cleanup`: later optioneel voor retentie van oude logs of ruwe
  payloads.

## Frontendpagina's

De MVP krijgt één nieuwe pagina:

- `Dealtracker`: overzicht van actuele aanbiedingen, filters en alerts.

Belangrijke UI-elementen:

- KPI's voor beste prijs per kg, aantal aanbiedingen, laatst gecontroleerd en
  retailers met foutstatus.
- Filter op materiaal, merk, kleur, diameter, voorraadstatus en retailer.
- Sorteeropties voor prijs per kg, laatst gecontroleerd en korting.
- Dealkaarten met winkel, merk, materiaal, kleur, gewicht, voorraadstatus,
  totale prijs, prijs per kg, verzendkosten en laatste check.
- Prijshistorie per productvariant.
- Alertformulier met maximale prijs per kg en optionele filters.

De visuele stijl volgt de bestaande filamentpagina in `src/pages/Filamenten.tsx`
en `src/pages/Filamenten.css`, inclusief mobile-first layout, donkere panelen,
lucide-icons en bestaande CSS-variabelen.

## Alerts

MVP-alerts zijn persoonlijke regels in Supabase. Een alert wordt getriggerd
wanneer een actuele aanbieding voldoet aan de ingestelde filters en onder of
op de maximale prijs per kg komt.

Alertdeduplicatie gebruikt een `dedupe_key`, bijvoorbeeld:
`alert_id + product_id + price_per_kg_cents + date_bucket`.

Notificatiekanalen:

- MVP: in-app alertlijst en badge.
- Later: e-mail of web push, pas na aparte keuze en veilige secret/configuratie.

## Beveiliging

- Geen secrets in frontendcode, commits of logs.
- Service-role key alleen in Supabase Function of Vercel API-route.
- Cron endpoints vereisen een server-side secret.
- Ruwe retailerdata wordt beperkt opgeslagen en mag geen sessies, cookies of
  persoonlijke gegevens bevatten.
- URLs worden gevalideerd tegen SSRF-risico's wanneer server-side HTML of feeds
  worden opgehaald.
- Retailers met captcha, loginvereiste, anti-botblokkade of onduidelijke
  voorwaarden worden ongeschikt verklaard.
- Logs bevatten foutcategorieën, statuscodes en adapterkeys, maar geen secrets
  of volledige gevoelige payloads.

## Teststrategie

Er is momenteel geen apart testscript in `package.json`. De bestaande checks
zijn:

- `npm run lint`
- `npm run build`

`npm run build` voert `tsc -b && vite build` uit en fungeert daarmee ook als
typecheck.

Bij introductie van de dealtracker is extra testinrichting nodig:

- Unit-tests voor prijsberekening, gewichtsbepaling, multipacks, minimale
  bestelhoeveelheid, gratis verzending en directe kortingen.
- Unit-tests voor decimal-safe eurobedragen, bij voorkeur via centen of een
  kleine money-helper.
- Unit-tests voor normalisatie van PLA/PLA+, kleuren, diameter en voorraad.
- Adaptertests met opgeslagen fixtures, zonder live webverzoeken.
- Integratietests of SQL-checks voor RLS-policies.
- Frontend smoke-test voor filters, lege staat, dealkaart en alertformulier.

## Implementatiefases

### Fase 1: Bronvalidatie

Bestanden:

- `docs/filament-dealtracker-sources.md` nieuw.
- Geen applicatiecode.
- Geen migraties.

Doel: maximaal drie geschikte retailers selecteren op basis van officiële of
toegestane bronnen.

### Fase 2: Databasefundament

Bestanden:

- `supabase/migrations/YYYYMMDDHHMM_create_dealtracker.sql` nieuw.
- `src/types/Dealtracker.ts` nieuw.

Doel: tabellen, indexen en RLS vastleggen zonder destructieve wijzigingen.

### Fase 3: Rekenkern En Normalisatie

Bestanden:

- `src/utils/dealPricing.ts` nieuw.
- `src/utils/dealNormalize.ts` nieuw.
- Testbestanden volgens het gekozen testframework.

Doel: alle prijs- en gewichtsberekeningen centraal, getest en retailer-onafhankelijk.

### Fase 4: Collector En Adapters

Bestanden bij Supabase-variant:

- `supabase/functions/dealtracker-check/index.ts` nieuw.
- `supabase/functions/dealtracker-check/adapters/*` nieuw.

Bestanden bij Vercel-variant:

- `api/dealtracker-cron.js` nieuw.
- `api/dealtracker-run.js` eventueel nieuw.
- `vercel.json` nieuw of gewijzigd wanneer Cron via Vercel wordt gebruikt.

Doel: zesuurlijkse collectie, isolated adapter execution, logging en deduplicatie.

### Fase 5: Frontend MVP

Bestanden:

- `src/pages/Dealtracker.tsx` nieuw.
- `src/pages/Dealtracker.css` nieuw.
- `src/services/DealtrackerService.ts` nieuw.
- `src/components/dealtracker/*` eventueel nieuw.
- `src/App.tsx` wijzigen.
- `src/components/Sidebar/Sidebar.tsx` wijzigen.
- `src/components/BottomNavigation/BottomNavigation.tsx` eventueel wijzigen.

Doel: mobiele Dealtracker-pagina met actuele aanbiedingen, filters en details.

### Fase 6: Alerts

Bestanden:

- Alertcomponenten onder `src/components/dealtracker`.
- Alertfuncties in `src/services/DealtrackerService.ts`.
- Backend alert-evaluatie in de collector of aparte functie.

Doel: persoonlijke prijsalerts met deduplicatie en in-app weergave.

### Fase 7: Monitoring En Retentie

Bestanden:

- Mogelijk extra servicefuncties of admin-only UI.
- Mogelijk extra SQL voor retentiebeleid.

Doel: zicht op laatste runs, adapterstatus, foutpercentages en oude logdata.

## Definitie Van Gereed

Een fase is gereed wanneer:

- De scope van de fase is geïmplementeerd.
- Bestaande functionaliteit niet onnodig is gewijzigd.
- Prijs- en gewichtsberekeningen zijn getest.
- Unit-tests gebruiken geen live webverzoeken.
- `npm run lint` slaagt.
- `npm run build` slaagt.
- Een eventueel nieuw testcommand slaagt.
- Nieuwe databasewijzigingen zijn niet destructief en hebben RLS.
- Secrets staan uitsluitend server-side.
- De UI is gecontroleerd op mobiele bruikbaarheid.
- Foutafhandeling voorkomt dat één retailer de hele run breekt.

## Bekende Risico's

- Retailerbronnen kunnen ontbreken, voorwaarden wijzigen of scraping verbieden.
- HTML-structuren zijn fragiel en kunnen zonder waarschuwing veranderen.
- Verzendkosten kunnen afhangen van postcode, winkelmandje, accountstatus of
  tijdelijke acties.
- Voorraadstatus kan per variant of magazijn verschillen.
- PLA+ wordt niet door iedere winkel consequent als aparte materiaalvariant
  gemodelleerd.
- Floating-point-afronding kan prijsfouten veroorzaken wanneer geld niet in
  centen of een decimal-safe model wordt verwerkt.
- Cronjobs kunnen dubbel starten of falen; idempotentie en run-locks zijn nodig.
- Te agressieve polling kan rate limits of blokkades veroorzaken.
- Push- of e-mailalerts vereisen later extra toestemming, secrets en
  aflevermonitoring.
