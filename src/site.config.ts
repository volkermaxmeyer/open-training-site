export const site = {
  name: "Open Training",
  tallyFormUrl: process.env.TALLY_FORM_URL ?? "https://tally.so/r/rD5DBL",
  contactEmail: "pickleballinberlin@gmail.com",
  imprint: {
    name: "BTV Olympia e.V., Abt. Pickleball",
    street: "Paul-Heyse-Str. 25",
    city: "10407 Berlin, Germany",
  },
} as const;
