//
// Kjør uten argument  → sjekker dagens kamp
// Kjør med "yesterday" → sjekker gårsdagens kamp
//

const API_KEY = process.env.FOOTBALL_DATA_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const BASE_URL = 'https://api.football-data.org/v4';
const LIVERPOOL_ID = 64; // Liverpool FC
const PREMIER_LEAGUE_ID = 47; // FotMob PL ID

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

//
// FOOTBALL-DATA
//
async function fetchFootballDataMatches(from, to) {
  const url = `${BASE_URL}/matches?dateFrom=${from}&dateTo=${to}`;

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY }
  });

  if (!res.ok) {
    console.error('Feil fra Football-Data:', res.status, res.statusText);
    return [];
  }

  const data = await res.json();
  return data.matches || [];
}

//
// FOTMOB FALLBACK — Premier League feed
//
async function fetchFotMobPL() {
  const url = `https://www.fotmob.com/api/leagues?id=${PREMIER_LEAGUE_ID}&tab=matches`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
        'Referer': 'https://www.fotmob.com/'
      }
    });

    if (!res.ok) {
      console.error('FotMob svarte ikke
