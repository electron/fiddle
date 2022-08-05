const config = {
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  parserOptions: {
    ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
    ecmaFeatures: {
      jsx: true, // Allows for the parsing of JSX
    },
  },
  settings: {
    react: {
      version: 'detect', // Tells eslint-plugin-react to automatically detect the version of React to use
    },
    'import/resolver': {
      // Allows eslint-plugin-import to detect resolved imports
      typescript: {
        project: './tsconfig.json',
      },
    },
  },
  extends: [
    'plugin:react/recommended', // Uses the recommended rules from @eslint-plugin-react
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    'plugin:import/recommended', // Used along with eslint-plugin-import to sort imports with recommended standards
    'plugin:import/typescript', // To handle import order cases for typescript files
  ],
  plugins: ['import'],
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true, // use eslint-plugin-import to handle this rule
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        allowSeparatedGroups: true,
      },
    ],
    'import/no-named-as-default-member': 'off',
    'import/namespace': 'off',
    'import/order': [
      'error',
      {
        groups: [
          'builtin', // Built-in imports
          'external', // External imports
          'internal', // Absolute imports
          ['sibling', 'parent'], // Relative imports
          'index', // index imports
          'unknown',
        ],
        // Keep all the `react` imports at the top level
        pathGroups: [
          {
            pattern: 'react',
            group: 'builtin',
            position: 'before',
          },
        ],
        'newlines-between': 'always',
        alphabetize: {
          // sort in ascending order
          order: 'asc',
          caseInsensitive: true,
        },
        // Exclude `react` imports so that our custom pathGroups applies
        pathGroupsExcludedImportTypes: ['react'],
      },
    ],
  },
  // the static folder is linted by standard
  ignorePatterns: ['/out', '/.webpack', '/coverage', '/static'],
};

module.exports = config;
