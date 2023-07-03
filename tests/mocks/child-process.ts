import { EventEmitter } from 'node:events';

export class ChildProcessMock extends EventEmitter {
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();
  public kill = jest.fn();
}
