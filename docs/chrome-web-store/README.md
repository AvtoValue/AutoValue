# Objava razširitve v Chrome Web Store

Vse, kar potrebuješ za oddajo razširitve AutoValue. Besedila spodaj samo kopiraš v obrazce.

## Kaj potrebuješ

- Google račun (priporočeno: ločen račun za AutoValue, ker bo njegov e-naslov viden v trgovini).
- Enkratna registracija razvijalca: **5 USD** s plačilno kartico.
- Paket razširitve: `autovalue-extension.zip` s strani AutoValue
  (https://avtovalue.github.io/AutoValue/autovalue-extension.zip). Zip ne razširjaj.
- Slike v tej mapi:
  - `screenshot-1-search.png`, `screenshot-2-ad-added.png`, `screenshot-3-result.png`,
    `screenshot-4-privacy.png` (1280 × 800)
  - `promo-small-440x280.png` (mala promocijska ploščica)
  - ikona 128 × 128 je že v paketu (`extension/icons/icon-128.png`)

## Koraki

1. Odpri https://chrome.google.com/webstore/devconsole in se prijavi.
2. Sprejmi pogodbo za razvijalce in plačaj registracijo (5 USD).
3. V zavihku **Account** izpolni ime razvijalca (npr. »AutoValue«) in potrdi e-naslov.
4. Klikni **New item** in naloži `autovalue-extension.zip`.
5. Zavihek **Store listing**: vnesi besedila iz razdelka *Opis v trgovini* in naloži slike.
   - Kategorija: **Shopping** (ali *Tools*).
   - Jezik: **slovenščina**; angleški prevod dodaš z *Add localized listing* (opcijsko).
6. Zavihek **Privacy**: izpolni po razdelku *Zasebnost* spodaj.
7. Zavihek **Distribution**: *Public*; države lahko pustiš *All regions*.
8. Klikni **Submit for review**. Pregled običajno traja od nekaj dni do nekaj tednov;
   Google te o rezultatu obvesti po e-pošti.

## Opis v trgovini

**Ime:** trgovina ga vzame iz paketa in ga prikaže v jeziku uporabnika (»AutoValue – pošlji oglas«,
»AutoValue – send ad«, …). V obrazcu ga ne vnašaš.

**Kratek opis (do 132 znakov):**
> Z enim klikom dodaj avto oglas, ki ga gledaš, v AutoValue in primerjaj ceno s podobnimi oglasi.

**Podroben opis:**
> AutoValue ti pomaga ugotoviti, ali je cena rabljenega avta smiselna, preden ga kupiš ali prodaš.
>
> Kako deluje:
> • Odpri oglas za avto na kateremkoli oglasniku.
> • Klikni ikono AutoValue.
> • Oglas se doda v tvojo primerjavo: AutoValue prebere ceno, letnik, kilometre, moč, gorivo in menjalnik.
> • Dodaj več podobnih oglasov in AutoValue izračuna mediano, priporočen nakupni razpon ali oceni tvojo prodajno ceno. Cene lahko prilagodi letniku in kilometrom tvojega avta.
>
> Zasebnost:
> • Razširitev prebere stran samo, ko klikneš njeno ikono.
> • Vsebina se prenese v AutoValue v tvojem brskalniku; ničesar ne pošiljamo na svoje strežnike.
> • Brez računov, piškotkov, analitike in oglasov.
>
> AutoValue je brezplačen. Rezultati so ocene na podlagi oglaševanih cen, ne strokovna cenitev.
> Deluje v slovenščini, angleščini, nemščini, italijanščini in hrvaščini.

**English short description:**
> Add the car ad you are viewing to AutoValue with one click and compare its price with similar ads.

**English detailed description:**
> AutoValue helps you check whether a used car's price makes sense before you buy or sell.
>
> How it works:
> • Open a car ad on any marketplace.
> • Click the AutoValue icon.
> • The ad is added to your comparison: AutoValue reads price, year, mileage, power, fuel and transmission.
> • Add more similar ads and AutoValue calculates the median, a suggested buying range or a verdict on your asking price. Prices can be adjusted to your car's year and mileage.
>
> Privacy:
> • The extension reads a page only when you click its icon.
> • The content is passed to AutoValue inside your browser; nothing is sent to our servers.
> • No accounts, cookies, analytics or ads.
>
> AutoValue is free. Results are estimates based on asking prices, not a professional appraisal.
> Available in English, Slovenian, German, Italian and Croatian.

## Zasebnost (zavihek Privacy)

**Single purpose (namen razširitve):**
> Send the car ad the user is viewing to the AutoValue price-comparison page with one click.

**Utemeljitev dovoljenj:**

| Dovoljenje | Utemeljitev (kopiraj) |
| --- | --- |
| `activeTab` | Reads the ad page the user is viewing, only after the user clicks the extension icon. |
| `scripting` | Runs a one-time script in that tab to read the page text and address after the click. |
| `storage` | Saves one setting: the address of the AutoValue page the ad is sent to. |

**Host permissions:** razširitev jih nima.

**Remote code:** *No, I am not using remote code.*

**Data usage (katere podatke razširitev obravnava):**
- Označi **Website content** (besedilo oglasa, ki ga uporabnik pošlje v AutoValue).
- Ničesar drugega ne označi.
- Potrdi vse tri izjave:
  - podatkov ne prodajamo tretjim osebam;
  - podatkov ne uporabljamo ali prenašamo za namene, ki niso povezani z osnovnim namenom;
  - podatkov ne uporabljamo za ugotavljanje kreditne sposobnosti ali posojila.

**Privacy policy URL:**
> https://avtovalue.github.io/AutoValue/privacy.html

## Pred oddajo preveri

- Na strani https://avtovalue.github.io/AutoValue/privacy.html se odpre politika zasebnosti.
- V razdelku *Kontakt* na tej strani je zdaj povezava na GitHub Issues. Če želiš, da je tam
  e-naslov ali ime podjetja (za GDPR je priporočljivo, da je upravljavec jasno naveden), povej in
  ga dodam.
- Če kasneje spremeniš razširitev, v `extension/manifest.json` povečaj `version` (npr. 1.0.1) in
  naloži nov zip v isti element v konzoli.
