const Parser = require("rss-parser");
const axios = require("axios");

const parser = new Parser();
const FEED = "https://www.thisisanfield.com/feed/";

(async () => {
  try {
    const feed = await parser.parseURL(FEED);
    const latest = feed.items[0];

    const title = latest.title;
    console.log("Latest title:", title);

    // Finn resultat i tittelen
    const match = title.match(/(\d+)\s*-\s*(\d+)/);
    if (!match) {
      console.log("No score found.");
      return;
    }

    const home = parseInt(match[1]);
    const away = parseInt(match[2]);

    const liverpoolHome = title.toLowerCase().startsWith("liverpool");

    const liverpoolLost =
      (liverpoolHome && home < away) ||
      (!liverpoolHome && away < home);

    if (!liverpoolLost) {
      console.log("Liverpool did not lose.");
      return;
    }

    console.log("Liverpool LOST — sending Pushcut notification");

    await axios.post(process.env.PUSHCUT_URL, {
      text: `Liverpool tapte: ${title}`
    });

  } catch (err) {
    console.error(err);
  }
})();
