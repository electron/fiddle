import * as monaco from 'monaco-editor';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginESTree from 'prettier/plugins/estree';
import * as prettierPluginHTML from 'prettier/plugins/html';
import * as prettierPluginCSS from 'prettier/plugins/postcss';
import * as prettier from 'prettier/standalone';

import { App } from './app';
import { initSentry } from './sentry';

initSentry();

// Register Prettier as the formatter for all Monaco.
monaco.languages.registerDocumentFormattingEditProvider('javascript', {
  provideDocumentFormattingEdits: async (model) => {
    const formatted = await prettier.format(model.getValue(), {
      semi: false,
      singleQuote: true,
      parser: 'babel',
      trailingComma: 'none',
      plugins: [prettierPluginBabel, prettierPluginESTree],
    });
    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
});

monaco.languages.registerDocumentRangeFormattingEditProvider('javascript', {
  provideDocumentRangeFormattingEdits: async (model, range) => {
    const value = model.getValueInRange(range);
    const formatted = await prettier.format(value, {
      semi: false,
      singleQuote: true,
      parser: 'babel',
      trailingComma: 'none',
      plugins: [prettierPluginBabel, prettierPluginESTree],
    });
    return [
      {
        range,
        text: formatted,
      },
    ];
  },
});

monaco.languages.registerDocumentFormattingEditProvider('html', {
  provideDocumentFormattingEdits: async (model) => {
    const formatted = await prettier.format(model.getValue(), {
      parser: 'html',
      plugins: [prettierPluginHTML],
    });
    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
});

monaco.languages.registerDocumentRangeFormattingEditProvider('html', {
  provideDocumentRangeFormattingEdits: async (model, range) => {
    const value = model.getValueInRange(range);
    const formatted = await prettier.format(value, {
      parser: 'html',
      plugins: [prettierPluginHTML],
    });
    return [
      {
        range,
        text: formatted,
      },
    ];
  },
});

monaco.languages.registerDocumentFormattingEditProvider('css', {
  provideDocumentFormattingEdits: async (model) => {
    const formatted = await prettier.format(model.getValue(), {
      parser: 'css',
      plugins: [prettierPluginCSS],
    });
    return [
      {
        range: model.getFullModelRange(),
        text: formatted,
      },
    ];
  },
});

monaco.languages.registerDocumentRangeFormattingEditProvider('css', {
  provideDocumentRangeFormattingEdits: async (model, range) => {
    const value = model.getValueInRange(range);
    const formatted = await prettier.format(value, {
      parser: 'css',
      plugins: [prettierPluginCSS],
    });
    return [
      {
        range,
        text: formatted,
      },
    ];
  },
});

window.monaco = monaco;
window.app = new App();
window.app.setup();
