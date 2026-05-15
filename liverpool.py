import os
import time
import datetime
import requests

API_KEY = os.getenv("API_KEY")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")

TEAM_ID = 40  # Liverpool
RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com"
BASE_URL = "https://api-football-v1.p.rapidapi.com/v3"


def api_get(path, params=None):
    headers = {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
    }
    r = requests.get(f"{BASE_URL}{path}", headers=headers, params=params or {})
    try:
        data = r.json()
    except Exception:
        print("Klarte ikke å parse JSON:", r.text)
        return None

    if r.status_code != 200:
        print("API-feil:", r.status_code, data)
        return None

    return data


def hent_dagens_liverpool_kamp():
    today = datetime.date.today().strftime("%Y-%m-%d")

    params = {
        "team": TEAM_ID,
        "date": today,
    }

    data = api_get("/fixtures", params=params)
    if not data or "response" not in data:
        print("Ingen 'response' i API-svar:", data)
        return None

    if not data["response"]:
        print("Ingen Liverpool-kamper i dag.")
        return None

    # Tar første kamp (hvis flere samme dag kan du utvide logikken)
    kamp = data["response"][0]
    return kamp


def liverpool_tapte(fixture):
    """
    fixture: ett element fra data["response"][0]["fixture"/"teams"/"goals"]
    """
    teams = fixture["teams"]
    goals = fixture["goals"]

    home_name = teams["home"]["name"]
    away_name = teams["away"]["name"]
    home_goals = goals["home"]
    away_goals = goals["away"]

    # Sikkerhetsnett hvis mål er None
    if home_goals is None or away_goals is None:
        return False

    if home_name == "Liverpool":
        return home_goals < away_goals
    elif away_name == "Liverpool":
        return away_goals < home_goals
    else:
        # Skulle aldri skje hvis vi filtrerer på team=40, men greit å ha
        return False


def overvåk_kamp(fixture):
    fixture_id = fixture["fixture"]["id"]
    sms_sendt = False

    print(f"Overvåker kamp med fixture_id={fixture_id}")

    while True:
        data = api_get("/fixtures", params={"id": fixture_id})
        if not data or "response" not in data or not data["response"]:
            print("Ugyldig svar når vi prøver å hente kampstatus:", data)
            time.sleep(60)
            continue

        kamp = data["response"][0]
        status = kamp["fixture"]["status"]["short"]  # f.eks. "NS", "1H", "HT", "2H", "FT"

        print("Status nå:", status)

        if status in ("FT", "AET", "PEN"):  # ferdig
            if liverpool_tapte(kamp) and not sms_sendt:
                print("Liverpool tapte. Sender webhook...")
                try:
                    r = requests.post(WEBHOOK_URL, json={"message": "Liverpool tapte 😢"})
                    print("Webhook-respons:", r.status_code, r.text)
                except Exception as e:
                    print("Feil ved sending av webhook:", e)
                sms_sendt = True
            else:
                print("Liverpool tapte ikke, ingen webhook.")
            break

        # Kamp ikke ferdig ennå – vent ett minutt
        time.sleep(60)


def main():
    if not API_KEY:
        print("Mangler API_KEY i miljøvariabler.")
        return

    if not WEBHOOK_URL:
        print("Mangler WEBHOOK_URL i miljøvariabler.")
        return

    kamp = hent_dagens_liverpool_kamp()
    if kamp:
        print("Fant kamp i dag:")
        print(
            kamp["teams"]["home"]["name"],
            "vs",
            kamp["teams"]["away"]["name"],
        )
        overvåk_kamp(kamp)
    else:
        print("Ingen kamp å overvåke i dag.")


if __name__ == "__main__":
    main()

