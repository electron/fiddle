export const appMock = {
  typeDefDisposable: {
    dispose: jest.fn()
  },
  monaco: {
    languages: {
      typescript: {
        javascriptDefaults: {
          addExtraLib: jest.fn()
        }
      }
    }
  }
};
