import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import { PosConfigProvider, type PosAppConfig } from "./lib/pos-config-context";

const COMPONENT_TAG = "pos-app";

let styleText: string | null = null;

async function loadStyles(): Promise<string> {
  if (styleText !== null) return styleText;
  try {
    const css = await import("./index.css?inline");
    styleText = (css as any).default || css;
    return styleText!;
  } catch {
    styleText = "";
    return "";
  }
}

class PosAppElement extends HTMLElement {
  private _root: Root | null = null;
  private _mountPoint: HTMLDivElement | null = null;
  private _props: Record<string, any> = {};

  static get observedAttributes() {
    return ["api-base-url"];
  }

  async connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });

    const css = await loadStyles();
    if (css) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      shadow.adoptedStyleSheets = [sheet];
    }

    const hostStyle = document.createElement("style");
    hostStyle.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        contain: content;
        font-family: 'Inter', sans-serif;
      }
      :host * {
        box-sizing: border-box;
      }
    `;
    shadow.appendChild(hostStyle);

    this._mountPoint = document.createElement("div");
    this._mountPoint.id = "root";
    this._mountPoint.style.width = "100%";
    this._mountPoint.style.height = "100%";
    shadow.appendChild(this._mountPoint);

    this._root = createRoot(this._mountPoint);
    this._renderApp();
  }

  disconnectedCallback() {
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
    this._mountPoint = null;
  }

  attributeChangedCallback(_name: string, _old: string, _val: string) {
    this._renderApp();
  }

  setProps(props: Record<string, any>) {
    this._props = { ...this._props, ...props };
    this._renderApp();
  }

  private _buildConfig(): PosAppConfig {
    const apiBaseUrl =
      this.getAttribute("api-base-url") || this._props.apiBaseUrl;
    return { ...this._props, ...(apiBaseUrl ? { apiBaseUrl } : {}) };
  }

  private _renderApp() {
    if (!this._root) return;
    const config = this._buildConfig();
    this._root.render(
      <PosConfigProvider config={config}>
        <App />
      </PosConfigProvider>
    );
  }
}

if (!customElements.get(COMPONENT_TAG)) {
  customElements.define(COMPONENT_TAG, PosAppElement);
}

export { PosAppElement, COMPONENT_TAG };
export default PosAppElement;
