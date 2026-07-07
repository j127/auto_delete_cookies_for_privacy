/** @type {import("prettier").Config} */
export default {
  endOfLine: "lf",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  arrowParens: "always",
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind 4 has no JS config; the plugin reads theme/plugin data from the
  // CSS entry to sort class lists.
  tailwindStylesheet: "./src/ui/styles.css",
  overrides: [],
};
