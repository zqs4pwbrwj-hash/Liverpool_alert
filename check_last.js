const axios = require("axios");

async function getScoreboard(dateStr) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=${dateStr}`;
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

      let events;
      try {
        events = await getScoreboard(dateStr);
      } catch {
        daysBack++;
        continue;
      }

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

    if (!match) {
      console.log(
        mode === "today"
          ? "No Liverpool match today."
          : "No Liverpool match found in last 30 days."
      );
      return;
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

    if (!liverpoolLost) {
      console.log("Liverpool did NOT lose.");
      return;
    }

    console.log("Liverpool LOST — workflow will send Pushcut");

  } catch (err) {
    console.error(err);
  }
})();
