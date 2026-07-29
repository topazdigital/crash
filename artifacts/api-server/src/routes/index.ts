import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import gameRouter from "./game";
import adminRouter from "./admin";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(gameRouter);
router.use(adminRouter);
router.use(walletRouter);

export default router;
