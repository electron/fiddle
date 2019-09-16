import { shallow } from "enzyme";
import * as React from "react";

import { PublishButton } from "../../../src/renderer/components/commands-publish-button";
import { getOctokit } from "../../../src/utils/octokit";

jest.mock("../../../src/utils/octokit");

describe("Publish button component", () => {
  let store: any;

  const expectedGistCreateOpts = {
    description: "Electron Fiddle Gist",
    files: {
      "index.html": { content: "html-content" },
      "renderer.js": { content: "renderer-content" },
      "main.js": { content: "main-content" }
    },
    public: true
  };

  beforeEach(() => {
    store = {
      gitHubPublishAsPublic: true
    };
  });

  it("renders", () => {
    const wrapper = shallow(<PublishButton appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("toggles the auth dialog on click if not authed", async () => {
    store.toggleAuthDialog = jest.fn();

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;
    await instance.handleClick();

    expect(store.toggleAuthDialog).toHaveBeenCalled();
  });

  it("toggles the publish method on click if authed", async () => {
    store.gitHubToken = "github-token";

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;
    instance.publishFiddle = jest.fn();
    await instance.handleClick();

    expect(instance.publishFiddle).toHaveBeenCalled();
  });

  it("attempts to publish to Gist", async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: "123" } }))
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;

    await instance.publishFiddle();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith({
      description: "Electron Fiddle Gist",
      files: {
        "index.html": { content: "html-content" },
        "renderer.js": { content: "renderer-content" },
        "main.js": { content: "main-content" }
      },
      public: true
    });
  });

  it("handles missing content", async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(async () => ({ data: { id: "123" } }))
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;

    (window as any).ElectronFiddle.app.getEditorValues.mockReturnValueOnce({});

    await instance.publishFiddle();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith({
      description: "Electron Fiddle Gist",
      files: {
        "index.html": { content: "<!-- Empty -->" },
        "renderer.js": { content: "// Empty" },
        "main.js": { content: "// Empty" }
      },
      public: true
    });
  });

  it("handles an error in Gist publishing", async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(() => {
          throw new Error("bwap bwap");
        })
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;

    await instance.publishFiddle();

    expect(store.isPublishing).toBe(false);
  });

  it("uses the privacy setting correctly", async () => {
    const mockOctokit = {
      authenticate: jest.fn(),
      gists: {
        create: jest.fn(() => {
          throw new Error("bwap bwap");
        })
      }
    };

    (getOctokit as any).mockReturnValue(mockOctokit);

    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;

    instance.setPrivate();
    await instance.publishFiddle();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith({
      ...expectedGistCreateOpts,
      public: false
    });

    instance.setPublic();
    await instance.publishFiddle();

    expect(mockOctokit.gists.create).toHaveBeenCalledWith({
      ...expectedGistCreateOpts,
      public: true
    });
  });

  it("disables during gist publishing", async () => {
    store.isPublishing = false;
    const wrapper = shallow(<PublishButton appState={store} />);
    const instance: PublishButton = wrapper.instance() as any;

    expect(wrapper.find("fieldset").prop("disabled")).toBe(false);

    instance.publishFiddle = jest.fn().mockImplementationOnce(() => {
      return new Promise(resolve => {
        wrapper.setProps({ appState: { store, isPublishing: true } }, () => {
          expect(wrapper.find("fieldset").prop("disabled")).toBe(true);
        });
        wrapper.setProps({ appState: { store, isPublishing: false } }, () => {
          expect(wrapper.find("fieldset").prop("disabled")).toBe(false);
        });
        resolve();
      });
    });

    await instance.publishFiddle();
  });

  describe("privacy menu", () => {
    it("toggles the privacy setting", () => {
      const wrapper = shallow(<PublishButton appState={store} />);
      const instance: PublishButton = wrapper.instance() as any;

      instance.setPublic();
      expect(store.gitHubPublishAsPublic).toBe(true);

      instance.setPrivate();
      expect(store.gitHubPublishAsPublic).toBe(false);
    });
  });
});
