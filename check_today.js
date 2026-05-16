const axios = require("axios");

(async () => {
  try {
    const url = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard";
    const { data } = await axios.get(url);

    const events = data.events || [];

    const match = events.find(e =>
      e.competitions[0].competitors.some(
        c => c.team.shortDisplayName === "Liverpool"
      )
    );

    if (!match) {
      console.log("No Liverpool match today.");
      return;
    }

    const comp = match.competitions[0];

    if (!comp.status.type.completed) {
      console.log("Liverpool match today is not completed.");
      return;
    }

    const home = comp.competitors.find(c => c.homeAway === "home");
    const away = comp.competitors.find(c => c.homeAway === "away");

    const homeScore = parseInt(home.score);
    const awayScore = parseInt(away.score);

    const liverpoolHome = home.team.shortDisplayName === "Liverpool";

    const liverpoolLost =
      (liverpoolHome && homeScore < awayScore) ||
      (!liverpoolHome && awayScore < homeScore);

    const title = `${home.team.shortDisplayName} ${homeScore}-${awayScore} ${away.team.shortDisplayName}`;

    console.log("Today's Liverpool match:", title);

    if (!liverpoolLost) {
      console.log("Liverpool did NOT lose.");
      return;
    }

    console.log("Liverpool LOST — sending Pushcut");

    await axios.post(process.env.PUSHCUT_URL, {
      text: `Liverpool tapte: ${title}`
    });

  } catch (err) {
    console.error(err);
  }
})();
