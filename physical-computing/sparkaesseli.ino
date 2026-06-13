#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_NeoPixel.h>
#include <ESP32Servo.h>

// =====================================================
// API / SERVER
// =====================================================

String geraeteId = "SPAR001";

String einwurfUrl = "https://IM4-VARM.villelindskog.ch/api/einwurf.php";
String sparzielUrl = "https://IM4-VARM.villelindskog.ch/api/sparziel.php?geraete_id=SPAR001";

// =====================================================
// LICHTSENSOREN FUER MUENZEN
// =====================================================

#define SENSOR_1_PIN 2
#define SENSOR_2_PIN 8
#define SENSOR_5_PIN 20

bool letzterZustand1 = HIGH;
bool letzterZustand2 = HIGH;
bool letzterZustand5 = HIGH;

unsigned long letzteErkennung1 = 0;
unsigned long letzteErkennung2 = 0;
unsigned long letzteErkennung5 = 0;

const unsigned long debounceZeit = 800;

// =====================================================
// WLAN RESET BUTTON
// =====================================================

#define WLAN_RESET_BUTTON_PIN 22

// =====================================================
// OLED DISPLAY
// =====================================================

#define SDA_PIN 6
#define SCL_PIN 7
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// =====================================================
// LED-RING
// =====================================================

#define LED_PIN 4
#define NUM_LEDS 12

Adafruit_NeoPixel ring(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// =====================================================
// SERVO
// =====================================================

#define SERVO_PIN 3

Servo servo;

const int SERVO_ZU = 90;
const int SERVO_OFFEN = 170;

// =====================================================
// STATUS
// =====================================================

bool hatAktivesSparziel = false;
bool hatteVorherAktivesSparziel = false;
bool servoAusgeloest = false;
bool sparschweinIstOffen = false;

// =====================================================
// WERTE FUER DISPLAY UND LED-RING
// =====================================================

float gesamt = 0.00;
float zielBetrag = 0.00;
float fortschritt = 0.00;
String zielTitel = "Kein Ziel";

// Server alle 10 Sekunden abfragen
unsigned long letzteAktualisierung = 0;
const unsigned long updateIntervall = 10000;

// LED nur bei Fortschrittsaenderung einschalten
float letzterFortschrittFuerLed = -1.00;

unsigned long ledEinschaltZeit = 0;
const unsigned long ledLeuchtDauer = 30000; // 30 Sekunden. Fuer 2 Minuten: 120000
bool ledRingIstAn = false;

// =====================================================
// DISPLAY: WLAN STATUS
// =====================================================

void zeigeWlanStatus(String zeile1, String zeile2) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(0, 8);
  display.println(zeile1);

  display.setTextSize(1);
  display.setCursor(0, 36);
  display.println(zeile2);

  display.display();
}

// =====================================================
// WLAN MIT WIFI MANAGER
// =====================================================

