import preset from './src/tailwind-preset.ts'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    './examples/**/*.{ts,tsx,html}',
  ],
}
