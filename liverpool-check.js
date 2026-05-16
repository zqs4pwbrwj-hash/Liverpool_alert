//
// Kjør uten argument  → sjekker dagens kamp (normal drift)
// Kjør med "yesterday" → sjekker gårsdagens kamp (test av webhook)
//

const API_KEY = process.env.FOOTBALL_DATA_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const BASE_URL = 'https://api.football-data.org/v4';
const LIVERPOOL_ID = 64; // Liverpool FC

if (!API_KEY) {
  console.error('Mangler FOOTBALL_DATA_KEY i Secrets.');
  process.exit(1);
}

function getDateRange() {
  const arg = process.argv[2];

  const now = new Date();
  const osloNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));

  if (arg === 'yesterday') {
    osloNow.setDate(osloNow.getDate() - 1);
  }

  const date = osloNow.toISOString().slice(0, 10);
  return { from: date, to: date };
}

async function sendWebhookMessage(text) {
  if (!WEBHOOK_URL) {
    console.error('Mangler WEBHOOK_URL i Secrets.');
    return;
  }

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text })
  });
}

async function fetchMatches(from, to) {
  const url = `${BASE_URL}/matches?dateFrom=${from}&dateTo=${to}`;

  const res = await fetch(url, {
    headers: {
      'X-Auth-Token': API_KEY
    }
  });

  if (!res.ok) {
    console.error('Feil fra Football-Data:', res.status, res.statusText);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  return data.matches || [];
}

async function describeMatch(match) {
  const home = match.homeTeam.name;
  const away = match.awayTeam.name;
  const status = match.status;
  const score = match.score;

  let message = `${home} vs ${away} — Status: ${status}`;

  if (status === 'FINISHED') {
    const result = `${home} ${score.fullTime.home} – ${score.fullTime.away} ${away}`;
    message = `Sluttresultat: ${result}`;

    const liverpoolLost =
      (home === 'Liverpool FC' && score.fullTime.home < score.fullTime.away) ||
      (away === 'Liverpool FC' && score.fullTime.away < score.fullTime.home);

    if (liverpoolLost) {
      await sendWebhookMessage(`Liverpool tapte: ${result}`);
    }
  }

  console.log(message);
}

(async () => {
  try {
    const { from, to } = getDateRange();
    console.log(`Sjekker kamper for dato: ${from}`);

    const matches = await fetchMatches(from, to);

    const liverpoolMatches = matches.filter(
      m => m.homeTeam.id === LIVERPOOL_ID || m.awayTeam.id === LIVERPOOL_ID
    );

    if (!liverpoolMatches.length) {
      console.log('Liverpool spilte ikke på denne datoen.');
      return;
    }

    console.log(`Fant ${liverpoolMatches.length} kamp(er) med Liverpool:\n`);

    for (const match of liverpoolMatches) {
      await describeMatch(match);
    }

  } catch (err) {
    console.error('Uventet feil:', err);
    process.exit(1);
  }
})();