void verbindeWlanMitManager() {
  WiFiManager wm;

  zeigeWlanStatus("WLAN", "Verbinden...");
  Serial.println("WLAN wird verbunden...");

  // Laenger auf gespeichertes WLAN warten
  wm.setConnectTimeout(25);        // 25 Sekunden warten
  wm.setConfigPortalTimeout(180);  // Setup-Portal bleibt 3 Minuten offen

  // Diese Anzeige kommt nur, wenn wirklich das Setup-WLAN gestartet wird
wm.setAPCallback([](WiFiManager *myWiFiManager) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("WLAN Setup:");

  display.setCursor(0, 12);
  display.println("Oeffne WLAN:");

  display.setCursor(0, 24);
  display.println("Sparschwein-Setup");

  display.setCursor(0, 38);
  display.println("Falls nichts oeffnet:");

  display.setCursor(0, 50);
  display.println("192.168.4.1");

  display.display();

  Serial.println("Setup-WLAN gestartet:");
  Serial.println("Sparschwein-Setup");
  Serial.println("Falls keine Seite aufgeht:");
  Serial.println("http://192.168.4.1");
});

  wm.setTitle("Spärkässeli");

  wm.setCustomHeadElement(
    "<style>"
    "body{"
      "font-family:Arial,Helvetica,sans-serif;"
      "background:#f7f5ef;"
      "color:#222;"
      "margin:0;"
    "}"

    ".wrap{"
      "max-width:420px;"
      "margin:30px auto;"
      "padding:28px;"
      "background:#ffffff;"
      "border-radius:24px;"
      "box-shadow:0 12px 30px rgba(0,0,0,0.12);"
    "}"

    "h1{"
      "text-align:center;"
      "font-size:34px;"
      "font-weight:800;"
      "margin:0 0 22px 0;"
      "color:#7b2be8;"
    "}"

    "p{"
      "text-align:center;"
      "color:#444;"
      "font-size:15px;"
      "line-height:1.45;"
    "}"

    "input,select{"
      "width:100%;"
      "box-sizing:border-box;"
      "border:1px solid #d8d0c7;"
      "border-radius:12px;"
      "padding:12px;"
      "font-size:16px;"
      "margin:8px 0 16px 0;"
      "background:#fff;"
    "}"

    "input:focus,select:focus{"
      "outline:none;"
      "border-color:#8b35df;"
      "box-shadow:0 0 0 3px rgba(139,53,223,0.15);"
    "}"

    "button,input[type=submit]{"
      "width:100%;"
      "border:0;"
      "border-radius:12px;"
      "padding:14px;"
      "font-size:16px;"
      "font-weight:700;"
      "color:white;"
      "background:linear-gradient(90deg,#c12d8a,#6517dc);"
    "}"

    "a{"
      "color:#7b2be8;"
      "font-weight:700;"
    "}"
    "</style>"
  );

  bool verbunden = wm.autoConnect("Sparschwein-Setup");

  if (!verbunden) {
    Serial.println("WLAN Verbindung fehlgeschlagen.");
    zeigeWlanStatus("KEIN WLAN", "Neustart...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("WLAN verbunden!");
  Serial.print("IP-Adresse: ");
  Serial.println(WiFi.localIP());

  zeigeWlanStatus("WLAN", "Verbunden");
  delay(1500);
}

// =====================================================
// WLAN RESET BUTTON PRUEFEN
// =====================================================

void pruefeWlanResetButton() {
  if (digitalRead(WLAN_RESET_BUTTON_PIN) == LOW) {
    unsigned long startZeit = millis();

    zeigeWlanStatus("WLAN", "Reset halten...");
    Serial.println("WLAN Reset Button gedrueckt...");

    while (digitalRead(WLAN_RESET_BUTTON_PIN) == LOW) {
      if (millis() - startZeit > 3000) {
        WiFiManager wm;

        zeigeWlanStatus("WLAN", "Daten geloescht");
        Serial.println("WLAN-Daten werden geloescht...");

        wm.resetSettings();

        delay(1500);

        zeigeWlanStatus("RESET", "Neustart...");
        delay(1000);

        ESP.restart();
      }

      delay(50);
    }

    zeigeSparziel();
  }
}

// =====================================================
// SETUP
// =====================================================

void setup() {
  Serial.begin(115200);

  pinMode(SENSOR_1_PIN, INPUT_PULLUP);
  pinMode(SENSOR_2_PIN, INPUT_PULLUP);
  pinMode(SENSOR_5_PIN, INPUT_PULLUP);

  pinMode(WLAN_RESET_BUTTON_PIN, INPUT_PULLUP);

  letzterZustand1 = digitalRead(SENSOR_1_PIN);
  letzterZustand2 = digitalRead(SENSOR_2_PIN);
  letzterZustand5 = digitalRead(SENSOR_5_PIN);

  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);
  servo.write(SERVO_ZU);
  delay(700);
  servo.detach();

  ring.begin();
  ring.setBrightness(40);
  ring.clear();
  ring.show();

  Wire.begin(SDA_PIN, SCL_PIN);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("Display nicht gefunden");
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Smartes");
    display.println("Sparschwein");
    display.println("");
    display.println("Start...");
    display.display();
  }

  delay(1500);

  verbindeWlanMitManager();

  ladeSparziel();
  zeigeSparziel();

  letzterFortschrittFuerLed = fortschritt;
}

