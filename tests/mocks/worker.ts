import stripComments from 'strip-comments';

export default class WorkerMock {
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

  public postMessage(code: string) {
    this.onmessage({ data: stripComments(code) });
  }
}
