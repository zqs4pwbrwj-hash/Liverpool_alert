const API_KEY = process.env.FOOTBALL_DATA_KEY;
const BASE_URL = 'https://api.football-data.org/v4';
const LIVERPOOL_ID = 64; // Liverpool i Football-Data.org

if (!API_KEY) {
  console.error('Mangler FOOTBALL_DATA_KEY i GitHub Secrets.');
  process.exit(1);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchMatches() {
  const date = todayISO();
  const url = `${BASE_URL}/matches?dateFrom=${date}&dateTo=${date}`;

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

function describeMatch(match) {
  const home = match.homeTeam.name;
  const away = match.awayTeam.name;
  const status = match.status; // SCHEDULED, IN_PLAY, FINISHED
  const utcDate = match.utcDate;
  const score = match.score;

  console.log('-----------------------------');
  console.log(`${home} vs ${away}`);
  console.log(`Tidspunkt: ${utcDate}`);
  console.log(`Status: ${status}`);

  if (status === 'FINISHED') {
    console.log(`Sluttresultat: ${home} ${score.fullTime.home} – ${score.fullTime.away} ${away}`);
  } else if (status === 'IN_PLAY') {
    console.log(`Live stilling: ${home} ${score.fullTime.home} – ${score.fullTime.away} ${away}`);
  } else {
    console.log('Kampen har ikke startet ennå.');
  }
}

(async () => {
  try {
    const matches = await fetchMatches();

    const liverpoolMatches = matches.filter(
      m => m.homeTeam.id === LIVERPOOL_ID || m.awayTeam.id === LIVERPOOL_ID
    );

    if (!liverpoolMatches.length) {
      console.log('Liverpool spiller ikke i dag.');
      return;
    }

    console.log(`Fant ${liverpoolMatches.length} kamp(er) med Liverpool i dag:\n`);

    liverpoolMatches.forEach(describeMatch);
  } catch (err) {
    console.error('Uventet feil:', err);
    process.exit(1);
  }
})();