// =====================================================
// LOOP
// =====================================================

void loop() {
  pruefeWlanResetButton();

  if (hatAktivesSparziel) {
    pruefeSensor(SENSOR_1_PIN, letzterZustand1, letzteErkennung1, 1.00);
    pruefeSensor(SENSOR_2_PIN, letzterZustand2, letzteErkennung2, 2.00);
    pruefeSensor(SENSOR_5_PIN, letzterZustand5, letzteErkennung5, 5.00);
  }

  if (millis() - letzteAktualisierung > updateIntervall) {
    letzteAktualisierung = millis();

    ladeSparziel();
    zeigeSparziel();

    pruefeObLedAktualisiertWerdenSoll();

    Serial.println("Daten aktualisiert");
  }

  if (ledRingIstAn && millis() - ledEinschaltZeit > ledLeuchtDauer) {
    ledRingAusschalten();
    Serial.println("LED-Ring automatisch ausgeschaltet");
  }
}

// =====================================================
// SENSOR PRUEFEN
// =====================================================

void pruefeSensor(int sensorPin, bool &letzterZustand, unsigned long &letzteErkennung, float muenzWert) {
  bool aktuellerZustand = digitalRead(sensorPin);

  if (letzterZustand == HIGH && aktuellerZustand == LOW) {
    if (millis() - letzteErkennung > debounceZeit) {
      letzteErkennung = millis();

      Serial.print("Muenze erkannt: ");
      Serial.print(muenzWert, 2);
      Serial.println(" Fr.");

      sendeMuenze(muenzWert);
    }
  }

  letzterZustand = aktuellerZustand;
}

// =====================================================
// MUENZE AN PHP SENDEN
// =====================================================

void sendeMuenze(float wert) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Kein WLAN");
    zeigeWlanStatus("KEIN WLAN", "Muenze nicht gesendet");
    return;
  }

  HTTPClient http;

  http.begin(einwurfUrl);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"geraete_id\":\"" + geraeteId + "\",";
  json += "\"muenz_wert\":" + String(wert, 2);
  json += "}";

  Serial.println("Sende JSON:");
  Serial.println(json);

  int httpResponseCode = http.POST(json);

  Serial.print("Einwurf HTTP: ");
  Serial.println(httpResponseCode);

  String response = http.getString();

  Serial.println("Einwurf Antwort:");
  Serial.println(response);

  http.end();

  if (httpResponseCode == 200 && response.indexOf("success") >= 0) {
    ladeSparziel();

    // Schwein anzeigen
    zeigeOinkAnimation();

    // LED-Animation laeuft, waehrend das Schwein sichtbar bleibt
    erfolgAnimation();

    // Danach wieder normale Anzeige
    zeigeSparziel();

    letzterFortschrittFuerLed = fortschritt;
  }
}

// =====================================================
// SPARZIEL VON PHP LADEN
// =====================================================

void ladeSparziel() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Kein WLAN fuer Sparziel");
    zeigeWlanStatus("KEIN WLAN", "Server nicht erreichbar");
    return;
  }

  HTTPClient http;

  http.begin(sparzielUrl);

  int httpCode = http.GET();

  Serial.print("Sparziel HTTP: ");
  Serial.println(httpCode);

  String response = http.getString();

  Serial.println("Sparziel Antwort:");
  Serial.println(response);

  http.end();

  if (httpCode == 200 && response.indexOf("\"status\":\"success\"") >= 0) {

    if (sparschweinIstOffen) {
      Serial.println("Neues Sparziel erkannt. Sparschwein wird geschlossen.");
      servoSchliessen();
      sparschweinIstOffen = false;
    }

    hatAktivesSparziel = true;
    hatteVorherAktivesSparziel = true;
    servoAusgeloest = false;

    zielTitel = leseStringAusJson(response, "titel");
    zielBetrag = leseFloatAusJson(response, "ziel_betrag");
    gesamt = leseFloatAusJson(response, "aktueller_betrag");
    fortschritt = leseFloatAusJson(response, "fortschritt");

    Serial.println("Aktives Sparziel geladen:");
    Serial.print("Titel: ");
    Serial.println(zielTitel);
    Serial.print("Zielbetrag: ");
    Serial.println(zielBetrag);
    Serial.print("Aktueller Betrag: ");
    Serial.println(gesamt);
    Serial.print("Fortschritt: ");
    Serial.println(fortschritt);

    return;
  }

  if (httpCode == 200 && response.indexOf("\"status\":\"no_goal\"") >= 0) {
    Serial.println("Kein aktives Sparziel vorhanden.");

    hatAktivesSparziel = false;

    zielTitel = "Sparziel";
    zielBetrag = 0.00;
    gesamt = 0.00;
    fortschritt = 0.00;

    ledRingAusschalten();
    letzterFortschrittFuerLed = -1.00;

    if (hatteVorherAktivesSparziel && !servoAusgeloest) {
      servoAusgeloest = true;
      hatteVorherAktivesSparziel = false;

      Serial.println("Sparziel wurde abgeschlossen. Servo oeffnet und bleibt offen.");
      servoOeffnen();
      sparschweinIstOffen = true;
    }

    return;
  }

  zielTitel = "Sparziel";
  zielBetrag = 0.00;
  gesamt = 0.00;
  fortschritt = 0.00;

  hatAktivesSparziel = false;

  Serial.println("Fehler oder kein gueltiges Sparziel.");
}

