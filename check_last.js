const axios = require("axios");

// ⭐ Ligaer vi skal sjekke
const leagues = [
  "eng.1",            // Premier League
  "uefa.champions",   // Champions League
  "eng.fa",           // FA Cup
  "eng.league_cup"    // EFL Cup (Carabao Cup)
];

async function getScoreboard(dateStr, league) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${dateStr}`;
  const response = await axios.get(url);
  return response.data.events || [];
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// ⭐ MODE: "today" (cron) eller "history" (manuell)
const mode = process.argv[2] || "today";

(async () => {
  try {
    let daysBack = 0;
    let match = null;

    while (!match && daysBack < 30) {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);

      const dateStr = formatDate(d);
      console.log("Checking date:", dateStr);

      let events = [];

      // ⭐ Hent kamper fra ALLE ligaene
      for (const league of leagues) {
        try {
          const e = await getScoreboard(dateStr, league);
          events = events.concat(e);
        } catch {
          // hopper over feilende liga
        }
      }

      // ⭐ Finn Liverpool-kamp som er ferdig
      match = events.find(e => {
        const comp = e.competitions[0];
        const completed = comp.status.type.completed === true;

        const hasLiverpool = comp.competitors.some(
          c => c.team.shortDisplayName === "Liverpool"
        );

        return completed && hasLiverpool;
      });

      // ⭐ Cron-modus: sjekk kun dagens dato
      if (mode === "today") break;

      daysBack++;
    }

    // ⭐ Ingen kamp funnet
    if (!match) {
      if (mode === "today") {
        console.log("No Liverpool match today.");
      } else {
        console.log("No Liverpool match found in last 30 days.");
      }
      process.exit(0); // workflow forblir grønn
    }

    const comp = match.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === "home");
    const away = comp.competitors.find(c => c.homeAway === "away");

    const homeScore = parseInt(home.score);
    const awayScore = parseInt(away.score);

    const liverpoolHome = home.team.shortDisplayName === "Liverpool";

    const liverpoolLost =
      (liverpoolHome && homeScore < awayScore) ||
      (!liverpoolHome && awayScore < homeScore);

    const title = `${home.team.shortDisplayName} ${homeScore}-${awayScore} ${away.team.shortDisplayName}`;

    console.log("Last Liverpool match:", title);

    // ⭐ Liverpool tapte ikke
    if (!liverpoolLost) {
      console.log("Liverpool did NOT lose.");
      process.exit(0); // workflow grønn
    }

    // ⭐ Liverpool tapte — workflow skal sende push
    console.log("Liverpool LOST — workflow will send Pushcut");
    console.log("PUSHCUT_TRIGGER"); // ← workflow ser etter denne
    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(0); // workflow grønn selv ved feil
  }
})();
