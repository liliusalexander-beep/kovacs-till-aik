/* ==========================================================================
   Stötta Kovács till AIK – app.js
   OBS: Denna sida hanterar INGA betalningar. Den skickar endast
   icke-bindande avsiktsförklaringar (pledges) till en formulärtjänst.
   ========================================================================== */

/* ==========================================================================
   >>> ÄNDRA HÄR <<<
   Klistra in ditt riktiga Formspree form-ID nedan (ersätt MITT_FORM_ID).
   Endpointen får du från formspree.io när du skapat ditt formulär.
   ========================================================================== */
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mpqvnblq';

/* ==========================================================================
   KONFIGURATION
   ========================================================================== */
const CONFIG = {
  // Välj formulärlösning: 'formspree' (rekommenderad) eller 'airtable'
  backend: 'formspree',

  formspreeEndpoint: FORMSPREE_ENDPOINT,

  // AIRTABLE (alternativ): Skapa en bas med ett formulär i Airtable,
  // klicka "Share form" och klistra in den publika formulärlänken här.
  // Besökaren skickas då till Airtables formulär i ny flik i stället.
  airtableFormUrl: 'https://airtable.com/DITT_FORMULAR_ID',

  // Mål för mätaren (kr)
  goalAmount: 1500000,

  // RÄKNARENS STARTVÄRDEN – uppdateras MANUELLT av dig.
  // Formspree kan inte läsas från frontend, så: logga in på Formspree,
  // summera inkomna belopp, skriv in totalsumman och antalet här,
  // och ladda upp sidan på nytt. Se README.md för detaljer.
  basePledgedAmount: 0,
  basePledgedCount: 0,
};

/* ==========================================================================
   Härifrån och ner behöver inget ändras
   ========================================================================== */

// Versionslogg – gör det enkelt att se i konsolen vilken skriptversion
// webbläsaren faktiskt kör (cache-felsökning). Syns aldrig för användaren.
console.info('[Kovacs-pledge] app.js v4 – FormData-läge, endpoint ifylld');

const SEK = new Intl.NumberFormat('sv-SE');

/* ==========================================================================
   RÄKNARE – VIKTIGT ATT FÖRSTÅ
   Detta är en VISUELL APPROXIMATION, inte en exakt global siffra.
   - Startvärdet är basePledgedAmount/basePledgedCount i CONFIG ovan,
     som du uppdaterar manuellt utifrån Formspree-inkorgen.
   - Besökarens egna lyckade inskick adderas optimistiskt och sparas i
     localStorage, så att samma besökare ser sitt bidrag även vid återbesök.
   - Andra besökares inskick syns INTE live – de kommer in först när du
     uppdaterar startvärdena i koden. Se README.md för motivering.
   ========================================================================== */

// Säker lagring: localStorage om det finns, annars minneslagring.
// (localStorage kan vara blockerat i sandboxade iframes och privat läge.)
const safeStorage = (() => {
  try {
    const s = window.localStorage;
    const t = '__kovacs_test__';
    s.setItem(t, '1');
    s.removeItem(t);
    return s;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
})();

const LOCAL_KEY = 'kovacs_pledge_local';

function getLocalPledge() {
  try {
    return JSON.parse(safeStorage.getItem(LOCAL_KEY)) || { amount: 0, count: 0 };
  } catch {
    return { amount: 0, count: 0 };
  }
}

function saveLocalPledge(amount) {
  const current = getLocalPledge();
  current.amount += amount;
  current.count += 1;
  safeStorage.setItem(LOCAL_KEY, JSON.stringify(current));
}

function renderCounter() {
  const local = getLocalPledge();
  const total = CONFIG.basePledgedAmount + local.amount;
  const count = CONFIG.basePledgedCount + local.count;
  const pct = Math.min(100, (total / CONFIG.goalAmount) * 100);

  document.getElementById('pledgedAmount').textContent = SEK.format(total) + ' kr';
  document.getElementById('pledgedCount').textContent = SEK.format(count);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressBar').setAttribute('aria-valuenow', String(total));
}

/* ===== Beloppsval ===== */
const amountGrid = document.getElementById('amountGrid');
const customWrap = document.getElementById('customAmountWrap');
const customInput = document.getElementById('customAmount');
const amountHidden = document.getElementById('amount');

amountGrid.addEventListener('click', (e) => {
  const pill = e.target.closest('.amount-pill');
  if (!pill) return;

  amountGrid.querySelectorAll('.amount-pill').forEach((p) => p.classList.remove('selected'));
  pill.classList.add('selected');

  if (pill.dataset.amount === 'custom') {
    customWrap.hidden = false;
    amountHidden.value = customInput.value || '';
    customInput.focus();
  } else {
    customWrap.hidden = true;
    amountHidden.value = pill.dataset.amount;
  }
  hideError('amountError');
});

customInput.addEventListener('input', () => {
  amountHidden.value = customInput.value;
});

/* ===== Validering ===== */
function showError(id) {
  document.getElementById(id).hidden = false;
}
function hideError(id) {
  document.getElementById(id).hidden = true;
}

function validate() {
  let ok = true;
  const email = document.getElementById('email');
  const consent = document.getElementById('consent');
  const amount = parseInt(amountHidden.value, 10);

  if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    showError('emailError');
    ok = false;
  } else {
    hideError('emailError');
  }

  if (!amount || amount < 1) {
    showError('amountError');
    ok = false;
  } else {
    hideError('amountError');
  }

  if (!consent.checked) {
    showError('consentError');
    ok = false;
  } else {
    hideError('consentError');
  }

  return ok;
}