// =====================================================
// DISPLAY: SPARZIEL ANZEIGEN
// =====================================================

void zeigeSparziel() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  if (!hatAktivesSparziel) {
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.println("SPARZIEL");

    display.setCursor(0, 18);
    display.println("EINGEBEN");

    display.setTextSize(1);
    display.setCursor(0, 44);
    display.println("Bitte Sparschwein");

    display.setCursor(0, 54);
    display.println("zumachen");

    display.display();
    return;
  }

  display.setTextSize(1);
  display.setCursor(0, 0);

  if (fortschritt >= 100) {
    display.println("Ziel erreicht!");
  } else {
    display.println("Sparziel:");
  }

  display.setCursor(0, 10);
  display.println(zielTitel);

  display.setTextSize(1);
  display.setCursor(0, 28);
  display.print(gesamt, 2);
  display.print(" / ");
  display.print(zielBetrag, 2);
  display.println(" Fr.");

  display.setTextSize(2);
  display.setCursor(0, 44);
  display.print(fortschritt, 0);
  display.println("%");

  display.display();
}

// =====================================================
// DISPLAY: OINK ANIMATION BEI MUENZEINWURF
// =====================================================

void zeigeOinkAnimation() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Kopf
  display.drawCircle(64, 26, 18, SSD1306_WHITE);

  // Ohren
  display.drawTriangle(48, 15, 55, 5, 58, 18, SSD1306_WHITE);
  display.drawTriangle(80, 15, 73, 5, 70, 18, SSD1306_WHITE);

  // Augen
  display.fillCircle(57, 23, 2, SSD1306_WHITE);
  display.fillCircle(71, 23, 2, SSD1306_WHITE);

  // Nase
  display.drawRoundRect(55, 31, 18, 10, 5, SSD1306_WHITE);
  display.fillCircle(60, 36, 1, SSD1306_WHITE);
  display.fillCircle(68, 36, 1, SSD1306_WHITE);

  // Text
  display.setTextSize(2);
  display.setCursor(35, 49);
  display.println("OINK!");

  display.display();
}

// =====================================================
// DISPLAY: SPARSCHWEIN OFFEN
// =====================================================

void zeigeSparschweinOffen() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(0, 8);
  display.println("SPAR-");

  display.setCursor(0, 26);
  display.println("SCHWEIN");

  display.setTextSize(2);
  display.setCursor(26, 48);
  display.println("OFFEN");

  display.display();
}

// =====================================================
// LED: NUR BEI AENDERUNG EINSCHALTEN
// =====================================================

