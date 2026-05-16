//
// Kjør uten argument  → sjekker dagens kamp
// Kjør med "yesterday" → sjekker gårsdagens kamp
//

const API_KEY = process.env.FOOTBALL_DATA_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const BASE_URL = 'https://api.football-data.org/v4';
const LIVERPOOL_ID = 64; // Liverpool FC
const SOFASCORE_TEAM_ID = 44; // Liverpool ID hos SofaScore

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
// SOFASCORE FALLBACK — hele sesongen
//
async function fetchSofaScoreSeason() {
  const url = `https://api.sofascore.com/api/v1/team/${SOFASCORE_TEAM_ID}/events/season`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.error('SofaScore svarte ikke OK:', res.status);
      return [];
    }

    const data = await res.json();
    return data.events || [];

  } catch (err) {
    console.error('Feil ved henting fra SofaScore:', err);
    return [];
  }
}

//
// MATCH BESKRIVELSE
//
async function describeMatch(match, source) {
  const home = match.homeTeam?.name || match.homeTeam?.shortName;
  const away = match.awayTeam?.name || match.awayTeam?.shortName;

  let homeScore, awayScore;

  if (source === 'football-data') {
    homeScore = match.score.fullTime.home;
    awayScore = match.score.fullTime.away;
  } else {
    homeScore = match.homeScore?.current;
    awayScore = match.awayScore?.current;
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

//
// MAIN
//
(async () => {
  try {
    const { from } = getDateRange();
    console.log(`Sjekker kamper for dato: ${from}`);

    //
    // 1) Football-Data først
    //
    let matches = await fetchFootballDataMatches(from, from);
    let source = 'football-data';

    const foundFD = matches.some(
      m => m.homeTeam?.id === LIVERPOOL_ID || m.awayTeam?.id === LIVERPOOL_ID
    );

    //
    // 2) SofaScore season fallback
    //
    if (!foundFD) {
      console.log('Ingen Liverpool-kamp i Football-Data, prøver SofaScore season...');

      const sofaMatches = await fetchSofaScoreSeason();

      const filtered = sofaMatches.filter(m => {
        const date = m.startTimestamp
          ? new Date(m.startTimestamp * 1000).toISOString().slice(0, 10)
          : null;

        const home = m.homeTeam?.name;
        const away = m.awayTeam?.name;

        return date === from && (home === 'Liverpool' || away === 'Liverpool');
      });

      if (filtered.length > 0) {
        matches = filtered;
        source = 'sofascore';
      }
    }

    //
    // 3) Ingen kamp funnet
    //
    if (matches.length === 0) {
      console.log('Liverpool spilte ikke på denne datoen.');
      return;
    }

    //
    // 4) Beskriv kamp(er)
    //
    for (const match of matches) {
      await describeMatch(match, source);
    }

  } catch (err) {
    console.error('Uventet feil:', err);
    process.exit(1);
  }
})();
