/* istanbul ignore file: React-redux init */

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
// Must be the first import: provides the `browser` global
// that MV2 supplied via script tags.
import "@/init-globals";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { createUIStore } from "@/redux/ui-store-bridge";
import { sleep } from "@/services/libs";
import ErrorBoundary from "@/ui/common-components/ErrorBoundary";
import fontAwesomeImports from "@/ui/font-awesome-imports";
import { initTheme } from "@/ui/theme";
import App from "./App";

fontAwesomeImports();
// Before the store hydrates, so an explicit dark/light choice applies
// without a flash of the wrong theme.
void initTheme();

async function initApp() {
  let store = await createUIStore();
  while (!store.getState()) {
    await sleep(250);
    store = await createUIStore();
  }
  const mountNode = document.createElement("div");
  document.body.appendChild(mountNode);

  await new Promise((resolve) => setTimeout(resolve, 100));

  createRoot(mountNode).render(
    <Provider store={store as any}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </Provider>
  );
}

initApp();
