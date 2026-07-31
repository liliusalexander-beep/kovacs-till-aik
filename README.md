# Stötta Kovács till AIK – landningssida

Enkelsidig, mobilanpassad landningssida som samlar in icke-bindande pledges.
**Sidan hanterar inga betalningar och innehåller ingen betalningsintegration.**

## Filer

| Fil | Beskrivning |
| --- | --- |
| `index.html` | Hela sidan (hero, mätare, formulär, faktaruta, delning, footer) |
| `css/styles.css` | All styling, svart/gult/vitt |
| `js/app.js` | Formulärlogik, räknare, delningsknappar. **All konfiguration ligger överst i denna fil.** |
| `assets/og-image.png` | Delningsbild 1200x630 px för Facebook/X |

## Kom igång – 3 steg

### 1. Koppla in Formspree (primär lösning)

1. Skapa gratis konto på [formspree.io](https://formspree.io)
2. Klicka **New form**, döp det till t.ex. "Kovacs pledge"
3. Kopiera din endpoint, den ser ut så här: `https://formspree.io/f/abcdwxyz`
4. Öppna `js/app.js` och byt ut `MITT_FORM_ID` på **första konstanten högst upp i filen**:

```js
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/MITT_FORM_ID';
```

Klart. Formuläret POST:ar som JSON med fetch enligt Formsprees AJAX-standard. Varje inskick landar i din Formspree-inkorg och skickas till din e-post. Fälten som skickas: `namn`, `epost`, `belopp_kr`, `samtycke_kontakt`.

**Beteende:**

- Bekräftelsevyn ("Tack! Din pledge på X kr är registrerad…") visas **endast** vid lyckat svar från Formspree
- Vid fel (nätverk, rate limit, fel endpoint) visas: "Något gick fel, försök igen om en liten stund eller kontakta oss direkt." och användaren kan försöka igen direkt. Tekniska detaljer loggas bara i webbläsarkonsolen, aldrig till besökaren
- Skicka-knappen låses och visar en snurrande laddningsindikator under pågående request, så dubbla inskick undviks
- Klientvalidering (e-post, belopp, samtycke) körs innan något skickas
- Så länge `MITT_FORM_ID` står kvar kommer inskick att misslyckas med det vänliga felmeddelandet, och en varning loggas i konsolen

### 2. Uppdatera domänen i meta-taggarna

I `index.html`, byt ut `https://DIN-DOMAN.se/` på tre ställen (`og:url`, `og:image`, `twitter:image`) mot sidans riktiga adress när den är publicerad.

**Om og:image:** Facebook och X kräver en **absolut URL** (https://...) till bilden. Rekommenderad storlek är **1200x630 px** (PNG eller JPG, under 1 MB). En färdig bild ligger i `assets/og-image.png`. Vill du byta bild, behåll samma mått. Testa delningen med [Facebooks Sharing Debugger](https://developers.facebook.com/tools/debug/).

### 3. Publicera

Sidan är helt statisk. Ladda upp mappen till valfri statisk host (Netlify, Vercel, GitHub Pages, Cloudflare Pages). Ingen build behövs.

## Räknaren – vald lösning och motivering

**Valt alternativ: lokal räknare med hårdkodat startvärde (alternativ 2).**

Alternativ 1 (Formspree-webhook till extern räknartjänst) undersöktes och förkastades av två skäl:

1. **Webhooks kräver betald Formspree-nivå.** Webhooks/plugins ingår inte i free-tier utan först från Professional-nivån, så lösningen är inte gratis och kräver extra konfiguration i dashboarden
2. **countapi.xyz är nedlagt.** Tjänsten försvann utan förvarning. De ersättare som finns (t.ex. abacus.jasoncameron.dev, countapi.mileshilliard.com) är hobbyprojekt utan driftgarantier, och en död räknartjänst mitt i kampanjen skulle få mätaren att se trasig ut precis när trafiken är som störst

Därför fungerar räknaren så här (allt dokumenterat i kommentarer i `js/app.js`):

- Startvärdena `basePledgedAmount` och `basePledgedCount` i CONFIG uppdaterar du manuellt: logga in på Formspree, summera beloppen, skriv in talen och ladda upp `app.js` på nytt (1–2 gånger per dag räcker)
- Besökarens **egna lyckade** inskick adderas optimistiskt på mätaren och sparas i localStorage, så samma besökare ser sitt bidrag även vid återbesök (med automatisk fallback till minneslagring där localStorage är blockerat, t.ex. privat läge)
- **Detta är en visuell approximation, inte en exakt global siffra** – andra besökares inskick syns först när du uppdaterat startvärdena

**Airtable-alternativet:** Om du hellre vill slippa manuell summering kan du byta till Airtable (se nedan). Där kan du summera med en gruppering eller formel direkt i Airtable-gränssnittet, men att hämta värdet live till sidan kräver fortfarande en exponerad token eller en liten proxy, så även där rekommenderas manuell uppdatering av talen i `app.js`.

## Formspree: gränser och kostnad

| Nivå | Pris | Inskick/månad |
| --- | --- | --- |
| Free | 0 kr | 50 |
| Personal | ca 10 USD/mån (ca 100 kr) | 200 |
| Professional | ca 20 USD/mån | 2 000 |

- **Vad händer vid 50 inskick?** Nya inskick tas inte emot förrän månaden nollställs eller du uppgraderar. Sidan visar då ett felmeddelande till besökaren (koden hanterar detta). Formspree mejlar dig vid 50 %, 75 % och 90 % av gränsen, och inskick som kommer in över gränsen arkiveras och blir tillgängliga om du uppgraderar.
- **Bedömning:** Om kampanjen får spridning i AIK-kretsar lär 50 inskick ta slut på timmar snarare än veckor. Räkna med att behöva Personal (200/mån) eller Professional (2 000/mån). Kontrollera aktuella priser på [formspree.io/plans](https://formspree.io/plans).

## Byta till Airtable (alternativ lösning)

1. Skapa en bas i [Airtable](https://airtable.com) med fälten: Namn, E-post, Belopp, Samtycke
2. Skapa ett **Form**-vy på tabellen och klicka **Share form**, kopiera länken
3. I `js/app.js`, ändra:

```js
backend: 'airtable',
airtableFormUrl: 'https://airtable.com/DIN_FORMULARLANK',
```

Knappen "Skicka min pledge" öppnar då Airtables formulär i ny flik. Ingen API-nyckel behövs och all data hamnar direkt i din tabell där du enkelt summerar med en gruppering eller formel. Nackdelen är att besökaren lämnar sidan för själva inskicket, därför är Formspree standardvalet.

## Juridiskt/innehåll

- Ansvarsfriskrivningen visas både i hero-sektionen (synlig utan scroll) och ordagrant i footern
- GDPR-text visas vid formuläret
- Ingen AIK-logotyp eller officiellt emblem används, endast färgskalan svart/gult/vitt
