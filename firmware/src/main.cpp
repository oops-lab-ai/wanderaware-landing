#include <Arduino.h>

// ── UART pins ──
#define RXD2 5
#define TXD2 18

// ── R200 protocol ──
#define FRAME_HEAD 0xAA
#define FRAME_END  0xDD

static const uint8_t CMD_HW_VERSION[] = {0xAA, 0x00, 0x03, 0x00, 0x01, 0x00, 0x04, 0xDD};
static const uint8_t CMD_INVENTORY[]  = {0xAA, 0x00, 0x22, 0x00, 0x00, 0x22, 0xDD};
// Note: Beeper can only be disabled by desoldering R9 or R11 on the R200 board

// ── Buffer ──
#define BUF_SIZE 256
static uint8_t buf[BUF_SIZE];
static uint16_t bufPos = 0;

// ── Tag tracking ──
#define MAX_TAGS 50
#define EPC_MAX_LEN 16

struct TagInfo {
  uint8_t epc[EPC_MAX_LEN];
  uint8_t epcLen;
  int16_t lastRSSI;
  int16_t minRSSI;
  int16_t maxRSSI;
  uint32_t readCount;
  unsigned long firstSeen;
  unsigned long lastSeen;
  bool active;
  bool wasReportedGone;
};

static TagInfo tags[MAX_TAGS];
static uint8_t tagCount = 0;
static uint32_t totalReads = 0;
static unsigned long lastDashboard = 0;
static unsigned long scanStartTime = 0;
static unsigned long lastPoll = 0;
static unsigned long lastHeartbeat = 0;

// ── Timing ──
#define POLL_INTERVAL    30    // send inventory every 30ms (~33 polls/sec)
#define DASHBOARD_INTERVAL 750
#define TAG_GONE_TIMEOUT 1500
#define HEARTBEAT_INTERVAL 2000  // show alive indicator every 2s when idle

void printHex(const uint8_t *data, uint16_t len) {
  for (uint16_t i = 0; i < len; i++) {
    if (data[i] < 0x10) Serial.print('0');
    Serial.print(data[i], HEX);
    if (i < len - 1) Serial.print(' ');
  }
}

void printShortEPC(const uint8_t *epc, uint8_t len) {
  if (len >= 4) {
    for (uint8_t i = len - 4; i < len; i++) {
      if (epc[i] < 0x10) Serial.print('0');
      Serial.print(epc[i], HEX);
    }
  } else {
    printHex(epc, len);
  }
}

int findOrAddTag(const uint8_t *epc, uint8_t len) {
  for (int i = 0; i < tagCount; i++) {
    if (tags[i].epcLen == len && memcmp(tags[i].epc, epc, len) == 0) {
      return i;
    }
  }
  if (tagCount < MAX_TAGS) {
    int idx = tagCount++;
    memcpy(tags[idx].epc, epc, len);
    tags[idx].epcLen = len;
    tags[idx].readCount = 0;
    tags[idx].firstSeen = millis();
    tags[idx].active = false;
    tags[idx].wasReportedGone = false;
    tags[idx].minRSSI = 999;
    tags[idx].maxRSSI = -999;
    return idx;
  }
  return -1;
}

// R200 RSSI: raw byte, higher = stronger signal
// Values typically range ~130 (weak) to ~210 (strong/close)
int16_t convertRSSI(uint8_t raw) {
  return (int16_t)raw;
}

void printSignalBar(int16_t rssi) {
  // Map raw RSSI range (~130-210) to bars
  int bars;
  if (rssi > 205) bars = 10;
  else if (rssi > 200) bars = 9;
  else if (rssi > 195) bars = 8;
  else if (rssi > 190) bars = 7;
  else if (rssi > 185) bars = 6;
  else if (rssi > 180) bars = 5;
  else if (rssi > 170) bars = 4;
  else if (rssi > 160) bars = 3;
  else if (rssi > 145) bars = 2;
  else bars = 1;

  Serial.print("[");
  for (int i = 0; i < bars; i++) Serial.print("|");
  for (int i = bars; i < 10; i++) Serial.print(" ");
  Serial.print("]");
}

const char* signalLabel(int16_t rssi) {
  if (rssi > 200) return "STRONG";
  if (rssi > 190) return "GOOD";
  if (rssi > 175) return "FAIR";
  if (rssi > 155) return "WEAK";
  return "FAINT";
}

