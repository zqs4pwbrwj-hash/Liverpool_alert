//
// Kjør uten argument  → sjekker dagens kamp
// Kjør med "yesterday" → sjekker gårsdagens kamp
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

async function fetchFotMobMatches(date) {
  const fotmobDate = date.replace(/-/g, ''); // 2026-05-15 → 20260515
  const url = `https://www.fotmob.com/api/matches?date=${fotmobDate}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();

    // Finn Premier League-kamper
    const allMatches = data.leagues.flatMap(l => l.matches);

    // Filtrer Liverpool
    return allMatches.filter(
      m =>
        m.home?.name === 'Liverpool' ||
        m.away?.name === 'Liverpool'
    );
  } catch (err) {
    console.error('Feil ved henting fra FotMob:', err);
    return [];
  }
}

async function describeMatch(match, source) {
  const home = match.homeTeam?.name || match.home?.name;
  const away = match.awayTeam?.name || match.away?.name;

  let homeScore, awayScore, status;

  if (source === 'football-data') {
    homeScore = match.score.fullTime.home;
    awayScore = match.score.fullTime.away;
    status = match.status;
  } else {
    homeScore = match.home.score;
    awayScore = match.away.score;
    status = match.status?.toUpperCase() || 'FINISHED';
  }

  const result = `${home} ${homeScore} – ${awayScore} ${away}`;

  const liverpoolLost =
    (home === 'Liverpool' && homeScore < awayScore) ||
    (away === 'Liverpool' && awayScore < homeScore);

  if (liverpoolLost) {
    await sendWebhookMessage(`Liverpool tapte: ${result}`);
  }

  console.log(`${result} (${source})`);
}

(async () => {
  try {
    const { from } = getDateRange();
    console.log(`Sjekker kamper for dato: ${from}`);

    // 1) Prøv Football-Data først
    let matches = await fetchFootballDataMatches(from, from);
    let source = 'football-data';

    // 2) Hvis ingen kamp → prøv FotMob
    if (!matches.some(m => m.homeTeam.id === LIVERPOOL_ID || m.awayTeam.id === LIVERPOOL_ID)) {
      console.log('Ingen Liverpool-kamp i Football-Data, prøver FotMob...');
      const fotmobMatches = await fetchFotMobMatches(from);

      if (fotmobMatches.length > 0) {
        matches = fotmobMatches;
        source = 'fotmob';
      }
    }

    if (matches.length === 0) {
      console.log('Liverpool spilte ikke på denne datoen.');
      return;
    }

    for (const match of matches) {
      await describeMatch(match, source);
    }

  } catch (err) {
    console.error('Uventet feil:', err);
    process.exit(1);
  }
})();