/* ===== Inskick ===== */
const form = document.getElementById('pledgeForm');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('formStatus');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) return;

  const amount = parseInt(amountHidden.value, 10);

  // Airtable-läget: öppna Airtables publika formulär i ny flik
  if (CONFIG.backend === 'airtable') {
    window.open(CONFIG.airtableFormUrl, '_blank', 'noopener');
    return;
  }

  // Lås knappen och visa laddningsindikator så att dubbla inskick undviks
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Skickar…';
  statusEl.hidden = true;
  statusEl.classList.remove('error');

  // Skicka som FormData (Formsprees standard för AJAX-formulär).
  // Ingen Content-Type-header sätts manuellt – webbläsaren sätter rätt
  // multipart-gräns själv, och requesten slipper CORS-preflight.
  const formData = new FormData();
  formData.append('namn', document.getElementById('name').value || '(ej angivet)');
  formData.append('email', document.getElementById('email').value);
  formData.append('belopp_kr', String(amount));
  formData.append('samtycke_kontakt', 'ja');
  formData.append('_subject', 'Ny pledge: Stötta Kovács till AIK');
  // Honeypot följer med så Formspree kan filtrera bort spam
  const gotcha = form.querySelector('input[name="_gotcha"]');
  if (gotcha) formData.append('_gotcha', gotcha.value);

  try {
    if (CONFIG.formspreeEndpoint.includes('MITT_FORM_ID')) {
      // Endast för felsökning – syns aldrig för slutanvändaren
      console.warn(
        '[Kovacs-pledge] Formspree form-ID är inte ifyllt. ' +
          'Byt ut MITT_FORM_ID i FORMSPREE_ENDPOINT högst upp i js/app.js.'
      );
    }

    const res = await fetch(CONFIG.formspreeEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });

    // Bekräftelsevyn visas ENDAST vid lyckat svar (response.ok).
    // Alla fel (nätverk, rate limit 429, fel endpoint) ger samma
    // användarvänliga meddelande – detaljer loggas bara i konsolen.
    if (!res.ok) {
      let detail = '';
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        /* svaret var inte JSON */
      }
      console.error('[Kovacs-pledge] Formspree-fel. Status:', res.status, detail);
      throw new Error('SUBMIT_FAILED');
    }

    // Lyckat inskick
    saveLocalPledge(amount);
    renderCounter();

    document.getElementById('confirmationText').textContent =
      'Din pledge på ' +
      SEK.format(amount) +
      ' kr är registrerad. Vi hör av oss om/när AIK öppnar en officiell insamlingskanal.';

    form.hidden = true;
    document.getElementById('confirmation').hidden = false;
    document.getElementById('confirmation').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    // Nätverksfel loggas för felsökning – användaren ser aldrig tekniska detaljer
    if (err.message !== 'SUBMIT_FAILED') {
      console.error('[Kovacs-pledge] Nätverksfel vid inskick:', err);
    }
    statusEl.textContent =
      'Något gick fel, försök igen om en liten stund eller kontakta oss direkt.';
    statusEl.classList.add('error');
    statusEl.hidden = false;
  } finally {
    // Knappen återställs alltid så att användaren kan försöka igen
    submitBtn.disabled = false;
    submitBtn.textContent = 'Skicka min pledge';
  }
});

/* ===== Delning ===== */
function pageUrl() {
  return window.location.href.split('#')[0];
}

const SHARE_TEXT = 'Vi vill se Kovács i AIK-tröjan! Gör en icke-bindande pledge och visa ditt stöd:';

document.getElementById('shareFacebook').addEventListener('click', () => {
  window.open(
    'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl()),
    '_blank',
    'noopener,width=600,height=500'
  );
});

document.getElementById('shareX').addEventListener('click', () => {
  window.open(
    'https://twitter.com/intent/tweet?text=' +
      encodeURIComponent(SHARE_TEXT) +
      '&url=' +
      encodeURIComponent(pageUrl()),
    '_blank',
    'noopener,width=600,height=500'
  );
});

document.getElementById('shareCopy').addEventListener('click', async () => {
  const feedback = document.getElementById('shareFeedback');
  try {
    await navigator.clipboard.writeText(pageUrl());
    feedback.textContent = 'Länken är kopierad.';
  } catch {
    feedback.textContent = 'Kunde inte kopiera automatiskt. Adress: ' + pageUrl();
  }
  feedback.hidden = false;
  setTimeout(() => (feedback.hidden = true), 4000);
});

/* ===== Init ===== */
renderCounter();
