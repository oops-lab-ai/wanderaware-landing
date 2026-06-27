import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "WanderAware",
  version: packageJson.version,
  copyright: `© ${currentYear} WanderAware`,
  meta: {
    title: "WanderAware Dashboard",
    description: "Manage buildings, RFID readers, tags, participants, alerts, team access, and device capacity.",
  },
};
