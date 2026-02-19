import "./web-component";
import { COMPONENT_TAG, type PosAppElement } from "./web-component";

export interface PosAppProps {
  apiBaseUrl?: string;
  [key: string]: any;
}

export interface PosAppHandle {
  element: PosAppElement;
  update: (props: PosAppProps) => void;
  destroy: () => void;
}

export function render(
  container: HTMLElement,
  props: PosAppProps = {}
): PosAppHandle {
  const el = document.createElement(COMPONENT_TAG) as PosAppElement;

  if (props.apiBaseUrl) {
    el.setAttribute("api-base-url", props.apiBaseUrl);
  }

  container.appendChild(el);

  requestAnimationFrame(() => {
    el.setProps(props);
  });

  return {
    element: el,
    update(newProps: PosAppProps) {
      el.setProps(newProps);
    },
    destroy() {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    },
  };
}

export { COMPONENT_TAG };
export default render;
