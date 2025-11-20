module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  plugins: ['react', 'react-hooks', '@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // ✅ TDZ PREVENTION: Prevent module-scope Supabase/browser API calls
    'no-restricted-syntax': [
      'error',
      {
        selector: "Program > VariableDeclaration > VariableDeclarator[init.type='CallExpression'][init.callee.object.name='supabase']",
        message: 'Do not call supabase.* at module scope. Wrap it in a function or hook (e.g. useEffect, useQuery, lazy getter).',
      },
      {
        selector: "Program > ExpressionStatement > CallExpression[callee.object.name='supabase']",
        message: 'Do not call supabase.* at module scope. Wrap it in a function or hook (e.g. useEffect, useQuery, lazy getter).',
      },
      {
        selector: "Program > VariableDeclaration > VariableDeclarator[init.type='MemberExpression'][init.object.name='window']",
        message: 'Do not access window at module scope. Wrap it in a function/hook or lazy initializer with proper guards.',
      },
      {
        selector: "Program > VariableDeclaration > VariableDeclarator[init.type='MemberExpression'][init.object.name='document']",
        message: 'Do not access document at module scope. Wrap it in a function/hook.',
      },
      {
        selector: "Program > VariableDeclaration > VariableDeclarator[init.type='Identifier'][init.name='localStorage']",
        message: 'Do not access localStorage at module scope. Wrap it in a function/hook or useState lazy initializer.',
      },
    ],
  },
  env: {
    browser: true,
    es2020: true,
    node: true
  }
};

