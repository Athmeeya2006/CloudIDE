/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ide: {
          bg:          '#1e1e1e',
          'bg-light':  '#252526',
          'bg-lighter':'#2d2d2d',
          sidebar:     '#252526',
          activity:    '#333333',
          border:      '#3e3e3e',
          hover:       '#2a2d2e',
          selected:    '#094771',
          accent:      '#007fd4',
          text:        '#cccccc',
          'text-muted':'#858585',
          'text-dim':  '#6b6b6b',
          tab:         '#2d2d2d',
          'tab-active':'#1e1e1e',
          status:      '#007acc',
          terminal:    '#1e1e1e',
          green:       '#4ec9b0',
          yellow:      '#dcdcaa',
          red:         '#f44747',
          blue:        '#569cd6',
          purple:      '#c586c0',
          orange:      '#ce9178',
        },
      },
      fontFamily: {
        mono: ["'Fira Code'", "'JetBrains Mono'", "'Cascadia Code'", "Menlo", "monospace"],
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
