// 스타일 빌드 설정: index.html 과 app-v3.js 안의 class 이름을 스캔해 필요한 CSS만 만든다.
module.exports = {
  darkMode: 'class',
  content: ['../index.html', '../app-v3.js'],
  theme: { extend: {} },
  plugins: []
};
