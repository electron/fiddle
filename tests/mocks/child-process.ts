import { EventEmitter } from 'events';

export class MockChildProcess extends EventEmitter {
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();
  public kill = jest.fn();
}
