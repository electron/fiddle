import { DocsDemoPage } from '../../../interfaces';

import { ShowMeApp } from './app';
import { ShowMeDefault } from './default';

export const DOCS_DEMO_COMPONENTS: Record<DocsDemoPage, any> = {
  DEFAULT: ShowMeDefault,
  DEMO_APP: ShowMeApp
};

export const DOCS_DEMO_NAMES: Record<DocsDemoPage, string> = {
  DEFAULT: 'Home',
  DEMO_APP: 'App Demos'
};