void processFrame(const uint8_t *frame, uint16_t len) {
  if (len < 7) return;

  uint8_t type = frame[1];
  uint8_t cmd  = frame[2];
  uint16_t paramLen = ((uint16_t)frame[3] << 8) | frame[4];

  // ── Tag data ──
  if (cmd == 0x22 && (type == 0x02 || type == 0x01)) {
    if (paramLen < 5) return;
    totalReads++;
    uint8_t rssiRaw = frame[5];
    int16_t rssi = convertRSSI(rssiRaw);
    uint16_t epcLen = paramLen - 4;
    if (epcLen > EPC_MAX_LEN || epcLen == 0) return;

    const uint8_t *epc = &frame[8];
    int idx = findOrAddTag(epc, epcLen);
    if (idx < 0) return;

    bool isNew = (tags[idx].readCount == 0);
    bool wasGone = !tags[idx].active;
    tags[idx].lastRSSI = rssi;
    tags[idx].readCount++;
    tags[idx].lastSeen = millis();
    tags[idx].active = true;

    if (rssi < tags[idx].minRSSI) tags[idx].minRSSI = rssi;
    if (rssi > tags[idx].maxRSSI) tags[idx].maxRSSI = rssi;

    if (isNew) {
      Serial.println();
      Serial.print("[+] TAG ");
      Serial.print(idx + 1);
      Serial.print(" DISCOVERED  EPC: ");
      printHex(epc, epcLen);
      Serial.print("  (");
      Serial.print(rssi);
      Serial.println(" dBm)");
    } else if (wasGone) {
      Serial.print("[+] TAG ");
      Serial.print(idx + 1);
      Serial.print(" returned  (");
      Serial.print(rssi);
      Serial.println(" dBm)");
      tags[idx].wasReportedGone = false;
    }
  }
  // ── Hardware version ──
  else if (cmd == 0x03 && type == 0x01) {
    Serial.print("Module: ");
    for (uint16_t i = 5; i < 5 + paramLen; i++) {
      if (frame[i] >= 0x20) Serial.print((char)frame[i]);
    }
    Serial.println();
  }
  // ── No tag (0x15) — silent ──
  else if (type == 0x01 && cmd == 0xFF && paramLen > 0 && frame[5] == 0x15) {
    // no-op, but confirms R200 is alive
    lastHeartbeat = millis();
  }
}

void readSerial() {
  static bool inFrame = false;

  while (Serial2.available()) {
    uint8_t b = Serial2.read();

    if (!inFrame) {
      if (b == FRAME_HEAD) {
        inFrame = true;
        bufPos = 0;
        buf[bufPos++] = b;
      }
    } else {
      if (bufPos < BUF_SIZE) {
        buf[bufPos++] = b;
      }
      if (b == FRAME_END) {
        processFrame(buf, bufPos);
        inFrame = false;
        bufPos = 0;
      }
      if (bufPos >= BUF_SIZE) {
        inFrame = false;
        bufPos = 0;
      }
    }
  }
}

void printDashboard() {
  unsigned long now = millis();
  if (now - lastDashboard < DASHBOARD_INTERVAL) return;
  lastDashboard = now;

  // Check for tags that left range
  for (int i = 0; i < tagCount; i++) {
    if (tags[i].active && (now - tags[i].lastSeen > TAG_GONE_TIMEOUT)) {
      tags[i].active = false;
      if (!tags[i].wasReportedGone) {
        Serial.print("[-] TAG ");
        Serial.print(i + 1);
        Serial.println(" out of range");
        tags[i].wasReportedGone = true;
      }
    }
  }

  // Count active
  uint8_t activeCount = 0;
  for (int i = 0; i < tagCount; i++) {
    if (tags[i].active) activeCount++;
  }

  unsigned long uptime = (now - scanStartTime) / 1000;

  // Show active tags
  if (activeCount > 0) {
    Serial.print("[LIVE ");
    Serial.print(uptime);
    Serial.print("s] ");
    Serial.print(activeCount);
    Serial.print(" active | ");
    Serial.print(tagCount);
    Serial.print(" known | ");
    Serial.print(totalReads);
    Serial.println(" reads");
    for (int i = 0; i < tagCount; i++) {
      if (!tags[i].active) continue;
      Serial.print("  TAG ");
      Serial.print(i + 1);
      Serial.print(" ");
      printSignalBar(tags[i].lastRSSI);
      Serial.print(" ");
      Serial.print(tags[i].lastRSSI);
      Serial.print(" dBm ");
      Serial.print(signalLabel(tags[i].lastRSSI));
      Serial.print("  x");
      Serial.print(tags[i].readCount);
      Serial.print("  id:");
      printShortEPC(tags[i].epc, tags[i].epcLen);
      Serial.println();
    }
  }
  // Heartbeat when idle — just a dot every 2 seconds
  else if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    Serial.print(".");
    lastHeartbeat = now;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println();
  Serial.println("========================================");
  Serial.println("  WanderAware R200 UHF RFID Reader");
  Serial.println("  LIVE TRACKING MODE");
  Serial.println("========================================");

  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);
  delay(500);

  Serial2.write(CMD_HW_VERSION, sizeof(CMD_HW_VERSION));
  delay(500);
  readSerial();

  Serial.println();
  Serial.println("  [+] = tag enters     [.] = scanning");
  Serial.println("  [-] = tag leaves     TAG # = persistent");
  Serial.println();
  Serial.println("  Scanning...");
  Serial.println("========================================");

  scanStartTime = millis();
  lastHeartbeat = millis();
}

void loop() {
  unsigned long now = millis();

  // Fast polling — send inventory command every 30ms
  if (now - lastPoll >= POLL_INTERVAL) {
    lastPoll = now;
    Serial2.write(CMD_INVENTORY, sizeof(CMD_INVENTORY));
  }

  // Always drain serial buffer
  readSerial();

  // Update display
  printDashboard();

  yield();
}
