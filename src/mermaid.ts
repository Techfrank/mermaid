/**
 * Web page integration module for the mermaid framework. It uses the mermaidAPI for mermaid
 * functionality and to render the diagrams to svg code.
 */
import { MermaidConfig } from 'types/config';
import { log } from './logger';
import mermaidAPI from './mermaidAPI';
import utils from './utils';

/**
 * ## init
 *
 * Function that goes through the document to find the chart definitions in there and render them.
 *
 * The function tags the processed attributes with the attribute data-processed and ignores found
 * elements with the attribute already set. This way the init function can be triggered several times.
 *
 * Optionally, `init` can accept in the second argument one of the following:
 *
 * - A DOM Node
 * - An array of DOM nodes (as would come from a jQuery selector)
 * - A W3C selector, a la `.mermaid`
 *
 * ```mermaid
 * graph LR;
 *  a(Find elements)-->b{Processed}
 *  b-->|Yes|c(Leave element)
 *  b-->|No |d(Transform)
 * ```
 *
 * Renders the mermaid diagrams
 */
const init = function (
  config?: MermaidConfig,
  nodes?: string | HTMLElement | NodeListOf<HTMLElement>,
  callback?: Function
) {
  try {
    initThrowsErrors(config, nodes, callback);
  } catch (e) {
    log.warn('Syntax Error rendering');
    // @ts-ignore
    log.warn(e.str);
    if (mermaid.parseError) {
      // @ts-ignore
      mermaid.parseError(e);
    }
  }
};

const initThrowsErrors = function (
  config?: MermaidConfig,
  nodes?: string | HTMLElement | NodeListOf<HTMLElement>,
  callback?: Function
) {
  const conf = mermaidAPI.getConfig();
  // console.log('Starting rendering diagrams (init) - mermaid.init', conf);
  if (config) {
    // @ts-ignore
    mermaid.sequenceConfig = config;
  }

  // if last argument is a function this is the callback function

  if (!callback && typeof conf?.mermaid?.callback === 'function') {
    callback = conf.mermaid.callback;
  }
  log.debug(`${!callback ? 'No ' : ''}Callback function found`);
  let nodesToProcess: NodeListOf<HTMLElement>;
  if (typeof nodes === 'undefined') {
    nodesToProcess = document.querySelectorAll('.mermaid');
  } else if (typeof nodes === 'string') {
    nodesToProcess = document.querySelectorAll(nodes);
  } else if (nodes instanceof HTMLElement) {
    nodesToProcess = new NodeList() as NodeListOf<HTMLElement>;
    nodesToProcess[0] = nodes;
  } else if (nodes instanceof NodeList) {
    nodesToProcess = nodes;
  } else {
    throw new Error('Invalid argument nodes for mermaid.init');
  }

  log.debug(`Found ${nodesToProcess.length} diagrams`);
  if (typeof config?.startOnLoad !== 'undefined') {
    log.debug('Start On Load: ' + config?.startOnLoad);
    mermaidAPI.updateSiteConfig({ startOnLoad: config?.startOnLoad });
  }

  const idGenerator = new utils.initIdGenerator(conf.deterministicIds, conf.deterministicIDSeed);

  let txt;

  // element is the current div with mermaid class
  for (const element of Array.from(nodesToProcess)) {
    /*! Check if previously processed */
    if (element.getAttribute('data-processed')) {
      continue;
    }
    element.setAttribute('data-processed', 'true');

    const id = `mermaid-${idGenerator.next()}`;

    // Fetch the graph definition including tags
    txt = element.innerHTML;

    // transforms the html to pure text
    txt = utils
      .entityDecode(txt)
      .trim()
      .replace(/<br\s*\/?>/gi, '<br/>');

    const init = utils.detectInit(txt);
    if (init) {
      log.debug('Detected early reinit: ', init);
    }
    try {
      mermaidAPI.render(
        id,
        txt,
        (svgCode: string, bindFunctions: (el: HTMLElement) => void) => {
          element.innerHTML = svgCode;
          if (typeof callback !== 'undefined') {
            callback(id);
          }
          if (bindFunctions) bindFunctions(element);
        },
        element
      );
    } catch (error) {
      log.warn('Catching Error (bootstrap)');
      // @ts-ignore
      // TODO: We should be throwing an error object.
      throw { error, message: error.str };
    }
  }
};

const initialize = function (config: MermaidConfig) {
  mermaidAPI.initialize(config);
};

/**
 * ##contentLoaded Callback function that is called when page is loaded. This functions fetches
 * configuration for mermaid rendering and calls init for rendering the mermaid diagrams on the page.
 */
const contentLoaded = function () {
  const { startOnLoad } = mermaidAPI.getConfig();
  if (startOnLoad) {
    mermaid.init();
  }
};

if (typeof document !== 'undefined') {
  /*!
   * Wait for document loaded before starting the execution
   */
  window.addEventListener(
    'load',
    function () {
      contentLoaded();
    },
    false
  );
}

/**
 * ## setParseErrorHandler  Alternative to directly setting parseError using:
 *
 * ```js
 * mermaid.parseError = function(err,hash){=
 *   forExampleDisplayErrorInGui(err);  // do something with the error
 * };
 * ```
 *
 * This is provided for environments where the mermaid object can't directly have a new member added
 * to it (eg. dart interop wrapper). (Initially there is no parseError member of mermaid).
 *
 * @param {function (err, hash)} newParseErrorHandler New parseError() callback.
 */
const setParseErrorHandler = function (newParseErrorHandler: (err: any, hash: any) => void) {
  // @ts-ignore
  mermaid.parseError = newParseErrorHandler;
};

const mermaid = {
  diagrams: {},
  mermaidAPI,
  parse: mermaidAPI != undefined ? mermaidAPI.parse : null,
  render: mermaidAPI != undefined ? mermaidAPI.render : null,

  init,
  initThrowsErrors,
  initialize,
  parseError: undefined,
  contentLoaded,

  setParseErrorHandler,
};

export default mermaid;
