import {  AppMock } from './app';
import { EditorsMock } from './editors';

export class ElectronFiddleMock {
  public app = new AppMock();
  public editors = new EditorsMock();
}
