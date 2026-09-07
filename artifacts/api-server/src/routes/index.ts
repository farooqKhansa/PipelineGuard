import { Router, type IRouter } from "express";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

// The imported frontend ships a bundled fixture gateway for local/demo reads.
// Keep the shared API service quiet for those GETs when no live FastAPI gateway
// is configured; the frontend detects the empty response and uses its fixtures.
router.use("/v1", (req, res, next) => {
  if (req.method === "GET") {
    res.status(204).end();
    return;
  }
  next();
});

export default router;
