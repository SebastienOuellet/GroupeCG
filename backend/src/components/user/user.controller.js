import * as userService from "./user.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "./user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getMe = async (req, res, next) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getUsers({ role: req.query.role });
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const user = await userService.updateUserRole(req.params.id, req.body?.role, req.user);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { user, emailStatus } = await userService.createUser(req.body, req.user);
    res.status(201).json({ ...user.toJSON(), emailStatus });
  } catch (error) {
    next(error);
  }
};

const setUserPassword = async (req, res, next) => {
  try {
    const { password, sendEmail, includePassword } = req.body ?? {};
    const result = await userService.setUserPassword(req.params.id, password, req.user, { sendEmail, includePassword });
    res.status(200).json(result);
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
      middleware: [adminOnly, getUsers],
      authRequired: true
    },
    {
      method: "POST",
      url: "",
      middleware: [adminOnly, createUser],
      authRequired: true
    },
    {
      method: "PUT",
      url: "/:id/password",
      middleware: [adminOnly, setUserPassword],
      authRequired: true
    },
    {
      method: "PUT",
      url: "/:id/role",
      middleware: [adminOnly, updateUserRole],
      authRequired: true
    }
  ]
};
