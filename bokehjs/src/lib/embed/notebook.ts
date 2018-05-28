import {Document} from "../document"
import {Receiver} from "../protocol/receiver"
import {logger} from "../core/logging"
import {size, values} from "../core/util/object"

import {add_document_standalone} from "./standalone"
import {DocsJson, RenderItem} from "./json"
import {_get_element} from "./dom"

export const kernels: {[key: string]: Kernel} = {}

function _handle_notebook_comms(this: Document, receiver: Receiver, comm_msg: CommMessage): void {
  if (comm_msg.buffers.length > 0)
    receiver.consume(comm_msg.buffers[0].buffer)
  else
    receiver.consume(comm_msg.content.data)

  const msg = receiver.message
  if (msg != null)
    this.apply_json_patch(msg.content, msg.buffers)
}

function _init_comms(target: string, doc: Document): void {
  if (typeof Jupyter !== 'undefined' && Jupyter.notebook.kernel != null) {
    logger.info(`Registering Jupyter comms for target ${target}`)
    const comm_manager = Jupyter.notebook.kernel.comm_manager
    try {
      comm_manager.register_target(target, (comm: Comm) => {
        logger.info(`Registering Jupyter comms for target ${target}`)
        const r = new Receiver()
        comm.on_msg(_handle_notebook_comms.bind(doc, r))
      })
    } catch (e) {
      logger.warn(`Jupyter comms failed to register. push_notebook() will not function. (exception reported: ${e})`)
    }
  } else if (doc.roots()[0].id in kernels) {
    logger.info(`Registering JupyterLab comms for target ${target}`)
    const kernel = kernels[doc.roots()[0].id]
    try {
      kernel.registerCommTarget(target, (comm: Comm) => {
        logger.info(`Registering JupyterLab comms for target ${target}`)
        const r = new Receiver()
        comm.onMsg = _handle_notebook_comms.bind(doc, r)
      })
    } catch (e) {
      logger.warn(`Jupyter comms failed to register. push_notebook() will not function. (exception reported: ${e})`)
    }
  } else {
    console.warn(`Jupyter notebooks comms not available. push_notebook() will not function. If running JupyterLab ensure the latest jupyterlab_bokeh extension is installed. In an exported notebook this warning is expected.`);
  }
}

export function embed_items_notebook(docs_json: DocsJson, render_items: RenderItem[]): void {
  if (size(docs_json) != 1)
    throw new Error("embed_items_notebook expects exactly one document in docs_json")

  const document = Document.from_json(values(docs_json)[0])

  for (const item of render_items) {
    if (item.notebook_comms_target != null)
      _init_comms(item.notebook_comms_target, document)

    const element = _get_element(item)

    const roots: {[key: string]: HTMLElement} = {}
    for (const root_id in item.roots || {})
      roots[root_id] = _get_element(item, root_id)

    add_document_standalone(document, element, roots)
  }
}