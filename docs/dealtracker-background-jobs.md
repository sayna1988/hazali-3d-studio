# Dealtracker Achtergrondtaken

## Keuze

Hazali gebruikt al Vercel API-routes in `api/` en Supabase service-role writes
voor server-side processen. Daarom draait de dealtracker als beveiligde Vercel
serverfunctie:

- endpoint: `api/dealtracker-run.ts`
- schedule: `vercel.json`, iedere zes uur met `0 */6 * * *`
- database: Supabase via service-role key, uitsluitend server-side

Er wordt niets vanuit de React-browserapp gescrapet.

## Environment Variables

Vereist:

- `SUPABASE_URL` of `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEALTRACKER_RUN_SECRET` of `CRON_SECRET`
- `HAZALI_APP_URL`

Optioneel voor e-mailalerts:

- `DEALTRACKER_EMAIL_MODE`: `log`, `off` of `resend`. Standaard is `log`.
- `DEALTRACKER_TEST_EMAIL_TO`: overschrijft ontvanger tijdens testen.
- `RESEND_API_KEY`: alleen nodig bij `DEALTRACKER_EMAIL_MODE=resend`.
- `DEALTRACKER_EMAIL_FROM`: afzender bij Resend.

Retailerconfiguratie staat in `deal_retailers.config` zonder secrets. Voor
Joybuy wordt `config.feedUrl` verwacht wanneer de echte Awin-feed gebruikt
wordt.

## Handmatig Uitvoeren

Dry-run voor alle actieve retailers:

```bash
npm run dealtracker:run -- --dry-run
```

Een retailer uitvoeren:

```bash
npm run dealtracker:run -- --retailer=joybuy-nl
```

Alleen valideren, zonder writes:

```bash
npm run dealtracker:run -- --validate-only --retailer=joybuy-nl
```

Maximaal aantal producten:

```bash
npm run dealtracker:run -- --max-products=10 --dry-run
```

Maximale runtime:

```bash
npm run dealtracker:run -- --max-runtime-ms=240000
```

## API Endpoint

Vercel Cron roept aan:

```text
GET /api/dealtracker-run
```

Handmatig kan ook:

```bash
curl -H "Authorization: Bearer $DEALTRACKER_RUN_SECRET" \
  "https://<deployment>/api/dealtracker-run?dryRun=true&retailer=joybuy-nl"
```

Het endpoint accepteert `dryRun`, `validateOnly`, `retailer`, `maxProducts` en
`maxRuntimeMs` via querystring of JSON body.

## Gedrag

- Per uitvoering wordt een unieke `deal_scrape_runs` rij gemaakt.
- Een lock in `deal_scrape_locks` voorkomt twee gelijktijdige runs.
- Per retailer wordt een rij in `deal_scrape_run_retailers` opgeslagen.
- Productfouten komen in `deal_scrape_run_errors`.
- Een falende retailer stopt andere retailers niet.
- Maximaal drie gelijktijdige verzoeken per retailer.
- Timeout, retries en rate limit komen uit retailerconfiguratie.
- Dry-run en validate-only schrijven geen producten, offers of observaties.
- Oude varianten worden inactief gemarkeerd wanneer ze in een succesvolle
  write-run ontbreken.