void pruefeObLedAktualisiertWerdenSoll() {
  if (!hatAktivesSparziel) {
    ledRingAusschalten();
    letzterFortschrittFuerLed = -1.00;
    return;
  }

  if (letzterFortschrittFuerLed < 0) {
    letzterFortschrittFuerLed = fortschritt;
    return;
  }

  int neuerFortschritt = round(fortschritt);
  int alterFortschritt = round(letzterFortschrittFuerLed);

  if (neuerFortschritt != alterFortschritt) {
    letzterFortschrittFuerLed = fortschritt;
    zeigeLedFortschritt();
    Serial.println("Fortschritt geaendert. LED-Ring eingeschaltet.");
  }
}

// =====================================================
// LED-RING: FORTSCHRITT ANZEIGEN
// =====================================================

void zeigeLedFortschritt() {
  ring.clear();

  if (!hatAktivesSparziel) {
    ring.show();
    ledRingIstAn = false;
    return;
  }

  int aktiveLeds = round((fortschritt / 100.0) * NUM_LEDS);

  if (aktiveLeds > NUM_LEDS) {
    aktiveLeds = NUM_LEDS;
  }

  for (int i = 0; i < aktiveLeds; i++) {
    if (fortschritt >= 100) {
      ring.setPixelColor(i, ring.Color(0, 255, 0));
    } else if (fortschritt < 50) {
      ring.setPixelColor(i, ring.Color(255, 0, 0));
    } else {
      ring.setPixelColor(i, ring.Color(255, 180, 0));
    }
  }

  ring.show();

  ledEinschaltZeit = millis();
  ledRingIstAn = true;
}

// =====================================================
// LED-RING: AUSSCHALTEN
// =====================================================

void ledRingAusschalten() {
  ring.clear();
  ring.show();
  ledRingIstAn = false;
}

// =====================================================
// LED-ANIMATION BEI EINWURF
// =====================================================

void erfolgAnimation() {
  for (int i = 0; i < NUM_LEDS; i++) {
    ring.setPixelColor(i, ring.Color(0, 255, 0));
    ring.show();
    delay(40);
  }

  delay(200);

  zeigeLedFortschritt();
}

// =====================================================
// SERVO: OEFFNEN
// =====================================================

void servoOeffnen() {
  Serial.println("Servo oeffnet.");

  zeigeSparschweinOffen();

  for (int r = 0; r < 2; r++) {
    ring.clear();
    ring.show();
    delay(120);

    for (int i = 0; i < NUM_LEDS; i++) {
      ring.setPixelColor(i, ring.Color(0, 255, 0));
    }

    ring.show();
    delay(120);
  }

  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);
  delay(200);

  servo.write(SERVO_OFFEN);
  delay(700);

  servo.detach();

  Serial.println("Servo ist offen.");

  delay(1500);

  zeigeSparziel();

  ledRingAusschalten();
}

// =====================================================
// SERVO: SCHLIESSEN
// =====================================================

void servoSchliessen() {
  Serial.println("Servo schliesst.");

  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);
  delay(200);

  servo.write(SERVO_ZU);
  delay(700);

  servo.detach();

  Serial.println("Servo ist geschlossen.");
}

// =====================================================
// JSON-HILFSFUNKTION FUER TEXT
// =====================================================

String leseStringAusJson(String json, String key) {
  String suchText = "\"" + key + "\":\"";

  int startIndex = json.indexOf(suchText);

  if (startIndex < 0) {
    return "";
  }

  startIndex += suchText.length();

  int endIndex = json.indexOf("\"", startIndex);

  if (endIndex < 0) {
    return "";
  }

  return json.substring(startIndex, endIndex);
}

// =====================================================
// JSON-HILFSFUNKTION FUER ZAHLEN
// =====================================================

float leseFloatAusJson(String json, String key) {
  String suchText = "\"" + key + "\":";

  int startIndex = json.indexOf(suchText);

  if (startIndex < 0) {
    return 0.00;
  }

  startIndex += suchText.length();

  int endIndexKomma = json.indexOf(",", startIndex);
  int endIndexKlammer = json.indexOf("}", startIndex);

  int endIndex;

  if (endIndexKomma < 0) {
    endIndex = endIndexKlammer;
  } else {
    endIndex = endIndexKomma;
  }

  if (endIndex < 0) {
    return 0.00;
  }

  String wertString = json.substring(startIndex, endIndex);
  wertString.replace("\"", "");

  return wertString.toFloat();
}