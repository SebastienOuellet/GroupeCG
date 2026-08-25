import * as userService from "./user.service.js";

const getMe = async (req, res, next) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

export const userController = {
  routes: [
    {
      method: "GET",
      url: "/me",
      middleware: [getMe],
      authRequired: true
    },
    {
      method: "GET",
      url: "",
      middleware: [getUsers],
      authRequired: true
    }
  ]
};
