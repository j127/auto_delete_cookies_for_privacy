/**
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import * as React from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { resetAll } from "@/redux/actions";
import { adcpLog } from "@/services/libs";
import { downloadObjectAsJSON } from "@/ui/ui-libs";
import IconButton from "./IconButton";

// This fixes the error thrown when upgrading react-redux from 7.1.7 to 7.1.8
interface ChildrenProps {
  children: React.ReactNode;
}

interface DispatchProps {
  onResetButtonClick: () => void;
}

interface StateProps {
  state: State;
}

type ErrorBoundaryProps = ChildrenProps & DispatchProps & StateProps;

// This stays a class component: React error boundaries rely on
// componentDidCatch/getDerivedStateFromError, which have no hook equivalent.
class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
  public static getDerivedStateFromError(error: Error) {
    // update state so next render will show fallback UI
    if (error.message !== "state is undefined") {
      return { error, hasError: true };
    }
    return { hasError: false };
  }

  public state = {
    error: null as Error | null,
    hasError: false,
  };

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Shouldn't update state here but can be used to log errors somewhere else.
    adcpLog(
      {
        msg: `React ErrorBoundary - An Error was caught:  ${error}`,
        type: "error",
        x: { message: error.message, stack: error.stack, errorInfo },
      },
      true
    );
  }

  public async resetExtensionData() {
    await browser.storage.local.clear();
    this.props.onResetButtonClick();
    browser.runtime.reload();
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div
          className="alert block whitespace-pre-wrap alert-error"
          role="alert"
        >
          <h4 className="mb-2 text-lg font-bold">
            {browser.i18n.getMessage("errorText")}
          </h4>
          {this.state.error && this.state.error.toString()}
          <br />
          {this.state.error && this.state.error.stack && (
            // whitespace-pre-wrap on the alert container keeps the stack's
            // line breaks; no inline style needed.
            <details>{this.state.error.stack}</details>
          )}
          <div className="divider" />
          <div className="flex flex-wrap gap-2">
            <IconButton
              className="btn-primary"
              iconName="download"
              role="button"
              onClick={() =>
                downloadObjectAsJSON(this.props.state.settings, "CoreSettings")
              }
              title={browser.i18n.getMessage("exportTitleTimestamp")}
              text={browser.i18n.getMessage("exportSettingsText")}
            />
            <IconButton
              className="btn-primary"
              iconName="download"
              role="button"
              onClick={() =>
                downloadObjectAsJSON(this.props.state.lists, "Expressions")
              }
              title={browser.i18n.getMessage("exportTitleTimestamp")}
              text={browser.i18n.getMessage("exportURLSText")}
            />
            <IconButton
              tag="a"
              className="btn-error"
              iconName="skull-crossbones"
              onClick={() => this.resetExtensionData()}
              title={browser.i18n.getMessage("resetExtensionDataText")}
              text={browser.i18n.getMessage("resetExtensionDataText")}
            />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Function-component wrapper that supplies the props the connect() wrapper
// used to inject (state and onResetButtonClick) via hooks.
const ErrorBoundaryWrapper = ({ children }: ChildrenProps) => {
  // The boundary's fallback UI only ever reads state.settings and
  // state.lists (in its export-button click handlers). Subscribing to those
  // two slices keeps the state prop fresh whenever they change without
  // selecting the root state, which react-redux warns about in dev builds.
  useSelector((s: State) => s.settings);
  useSelector((s: State) => s.lists);
  const store = useStore();
  const dispatch = useDispatch<any>();
  return (
    <ErrorBoundary
      state={store.getState() as State}
      onResetButtonClick={() => dispatch(resetAll())}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundaryWrapper;
