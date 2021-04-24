const platform = process.platform;

export function overridePlatform(value: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value,
    writable: true,
  });
}

export function resetPlatform() {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
  });
}

export function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

export function mockFetchOnce(text: string) {
  (window.fetch as jest.Mock).mockImplementationOnce(() => {
    return Promise.resolve({
      text: jest.fn().mockResolvedValue(text),
      json: jest.fn().mockResolvedValue(JSON.parse(text)),
    });
  });
}

export class FetchMock {
  private readonly urls: Map<string, string> = new Map();
  public add(url: string, content: string) {
    this.urls.set(url, content);
  }
  constructor() {
    window.fetch = jest.fn().mockImplementation((url: string) => {
      const content = this.urls.get(url);
      if (!content) {
        console.trace('Unhandled mock URL:', url);
        return {
          ok: false,
        };
      }
      return Promise.resolve({
        text: jest.fn().mockImplementation(() => Promise.resolve(content)),
        json: jest
          .fn()
          .mockImplementation(() => Promise.resolve(JSON.parse(content))),
        ok: true,
      });
    });
  }
}
