import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { copilotRouter } from "./routes/copilot.js";
import { healthRouter } from "./routes/health.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/copilot", copilotRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app };
