@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color: #0f172a;
  background: #f8fafc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
}

* {
  box-sizing: border-box;
}

button,
input,
select,
textarea {
  font: inherit;
}

input[type='file'] {
  display: none;
}

.card {
  @apply rounded-2xl border border-slate-200 bg-white shadow-soft;
}
