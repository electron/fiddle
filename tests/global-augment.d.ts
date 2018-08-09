import { EditorId } from '../src/interfaces';
import { App as AppType } from '../src/renderer/app';
import { EditorMock } from './mocks/editors';

declare global {
  interface Window {
    ElectronFiddle: {
      app: AppType;
      editors: Record<EditorId, EditorMock>;
    };
  }
}
