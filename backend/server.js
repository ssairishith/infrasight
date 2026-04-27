require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: corsOptions,
  transports: ["polling", "websocket"], // polling first for Render free tier
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "20mb" }));

app.set("io", io);

require("./sockets/index")(io);

app.use("/issues", require("./routes/issues"));
app.get("/", (req, res) => res.json({ status: "InfraSight API running" }));

(async () => {
  const findFreePort = (startPort) => {
    return new Promise((resolve) => {
      const testServer = http.createServer();
      testServer.listen(startPort, () => {
        const usedPort = testServer.address().port;
        testServer.close(() => resolve(usedPort));
      });
      testServer.on('error', () => resolve(findFreePort(startPort + 1)));
    });
  };

  const PORT = process.env.PORT || await findFreePort(5000);
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
