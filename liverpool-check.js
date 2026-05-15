const API_KEY = process.env.API_SPORTS_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const LIVERPOOL_TEAM_ID = 40; // Liverpool i API-Sports

if (!API_KEY) {
  console.error('Mangler API_SPORTS_KEY i GitHub Secrets.');
  process.exit(1);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC, men godt nok)
}

async function fetchLiverpoolFixtures() {
  const date = todayISO();
  const url = `${BASE_URL}/fixtures?team=${LIVERPOOL_TEAM_ID}&date=${date}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-apisports-key': API_KEY,
      'accept': 'application/json'
    }
  });

  if (!res.ok) {
    console.error('Feil fra API-Sports:', res.status, res.statusText);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  return data.response || [];
}

function describeFixture(fix) {
  const league = fix.league?.name;
  const round = fix.league?.round;
  const home = fix.teams?.home?.name;
  const away = fix.teams?.away?.name;
  const status = fix.fixture?.status?.short; // NS, 1H, HT, 2H, FT, AET, PEN, etc.
  const date = fix.fixture?.date;
  const goalsHome = fix.goals?.home;
  const goalsAway = fix.goals?.away;

  console.log('-----------------------------');
  console.log(`${league} – ${round}`);
  console.log(`${home} vs ${away}`);
  console.log(`Tidspunkt: ${date}`);
  console.log(`Status: ${status}`);

  if (['FT', 'AET', 'PEN'].includes(status)) {
    console.log(`Sluttresultat: ${home} ${goalsHome} – ${goalsAway} ${away}`);
  } else if (['1H', '2H', 'HT'].includes(status)) {
    console.log(`Live stilling: ${home} ${goalsHome} – ${goalsAway} ${away}`);
  } else if (status === 'NS') {
    console.log('Kampen har ikke startet ennå.');
  } else {
    console.log('Status ukjent/annen.');
  }
}

(async () => {
  try {
    const fixtures = await fetchLiverpoolFixtures();

    if (!fixtures.length) {
      console.log('Liverpool spiller ikke i dag.');
      return;
    }

    console.log(`Fant ${fixtures.length} kamp(er) med Liverpool i dag:\n`);

    fixtures.forEach(describeFixture);
  } catch (err) {
    console.error('Uventet feil:', err);
    process.exit(1);
  }
})();
