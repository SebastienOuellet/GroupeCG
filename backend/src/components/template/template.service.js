import db from "../../../models/index.js";
import { NotFoundError } from "../../errors/Errors.js";

const { NotificationTemplate } = db;

export const getTemplates = async ({ includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) {
    where.IsActive = true;
  }
  return NotificationTemplate.findAll({ where, order: [["Name", "ASC"]] });
};

export const getTemplateById = async (id) => {
  const template = await NotificationTemplate.findByPk(id);
  if (!template) {
    throw new NotFoundError("Modèle introuvable.");
  }
  return template;
};

export const createTemplate = async (templateInfo) => {
  return NotificationTemplate.create(templateInfo);
};

export const updateTemplate = async (id, templateInfo) => {
  const template = await getTemplateById(id);
  const { Id, ...updatable } = templateInfo;
  Object.assign(template, updatable);
  await template.save();
  return template;
};

export const deactivateTemplate = async (id) => {
  const template = await getTemplateById(id);
  template.IsActive = false;
  await template.save();
  return template;
};
