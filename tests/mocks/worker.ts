import * as decomment from 'decomment';

export default class MockWorker {
  public onmessage: (msg: any) => any;
  public onmessageerror: () => any;
  public onerror: () => any;
  public addEventListener: () => any;
  public removeEventListener: () => any;
  public dispatchEvent: () => any;
  public terminate: () => any;
  constructor() {
    this.onmessage = () => {
      /*no-op*/
    };
  }

  public postMessage(input: string) {
    this.onmessage({ data: decomment(input) });
  }
}
