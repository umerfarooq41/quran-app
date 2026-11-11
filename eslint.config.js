import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
export default [
  { ignores:['node_modules/**','dist/**','public/**','playwright-report/**','test-results/**'] },
  js.configs.recommended,
  {
    files:['**/*.{js,jsx,mjs}'],
    languageOptions:{ ecmaVersion:'latest',sourceType:'module',parserOptions:{ecmaFeatures:{jsx:true}},globals:{...globals.browser,...globals.node} },
    plugins:{ react, 'react-hooks':hooks },
    rules:{'react/jsx-uses-react':'error','react/jsx-uses-vars':'error','react/jsx-no-undef':'error','react-hooks/rules-of-hooks':'error'},
  },
];
