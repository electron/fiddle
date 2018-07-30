import { EditorsMock } from './editors';
import {  AppMock } from './app';

export class ElectronFiddleMock {
  public app = new AppMock();
  public editors = new EditorsMock();
}
