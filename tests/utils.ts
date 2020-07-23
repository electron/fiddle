const platform = process.platform;

export function overridePlatform(value: string) {
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
  (window.fetch as jest.Mock).mockResolvedValueOnce({
    text: () => text,
    json: () => JSON.parse(text),
  });
}
