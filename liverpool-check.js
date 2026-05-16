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
        'Referer': 'https://www.fotmob.com/',
        'Cookie': 'fm_cookie=1'
      }
    });

    if (!res.ok) {
      console.error('FotMob svarte ikke OK:', res.status);
      return [];
    }

    const data = await res.json();

    const rounds = data?.matches?.allMatches || [];
    const matches = [];

    for (const round of rounds) {
      if (round.matches) {
        matches.push(...round.matches);
      }
    }

    return matches;

  } catch (err) {
    console.error('Feil ved henting fra FotMob:', err);
    return [];
  }
}


//
// MATCH BESKRIVELSE
//
async function describeMatch(match, source) {
  const home = match.homeTeam?.name || match.home?.name;
  const away = match.awayTeam?.name || match.away?.name;

  let homeScore, awayScore;

  if (source === 'football-data') {
    homeScore = match.score.fullTime.home;
    awayScore = match.score.fullTime.away;
  } else {
    homeScore = match.home.score;
    awayScore = match.away.score;
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
    // 2) Hvis ingen kamp → FotMob Premier League fallback
    //
    if (!foundFD) {
      console.log('Ingen Liverpool-kamp i Football-Data, prøver FotMob PL-feed...');

      const fotmobMatches = await fetchFotMobPL();

      const filtered = fotmobMatches.filter(m => {
        const date = m.status?.utcTime?.slice(0, 10);
        const home = m.home?.name;
        const away = m.away?.name;
        return date === from && (home === 'Liverpool' || away === 'Liverpool');
      });

      if (filtered.length > 0) {
        matches = filtered;
        source = 'fotmob';
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
