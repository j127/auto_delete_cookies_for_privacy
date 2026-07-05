const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  entry: {
    background: `${__dirname}/src/background.ts`,
    popup: `${__dirname}/src/ui/popup/index.tsx`,
    setting: `${__dirname}/src/ui/settings/index.tsx`,
  },
  output: {
    path: `${__dirname}/extension/bundles`,
    filename: `[name].bundle.js`,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            // options: {
            //   // this will disable any type checking
            //   transpileOnly: true,
            // },
          },
        ],
      },
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
    ],
  },
  plugins: [
    new webpack.BannerPlugin(`
      Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
      Fork: Auto-Delete Cookies for Privacy, Copyright (c) 2026 j127 (https://github.com/j127/autodelete_cookies_for_privacy)
      Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)

      THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
      IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
      FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
      AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
      LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
      OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
      SOFTWARE.

    `),
    // new BundleAnalyzerPlugin({
    //   analyzerMode: 'static',
    // }),
    new CopyPlugin({
      patterns: [
        {
          force: true,
          from: "bootstrap/dist/css/bootstrap.min.css*",
          to: "../../extension/global_files/[name][ext]",
          context: `${__dirname}/node_modules`,
        },
        {
          force: true,
          from: "bootstrap/dist/js/bootstrap.bundle.min.js*",
          to: "../../extension/global_files/[name][ext]",
          context: `${__dirname}/node_modules`,
        },
        {
          force: true,
          from: "jquery/dist/jquery.slim.min*",
          to: "../../extension/global_files/[name][ext]",
          context: `${__dirname}/node_modules`,
        },
        // webextension-polyfill is no longer copied as a page script; it is
        // bundled via src/init-globals.ts so the service worker gets it too.
      ],
    }),
  ],
  resolve: {
    extensions: [".mjs", ".tsx", ".ts", ".js", ".json", ".png"],
  },
  optimization: {
    splitChunks: {
      automaticNameDelimiter: "-",
      // The MV3 service worker must be a single classic script: it cannot
      // load sibling chunk files the way HTML pages can, so the background
      // entry is excluded from chunk splitting entirely.
      chunks: (chunk) => chunk.name !== "background",
      cacheGroups: {
        ui: {
          test: /[\\/]node_modules[\\/](react|react-dom|@fortawesome)[\\/]|[\\/]src[\\/]ui[\\/]/,
          // Stable file name: the two HTML pages hand-list their script tags,
          // so numeric chunk ids would silently break on dependency changes.
          name: "ui",
          priority: -10,
        },
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          // Stable name (default would be a numeric chunk id) because the
          // HTML pages hand-list their script tags.
          name: "vendors",
          priority: -10,
          reuseExistingChunk: true,
        },
        common: {
          chunks: (chunk) => chunk.name !== "background",
          // cacheGroupKey here is `common` as key of cacheGroup
          name: (module, chunks, cacheGroupKey) => {
            return [cacheGroupKey, chunks.map((c) => c.runtime).join("-")].join(
              "-"
            );
          },
          // Alternate version of above results, only if output.filename stays as [name].bundle.js
          // filename: (pathData) => {
          //   return `common-${
          //     pathData.runtime.size > 1
          //       ? Array.from(pathData.runtime).join('-')
          //       : pathData.runtime
          //   }.bundle.js`;
          // },
          priority: -15,
        },
        default: {
          minChunks: 2,
          // Stable name for the same hand-listed-script-tag reason as "ui".
          name: "shared",
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
