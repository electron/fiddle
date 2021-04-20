import { observable } from 'mobx';

export class EditorMosaicMock {
  @observable public isEdited = false;
  public showAll = jest.fn();
  public addEditor = jest.fn();

  /*
  @computed public get states(): EditorStates {
  @observable public mosaic: MosaicNode<EditorId> | null = null;
  @computed public get mosaicLeafCount(): number {
  @action public set(values: Partial<EditorValues>) {
  @action public add(id: EditorId, value: string) {
  @action public remove(id: EditorId) {
  public values(): EditorValues {
  public inspect() {
  @action public resetLayout() {
  @action public hide(id: EditorId) {
  @action public show(id: EditorId) {
  @action public toggle(id: EditorId) {
  @action public showAll() {
  public focusedEditor(): IStandaloneCodeEditor | undefined {
  public layout() {
  public updateOptions(options: MonacoType.editor.IEditorOptions) {
  */
}
