/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      colors: {
        // Paleta oficial do design (Figma - MyFinances)
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        ink: {
          DEFAULT: '#0f172a', // títulos / fundo da sidebar
          soft: '#1e293b', // item ativo da sidebar / barras escuras
          muted: '#475569', // texto de apoio
          faint: '#94a3b8', // texto secundário
        },
        line: '#e2e8f0',
        canvas: '#f8fafc',
        danger: {
          DEFAULT: '#ef4444',
          soft: '#fef2f2',
        },
        accent: {
          blue: '#3b82f6',
          amber: '#f59e0b',
          violet: '#8b5cf6',
        },
      },
      borderRadius: {
        card: '16px',
        control: '10px',
      },
      boxShadow: {
        card: '0 4px 8px rgba(0, 0, 0, 0.04)',
        overlay: '0 24px 48px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};
