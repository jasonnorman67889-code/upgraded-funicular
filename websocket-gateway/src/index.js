import express from "express";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json());

const server = app.listen(8020, () => {
  console.log("websocket gateway listening on 8020");
});

const wss = new WebSocketServer({ server, path: "/stream" });

const eventTypes = [
  "ImpossibleTravel",
  "MfaFatigue",
  "TokenReplay",
  "PasswordSpray",
  "OAuthPersistence",
  "SessionHijack",
];

function emitSynthetic() {
  const event = {
    eventId: randomUUID(),
    tenantId: Math.random() > 0.5 ? "tenant-a" : "tenant-b",
    entityId: Math.random() > 0.5 ? "user-alex" : "user-riley",
    eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
    riskScore: Number((Math.random() * 0.7 + 0.3).toFixed(2)),
    timeGenerated: new Date().toISOString(),
  };
  const payload = JSON.stringify({ type: "stream_event", data: event });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

setInterval(emitSynthetic, 2500);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "websocket-gateway" });
});
