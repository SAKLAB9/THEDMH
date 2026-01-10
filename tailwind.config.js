/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'media',
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // 색상은 모두 config에서 동적으로 가져오므로 하드코딩된 색상 정의를 제거했습니다.
    },
  },
  plugins: [],
}

