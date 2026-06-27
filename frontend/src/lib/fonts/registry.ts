export const fontRegistry = {
  inter: {
    label: "Inter",
    variable: "--font-inter",
  },
  roboto: {
    label: "Roboto",
    variable: "--font-roboto",
  },
  poppins: {
    label: "Poppins",
    variable: "--font-poppins",
  },
  geist: {
    label: "Geist",
    variable: "--font-geist",
  },
  geistMono: {
    label: "Geist Mono",
    variable: "--font-geist-mono",
  },
  jakarta: {
    label: "Plus Jakarta Sans",
    variable: "--font-jakarta",
  },
  nunito: {
    label: "Nunito",
    variable: "--font-nunito",
  },
  gabriela: {
    label: "Gabriela",
    variable: "--font-gabriela",
  },
  outfit: {
    label: "Outfit",
    variable: "--font-outfit",
  },
  manrope: {
    label: "Manrope",
    variable: "--font-manrope",
  },
  dmSans: {
    label: "DM Sans",
    variable: "--font-dm-sans",
  },
  greatVibes: {
    label: "Great Vibes",
    variable: "--font-great-vibes",
  },
} as const;

export type FontKey = keyof typeof fontRegistry;

export const fontOptions = (Object.entries(fontRegistry) as Array<[FontKey, (typeof fontRegistry)[FontKey]]>).map(
  ([key, f]) => ({
    key,
    label: f.label,
    variable: f.variable,
  }),
);
