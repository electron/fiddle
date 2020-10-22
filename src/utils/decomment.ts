import decomment from 'decomment';

onmessage = function (event: MessageEvent<string>) {
  postMessage(decomment(event.data));
};
