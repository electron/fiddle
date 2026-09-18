module.exports = {
  trailingComma: 'all',
  singleQuote: true,
  overrides: [
    {
      // The bundled templates are semicolon-free, unlike src/.
      files: 'static/**/*.js',
      options: {
        semi: false,
        trailingComma: 'none',
      },
    },
  ],
};
