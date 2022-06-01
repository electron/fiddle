import { ElectronFiddleMock, MonacoMock } from '../tests/mocks/mocks';

declare global {
  interface Window {
    ElectronFiddle: ElectronFiddleMock;
    monaco: MonacoMock;
  }
}

interface Window {
  ElectronFiddle: ElectronFiddleMock;
  monaco: MonacoMock;
}
