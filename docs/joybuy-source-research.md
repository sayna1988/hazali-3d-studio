# Joybuy Brononderzoek

Onderzocht op 2026-06-30 voor `www.joybuy.nl`.

## Voorkeursvolgorde

1. Officiele API: geen publieke, gedocumenteerde Joybuy product-API gevonden
   voor prijzen, voorraad en varianten.
2. Officiele productfeed: geen publiek downloadbare Joybuy-productfeed gevonden.
3. Officiele affiliate-feed: Joybuy BNL heeft een Awin publisherprogramma
   (`merchant-profile/123930`). Awin documenteert productfeeds via Create-a-Feed,
   Product Feed List Download en Publisher Product API voor publishers met
   toegang.
4. Publieke HTML-productpagina's: niet gekozen. Directe productpagina's zijn
   publiek vindbaar, maar Joybuy toont reCAPTCHA-bescherming op de site en een
   directe productpage-open gaf een 403/onderbrekingspagina. Robots.txt blokkeert
   login/cart/checkout en bepaalde `/dp`-patronen, en zoek/filter-URL's met
   diverse queryvormen. Daarom is HTML-scraping onderhoudsgevoelig en niet de
   veilige primaire bron.

## Gekozen Bron

Gekozen: officiele affiliate-feed via Awin/Google Shopping-feedvorm.

Redenen:

- Past bij de gewenste bronvolgorde.
- Geen captcha, loginpagina, browserfingerprinting of private API nodig in de
  Hazali-adapter zelf.
- Feedkolommen zijn stabieler dan Joybuy HTML.
- Awin documenteert CSV/feed-downloads en productfeedtoegang voor publishers.

## Beperkingen

- Productfeedtoegang vereist waarschijnlijk een Awin publisheraccount,
  goedkeuring voor Joybuy BNL en een geconfigureerde feed-URL.
- Feedinhoud en kolomnamen kunnen per Awin/Google-feedvariant verschillen.
- Verzendkosten zijn alleen betrouwbaar wanneer de feed een expliciete
  shipping/delivery-kolom bevat. Ontbrekende verzendkosten worden als onbekend
  gemarkeerd en niet als gratis verzending.
- Levering naar Nederland wordt aangenomen voor de Joybuy BNL/NL feed en
  `www.joybuy.nl` links; productniveau-uitzonderingen blijven mogelijk.

## Onderhoudsgevoeligheid

Laag tot middel bij affiliate-feedgebruik: kolomnamen en feedformaten kunnen
wijzigen, maar dit is aanzienlijk stabieler dan HTML. HTML-productpagina's zijn
hoog risico door reCAPTCHA/403-signalen en dynamische markup.
