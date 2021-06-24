import { ElectronFiddleMock, MonacoMock } from './mocks/mocks';

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
