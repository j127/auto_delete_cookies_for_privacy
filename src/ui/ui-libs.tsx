/**
 * Copyright (c) 2019-2022 Kenneth Tran and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
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

/**
 *  Dynamically generate timestamp as a string
 */
export const appendDynamicTimestamp = (): string => {
  // We take into account the timezone offset since using Date.toISOString() returns in UTC/GMT.
  return new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, -5)
    .replace("T", "_")
    .replace(/:/g, ".");
};

/**
 * The saved-sites lists as they go into a backup file: everything except
 * the Private list (#468). That list holds sites kept during a private
 * session and is erased when the session ends, so a backup must not carry
 * that trail either. Importing an old file that has one still works; its
 * rules are erased at the next session end or browser start.
 */
export const listsForExport = (
  lists: StoreIdToExpressionList
): StoreIdToExpressionList =>
  Object.fromEntries(
    Object.entries(lists).filter(([storeId]) => storeId !== "private")
  );

/**
 * Dynamically generate data to be downloaded and executes the download.
 * https://stackoverflow.com/questions/19721439/download-json-object-as-a-file-from-browser
 */
export const downloadObjectAsJSON = (
  exportObj: Record<string, unknown>,
  exportName = "ExportedData"
): Record<string, boolean | null | string> => {
  const dataHref = `data:text/json;charset=urf-8,${encodeURIComponent(
    JSON.stringify(exportObj, null, 2)
  )}`;
  const downloadNode = document.createElement("a");
  downloadNode.setAttribute("href", dataHref);
  downloadNode.setAttribute(
    "download",
    `CAD_${exportName}_${appendDynamicTimestamp()}.json`
  );
  downloadNode.setAttribute("target", "_blank");
  document.body.appendChild(downloadNode);
  downloadNode.click();
  downloadNode.remove();
  return {
    status: true,
    downloadHref: downloadNode.getAttribute("href"),
    downloadName: downloadNode.getAttribute("download"),
  };
};
