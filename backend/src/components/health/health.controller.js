import db from "../../../models/index.js";

const getHealth = async (req, res, next) => {
  try {
    let dbStatus = "unknown";
    try {
      await db.sequelize.authenticate();
      dbStatus = "connected";
    } catch {
      dbStatus = "disconnected";
    }

    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      db: dbStatus
    });
  } catch (error) {
    next(error);
  }
};

export const healthController = {
  routes: [
    {
      method: "GET",
      url: "",
      middleware: [getHealth],
      authRequired: false
    }
  ]
};
